#include "via_service.h"

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
#include "rpc.h"
#include "via_keyboard.h"

using google::protobuf::Empty;
using mo::rpc::Callback;

namespace {

constexpr auto kScanInterval = std::chrono::seconds(1);
constexpr auto kSilentInterfaceRetry = std::chrono::seconds(30);

// The open keyboards, shared by RPC calls, the scanning thread, and write threads.
struct Session {
  struct Connection {
    std::shared_ptr<ViaKeyboard> keyboard;
    ViaKeyboard::Lighting lighting;
  };

  // Guards every member below. HID I/O never happens while it is held.
  std::mutex mutex;
  // By connection ID. IDs are never reused, so a stale one finds nothing.
  std::map<uint32_t, Connection> live;
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
ConnectedKeyboards SnapshotLocked(const Session& session) {
  ConnectedKeyboards snapshot;
  for (const auto& [id, connection] : session.live) {
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
  return snapshot;
}

// Requires session.mutex to be held, so that snapshots from different threads arrive
// in order.
void PublishLocked(const Session& session) {
  mo::rpc::via_events.Changed(SnapshotLocked(session), [](mo::rpc::Result<Empty>) {});
}

class ViaServiceImpl : public ViaService {
 public:
  explicit ViaServiceImpl(std::shared_ptr<Session> session) : session_(std::move(session)) {}

  void List(const Empty*, Callback<ConnectedKeyboards> done) override {
    ConnectedKeyboards snapshot;
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
      auto live = session_->live.find(id);
      if (live != session_->live.end()) keyboard = live->second.keyboard;
    }
    if (!keyboard) {
      std::move(done).Reject("Keyboard is not connected: " + std::to_string(id));
      return;
    }

    // Callback is move-only and std::function needs a copyable target.
    auto shared_done = std::make_shared<Callback<Empty>>(std::move(done));
    // The write runs on the keyboard's own thread, so this request returns at once.
    keyboard->WriteLightingAsync(lighting, [session = session_, id, lighting,
                                            shared_done](bool ok) {
      {
        std::lock_guard lock(session->mutex);
        auto live = session->live.find(id);
        if (live != session->live.end()) {
          if (ok) {
            live->second.lighting = lighting;
          } else {
            // Most likely unplugged; the next scan reopens it under a new ID if it is
            // still there.
            session->live.erase(live);
            PublishLocked(*session);
          }
        }
      }
      if (ok) {
        std::move(*shared_done).Complete(Empty());
      } else {
        std::move(*shared_done).Reject("Cannot write lighting to keyboard: " +
                                       std::to_string(id));
      }
    });
  }

 private:
  std::shared_ptr<Session> session_;
};

}  // namespace

void StartViaService() {
  auto session = std::make_shared<Session>();
  mo::rpc::RegisterService(new ViaServiceImpl(session));

  // Never stopped or joined: it keeps the session alive until the app exits.
  std::thread([session] {
    ViaScanner scanner(kSilentInterfaceRetry);
    while (true) {
      // Opening a new keyboard happens here, outside the lock, so it delays no request.
      ViaScanner::Changes changes = scanner.Scan();
      if (!changes.added.empty() || !changes.removed.empty()) {
        std::lock_guard lock(session->mutex);
        for (const std::shared_ptr<ViaKeyboard>& keyboard : changes.removed) {
          std::erase_if(session->live, [&](const auto& live) {
            return live.second.keyboard == keyboard;
          });
        }
        for (ViaScanner::Added& added : changes.added) {
          session->live[session->next_id++] = {std::move(added.keyboard), added.lighting};
        }
        PublishLocked(*session);
      }
      std::this_thread::sleep_for(kScanInterval);
    }
  }).detach();
}
