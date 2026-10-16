#ifndef DEVICE_STACK_H_
#define DEVICE_STACK_H_

#include <functional>
#include <map>
#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "gen/devices.pb.h"
#include "via_keyboard.h"

// Holds the simulated devices, plus the real VIA keyboards that are plugged in.
// Every method is thread-safe.
class DeviceStack {
 public:
  using DevicesChangedHandler = std::function<void(const DeviceList&)>;

  // Creates the managed demo devices and one nearby device available to pair.
  DeviceStack();

  // Starts a background thread that adds VIA keyboards as they are plugged in and shows
  // them as disconnected when unplugged. Call once, after SetDevicesChangedHandler.
  void StartScanning();

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

  // Replaces the complete settings snapshot for one known device. For a real keyboard,
  // done is called on its write thread once the keyboard has acknowledged the change.
  void ApplySettings(const Settings& settings, std::function<void(bool ok)> done);

  // Connects native device-list changes to the main-process callback. The handler may
  // be called from any thread.
  void SetDevicesChangedHandler(DevicesChangedHandler handler) {
    std::lock_guard lock(mutex_);
    devices_changed_ = std::move(handler);
  }

 private:
  struct Entry {
    Device device;
    Settings settings;
  };

  // Guards every member below. HID I/O never happens while it is held.
  mutable std::mutex mutex_;
  std::vector<Entry> paired_;
  std::vector<Entry> available_;
  DevicesChangedHandler devices_changed_;
  // Connected keyboards by device ID; a disconnected keyboard keeps its entry only.
  std::map<std::string, std::shared_ptr<ViaKeyboard>> live_;

  // The methods below require mutex_ to be held.
  DeviceList ListLocked() const;
  void ConnectLocked(const ViaScanner::Added& added);
  void DisconnectLocked(const ViaKeyboard* keyboard);
  // Sends the latest managed-device snapshot to the registered callback.
  void PublishDevicesChangedLocked() const;
};

#endif  // DEVICE_STACK_H_
