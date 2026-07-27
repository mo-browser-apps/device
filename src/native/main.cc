#include "device_stack.h"
#include "simulator.h"

void launch() {
  auto* stack = new DeviceStack();
  SeedDevices(*stack);
  RegisterDeviceStackService(*stack);
  RegisterSimulatorService(*stack);
}
