// Checks the VIA keyboard code against simulated QMK firmware. Run with `npm run test:native`.
#include <algorithm>
#include <array>
#include <cassert>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <deque>
#include <map>
#include <string>
#include <utility>
#include <vector>

#include "../keychron_hid.h"
#include "hidapi.h"

namespace {

using Report = std::array<uint8_t, 32>;

// One keyboard's VIA interface, answering the way QMK's quantum/via.c does.
struct FakeBoard {
  unsigned short vendor_id = 0x3434;
  unsigned short product_id = 0x0AA0;
  std::wstring manufacturer = L"Keychron";
  std::wstring product = L"Keychron K10 Max";
  int protocol = 12;
  // Exposes the interface but never answers, like a wireless receiver with no keyboard.
  bool silent = false;
  // Reports the firmware sends on its own (such as layer changes) before each reply.
  int unprompted = 0;
  // Lighting channels compiled into the firmware; others answer 0xFF (id_unhandled).
  std::vector<uint8_t> channels = {3};
  // Current value bytes per (channel, value ID).
  std::map<std::pair<uint8_t, uint8_t>, std::array<uint8_t, 2>> values;
  std::deque<Report> replies;
};

std::vector<FakeBoard> boards;
// Reads that found no reply, so real hardware would have waited for the timeout.
int timed_out_reads = 0;

FakeBoard& BoardOf(hid_device* device) {
  return *reinterpret_cast<FakeBoard*>(device);
}

}  // namespace

int hid_init() {
  return 0;
}

void hid_darwin_set_open_exclusive(int) {}

hid_device_info* hid_enumerate(unsigned short vendor_id, unsigned short product_id) {
  hid_device_info* list = nullptr;
  for (size_t i = boards.size(); i-- > 0;) {
    FakeBoard& board = boards[i];
    if ((vendor_id && vendor_id != board.vendor_id) ||
        (product_id && product_id != board.product_id)) {
      continue;
    }
    // Every keyboard also has a keystroke interface, which must be skipped.
    for (unsigned short usage_page : {0xFF60, 0x0001}) {
      list = new hid_device_info{
          .path = strdup(std::to_string(i).c_str()),
          .vendor_id = board.vendor_id,
          .product_id = board.product_id,
          .serial_number = const_cast<wchar_t*>(L""),
          .manufacturer_string = board.manufacturer.data(),
          .product_string = board.product.data(),
          .usage_page = usage_page,
          .usage = static_cast<unsigned short>(usage_page == 0xFF60 ? 0x61 : 0x06),
          .next = list,
      };
    }
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
  return reinterpret_cast<hid_device*>(&boards[std::stoul(path)]);
}

void hid_close(hid_device*) {}

int hid_write(hid_device* device, const unsigned char* data, size_t length) {
  assert(length == 1 + sizeof(Report) && data[0] == 0);
  FakeBoard& board = BoardOf(device);
  if (board.silent) {
    return static_cast<int>(length);
  }

  Report reply;
  std::memcpy(reply.data(), data + 1, reply.size());
  const uint8_t channel = reply[1];
  const auto value = std::make_pair(channel, reply[2]);
  switch (reply[0]) {
    case 0x01:  // id_get_protocol_version
      reply[1] = board.protocol >> 8;
      reply[2] = board.protocol & 0xFF;
      break;
    case 0x07:  // id_custom_set_value
    case 0x08:  // id_custom_get_value
      if (board.protocol < 12 || std::find(board.channels.begin(), board.channels.end(),
                                           channel) == board.channels.end()) {
        reply[0] = 0xFF;
      } else if (reply[0] == 0x07) {
        board.values[value] = {reply[3], reply[4]};
      } else {
        reply[3] = board.values[value][0];
        reply[4] = board.values[value][1];
      }
      break;
    default:
      reply[0] = 0xFF;
  }
  for (int i = 0; i < board.unprompted; ++i) {
    board.replies.push_back(Report{0xA0, 1});
  }
  board.replies.push_back(reply);
  return static_cast<int>(length);
}

int hid_read_timeout(hid_device* device, unsigned char* data, size_t length, int) {
  FakeBoard& board = BoardOf(device);
  if (board.replies.empty()) {
    ++timed_out_reads;
    return 0;
  }
  std::memcpy(data, board.replies.front().data(), length);
  board.replies.pop_front();
  return static_cast<int>(length);
}

namespace {

void TestReadsAndWritesRgbMatrix() {
  FakeBoard board;
  board.unprompted = 2;
  board.values[{3, 1}] = {200, 0};    // brightness
  board.values[{3, 2}] = {5, 0};      // effect
  board.values[{3, 4}] = {85, 255};   // hue, saturation
  boards = {board};

  auto keyboard = KeychronHid::Open();
  assert(keyboard && keyboard->protocol_version() == 12);
  auto lighting = keyboard->ReadLighting();
  assert(lighting && lighting->effect == 5 && lighting->hue == 85 &&
         lighting->saturation == 255 && lighting->brightness == 200);

  assert(keyboard->WriteLighting({.effect = 1, .hue = 10, .saturation = 20, .brightness = 30}));
  auto& values = boards[0].values;
  assert((values[{3, 2}][0] == 1 && values[{3, 4}] == std::array<uint8_t, 2>{10, 20} &&
          values[{3, 1}][0] == 30));
}

void TestSkipsFirmwareBeforeProtocol12() {
  FakeBoard board;
  board.protocol = 11;
  boards = {board};
  assert(!KeychronHid::Open());
}

void TestSkipsSilentInterface() {
  FakeBoard board;
  board.silent = true;
  boards = {board};
  assert(!KeychronHid::Open());
}

}  // namespace

void TestFindsRgbLightChannel() {
  FakeBoard board;
  board.channels = {2};
  board.values[{2, 4}] = {40, 50};
  boards = {board};
  timed_out_reads = 0;

  auto keyboard = KeychronHid::Open();
  // Probing past the unhandled RGB matrix channel must not wait for a timeout.
  assert(keyboard && keyboard->has_color() && timed_out_reads == 0);
  auto lighting = keyboard->ReadLighting();
  assert(lighting && lighting->hue == 40 && lighting->saturation == 50);
  assert(keyboard->WriteLighting({.effect = 1, .hue = 1, .saturation = 2, .brightness = 3}));
  assert((boards[0].values[{2, 4}] == std::array<uint8_t, 2>{1, 2}));
}

void TestSingleColorLedMatrixKeepsColorUntouched() {
  FakeBoard board;
  board.channels = {5};
  board.values[{5, 2}] = {1, 0};
  board.values[{5, 1}] = {100, 0};
  boards = {board};

  auto keyboard = KeychronHid::Open();
  assert(keyboard && !keyboard->has_color());
  auto lighting = keyboard->ReadLighting();
  assert(lighting && lighting->effect == 1 && lighting->brightness == 100);
  assert(keyboard->WriteLighting({.effect = 0, .hue = 9, .saturation = 9, .brightness = 7}));
  auto& values = boards[0].values;
  assert((values[{5, 2}][0] == 0 && values[{5, 1}][0] == 7 && !values.count({5, 4})));
}

void TestBacklightSetsBrightnessOnly() {
  FakeBoard board;
  board.channels = {1};
  boards = {board};

  auto keyboard = KeychronHid::Open();
  assert(keyboard && !keyboard->has_color());
  auto lighting = keyboard->ReadLighting();
  // Without an effect list the backlight reads as solid color.
  assert(lighting && lighting->effect == 1);
  assert(keyboard->WriteLighting({.effect = 5, .hue = 9, .saturation = 9, .brightness = 7}));
  auto& values = boards[0].values;
  assert((values[{1, 1}][0] == 7 && !values.count({1, 2}) && !values.count({1, 4})));
}

void TestSkipsKeyboardWithoutLighting() {
  FakeBoard board;
  board.channels = {};
  boards = {board};
  assert(!KeychronHid::Open());
}

int main() {
  TestReadsAndWritesRgbMatrix();
  TestSkipsFirmwareBeforeProtocol12();
  TestSkipsSilentInterface();
  TestFindsRgbLightChannel();
  TestSingleColorLedMatrixKeepsColorUntouched();
  TestBacklightSetsBrightnessOnly();
  TestSkipsKeyboardWithoutLighting();
  std::puts("via_test: ok");
}
