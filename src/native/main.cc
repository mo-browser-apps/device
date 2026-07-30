#include "device_service.h"
#include "device_stack.h"

// Creates the native device stack and keeps it available for RPC calls.
void launch() {
  static DeviceStack stack;
  RegisterDeviceStackService(stack);
}
