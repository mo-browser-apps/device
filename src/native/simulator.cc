// DEMO ONLY. Stands in for hardware activity; delete with the rest of the simulator.
#include "simulator.h"

#include <string>
#include <utility>
#include <vector>

#include "device_stack.h"
#include "gen/simulator.rpc.h"
#include "rpc.h"

using google::protobuf::Empty;
using mo::rpc::Callback;

namespace {

constexpr int kMinBattery = 1;

struct MouseSeed {
  std::string id;
  std::string model;
  LinkType link;
  std::string firmware;
  int battery;
  std::vector<std::string> buttons;
  int min_dpi;
  int max_dpi;
  int dpi;
};

void AddMouse(DeviceStack& stack, const MouseSeed& seed) {
  Device device;
  device.set_id(seed.id);
  device.set_model(seed.model);
  device.set_link(seed.link);
  device.set_firmware(seed.firmware);
  device.set_connected(true);
  device.set_has_battery(true);
  device.set_battery(seed.battery);

  MouseSpec* spec = device.mutable_mouse();
  spec->set_min_dpi(seed.min_dpi);
  spec->set_max_dpi(seed.max_dpi);

  Settings settings;
  settings.set_device_id(seed.id);
  MouseSettings* mouse = settings.mutable_mouse();
  mouse->set_dpi(seed.dpi);
  mouse->set_scroll_speed(3);
  mouse->set_natural_scroll(false);

  for (const std::string& button : seed.buttons) {
    spec->add_buttons(button);
  }

  stack.Add(device, settings);
}

// The 60% layout minus `fn`, which is fixed in firmware.
const char* const kRemappableKeys[] = {
    "esc", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "minus", "equal", "backspace",
    "tab", "q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "bracketleft", "bracketright",
    "backslash",
    "capslock", "a", "s", "d", "f", "g", "h", "j", "k", "l", "semicolon", "quote", "enter",
    "shiftleft", "z", "x", "c", "v", "b", "n", "m", "comma", "period", "slash", "shiftright",
    "ctrlleft", "altleft", "metaleft", "space", "metaright", "altright", "ctrlright",
};

void AddKeyboard(DeviceStack& stack) {
  Device device;
  device.set_id("aero-k1");
  device.set_model("Aero K1 Backlit");
  device.set_link(WIRED);
  device.set_firmware("2.0.5");
  device.set_connected(true);
  device.set_has_battery(false);

  KeyboardSpec* spec = device.mutable_keyboard();
  spec->set_backlight(true);
  for (const char* key : kRemappableKeys) {
    spec->add_keys(key);
  }

  Settings settings;
  settings.set_device_id("aero-k1");
  KeyboardSettings* keyboard = settings.mutable_keyboard();
  keyboard->set_effect(STATIC);
  keyboard->set_hue(35);
  keyboard->set_brightness(70);

  stack.Add(device, settings);
}

class SimulatorServiceImpl : public SimulatorService {
 public:
  explicit SimulatorServiceImpl(DeviceStack& stack) : stack_(stack) {}

  void Tick(const Empty*, Callback<Empty> done) override {
    // Iterate a snapshot: UpdateDevice sends an event that can reenter the stack.
    const DeviceList devices = stack_.List();
    for (const Device& device : devices.devices()) {
      if (!device.connected() || !device.has_battery() || device.battery() <= kMinBattery) {
        continue;
      }
      Device drained = device;
      drained.set_battery(drained.battery() - 1);
      stack_.UpdateDevice(drained);
    }
    std::move(done).Complete(Empty());
  }

 private:
  DeviceStack& stack_;
};

}  // namespace

void SeedDevices(DeviceStack& stack) {
  AddMouse(stack, {
                      .id = "aero-m1",
                      .model = "Aero M1 Wireless",
                      .link = RECEIVER,
                      .firmware = "3.2.1",
                      .battery = 82,
                      .buttons = {"left", "right", "wheel", "back", "forward", "gesture"},
                      .min_dpi = 400,
                      .max_dpi = 8000,
                      .dpi = 1600,
                  });

  AddMouse(stack, {
                      .id = "aero-m2",
                      .model = "Aero M2 Travel",
                      .link = BLUETOOTH,
                      .firmware = "1.4.0",
                      .battery = 45,
                      .buttons = {"left", "right", "wheel"},
                      .min_dpi = 800,
                      .max_dpi = 3200,
                      .dpi = 1200,
                  });

  AddKeyboard(stack);
}

void RegisterSimulatorService(DeviceStack& stack) {
  mo::rpc::RegisterService(new SimulatorServiceImpl(stack));
}
