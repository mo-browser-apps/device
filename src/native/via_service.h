#ifndef VIA_SERVICE_H_
#define VIA_SERVICE_H_

// Registers ViaService and starts a background thread that opens VIA keyboards as they
// are plugged in and closes them when unplugged, notifying the main process each time.
// Call once, from launch().
void StartViaService();

#endif  // VIA_SERVICE_H_
