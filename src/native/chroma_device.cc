#include "chroma_device.h"

#include <hidapi.h>

#include <cstdio>
#include <map>

namespace {

constexpr unsigned short kRazer = 0x1532;

// A device's first interface tells its kind: a keyboard's carries keystrokes and a
// mouse's carries pointer reports, whatever else the device adds (a Razer mouse also
// has a keyboard interface for its macro keys, and a keyboard a mouse one).
constexpr int kMainInterface = 0;
constexpr unsigned short kGenericDesktopPage = 0x01;
constexpr unsigned short kMouseUsage = 0x02;
constexpr unsigned short kKeyboardUsage = 0x06;

// ponytail: non-ASCII characters become '?'; add UTF-8 encoding if a product name needs it.
std::string Narrow(const wchar_t* text) {
  std::string result;
  for (; text && *text; ++text) {
    result += *text < 0x80 ? static_cast<char>(*text) : '?';
  }
  result.erase(result.find_last_not_of(' ') + 1);
  return result;
}

std::optional<ChromaDeviceKind> KindOf(const hid_device_info& info) {
  // HIDAPI reports -1 when the interface number is unknown, as for a device with a
  // single interface, which is then the main one.
  if (info.interface_number > kMainInterface || info.usage_page != kGenericDesktopPage) {
    return std::nullopt;
  }
  if (info.usage == kKeyboardUsage) return ChromaDeviceKind::kKeyboard;
  if (info.usage == kMouseUsage) return ChromaDeviceKind::kMouse;
  return std::nullopt;
}

}  // namespace

bool ChromaScanner::SdkReady() {
  if (ready_) return true;
  const auto now = std::chrono::steady_clock::now();
  if (retry_at_ && now < *retry_at_) return false;
  ready_ = InitChromaSdk();
  if (!ready_) {
    if (!retry_at_) {
      std::fputs("Razer Chroma SDK is not available; Razer devices are not listed.\n", stderr);
    }
    retry_at_ = now + retry_delay_;
  }
  return ready_;
}

std::vector<ChromaDevice> ChromaScanner::Scan() {
  std::vector<ChromaDevice> devices;
  if (!SdkReady()) return devices;

  // Enumeration only reads the system's device list. A device shows up once per
  // interface and collection; its main interface identifies it.
  std::map<std::string, ChromaDevice> found;
  hid_device_info* infos = hid_enumerate(kRazer, 0);
  for (hid_device_info* info = infos; info; info = info->next) {
    const std::optional<ChromaDeviceKind> kind = KindOf(*info);
    if (!kind) continue;
    found[info->path] = {
        .kind = *kind,
        .vendor_id = info->vendor_id,
        .product_id = info->product_id,
        .product_name = Narrow(info->product_string),
        .path = info->path,
    };
  }
  hid_free_enumeration(infos);

  for (auto& [path, device] : found) devices.push_back(std::move(device));
  return devices;
}
