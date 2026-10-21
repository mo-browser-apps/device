#ifndef CHROMA_DEVICE_H_
#define CHROMA_DEVICE_H_

#include <chrono>
#include <map>
#include <optional>
#include <string>
#include <vector>

#include "platform/platform.h"

// A Razer keyboard or mouse. Lighting uses the Chroma SDK; supported receivers are
// queried over HID to distinguish a connected mouse from an idle USB receiver.
struct ChromaDevice {
  ChromaDeviceKind kind;
  unsigned short vendor_id;
  unsigned short product_id;
  // The USB product string with trailing spaces removed; may be empty.
  std::string product_name;
  // The HID path of the device's main interface; stable while it stays plugged in.
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

  // Disconnects from the SDK after it refused a color, most likely because its service
  // stopped. The next Scan connects again and lists the devices if it can.
  void Reset();

 private:
  bool SdkReady();

  std::chrono::milliseconds retry_delay_;
  std::optional<std::chrono::steady_clock::time_point> retry_at_;
  bool ready_ = false;
  // Keep the last confirmed receiver state when another client interrupts a query.
  std::map<std::string, bool> receiver_connected_;
};

#endif  // CHROMA_DEVICE_H_
