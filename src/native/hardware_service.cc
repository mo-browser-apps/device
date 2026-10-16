#include "hardware_service.h"

#include <algorithm>
#include <chrono>
#include <cstdint>
#include <map>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <utility>

#include "gen/devices.rpc.h"
#include "gen/events.rpc.h"
#include "hidpp_mouse.h"
#include "rpc.h"
#include "via_keyboard.h"

using google::protobuf::Empty;
using mo::rpc::Callback;

namespace {

constexpr auto kScanInterval = std::chrono::seconds(1);
constexpr auto kSilentInterfaceRetry = std::chrono::seconds(30);
// How often mice are looked for and their batteries read.
constexpr auto kMouseScanInterval = std::chrono::seconds(3);

// The open devices, shared by RPC calls, the scanning thread, and write threads.
struct Session {
  struct Keyboard {
    std::shared_ptr<ViaKeyboard> keyboard;
    ViaKeyboard::Lighting lighting;
  };
  struct Mouse {
    std::shared_ptr<HidppMouse> mouse;
    HidppMouse::Battery battery;
    int dpi;
  };

  // Guards every member below. HID I/O never happens while it is held.
  std::mutex mutex;
  // By connection ID. IDs are never reused, so a stale one finds nothing.
  std::map<uint32_t, Keyboard> keyboards;
  std::map<uint32_t, Mouse> mice;
  uint32_t next_id = 1;
};

RawLighting ToProto(const ViaKeyboard::Lighting& lighting) {
  RawLighting result;
  result.set_effect(lighting.effect);
  result.set_hue(lighting.hue);
  result.set_saturation(lighting.saturation);
  result.set_brightness(lighting.brightness);
  return result;
}

// The main process sends VIA values already, but a byte must never wrap around.
ViaKeyboard::Lighting FromProto(const RawLighting& lighting) {
  auto byte = [](int value) { return std::clamp(value, 0, 255); };
  return {
      .effect = byte(lighting.effect()),
      .hue = byte(lighting.hue()),
      .saturation = byte(lighting.saturation()),
      .brightness = byte(lighting.brightness()),
  };
}

// Requires session.mutex to be held.
ConnectedDevices SnapshotLocked(const Session& session) {
  ConnectedDevices snapshot;
  for (const auto& [id, connection] : session.keyboards) {
    const ViaKeyboard& keyboard = *connection.keyboard;
    ConnectedKeyboard* entry = snapshot.add_keyboards();
    entry->set_connection_id(id);
    entry->set_vendor_id(keyboard.hardware().vendor_id);
    entry->set_product_id(keyboard.hardware().product_id);
    entry->set_product_name(keyboard.hardware().product_name);
    entry->set_bus(keyboard.hardware().bluetooth ? BUS_BLUETOOTH : BUS_CABLE);
    entry->set_protocol_version(keyboard.protocol_version());
    entry->set_has_color(keyboard.has_color());
    entry->set_has_effect(keyboard.has_effect());
    *entry->mutable_lighting() = ToProto(connection.lighting);
  }
  for (const auto& [id, connection] : session.mice) {
    ConnectedMouse* entry = snapshot.add_mice();
    entry->set_connection_id(id);
    entry->set_name(connection.mouse->name());
    entry->set_protocol(connection.mouse->protocol());
    entry->set_battery(connection.battery.percent);
    entry->set_charging(connection.battery.charging);
    entry->set_dpi(connection.dpi);
    entry->set_min_dpi(connection.mouse->min_dpi());
    entry->set_max_dpi(connection.mouse->max_dpi());
  }
  return snapshot;
}

// Requires session.mutex to be held, so that snapshots from different threads arrive
// in order.
void PublishLocked(const Session& session) {
  mo::rpc::hardware_events.Changed(SnapshotLocked(session), [](mo::rpc::Result<Empty>) {});
}

// Completes an RPC once a write finishes. Callback is move-only and std::function needs
// a copyable target, hence the shared_ptr.
std::function<void(bool)> CompleteWhenWritten(Callback<Empty> done, std::string error) {
  auto shared_done = std::make_shared<Callback<Empty>>(std::move(done));
  return [shared_done, error = std::move(error)](bool ok) {
    if (ok) {
      std::move(*shared_done).Complete(Empty());
    } else {
      std::move(*shared_done).Reject(error);
    }
  };
}

class HardwareServiceImpl : public HardwareService {
 public:
  explicit HardwareServiceImpl(std::shared_ptr<Session> session)
      : session_(std::move(session)) {}

  void List(const Empty*, Callback<ConnectedDevices> done) override {
    ConnectedDevices snapshot;
    {
      std::lock_guard lock(session_->mutex);
      snapshot = SnapshotLocked(*session_);
    }
    std::move(done).Complete(std::move(snapshot));
  }

  void ApplyLighting(const LightingRequest* request, Callback<Empty> done) override {
    const uint32_t id = request->connection_id();
    const ViaKeyboard::Lighting lighting = FromProto(request->lighting());
    std::shared_ptr<ViaKeyboard> keyboard;
    {
      std::lock_guard lock(session_->mutex);
      auto live = session_->keyboards.find(id);
      if (live != session_->keyboards.end()) keyboard = live->second.keyboard;
    }
    if (!keyboard) {
      std::move(done).Reject("Keyboard is not connected: " + std::to_string(id));
      return;
    }

    auto complete = CompleteWhenWritten(
        std::move(done), "Cannot write lighting to keyboard: " + std::to_string(id));
    // The write runs on the keyboard's own thread, so this request returns at once.
    keyboard->WriteLightingAsync(lighting, [session = session_, id, lighting,
                                            complete](bool ok) {
      {
        std::lock_guard lock(session->mutex);
        auto live = session->keyboards.find(id);
        if (live != session->keyboards.end()) {
          if (ok) {
            live->second.lighting = lighting;
          } else {
            // Most likely unplugged; the next scan reopens it under a new ID if it is
            // still there.
            session->keyboards.erase(live);
            PublishLocked(*session);
          }
        }
      }
      complete(ok);
    });
  }

  void ApplyDpi(const DpiRequest* request, Callback<Empty> done) override {
    const uint32_t id = request->connection_id();
    std::shared_ptr<HidppMouse> mouse;
    {
      std::lock_guard lock(session_->mutex);
      auto live = session_->mice.find(id);
      if (live != session_->mice.end()) mouse = live->second.mouse;
    }
    if (!mouse) {
      std::move(done).Reject("Mouse is not connected: " + std::to_string(id));
      return;
    }

    const int dpi = std::clamp(request->dpi(), mouse->min_dpi(), mouse->max_dpi());
    auto complete =
        CompleteWhenWritten(std::move(done), "Cannot set mouse DPI: " + std::to_string(id));
    mouse->WriteDpiAsync(dpi, [session = session_, id, dpi, complete](bool ok) {
      {
        std::lock_guard lock(session->mutex);
        auto live = session->mice.find(id);
        if (live != session->mice.end()) {
          if (ok) {
            live->second.dpi = dpi;
          } else {
            // Most likely asleep; the next scan finds it again under a new ID once it
            // wakes up.
            session->mice.erase(live);
            PublishLocked(*session);
          }
        }
      }
      complete(ok);
    });
  }

 private:
  std::shared_ptr<Session> session_;
};

// Applies one mouse scan to the session; true if anything the snapshot shows changed.
// Requires session.mutex to be held.
bool UpdateMiceLocked(Session& session, const std::vector<HidppScanner::Found>& found) {
  bool changed = std::erase_if(session.mice, [&](const auto& live) {
    return std::none_of(found.begin(), found.end(), [&](const HidppScanner::Found& mouse) {
      return mouse.mouse == live.second.mouse;
    });
  });
  for (const HidppScanner::Found& mouse : found) {
    auto live = std::find_if(session.mice.begin(), session.mice.end(),
                             [&](const auto& live) { return live.second.mouse == mouse.mouse; });
    if (live == session.mice.end()) {
      session.mice[session.next_id++] = {mouse.mouse, mouse.battery, mouse.dpi.value_or(0)};
      changed = true;
    } else if (live->second.battery.percent != mouse.battery.percent ||
               live->second.battery.charging != mouse.battery.charging) {
      live->second.battery = mouse.battery;
      changed = true;
    }
  }
  return changed;
}

}  // namespace

void StartHardwareService() {
  auto session = std::make_shared<Session>();
  mo::rpc::RegisterService(new HardwareServiceImpl(session));

  // Never stopped or joined: it keeps the session alive until the app exits.
  std::thread([session] {
    ViaScanner keyboards(kSilentInterfaceRetry);
    HidppScanner mice(kMouseScanInterval);
    while (true) {
      // Opening a new device happens here, outside the lock, so it delays no request.
      ViaScanner::Changes changes = keyboards.Scan();
      std::optional<std::vector<HidppScanner::Found>> found = mice.Scan();
      {
        std::lock_guard lock(session->mutex);
        bool changed = !changes.added.empty() || !changes.removed.empty();
        for (const std::shared_ptr<ViaKeyboard>& keyboard : changes.removed) {
          std::erase_if(session->keyboards, [&](const auto& live) {
            return live.second.keyboard == keyboard;
          });
        }
        for (ViaScanner::Added& added : changes.added) {
          session->keyboards[session->next_id++] = {std::move(added.keyboard), added.lighting};
        }
        if (found && UpdateMiceLocked(*session, *found)) changed = true;
        if (changed) PublishLocked(*session);
      }
      std::this_thread::sleep_for(kScanInterval);
    }
  }).detach();
}
