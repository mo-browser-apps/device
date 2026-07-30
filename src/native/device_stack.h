#ifndef DEVICE_STACK_H_
#define DEVICE_STACK_H_

#include <functional>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "gen/devices.pb.h"

// Owns discovery, paired devices, and their settings. Replace this in-memory
// implementation with a vendor HID SDK; the RPC and UI layers stay unchanged.
class DeviceStack {
 public:
  using DevicesChangedHandler = std::function<void(const DeviceList&)>;

  DeviceStack();

  DeviceList List() const;
  DeviceList Discover() const;
  bool Pair(const std::string& device_id);
  bool Forget(const std::string& device_id);
  std::optional<Settings> GetSettings(const std::string& device_id) const;
  bool ApplySettings(const Settings& settings);

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

  void PublishDevicesChanged() const;
};

#endif  // DEVICE_STACK_H_
