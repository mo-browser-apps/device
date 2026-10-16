#ifndef PLATFORM_PLATFORM_H_
#define PLATFORM_PLATFORM_H_

#include <string>

// Everything the native code does differently per operating system. Each supported
// platform implements these in its own file next to this one (mac.cc, linux.cc,
// windows.cc), and CMakeLists.txt compiles only the file for the platform being built.
// See "Add a platform" in README.md.

// Initializes HIDAPI with the platform's settings. Called once, before any device is
// opened; false if HID devices cannot be used.
bool InitHid();

// The path of the HID collection that carries a Logitech receiver's short HID++ reports,
// including its error replies, given the path of its long-report collection. Empty when
// both arrive on the long-report path.
std::string HidppShortReportPath(const std::string& long_report_path);

#endif  // PLATFORM_PLATFORM_H_
