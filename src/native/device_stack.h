#ifndef DEVICE_STACK_H_
#define DEVICE_STACK_H_

#include <optional>
#include <string>
#include <vector>

#include "gen/devices.pb.h"

// Holds the attached devices and their settings. To drive real hardware,
// replace the body of this class with a vendor HID SDK.
class DeviceStack {
 public:
  void Add(const Device& device, const Settings& settings);
  DeviceList List() const;
  std::optional<Settings> GetSettings(const std::string& device_id) const;
  bool ApplySettings(const Settings& settings);

  // Replaces a device and broadcasts the list. The only place Changed is sent.
  bool UpdateDevice(const Device& device);

 private:
  struct Entry {
    Device device;
    Settings settings;
  };

  std::vector<Entry> entries_;
};

void RegisterDeviceStackService(DeviceStack& stack);

#endif  // DEVICE_STACK_H_
