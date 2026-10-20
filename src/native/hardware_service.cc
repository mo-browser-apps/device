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

#include "chroma_device.h"
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
// How often the Chroma SDK is tried again while it is missing or not running.
constexpr auto kChromaSdkRetry = std::chrono::seconds(30);

// Razer green, as VIA values: what a Chroma device is assumed to show before the first
// write, since the SDK cannot read it.
constexpr ViaKeyboard::Lighting kChromaDefault = {
    .effect = 1, .hue = 85, .saturation = 255, .brightness = 255};

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
  ChromaScanner chroma_scanner{kChromaSdkRetry};
  // By connection ID. IDs are never reused, so a stale one finds nothing.
  std::map<uint32_t, Keyboard> keyboards;
  std::map<uint32_t, Mouse> mice;
  std::map<uint32_t, ChromaDevice> chroma_devices;
  // The Chroma SDK lights every Razer keyboard, or every mouse, as one: the color last
  // written to each kind.
  ViaKeyboard::Lighting chroma_keyboards = kChromaDefault;
  ViaKeyboard::Lighting chroma_mice = kChromaDefault;
  uint32_t next_id = 1;

  ViaKeyboard::Lighting& chroma_lighting(ChromaDeviceKind kind) {
    return kind == ChromaDeviceKind::kKeyboard ? chroma_keyboards : chroma_mice;
  }
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

struct Rgb {
  uint8_t red;
  uint8_t green;
  uint8_t blue;
};

// The solid color a Chroma device shows for VIA values: the hue and saturation, dimmed
// by the brightness. An effect of 0 is off, like no brightness.
Rgb ToRgb(const ViaKeyboard::Lighting& lighting) {
  if (lighting.effect == 0) return {0, 0, 0};
  const double hue = lighting.hue * 6.0 / 256.0;  // Sector 0 to 6 around the wheel.
  const double saturation = lighting.saturation / 255.0;
  const double value = lighting.brightness / 255.0;
  const int sector = static_cast<int>(hue);
  const double fraction = hue - sector;
  const double low = value * (1 - saturation);
  const double falling = value * (1 - saturation * fraction);
  const double rising = value * (1 - saturation * (1 - fraction));
  double red = value, green = low, blue = falling;
  switch (sector) {
    case 0: red = value, green = rising, blue = low; break;
    case 1: red = falling, green = value, blue = low; break;
    case 2: red = low, green = value, blue = rising; break;
    case 3: red = low, green = falling, blue = value; break;
    case 4: red = rising, green = low, blue = value; break;
    default: break;
  }
  auto byte = [](double channel) { return static_cast<uint8_t>(channel * 255 + 0.5); };
  return {byte(red), byte(green), byte(blue)};
}

ConnectedDevices Snapshot(Hardware& hardware) {
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
  for (const auto& [id, device] : hardware.chroma_devices) {
    ConnectedChromaDevice* entry = snapshot.add_chroma_devices();
    entry->set_connection_id(id);
    entry->set_kind(device.kind == ChromaDeviceKind::kKeyboard ? CHROMA_KEYBOARD : CHROMA_MOUSE);
    entry->set_vendor_id(device.vendor_id);
    entry->set_product_id(device.product_id);
    entry->set_product_name(device.product_name);
    *entry->mutable_lighting() = ToProto(hardware.chroma_lighting(device.kind));
  }
  return snapshot;
}

void Publish(Hardware& hardware) {
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
      if (auto chroma = hardware.chroma_devices.find(id);
          chroma != hardware.chroma_devices.end()) {
        const ChromaDeviceKind kind = chroma->second.kind;
        const Rgb color = ToRgb(lighting);
        if (!SetChromaColor(kind, color.red, color.green, color.blue)) {
          std::move(*done).Reject("Cannot set the color of Chroma device: " +
                                  std::to_string(id));
          return;
        }
        hardware.chroma_lighting(kind) = lighting;
        std::move(*done).Complete(Empty());
        return;
      }
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

// Applies one Chroma scan; true if a Razer device came or went.
bool UpdateChromaDevices(Hardware& hardware, const std::vector<ChromaDevice>& found) {
  bool changed = std::erase_if(hardware.chroma_devices, [&](const auto& live) {
    return std::none_of(found.begin(), found.end(), [&](const ChromaDevice& device) {
      return device.path == live.second.path;
    });
  });
  for (const ChromaDevice& device : found) {
    const bool known =
        std::any_of(hardware.chroma_devices.begin(), hardware.chroma_devices.end(),
                    [&](const auto& live) { return live.second.path == device.path; });
    if (known) continue;
    hardware.chroma_devices[hardware.next_id++] = device;
    changed = true;
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
  if (UpdateChromaDevices(hardware, hardware.chroma_scanner.Scan())) changed = true;
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
