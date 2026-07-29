#include "device_service.h"
#include "device_stack.h"

void launch() {
  auto* stack = new DeviceStack();
  RegisterDeviceStackService(*stack);
}
