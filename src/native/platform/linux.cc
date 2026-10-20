// Linux: HIDAPI's hidraw backend. Users need read and write access to /dev/hidraw*,
// which 70-modevice.rules next to this file grants.
#include <hidapi.h>

#include "platform.h"

bool InitHid() {
  return hid_init() == 0;
}

// A hidraw node carries every report of its interface.
std::string HidppShortReportPath(const std::string&) {
  return {};
}

// HIDAPI lists every interface once, whatever its collections.
std::string HidInterfacePath(const std::string& collection_path) {
  return collection_path;
}

// The Chroma SDK has no Linux runtime.
bool InitChromaSdk() {
  return false;
}

void UninitChromaSdk() {}

bool SetChromaColor(ChromaDeviceKind, uint8_t, uint8_t, uint8_t) {
  return false;
}
