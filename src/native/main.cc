#include "device_service.h"
#include "device_stack.h"

// Creates the native device stack and keeps it available for RPC calls.
void launch() {
  // Never destroyed: its scanning and write threads may run until the process exits.
  static DeviceStack& stack = *new DeviceStack();
  RegisterDeviceStackService(stack);
  stack.StartScanning();
}
