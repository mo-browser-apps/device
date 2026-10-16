// Checks the HID++ mouse code against a simulated Bolt receiver. Run with
// `npm run test:native`.
#include <cassert>
#include <chrono>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <deque>
#include <string>
#include <vector>

#include "../hidpp_mouse.h"
#include "../platform/platform.h"
#include "hidapi.h"

namespace {

using Report = std::vector<uint8_t>;

// A Bolt receiver with a Signature M650 L paired at index 2, answering like the real one.
struct FakeReceiver {
  bool plugged = true;
  bool mouse_awake = true;
  std::string name = "Signature M650 L";
  int battery_percent = 70;
  uint8_t battery_level = 8;
  uint8_t charging = 0;
  int dpi = 1000;
  int requests = 0;
  // Short reports arrive on their own collection, as on Windows.
  bool split = false;
  std::deque<Report> replies;
  std::deque<Report> short_replies;
  // Reads of the long-report collection that found nothing, so real hardware would have
  // waited.
  int empty_long_reads = 0;
} receiver;

// Where a reply arrives: short reports on their own collection when the receiver is split.
void Send(Report reply) {
  (receiver.split && reply[0] == 0x10 ? receiver.short_replies : receiver.replies)
      .push_back(std::move(reply));
}

// Feature indexes on the fake mouse.
constexpr uint8_t kName = 3, kBattery = 7, kDpi = 12;

Report Answer(const uint8_t* request) {
  const uint8_t index = request[1], feature = request[2], function = request[3] >> 4;
  Report reply(request, request + 20);
  reply.resize(20);
  std::fill(reply.begin() + 4, reply.end(), 0);
  if (index != 2 || !receiver.mouse_awake) {
    // HID++ 1.0 error from the receiver: no device there, or it is asleep.
    return {0x10, index, 0x8F, feature, request[3], 0x09, 0};
  }
  uint8_t* params = reply.data() + 4;
  if (feature == 0 && function == 0) {
    const int wanted = (request[4] << 8) | request[5];
    params[0] = wanted == 0x0005 ? kName : wanted == 0x1004 ? kBattery : wanted == 0x2201 ? kDpi : 0;
  } else if (feature == 0 && function == 1) {
    params[0] = 4;
    params[1] = 5;
    params[2] = request[6];
  } else if (feature == kName && function == 0) {
    params[0] = receiver.name.size();
  } else if (feature == kName && function == 1) {
    for (size_t i = 0; i < 16 && request[4] + i < receiver.name.size(); ++i) {
      params[i] = receiver.name[request[4] + i];
    }
  } else if (feature == kBattery && function == 1) {
    params[0] = receiver.battery_percent;
    params[1] = receiver.battery_level;
    params[2] = receiver.charging;
  } else if (feature == kDpi && function == 1) {
    // 400 to 4000 in steps of 100, as the M650 L reports it.
    const uint8_t list[] = {0, 0x01, 0x90, 0xE0, 0x64, 0x0F, 0xA0};
    std::memcpy(params, list, sizeof(list));
  } else if (feature == kDpi && function == 2) {
    params[1] = receiver.dpi >> 8;
    params[2] = receiver.dpi & 0xFF;
  } else if (feature == kDpi && function == 3) {
    receiver.dpi = (request[5] << 8) | request[6];
  } else {
    return {0x11, index, 0xFF, feature, request[3], 0x02, 0};
  }
  return reply;
}

}  // namespace

// Stands in for the platform file.
std::string HidppShortReportPath(const std::string& long_report_path) {
  return receiver.split ? long_report_path + "-short" : "";
}

hid_device_info* hid_enumerate(unsigned short vendor_id, unsigned short product_id) {
  if (!receiver.plugged || vendor_id != 0x046D || product_id != 0xC548) return nullptr;
  hid_device_info* list = nullptr;
  // The short-report, long-report, and mouse interfaces; only the long one is used.
  for (auto [page, usage] : {std::pair{0xFF00, 1}, {0xFF00, 2}, {0x0001, 2}}) {
    list = new hid_device_info{
        .path = strdup(page != 0xFF00 ? "mouse"
                       : usage == 1 && receiver.split ? "hidpp-short"
                                                      : "hidpp"),
        .vendor_id = vendor_id,
        .product_id = product_id,
        .usage_page = static_cast<unsigned short>(page),
        .usage = static_cast<unsigned short>(usage),
        .next = list,
    };
  }
  return list;
}

void hid_free_enumeration(hid_device_info* devices) {
  while (devices) {
    hid_device_info* next = devices->next;
    free(devices->path);
    delete devices;
    devices = next;
  }
}

hid_device* hid_open_path(const char* path) {
  if (std::string(path) == "hidpp-short") {
    return reinterpret_cast<hid_device*>(&receiver.short_replies);
  }
  assert(std::string(path) == "hidpp");
  return reinterpret_cast<hid_device*>(&receiver.replies);
}

void hid_close(hid_device*) {}

int hid_write(hid_device*, const unsigned char* data, size_t length) {
  assert(length == 20 && data[0] == 0x11 && (data[3] & 0x0F) == 0x0A);
  if (!receiver.plugged) return -1;
  ++receiver.requests;
  // A connection notification and another app's reply arrive first and must be skipped.
  Send({0x10, data[1], 0x41, 0x04, 0x01, 0x4F, 0x10});
  Send({0x11, data[1], data[2], static_cast<uint8_t>((data[3] & 0xF0) | 0x03)});
  Send(Answer(data));
  return static_cast<int>(length);
}

int hid_read_timeout(hid_device* device, unsigned char* data, size_t length, int) {
  auto& replies = *reinterpret_cast<std::deque<Report>*>(device);
  if (replies.empty()) {
    receiver.empty_long_reads += &replies == &receiver.replies;
    return 0;
  }
  Report reply = replies.front();
  replies.pop_front();
  reply.resize(std::min(length, reply.size()));
  std::memcpy(data, reply.data(), reply.size());
  return static_cast<int>(reply.size());
}

namespace {

using namespace std::chrono_literals;

std::vector<HidppScanner::Found> ScanNow(HidppScanner& scanner) {
  std::optional<std::vector<HidppScanner::Found>> found = scanner.Scan();
  assert(found);
  return *found;
}

void TestFindsMouseBehindReceiver() {
  receiver = FakeReceiver{};
  HidppScanner scanner(0ms);
  auto found = ScanNow(scanner);
  assert(found.size() == 1);
  const HidppMouse& mouse = *found[0].mouse;
  assert(mouse.name() == "Signature M650 L" && mouse.protocol() == "4.5");
  assert(mouse.min_dpi() == 400 && mouse.max_dpi() == 4000);
  assert(found[0].battery.percent == 70 && !found[0].battery.charging && found[0].dpi == 1000);

  // An awake mouse keeps its handle; only its battery is read again.
  receiver.battery_percent = 65;
  const int requests = receiver.requests;
  auto again = ScanNow(scanner);
  assert(again.size() == 1 && again[0].mouse == found[0].mouse && !again[0].dpi);
  assert(again[0].battery.percent == 65);
  // One battery read, plus a ping for each of the five empty slots.
  assert(receiver.requests - requests == 6);
}

void TestScansOncePerInterval() {
  receiver = FakeReceiver{};
  HidppScanner scanner(1h);
  assert(ScanNow(scanner).size() == 1);
  assert(!scanner.Scan());
}

void TestSleepingMouseComesBackAsNew() {
  receiver = FakeReceiver{};
  HidppScanner scanner(0ms);
  auto mouse = ScanNow(scanner).at(0).mouse;

  receiver.mouse_awake = false;
  assert(ScanNow(scanner).empty());
  receiver.mouse_awake = true;
  auto found = ScanNow(scanner);
  assert(found.size() == 1 && found[0].mouse != mouse && found[0].dpi == 1000);
}

void TestUnpluggedReceiver() {
  receiver = FakeReceiver{};
  HidppScanner scanner(0ms);
  assert(ScanNow(scanner).size() == 1);
  receiver.plugged = false;
  assert(ScanNow(scanner).empty());
}

void TestBatteryLevelOnly() {
  receiver = FakeReceiver{};
  receiver.battery_percent = 0;
  receiver.battery_level = 2;
  receiver.charging = 1;
  HidppScanner scanner(0ms);
  auto found = ScanNow(scanner);
  assert(found.at(0).battery.percent == 20 && found[0].battery.charging);
}

void TestShortReportsOnTheirOwnCollection() {
  receiver = FakeReceiver{};
  receiver.split = true;
  HidppScanner scanner(0ms);
  auto found = ScanNow(scanner);
  assert(found.size() == 1 && found[0].mouse->name() == "Signature M650 L");
  // The empty slots' errors are read from the short collection, so no slot waited for
  // the reply timeout.
  assert(receiver.empty_long_reads == 0);
}

void TestWritesClampedDpi() {
  receiver = FakeReceiver{};
  HidppScanner scanner(0ms);
  auto mouse = ScanNow(scanner).at(0).mouse;

  assert(mouse->WriteDpi(9000) && receiver.dpi == 4000);
  receiver.mouse_awake = false;

  // A failed write marks the mouse, so the next scan looks for it again.
  assert(!mouse->WriteDpi(800) && mouse->failed());
}

}  // namespace

int main() {
  TestFindsMouseBehindReceiver();
  TestScansOncePerInterval();
  TestSleepingMouseComesBackAsNew();
  TestUnpluggedReceiver();
  TestBatteryLevelOnly();
  TestShortReportsOnTheirOwnCollection();
  TestWritesClampedDpi();
  std::puts("hidpp_test: ok");
}
