#include "device_stack.h"

#include <algorithm>
#include <utility>

#include "gen/devices.rpc.h"
#include "rpc.h"

using google::protobuf::Empty;
using mo::rpc::Callback;

namespace {

template <class Entries>
auto FindById(Entries& entries, const std::string& device_id) {
  return std::find_if(entries.begin(), entries.end(),
                      [&](const auto& entry) { return entry.device.id() == device_id; });
}

class DeviceStackServiceImpl : public DeviceStackService {
 public:
  explicit DeviceStackServiceImpl(DeviceStack& stack) : stack_(stack) {}

  void List(const Empty*, Callback<DeviceList> done) override {
    std::move(done).Complete(stack_.List());
  }

  void GetSettings(const DeviceId* request, Callback<Settings> done) override {
    std::optional<Settings> settings = stack_.GetSettings(request->id());
    if (!settings.has_value()) {
      std::move(done).Reject("Unknown device: " + request->id());
      return;
    }
    std::move(done).Complete(std::move(*settings));
  }

  void ApplySettings(const Settings* request, Callback<Empty> done) override {
    if (!stack_.ApplySettings(*request)) {
      std::move(done).Reject("Cannot apply settings to device: " + request->device_id());
      return;
    }
    std::move(done).Complete(Empty());
  }

 private:
  DeviceStack& stack_;
};

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

// Rejects settings whose kind does not match the device, so a stray write cannot
// put mouse settings on a keyboard or blank a device with an unset oneof.
bool DeviceStack::ApplySettings(const Settings& settings) {
  auto entry = FindById(entries_, settings.device_id());
  if (entry == entries_.end() || entry->settings.kind_case() != settings.kind_case()) {
    return false;
  }
  entry->settings = settings;
  return true;
}

void RegisterDeviceStackService(DeviceStack& stack) {
  mo::rpc::RegisterService(new DeviceStackServiceImpl(stack));
}
