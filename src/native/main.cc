#include "device_service.h"
#include "device_stack.h"

void launch() {
  static DeviceStack stack;
  RegisterDeviceStackService(stack);
}
