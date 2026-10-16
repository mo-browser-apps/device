#include "device_service.h"

#include <memory>
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

  void Discover(const Empty*, Callback<DeviceList> done) override {
    std::move(done).Complete(stack_.Discover());
  }

  void Pair(const DeviceId* request, Callback<Empty> done) override {
    if (!stack_.Pair(request->id())) {
      std::move(done).Reject("Cannot pair device: " + request->id());
      return;
    }
    std::move(done).Complete(Empty());
  }

  void Forget(const DeviceId* request, Callback<Empty> done) override {
    if (!stack_.Forget(request->id())) {
      std::move(done).Reject("Cannot forget device: " + request->id());
      return;
    }
    std::move(done).Complete(Empty());
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
    // Callback is move-only and std::function needs a copyable target.
    auto shared_done = std::make_shared<Callback<Empty>>(std::move(done));
    stack_.ApplySettings(*request, [shared_done, id = request->device_id()](bool ok) {
      if (ok) {
        std::move(*shared_done).Complete(Empty());
      } else {
        std::move(*shared_done).Reject("Cannot apply settings to device: " + id);
      }
    });
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
