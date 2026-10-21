#ifndef HARDWARE_SERVICE_H_
#define HARDWARE_SERVICE_H_

// Registers HardwareService and starts a background thread that opens VIA keyboards and
// Logitech mice as they connect and closes them when they go, notifying the main
// process each time. Call once, from launch().
void StartHardwareService();

#endif  // HARDWARE_SERVICE_H_
