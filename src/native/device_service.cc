#include "device_service.h"

#include <optional>
#include <utility>

#include "device_stack.h"
#include "gen/devices.rpc.h"
#include "gen/events.rpc.h"
#include "rpc.h"

using google::protobuf::Empty;
using mo::rpc::Callback;

namespace {

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

void RegisterDeviceStackService(DeviceStack& stack) {
  stack.SetDevicesChangedHandler([](const DeviceList& devices) {
    mo::rpc::device_events.Changed(devices, [](mo::rpc::Result<Empty>) {});
  });
  mo::rpc::RegisterService(new DeviceStackServiceImpl(stack));
}
