#include "device_stack.h"

#include <algorithm>

namespace {

template <class Entries>
auto FindById(Entries& entries, const std::string& device_id) {
  return std::find_if(entries.begin(), entries.end(),
                      [&](const auto& entry) { return entry.device.id() == device_id; });
}

}  // namespace

void DeviceStack::Add(const Device& device, const Settings& settings) {
  entries_.push_back({device, settings});
}

DeviceList DeviceStack::List() const {
  DeviceList list;
  for (const Entry& entry : entries_) {
    *list.add_devices() = entry.device;
  }
  return list;
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
  if (entry == entries_.end() || entry->settings.kind_case() != settings.kind_case()) {
    return false;
  }
  entry->settings = settings;
  return true;
}

bool DeviceStack::UpdateDevice(const Device& device) {
  auto entry = FindById(entries_, device.id());
  if (entry == entries_.end() || entry->device.spec_case() != device.spec_case()) {
    return false;
  }
  entry->device = device;
  if (devices_changed_) {
    const DeviceList devices = List();
    devices_changed_(devices);
  }
  return true;
}
