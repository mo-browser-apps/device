// DEMO ONLY. Stands in for hardware activity; delete with the rest of the simulator.
#ifndef SIMULATOR_H_
#define SIMULATOR_H_

class DeviceStack;

// Fills the stack with fake devices in place of a hardware scan.
void SeedDevices(DeviceStack& stack);

void RegisterSimulatorService(DeviceStack& stack);

#endif  // SIMULATOR_H_
