// macOS: HIDAPI's IOHIDManager backend.
#include <hidapi.h>
#include <hidapi_darwin.h>

#include "platform.h"

bool InitHid() {
  if (hid_init() != 0) return false;
  // Share devices so the VIA, Keychron Launcher, or Logi Options+ apps can stay open.
  hid_darwin_set_open_exclusive(0);
  return true;
}

// Every top-level collection of a device shares one IOService path.
std::string HidppShortReportPath(const std::string&) {
  return {};
}
