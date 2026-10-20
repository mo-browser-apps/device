#ifndef CHROMA_DEVICE_H_
#define CHROMA_DEVICE_H_

#include <chrono>
#include <optional>
#include <string>
#include <vector>

#include "platform/platform.h"

// A Razer keyboard or mouse that is plugged in. Nothing is opened: the Razer Chroma SDK
// does the I/O, and it lights every keyboard, or every mouse, as one.
struct ChromaDevice {
  ChromaDeviceKind kind;
  unsigned short vendor_id;
  unsigned short product_id;
  // The USB product string with trailing spaces removed; may be empty.
  std::string product_name;
  // The HID path of the device's first interface; stable while it stays plugged in.
  std::string path;
};

// Lists the Razer keyboards and mice that are plugged in, once the Chroma SDK is ready
// to light them. Every call must come from the same thread, since HIDAPI enumeration
// is not thread-safe.
class ChromaScanner {
 public:
  // The SDK is missing or not running yet when it fails to initialize; it is tried
  // again only after retry_delay.
  explicit ChromaScanner(std::chrono::milliseconds retry_delay) : retry_delay_(retry_delay) {}

  // The devices plugged in now, or none while the SDK is not ready.
  std::vector<ChromaDevice> Scan();

 private:
  bool SdkReady();

  std::chrono::milliseconds retry_delay_;
  std::optional<std::chrono::steady_clock::time_point> retry_at_;
  bool ready_ = false;
};

#endif  // CHROMA_DEVICE_H_
