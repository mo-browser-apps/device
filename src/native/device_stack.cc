#include "device_stack.h"

#include <algorithm>
#include <string>
#include <thread>
#include <utility>
#include <vector>

namespace {

constexpr auto kScanInterval = std::chrono::seconds(1);
constexpr auto kSilentInterfaceRetry = std::chrono::seconds(30);

struct ButtonSeed {
  std::string control;
  std::string action;
};

struct MouseSeed {
  std::string id;
  std::string model_id;
  std::string model;
  LinkType link;
  std::string firmware;
  int battery;
  bool charging;
  std::vector<ButtonSeed> buttons;
  int min_dpi;
  int max_dpi;
  int dpi;
};

struct DeviceSeed {
  Device device;
  Settings settings;
};

template <class Entries>
auto FindById(Entries& entries, const std::string& device_id) {
  return std::find_if(entries.begin(), entries.end(),
                      [&](const auto& entry) { return entry.device.id() == device_id; });
}

DeviceSeed MakeMouse(const MouseSeed& seed) {
  Device device;
  device.set_id(seed.id);
  device.set_model_id(seed.model_id);
  device.set_model(seed.model);
  device.set_link(seed.link);
  device.set_firmware(seed.firmware);
  device.set_connected(true);
  device.set_has_battery(true);
  device.set_battery(seed.battery);
  device.set_charging(seed.charging);

  MouseSpec* spec = device.mutable_mouse();
  spec->set_min_dpi(seed.min_dpi);
  spec->set_max_dpi(seed.max_dpi);

  Settings settings;
  settings.set_device_id(seed.id);
  MouseSettings* mouse = settings.mutable_mouse();
  mouse->set_dpi(seed.dpi);
  mouse->set_scroll_speed(3);
  mouse->set_natural_scroll(false);

  for (const ButtonSeed& button : seed.buttons) {
    spec->add_buttons(button.control);
    Binding* binding = mouse->add_bindings();
    binding->set_control(button.control);
    binding->set_action(button.action);
  }

  return {std::move(device), std::move(settings)};
}

// The firmware effects every keyboard shares; the rest come from ViaKeyboard::Model.
constexpr int kViaOff = 0;
constexpr int kViaSolid = 1;

// The editor uses hue 0–359° and brightness 0–100%; VIA uses 0–255 for both.
int ToVia(int value, int range) {
  return std::clamp((value * 255 + range / 2) / range, 0, 255);
}

int FromVia(int value, int range) {
  return (value * range + 127) / 255;
}

ViaKeyboard::Lighting ToViaLighting(const KeyboardSettings& keyboard,
                                   const ViaKeyboard::Model& model) {
  int effect = kViaSolid;
  if (keyboard.effect() == BREATHING && model.breathing_effect) effect = model.breathing_effect;
  if (keyboard.effect() == WAVE && model.wave_effect) effect = model.wave_effect;

  return {
      .effect = effect,
      .hue = ToVia(keyboard.hue(), 360),
      // Full saturation keeps hue changes clearly visible.
      .saturation = 255,
      .brightness = ToVia(keyboard.brightness(), 100),
  };
}

DeviceSeed MakeViaKeyboard(const std::string& id,
                           const ViaKeyboard& hid,
                           const ViaKeyboard::Lighting& lighting) {
  Device device;
  device.set_id(id);
  device.set_model_id(hid.model().id);
  device.set_model(hid.model().name);
  switch (hid.model().link) {
    case ViaKeyboard::Link::kCable:
      device.set_link(WIRED);
      break;
    case ViaKeyboard::Link::kReceiver:
      device.set_link(RECEIVER);
      break;
    case ViaKeyboard::Link::kBluetooth:
      device.set_link(BLUETOOTH);
      break;
  }
  device.set_firmware("VIA protocol " + std::to_string(hid.protocol_version()));
  device.set_connected(true);
  device.set_has_battery(false);
  device.set_live(true);
  // Lighting only: key remapping is not implemented for the real keyboard.
  device.mutable_keyboard()->set_backlight(true);
  device.mutable_keyboard()->set_color(hid.has_color());
  device.mutable_keyboard()->add_effects(STATIC);
  if (hid.model().breathing_effect) device.mutable_keyboard()->add_effects(BREATHING);
  if (hid.model().wave_effect) device.mutable_keyboard()->add_effects(WAVE);

  Settings settings;
  settings.set_device_id(device.id());
  KeyboardSettings* keyboard = settings.mutable_keyboard();
  // Firmware effects the editor cannot show are listed as the animated "Wave". When the
  // keyboard has no Wave, no option is selected, and choosing Steady still applies.
  keyboard->set_effect(WAVE);
  // Effect 0 means the backlight is off; it is shown as Steady at zero brightness.
  if (lighting.effect == kViaSolid || lighting.effect == kViaOff) keyboard->set_effect(STATIC);
  const int breathing = hid.model().breathing_effect;
  if (breathing && lighting.effect == breathing) keyboard->set_effect(BREATHING);
  keyboard->set_hue(std::min(FromVia(lighting.hue, 360), 359));
  keyboard->set_brightness(lighting.effect == kViaOff ? 0 : FromVia(lighting.brightness, 100));

  return {std::move(device), std::move(settings)};
}

}  // namespace

DeviceStack::DeviceStack() {
  auto add = [](std::vector<Entry>& paired, DeviceSeed seed) {
    paired.push_back({std::move(seed.device), std::move(seed.settings)});
  };

  add(paired_, MakeMouse({
                    .id = "performance-mouse",
                    .model_id = "performance-mouse",
                    .model = "Performance Mouse",
                    .link = RECEIVER,
                    .firmware = "3.2.1",
                    .battery = 82,
                    .charging = true,
                    .buttons = {{"wheel", "middle-click"},
                                {"back", "back"},
                                {"forward", "forward"},
                                {"gesture", "show-desktop"}},
                    .min_dpi = 400,
                    .max_dpi = 8000,
                    .dpi = 1600,
                }));
  add(paired_, MakeMouse({
                    .id = "travel-mouse",
                    .model_id = "travel-mouse",
                    .model = "Travel Mouse",
                    .link = BLUETOOTH,
                    .firmware = "1.4.0",
                    .battery = 15,
                    .charging = false,
                    .buttons = {{"wheel", "middle-click"}},
                    .min_dpi = 800,
                    .max_dpi = 3200,
                    .dpi = 1200,
                }));

  // A second unit of the same mouse, discoverable so the pairing flow is
  // usable on a fresh launch.
  Entry nearby = paired_.front();
  nearby.device.set_id("performance-mouse-secondary");
  nearby.device.set_link(BLUETOOTH);
  nearby.device.set_battery(68);
  nearby.device.set_charging(false);
  nearby.device.set_connected(false);
  nearby.settings.set_device_id(nearby.device.id());
  available_.push_back(std::move(nearby));
}

void DeviceStack::StartScanning() {
  // Never stopped or joined: the stack lives until the app exits (see main.cc).
  std::thread([this] {
    ViaScanner scanner(kSilentInterfaceRetry);
    while (true) {
      // Probing a new keyboard happens here, outside the lock, so it delays no request.
      ViaScanner::Changes changes = scanner.Scan();
      if (!changes.added.empty() || !changes.removed.empty()) {
        std::lock_guard lock(mutex_);
        for (const std::shared_ptr<ViaKeyboard>& keyboard : changes.removed) {
          DisconnectLocked(keyboard.get());
        }
        for (const ViaScanner::Added& added : changes.added) {
          ConnectLocked(added);
        }
        PublishDevicesChangedLocked();
      }
      std::this_thread::sleep_for(kScanInterval);
    }
  }).detach();
}

void DeviceStack::ConnectLocked(const ViaScanner::Added& added) {
  // A returning keyboard takes the place of the first disconnected unit of its model,
  // so an open device page keeps working. Firmware rarely sets a serial number, so
  // further units of a model are numbered.
  const std::string& model_id = added.keyboard->model().id;
  Entry* entry = nullptr;
  int units = 0;
  for (Entry& candidate : paired_) {
    if (candidate.device.live() && candidate.device.model_id() == model_id) {
      ++units;
      if (!entry && !candidate.device.connected()) entry = &candidate;
    }
  }
  std::string id = entry ? entry->device.id() : model_id;
  if (!entry && units > 0) {
    id += "-" + std::to_string(units + 1);
  }

  // The keyboard restores its own saved lighting when plugged in, so read it again.
  DeviceSeed seed = MakeViaKeyboard(id, *added.keyboard, added.lighting);
  if (entry) {
    entry->device = std::move(seed.device);
    entry->settings = std::move(seed.settings);
  } else {
    paired_.push_back({std::move(seed.device), std::move(seed.settings)});
  }
  live_[id] = added.keyboard;
}

void DeviceStack::DisconnectLocked(const ViaKeyboard* keyboard) {
  for (auto live = live_.begin(); live != live_.end(); ++live) {
    if (live->second.get() == keyboard) {
      FindById(paired_, live->first)->device.set_connected(false);
      live_.erase(live);
      return;
    }
  }
}

DeviceList DeviceStack::List() const {
  std::lock_guard lock(mutex_);
  return ListLocked();
}

DeviceList DeviceStack::ListLocked() const {
  DeviceList list;
  for (const Entry& entry : paired_) {
    *list.add_devices() = entry.device;
  }
  return list;
}

DeviceList DeviceStack::Discover() const {
  std::lock_guard lock(mutex_);
  DeviceList list;
  for (const Entry& entry : available_) {
    *list.add_devices() = entry.device;
  }
  return list;
}

bool DeviceStack::Pair(const std::string& device_id) {
  std::lock_guard lock(mutex_);
  auto entry = FindById(available_, device_id);
  if (entry == available_.end()) {
    return false;
  }
  entry->device.set_connected(true);
  paired_.push_back(std::move(*entry));
  available_.erase(entry);
  PublishDevicesChangedLocked();
  return true;
}

bool DeviceStack::Forget(const std::string& device_id) {
  std::lock_guard lock(mutex_);
  auto entry = FindById(paired_, device_id);
  // Real keyboards stay listed while plugged in, whatever their link.
  if (entry == paired_.end() || entry->device.link() == WIRED || entry->device.live()) {
    return false;
  }
  entry->device.set_connected(false);
  available_.push_back(std::move(*entry));
  paired_.erase(entry);
  PublishDevicesChangedLocked();
  return true;
}

std::optional<Settings> DeviceStack::GetSettings(const std::string& device_id) const {
  std::lock_guard lock(mutex_);
  auto entry = FindById(paired_, device_id);
  if (entry == paired_.end()) {
    return std::nullopt;
  }
  return entry->settings;
}

void DeviceStack::ApplySettings(const Settings& settings, std::function<void(bool ok)> done) {
  std::unique_lock lock(mutex_);
  auto entry = FindById(paired_, settings.device_id());
  if (entry != paired_.end()) {
    if (entry->settings.kind_case() != settings.kind_case()) {
      lock.unlock();
      done(false);
      return;
    }
    if (!entry->device.live()) {
      entry->settings = settings;
      lock.unlock();
      done(true);
      return;
    }
    auto live = live_.find(entry->device.id());
    if (live == live_.end()) {
      lock.unlock();
      done(false);
      return;
    }
    // The write runs on the keyboard's own thread, so this request returns at once.
    ViaKeyboard* keyboard = live->second.get();
    keyboard->WriteLightingAsync(
        ToViaLighting(settings.keyboard(), keyboard->model()),
        [this, keyboard, settings, done = std::move(done)](bool ok) {
          {
            std::lock_guard lock(mutex_);
            // Skip results for a keyboard that was unplugged or replaced meanwhile.
            auto live = live_.find(settings.device_id());
            if (live != live_.end() && live->second.get() == keyboard) {
              if (ok) {
                FindById(paired_, live->first)->settings = settings;
              } else {
                // Most likely unplugged; the next scan reconnects it if it is still there.
                DisconnectLocked(keyboard);
                PublishDevicesChangedLocked();
              }
            }
          }
          done(ok);
        });
    return;
  }

  // Keep an unpaired device's customizations so adding it again does not reset it.
  auto available = FindById(available_, settings.device_id());
  const bool ok =
      available != available_.end() && available->settings.kind_case() == settings.kind_case();
  if (ok) {
    available->settings = settings;
  }
  lock.unlock();
  done(ok);
}

void DeviceStack::PublishDevicesChangedLocked() const {
  // Sent under the lock so that snapshots from different threads arrive in order.
  if (devices_changed_) {
    devices_changed_(ListLocked());
  }
}
