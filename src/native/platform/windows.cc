// Windows: HIDAPI's WinAPI backend.
#include <hidapi.h>

#include "platform.h"

bool InitHid() {
  return hid_init() == 0;
}

// Windows opens each top-level collection under its own path, such as
// "\\?\hid#vid_046d&pid_c548&mi_02&col02#..." for long reports and "...&col01#..." for
// short ones. HIDAPI lowercases the path.
std::string HidppShortReportPath(const std::string& long_report_path) {
  std::string path = long_report_path;
  const size_t collection = path.find("&col02");
  if (collection == std::string::npos) return {};
  path.replace(collection, 6, "&col01");
  return path;
}
