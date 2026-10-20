// Exercise the actual scanner with simulated HID replies, without touching hardware.
#include "chroma_device.h"
#include <hidapi.h>
#include <array>
#include <cstdlib>
#include <cstring>
#include <iostream>

namespace {
enum class Reply { kOnline, kOffline, kBusy, kOtherCommand, kBadChecksum,
                   kShort, kReadError, kEmptySerial, kZeroSerial, kOpenError, kSendError };
Reply response = Reply::kOffline;
bool plugged = true;
bool second_receiver = false;
int opens = 0;
int closes = 0;
hid_device_info receiver{}, wired{}, other{};

void Check(bool condition, const char* message) {
  if (!condition) {
    std::cerr << message << '\n';
    std::exit(1);
  }
}
void Init(hid_device_info& info, unsigned short pid, const char* path) {
  info.vendor_id = 0x1532;
  info.product_id = pid;
  info.interface_number = 0;
  info.usage_page = 1;
  info.usage = 2;
  info.path = const_cast<char*>(path);
}
}

// Platform and HID test doubles. The production scanner is compiled unchanged.
bool InitChromaSdk() { return true; }
void UninitChromaSdk() {}
std::string HidInterfacePath(const std::string& path) { return path; }
hid_device_info* hid_enumerate(unsigned short, unsigned short) {
  receiver.next = &wired;
  wired.next = second_receiver ? &other : nullptr;
  return plugged ? &receiver : &wired;
}
void hid_free_enumeration(hid_device_info*) {}
hid_device* hid_open_path(const char* path) {
  ++opens;
  if (response == Reply::kOpenError) return nullptr;
  return reinterpret_cast<hid_device*>(std::strcmp(path, other.path) == 0 ? &other : &receiver);
}
void hid_close(hid_device*) { ++closes; }
int hid_send_feature_report(hid_device*, const unsigned char* data, size_t length) {
  const std::array<unsigned char, 9> header{0, 0, 0x3f, 0, 0, 0, 0x16, 0, 0x82};
  Check(length == 91 && std::memcmp(data, header.data(), header.size()) == 0 &&
        data[89] == 0x94 && data[90] == 0, "Wrong serial-query wire format");
  return response == Reply::kSendError ? -1 : 91;
}
int hid_get_feature_report(hid_device* handle, unsigned char* data, size_t length) {
  Check(length == 91, "Wrong reply buffer size");
  auto mode = handle == reinterpret_cast<hid_device*>(&other) ? Reply::kOnline : response;
  if (mode == Reply::kReadError) return -1;
  if (mode == Reply::kShort) return 10;
  std::memset(data, 0, length);
  data[1] = mode == Reply::kOffline ? 4 : mode == Reply::kBusy ? 1 : 2;
  data[2] = 0x3f;
  data[6] = 0x16;
  data[8] = mode == Reply::kOtherCommand ? 0x81 : 0x82;
  if (mode == Reply::kZeroSerial) std::memcpy(data + 9, "000000000000", 12);
  else if (mode != Reply::kEmptySerial) std::memcpy(data + 9, "MAMBA123456", 11);
  for (size_t i = 3; i < 89; ++i) data[89] ^= data[i];
  if (mode == Reply::kBadChecksum) data[89] ^= 1;
  return 91;
}

int main() {
  Init(receiver, 0x0072, "receiver");
  Init(wired, 0x0073, "wired");
  Init(other, 0x0072, "other-receiver");
  ChromaScanner scanner{std::chrono::milliseconds(0)};
  Check(scanner.Scan().size() == 1, "Inactive receiver duplicated the wired mouse");
  second_receiver = true;
  Check(scanner.Scan().size() == 2, "A second real mouse was hidden");
  second_receiver = false;
  for (auto mode : {Reply::kBusy, Reply::kOtherCommand, Reply::kBadChecksum,
                    Reply::kShort, Reply::kReadError, Reply::kEmptySerial,
                    Reply::kZeroSerial, Reply::kOpenError, Reply::kSendError}) {
    response = mode;
    Check(scanner.Scan().size() == 1, "Uncertain reply lost confirmed offline state");
  }
  response = Reply::kOnline;
  Check(scanner.Scan().size() == 2, "Mouse did not return when radio link became active");
  response = Reply::kOtherCommand;
  Check(scanner.Scan().size() == 2, "Synapse reply hid an active mouse");
  plugged = false;
  Check(scanner.Scan().size() == 1, "Unplugged receiver remained listed");
  plugged = true;
  Check(scanner.Scan().size() == 2, "Unknown newly plugged receiver was hidden");
  response = Reply::kOffline;
  Check(scanner.Scan().size() == 1, "Replugged inactive receiver remained listed");
  plugged = false;
  Check(scanner.Scan().size() == 1, "Unplug scan failed");
  plugged = true;
  response = Reply::kReadError;
  Check(scanner.Scan().size() == 2, "Replug retained a stale offline state");
  response = Reply::kOffline;
  Check(scanner.Scan().size() == 1, "Offline receiver returned");
  scanner.Reset();
  response = Reply::kReadError;
  Check(scanner.Scan().size() == 2, "Reset retained stale receiver state");
  Check(closes == opens - 1, "An opened HID handle leaked");
  std::cout << "Chroma discovery regression tests passed\n";
}
