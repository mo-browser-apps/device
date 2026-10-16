#include "hardware_service.h"

#include <algorithm>
#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <cstdio>
#include <deque>
#include <functional>
#include <map>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <utility>

#include "gen/devices.rpc.h"
#include "gen/events.rpc.h"
#include "hidpp_mouse.h"
#include "platform/platform.h"
#include "rpc.h"
#include "via_keyboard.h"

using google::protobuf::Empty;
using mo::rpc::Callback;

namespace {

constexpr auto kScanInterval = std::chrono::seconds(1);
constexpr auto kSilentInterfaceRetry = std::chrono::seconds(30);
// How often mice are looked for and their batteries read.
constexpr auto kMouseScanInterval = std::chrono::seconds(3);

// The open devices. Only the hardware thread touches them, so no HID handle is ever
// used by two threads at once.
struct Hardware {
  struct Keyboard {
    std::shared_ptr<ViaKeyboard> keyboard;
    ViaKeyboard::Lighting lighting;
  };
  struct Mouse {
    std::shared_ptr<HidppMouse> mouse;
    HidppMouse::Battery battery;
    int dpi;
  };

  ViaScanner keyboard_scanner{kSilentInterfaceRetry};
  HidppScanner mouse_scanner{kMouseScanInterval};
  // By connection ID. IDs are never reused, so a stale one finds nothing.
  std::map<uint32_t, Keyboard> keyboards;
  std::map<uint32_t, Mouse> mice;
  uint32_t next_id = 1;
};

// RPC work waiting for the hardware thread, which runs it between scans.
struct Queue {
  using Task = std::function<void(Hardware&)>;
  std::mutex mutex;
  std::condition_variable wake;
  std::deque<Task> tasks;

  void Post(Task task) {
    {
      std::lock_guard lock(mutex);
      tasks.push_back(std::move(task));
    }
    wake.notify_one();
  }
};

// Callback is move-only and std::function needs a copyable target, hence the shared_ptr.
template <typename T>
std::shared_ptr<Callback<T>> Share(Callback<T> done) {
  return std::make_shared<Callback<T>>(std::move(done));
}

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

ConnectedDevices Snapshot(const Hardware& hardware) {
  ConnectedDevices snapshot;
  for (const auto& [id, connection] : hardware.keyboards) {
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
  for (const auto& [id, connection] : hardware.mice) {
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

void Publish(const Hardware& hardware) {
  mo::rpc::hardware_events.Changed(Snapshot(hardware), [](mo::rpc::Result<Empty>) {});
}

// Hands every request to the hardware thread, so each returns at once.
class HardwareServiceImpl : public HardwareService {
 public:
  explicit HardwareServiceImpl(std::shared_ptr<Queue> queue) : queue_(std::move(queue)) {}

  void List(const Empty*, Callback<ConnectedDevices> done) override {
    queue_->Post([done = Share(std::move(done))](Hardware& hardware) {
      std::move(*done).Complete(Snapshot(hardware));
    });
  }

  void ApplyLighting(const LightingRequest* request, Callback<Empty> done) override {
    const uint32_t id = request->connection_id();
    const ViaKeyboard::Lighting lighting = FromProto(request->lighting());
    queue_->Post([id, lighting, done = Share(std::move(done))](Hardware& hardware) {
      auto live = hardware.keyboards.find(id);
      if (live == hardware.keyboards.end()) {
        std::move(*done).Reject("Keyboard is not connected: " + std::to_string(id));
        return;
      }
      if (!live->second.keyboard->WriteLighting(lighting)) {
        // Most likely unplugged; the next scan reopens it under a new ID if it is still
        // there.
        hardware.keyboards.erase(live);
        Publish(hardware);
        std::move(*done).Reject("Cannot write lighting to keyboard: " + std::to_string(id));
        return;
      }
      live->second.lighting = lighting;
      std::move(*done).Complete(Empty());
    });
  }

  void ApplyDpi(const DpiRequest* request, Callback<Empty> done) override {
    const uint32_t id = request->connection_id();
    const int requested = request->dpi();
    queue_->Post([id, requested, done = Share(std::move(done))](Hardware& hardware) {
      auto live = hardware.mice.find(id);
      if (live == hardware.mice.end()) {
        std::move(*done).Reject("Mouse is not connected: " + std::to_string(id));
        return;
      }
      const HidppMouse& mouse = *live->second.mouse;
      const int dpi = std::clamp(requested, mouse.min_dpi(), mouse.max_dpi());
      if (!live->second.mouse->WriteDpi(dpi)) {
        // Most likely asleep; the next scan finds it again under a new ID once it wakes
        // up.
        hardware.mice.erase(live);
        Publish(hardware);
        std::move(*done).Reject("Cannot set mouse DPI: " + std::to_string(id));
        return;
      }
      live->second.dpi = dpi;
      std::move(*done).Complete(Empty());
    });
  }

 private:
  std::shared_ptr<Queue> queue_;
};

// Applies one mouse scan; true if anything the snapshot shows changed.
bool UpdateMice(Hardware& hardware, const std::vector<HidppScanner::Found>& found) {
  bool changed = std::erase_if(hardware.mice, [&](const auto& live) {
    return std::none_of(found.begin(), found.end(), [&](const HidppScanner::Found& mouse) {
      return mouse.mouse == live.second.mouse;
    });
  });
  for (const HidppScanner::Found& mouse : found) {
    auto live = std::find_if(hardware.mice.begin(), hardware.mice.end(),
                             [&](const auto& live) { return live.second.mouse == mouse.mouse; });
    if (live == hardware.mice.end()) {
      hardware.mice[hardware.next_id++] = {mouse.mouse, mouse.battery, mouse.dpi.value_or(0)};
      changed = true;
    } else if (live->second.battery.percent != mouse.battery.percent ||
               live->second.battery.charging != mouse.battery.charging) {
      live->second.battery = mouse.battery;
      changed = true;
    }
  }
  return changed;
}

// Opens devices that were plugged in, drops the ones that went, and publishes the change.
void Scan(Hardware& hardware) {
  ViaScanner::Changes changes = hardware.keyboard_scanner.Scan();
  bool changed = !changes.added.empty() || !changes.removed.empty();
  for (const std::shared_ptr<ViaKeyboard>& keyboard : changes.removed) {
    std::erase_if(hardware.keyboards,
                  [&](const auto& live) { return live.second.keyboard == keyboard; });
  }
  for (ViaScanner::Added& added : changes.added) {
    hardware.keyboards[hardware.next_id++] = {std::move(added.keyboard), added.lighting};
  }
  std::optional<std::vector<HidppScanner::Found>> found = hardware.mouse_scanner.Scan();
  if (found && UpdateMice(hardware, *found)) changed = true;
  if (changed) Publish(hardware);
}

}  // namespace

void StartHardwareService() {
  auto queue = std::make_shared<Queue>();
  mo::rpc::RegisterService(new HardwareServiceImpl(queue));

  // Never stopped or joined: it keeps the queue alive until the app exits.
  std::thread([queue] {
    Hardware hardware;
    // Without HID, scans find nothing, and requests are still answered.
    if (!InitHid()) std::fputs("Could not initialize HIDAPI.\n", stderr);
    auto next_scan = std::chrono::steady_clock::now();
    while (true) {
      std::deque<Queue::Task> tasks;
      {
        std::unique_lock lock(queue->mutex);
        queue->wake.wait_until(lock, next_scan, [&] { return !queue->tasks.empty(); });
        tasks.swap(queue->tasks);
      }
      for (Queue::Task& task : tasks) task(hardware);
      // ponytail: a write waits behind a scan that is probing a silent device (up to a
      // few reply timeouts); move probing to its own thread if that lag shows.
      if (std::chrono::steady_clock::now() >= next_scan) {
        Scan(hardware);
        next_scan = std::chrono::steady_clock::now() + kScanInterval;
      }
    }
  }).detach();
}
