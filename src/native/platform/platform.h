#ifndef PLATFORM_PLATFORM_H_
#define PLATFORM_PLATFORM_H_

#include <cstdint>
#include <string>

// Everything the native code does differently per operating system. Each supported
// platform implements these in its own file next to this one (mac.cc, linux.cc,
// windows.cc), and CMakeLists.txt compiles only the file for the platform being built.
// See "Supported platforms" in README.md.

// Initializes HIDAPI with the platform's settings. Called once, before any device is
// opened; false if HID devices cannot be used.
bool InitHid();

// The path of the HID collection that carries a Logitech receiver's short HID++ reports,
// including its error replies, given the path of its long-report collection. Empty when
// both arrive on the long-report path.
std::string HidppShortReportPath(const std::string& long_report_path);

// The Razer Chroma SDK lights Razer devices on Windows, where its runtime comes with
// Razer Synapse. Other platforms have no SDK, so InitChromaSdk is always false there.

// What the SDK lights as one: every connected Razer keyboard, or every mouse.
enum class ChromaDeviceKind { kKeyboard, kMouse };

// Loads the Chroma SDK runtime and connects to its service; false when either is
// missing or not running yet. Calling it again retries, and once it has succeeded it
// returns true at once.
bool InitChromaSdk();

// Shows one solid color on every Razer device of the kind; false if the SDK refused.
// Requires InitChromaSdk to have returned true.
bool SetChromaColor(ChromaDeviceKind kind, uint8_t red, uint8_t green, uint8_t blue);

#endif  // PLATFORM_PLATFORM_H_
