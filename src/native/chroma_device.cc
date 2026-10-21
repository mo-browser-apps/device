#include "chroma_device.h"

#include <hidapi.h>

#include <cstdio>
#include <map>
#include <thread>

namespace {

constexpr unsigned short kRazer = 0x1532;
constexpr unsigned short kMambaWirelessReceiver = 0x0072;

// Mamba 2018's read-only serial query, as documented by OpenRazer's
// razer_chroma_standard_get_serial and razer_get_report:
// https://github.com/openrazer/openrazer/tree/master/driver
// A receiver remains enumerated when the mouse is off or using its USB cable.
// Its explicit device-timeout reply means there is no mouse on the radio link.
// Transport errors and replies belonging to Synapse are NOT proof of absence.
std::optional<bool> ReceiverConnected(const std::string& path) {
  hid_device* handle = hid_open_path(path.c_str());
  if (!handle) return std::nullopt;
  // HIDAPI prefixes the 90-byte vendor packet with a zero report ID.
  unsigned char request[91] = {};
  request[2] = 0x3f;  // Transaction.
  request[6] = 0x16;  // Serial payload length.
  request[8] = 0x82;  // Get serial, command class 0.
  for (size_t i = 3; i < 89; ++i) request[89] ^= request[i];
  const int sent = hid_send_feature_report(handle, request, sizeof(request));
  unsigned char reply[91] = {};
  int received = -1;
  if (sent == sizeof(request)) {
    // This model needs at least 330 ms before reading the response.
    std::this_thread::sleep_for(std::chrono::milliseconds(350));
    received = hid_get_feature_report(handle, reply, sizeof(reply));
  }
  hid_close(handle);
  if (received != sizeof(reply) || reply[0] != 0 || reply[2] != request[2] ||
      reply[3] != 0 || reply[4] != 0 || reply[5] != 0 ||
      reply[6] != request[6] || reply[7] != 0 || reply[8] != request[8] ||
      reply[90] != 0) {
    return std::nullopt;
  }
  unsigned char checksum = 0;
  for (size_t i = 3; i < 89; ++i) checksum ^= reply[i];
  if (checksum != reply[89]) return std::nullopt;
  if (reply[1] == 0x04) return false;  // Device timeout, not a host read timeout.
  if (reply[1] != 0x02) return std::nullopt;
  // A successful reply must contain a real serial, not an empty/zero placeholder.
  bool nonzero = false;
  for (size_t i = 9; i < 31 && reply[i] != 0; ++i) {
    if (reply[i] < 0x20 || reply[i] > 0x7e) return std::nullopt;
    if (reply[i] != '0' && reply[i] != ' ') nonzero = true;
  }
  return nonzero ? std::optional<bool>(true) : std::nullopt;
}

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

void ChromaScanner::Reset() {
  UninitChromaSdk();
  ready_ = false;
  retry_at_.reset();
  receiver_connected_.clear();
}

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
  // interface and collection; its main interface identifies it. A main interface with
  // both a keyboard and a pointer, such as a keyboard with a trackpad, is a keyboard.
  std::map<std::string, ChromaDevice> found;
  hid_device_info* infos = hid_enumerate(kRazer, 0);
  for (hid_device_info* info = infos; info; info = info->next) {
    const std::optional<ChromaDeviceKind> kind = KindOf(*info);
    if (!kind) continue;
    const std::string path = HidInterfacePath(info->path);
    auto [entry, added] = found.try_emplace(path, ChromaDevice{
                                                      .kind = *kind,
                                                      .vendor_id = info->vendor_id,
                                                      .product_id = info->product_id,
                                                      .product_name = Narrow(info->product_string),
                                                      .path = path,
                                                  });
    if (!added && *kind == ChromaDeviceKind::kKeyboard) entry->second.kind = *kind;
  }
  hid_free_enumeration(infos);

  std::erase_if(receiver_connected_, [&](const auto& entry) {
    return !found.contains(entry.first);
  });
  for (auto& [path, device] : found) {
    if (device.product_id == kMambaWirelessReceiver &&
        device.kind == ChromaDeviceKind::kMouse) {
      if (const auto connected = ReceiverConnected(path)) {
        receiver_connected_[path] = *connected;
      }
      const auto state = receiver_connected_.find(path);
      if (state != receiver_connected_.end() && !state->second) continue;
    }
    devices.push_back(std::move(device));
  }
  return devices;
}
