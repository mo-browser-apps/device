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
  device.set_model_id("compact-keyboard");
  device.set_model("Compact Keyboard");
  device.set_link(WIRED);
  device.set_firmware("2.0.5");
  device.set_connected(true);
  device.set_has_battery(false);

  KeyboardSpec* spec = device.mutable_keyboard();
  spec->set_backlight(true);
  spec->set_color(true);
  spec->add_effects(STATIC);
  spec->add_effects(BREATHING);
  spec->add_effects(WAVE);

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

// The firmware effects every keyboard shares; the rest come from KeychronHid::Model.
constexpr int kViaOff = 0;
constexpr int kViaSolid = 1;

// The editor uses hue 0–359° and brightness 0–100%; VIA uses 0–255 for both.
int ToVia(int value, int range) {
  return std::clamp((value * 255 + range / 2) / range, 0, 255);
}

int FromVia(int value, int range) {
  return (value * range + 127) / 255;
}

KeychronHid::Lighting ToKeychronLighting(const KeyboardSettings& keyboard,
                                         const KeychronHid::Model& model) {
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

DeviceSeed MakeKeychron(const KeychronHid& keychron, const KeychronHid::Lighting& lighting) {
  Device device;
  device.set_id(keychron.model().id);
  device.set_model_id(keychron.model().id);
  device.set_model(keychron.model().name);
  device.set_link(WIRED);
  device.set_firmware("VIA protocol " + std::to_string(keychron.protocol_version()));
  device.set_connected(true);
  device.set_has_battery(false);
  device.set_live(true);
  // Lighting only: key remapping is not implemented for the real keyboard.
  device.mutable_keyboard()->set_backlight(true);
  device.mutable_keyboard()->set_color(keychron.has_color());
  device.mutable_keyboard()->add_effects(STATIC);
  if (keychron.model().breathing_effect) device.mutable_keyboard()->add_effects(BREATHING);
  if (keychron.model().wave_effect) device.mutable_keyboard()->add_effects(WAVE);

  Settings settings;
  settings.set_device_id(device.id());
  KeyboardSettings* keyboard = settings.mutable_keyboard();
  // Firmware effects the editor cannot show are listed as the animated "Wave". When the
  // keyboard has no Wave, no option is selected, and choosing Steady still applies.
  keyboard->set_effect(WAVE);
  // Effect 0 means the backlight is off; it is shown as Steady at zero brightness.
  if (lighting.effect == kViaSolid || lighting.effect == kViaOff) keyboard->set_effect(STATIC);
  const int breathing = keychron.model().breathing_effect;
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
  add(paired_, MakeKeyboard());

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

  // A single scan at startup; plugging the keyboard in later needs an app restart.
  keychron_ = KeychronHid::Open();
  std::optional<KeychronHid::Lighting> lighting;
  if (keychron_) lighting = keychron_->ReadLighting();
  if (lighting) {
    add(paired_, MakeKeychron(*keychron_, *lighting));
  } else {
    keychron_.reset();
  }
}

DeviceList DeviceStack::List() const {
  DeviceList list;
  for (const Entry& entry : paired_) {
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
  paired_.push_back(std::move(*entry));
  available_.erase(entry);
  PublishDevicesChanged();
  return true;
}

bool DeviceStack::Forget(const std::string& device_id) {
  auto entry = FindById(paired_, device_id);
  if (entry == paired_.end() || entry->device.link() == WIRED) {
    return false;
  }
  entry->device.set_connected(false);
  available_.push_back(std::move(*entry));
  paired_.erase(entry);
  PublishDevicesChanged();
  return true;
}

std::optional<Settings> DeviceStack::GetSettings(const std::string& device_id) const {
  auto entry = FindById(paired_, device_id);
  if (entry == paired_.end()) {
    return std::nullopt;
  }
  return entry->settings;
}

bool DeviceStack::ApplySettings(const Settings& settings) {
  auto entry = FindById(paired_, settings.device_id());
  if (entry != paired_.end()) {
    if (entry->settings.kind_case() != settings.kind_case()) {
      return false;
    }
    if (entry->device.live()) {
      if (!keychron_) {
        return false;
      }
      if (!keychron_->WriteLighting(ToKeychronLighting(settings.keyboard(), keychron_->model()))) {
        // Most likely unplugged; show it as disconnected until the app restarts.
        keychron_.reset();
        entry->device.set_connected(false);
        PublishDevicesChanged();
        return false;
      }
    }
    entry->settings = settings;
    return true;
  }

  // Keep an unpaired device's customizations so adding it again does not reset it.
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
