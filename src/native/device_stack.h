#ifndef DEVICE_STACK_H_
#define DEVICE_STACK_H_

#include <functional>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "gen/devices.pb.h"

// Holds the attached devices and their settings. To drive real hardware,
// replace the body of this class with a vendor HID SDK.
class DeviceStack {
 public:
  using DevicesChangedHandler = std::function<void(const DeviceList&)>;

  void Add(const Device& device, const Settings& settings);
  DeviceList List() const;
  std::optional<Settings> GetSettings(const std::string& device_id) const;
  bool ApplySettings(const Settings& settings);

  bool UpdateDevice(const Device& device);

  void SetDevicesChangedHandler(DevicesChangedHandler handler) {
    devices_changed_ = std::move(handler);
  }

 private:
  struct Entry {
    Device device;
    Settings settings;
  };

  std::vector<Entry> entries_;
  DevicesChangedHandler devices_changed_;
};

#endif  // DEVICE_STACK_H_
