#include "keychron_hid.h"

#include <hidapi.h>

#include <algorithm>
#include <chrono>

#ifdef __APPLE__
#include <hidapi_darwin.h>
#endif

namespace {

// USB identities and effect lists from Keychron's VIA definitions
// (keyboards/keychron/<model>/via_json in Keychron/qmk_firmware): 2 is Breathing and
// 5 is Cycle Left Right on all of them.
constexpr unsigned short kVendorId = 0x3434;
constexpr KeychronHid::Model kModels[] = {
    {0x0AA0, "keychron-k10-max", "Keychron K10 Max", 2, 5},  // ANSI RGB
    {0x0E20, "keychron-k2-he", "Keychron K2 HE", 2, 5},      // ANSI RGB
    {0x0E21, "keychron-k2-he", "Keychron K2 HE", 2, 5},      // ISO RGB
    {0x0E22, "keychron-k2-he", "Keychron K2 HE", 2, 5},      // JIS RGB
};

// QMK exposes VIA on a raw HID interface with this vendor-defined usage.
constexpr unsigned short kViaUsagePage = 0xFF60;
constexpr unsigned short kViaUsage = 0x61;

// VIA command and value IDs from QMK quantum/via.h.
constexpr uint8_t kGetProtocolVersion = 0x01;
// Channel-based custom value commands arrived in protocol 12 (VIA 3); older firmware
// uses different command and value IDs.
constexpr int kMinProtocolVersion = 12;
constexpr uint8_t kCustomSetValue = 0x07;
constexpr uint8_t kCustomGetValue = 0x08;
constexpr uint8_t kUnhandled = 0xFF;
// The same value IDs are used on every lighting channel that has the value.
constexpr uint8_t kBrightness = 1;
constexpr uint8_t kEffect = 2;
constexpr uint8_t kColor = 4;

// The firmware does not report which lighting it has, so channels are probed in this
// order and the first one it handles is used. The backlight channel's effect is a
// breathing on/off switch, not an effect list, so it is left alone.
constexpr KeychronHid::Channel kChannels[] = {
    {.id = 3, .color = true, .effect = true},    // RGB matrix
    {.id = 2, .color = true, .effect = true},    // RGB light
    {.id = 5, .color = false, .effect = true},   // LED matrix, single color
    {.id = 1, .color = false, .effect = false},  // Backlight, single color
};
// Effect 1 is the solid color effect on every channel with an effect list.
constexpr int kSolidEffect = 1;

constexpr int kReplyTimeoutMs = 500;

}  // namespace

std::unique_ptr<KeychronHid> KeychronHid::Open() {
  if (hid_init() != 0) {
    return nullptr;
  }
#ifdef __APPLE__
  // Share the interface so the VIA or Keychron Launcher apps can stay open.
  hid_darwin_set_open_exclusive(0);
#endif

  hid_device* device = nullptr;
  const Model* model = nullptr;
  hid_device_info* devices = hid_enumerate(kVendorId, 0);
  for (hid_device_info* info = devices; info && !device; info = info->next) {
    if (info->usage_page != kViaUsagePage || info->usage != kViaUsage) {
      continue;
    }
    for (const Model& candidate : kModels) {
      if (candidate.product_id == info->product_id) {
        model = &candidate;
        device = hid_open_path(info->path);
        break;
      }
    }
  }
  hid_free_enumeration(devices);
  if (!device) {
    return nullptr;
  }

  std::unique_ptr<KeychronHid> keyboard(new KeychronHid(device, model));
  Report report{kGetProtocolVersion};
  if (!keyboard->Transact(report)) {
    return nullptr;
  }
  keyboard->protocol_version_ = (report[1] << 8) | report[2];
  if (keyboard->protocol_version_ < kMinProtocolVersion) {
    return nullptr;
  }
  for (const Channel& channel : kChannels) {
    keyboard->channel_ = &channel;
    if (keyboard->GetValue(kBrightness)) {
      return keyboard;
    }
  }
  return nullptr;
}

KeychronHid::~KeychronHid() {
  hid_close(device_);
}

bool KeychronHid::Transact(Report& report) {
  // hidapi expects a leading report ID; VIA reports have none, so it is 0.
  uint8_t out[1 + sizeof(Report)] = {0};
  std::copy(report.begin(), report.end(), out + 1);
  if (hid_write(device_, out, sizeof(out)) != static_cast<int>(sizeof(out))) {
    return false;
  }

  // VIA echoes the command ID, or replies 0xFF for commands it does not handle.
  // Keychron firmware also sends unprompted reports, such as layer changes when Fn
  // is pressed, so skip anything that is not the echo until the deadline.
  const uint8_t command = report[0];
  const auto deadline =
      std::chrono::steady_clock::now() + std::chrono::milliseconds(kReplyTimeoutMs);
  while (true) {
    const auto remaining = std::chrono::duration_cast<std::chrono::milliseconds>(
        deadline - std::chrono::steady_clock::now());
    if (remaining.count() <= 0 ||
        hid_read_timeout(device_, report.data(), report.size(),
                         static_cast<int>(remaining.count())) <= 0) {
      return false;
    }
    if (report[0] == command || report[0] == kUnhandled) {
      return report[0] == command;
    }
  }
}

std::optional<KeychronHid::Report> KeychronHid::GetValue(uint8_t value_id) {
  Report report{kCustomGetValue, channel_->id, value_id};
  if (!Transact(report)) {
    return std::nullopt;
  }
  return report;
}

bool KeychronHid::SetValue(uint8_t value_id, uint8_t first, uint8_t second) {
  Report report{kCustomSetValue, channel_->id, value_id, first, second};
  return Transact(report);
}

std::optional<KeychronHid::Lighting> KeychronHid::ReadLighting() {
  // Replies repeat [command, channel, value_id] before the value bytes.
  Lighting lighting{.effect = kSolidEffect};
  if (channel_->effect) {
    std::optional<Report> effect = GetValue(kEffect);
    if (!effect) return std::nullopt;
    lighting.effect = (*effect)[3];
  }
  if (channel_->color) {
    std::optional<Report> color = GetValue(kColor);
    if (!color) return std::nullopt;
    lighting.hue = (*color)[3];
    lighting.saturation = (*color)[4];
  }
  std::optional<Report> brightness = GetValue(kBrightness);
  if (!brightness) return std::nullopt;
  lighting.brightness = (*brightness)[3];
  return lighting;
}

bool KeychronHid::WriteLighting(const Lighting& lighting) {
  return (!channel_->effect || SetValue(kEffect, lighting.effect)) &&
         (!channel_->color || SetValue(kColor, lighting.hue, lighting.saturation)) &&
         SetValue(kBrightness, lighting.brightness);
}
