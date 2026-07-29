#include "device_stack.h"

#include <algorithm>
#include <string>
#include <utility>
#include <vector>

namespace {

struct ButtonSeed {
  std::string control;
  std::string action;
};

struct MouseSeed {
  std::string id;
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

const char* const kRemappableKeys[] = {
    "esc", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "minus", "equal", "backspace",
    "tab", "q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "bracketleft", "bracketright",
    "backslash",
    "capslock", "a", "s", "d", "f", "g", "h", "j", "k", "l", "semicolon", "quote", "enter",
    "shiftleft", "z", "x", "c", "v", "b", "n", "m", "comma", "period", "slash", "shiftright",
    "ctrlleft", "metaleft", "altleft", "space", "altright", "menu", "ctrlright",
};

DeviceSeed MakeKeyboard() {
  Device device;
  device.set_id("compact-keyboard");
  device.set_model("Compact Keyboard");
  device.set_link(WIRED);
  device.set_firmware("2.0.5");
  device.set_connected(true);
  device.set_has_battery(false);

  KeyboardSpec* spec = device.mutable_keyboard();
  spec->set_backlight(true);

  Settings settings;
  settings.set_device_id(device.id());
  KeyboardSettings* keyboard = settings.mutable_keyboard();
  keyboard->set_effect(STATIC);
  keyboard->set_hue(35);
  keyboard->set_brightness(70);

  for (const char* key : kRemappableKeys) {
    spec->add_keys(key);
    Binding* binding = keyboard->add_bindings();
    binding->set_control(key);
    binding->set_action("default");
  }

  return {std::move(device), std::move(settings)};
}

}  // namespace

DeviceStack::DeviceStack() {
  auto add = [](std::vector<Entry>& entries, DeviceSeed seed) {
    entries.push_back({std::move(seed.device), std::move(seed.settings)});
  };

  add(entries_, MakeMouse({
                    .id = "performance-mouse",
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
  add(entries_, MakeMouse({
                    .id = "travel-mouse",
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
  add(entries_, MakeKeyboard());

  // A second unit of the same mouse, discoverable so the pairing flow is
  // usable on a fresh launch.
  Entry nearby = entries_.front();
  nearby.device.set_id("performance-mouse-secondary");
  nearby.device.set_link(BLUETOOTH);
  nearby.device.set_battery(68);
  nearby.device.set_charging(false);
  nearby.device.set_connected(false);
  nearby.settings.set_device_id(nearby.device.id());
  available_.push_back(std::move(nearby));
}

DeviceList DeviceStack::List() const {
  DeviceList list;
  for (const Entry& entry : entries_) {
    *list.add_devices() = entry.device;
  }
  return list;
}

DeviceList DeviceStack::Discover() const {
  DeviceList list;
  for (const Entry& entry : available_) {
    *list.add_devices() = entry.device;
  }
  return list;
}

bool DeviceStack::Pair(const std::string& device_id) {
  auto entry = FindById(available_, device_id);
  if (entry == available_.end()) {
    return false;
  }
  entry->device.set_connected(true);
  entries_.push_back(std::move(*entry));
  available_.erase(entry);
  PublishDevicesChanged();
  return true;
}

bool DeviceStack::Forget(const std::string& device_id) {
  auto entry = FindById(entries_, device_id);
  if (entry == entries_.end() || entry->device.link() == WIRED) {
    return false;
  }
  entry->device.set_connected(false);
  available_.push_back(std::move(*entry));
  entries_.erase(entry);
  PublishDevicesChanged();
  return true;
}

std::optional<Settings> DeviceStack::GetSettings(const std::string& device_id) const {
  auto entry = FindById(entries_, device_id);
  if (entry == entries_.end()) {
    return std::nullopt;
  }
  return entry->settings;
}

bool DeviceStack::ApplySettings(const Settings& settings) {
  auto entry = FindById(entries_, settings.device_id());
  if (entry != entries_.end()) {
    if (entry->settings.kind_case() != settings.kind_case()) {
      return false;
    }
    entry->settings = settings;
    return true;
  }

  auto available = FindById(available_, settings.device_id());
  if (available == available_.end() || available->settings.kind_case() != settings.kind_case()) {
    return false;
  }
  available->settings = settings;
  return true;
}

void DeviceStack::PublishDevicesChanged() const {
  if (devices_changed_) {
    devices_changed_(List());
  }
}
