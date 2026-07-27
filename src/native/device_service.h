#ifndef DEVICE_SERVICE_H_
#define DEVICE_SERVICE_H_

class DeviceStack;

// Exposes DeviceStack through the MōBrowser native RPC contract.
void RegisterDeviceStackService(DeviceStack& stack);

#endif  // DEVICE_SERVICE_H_
