#ifndef DEVICE_STACK_H_
#define DEVICE_STACK_H_

#include <functional>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "gen/devices.pb.h"

// Holds the simulated devices and their settings.
class DeviceStack {
 public:
  using DevicesChangedHandler = std::function<void(const DeviceList&)>;

  // Creates the managed demo devices and one nearby device available to pair.
  DeviceStack();

  // Returns every device currently managed by the stack.
  DeviceList List() const;

  // Returns nearby devices that are available to pair.
  DeviceList Discover() const;

  // Moves one nearby device into the managed device list.
  bool Pair(const std::string& device_id);

  // Removes one wireless device from the managed device list.
  bool Forget(const std::string& device_id);

  // Returns the current settings for one managed device.
  std::optional<Settings> GetSettings(const std::string& device_id) const;

  // Replaces the complete settings snapshot for one known device.
  bool ApplySettings(const Settings& settings);

  // Connects native device-list changes to the main-process callback.
  void SetDevicesChangedHandler(DevicesChangedHandler handler) {
    devices_changed_ = std::move(handler);
  }

 private:
  struct Entry {
    Device device;
    Settings settings;
  };

  std::vector<Entry> paired_;
  std::vector<Entry> available_;
  DevicesChangedHandler devices_changed_;

  // Sends the latest managed-device snapshot to the registered callback.
  void PublishDevicesChanged() const;
};

#endif  // DEVICE_STACK_H_
