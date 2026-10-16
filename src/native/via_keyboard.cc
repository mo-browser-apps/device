#include "via_keyboard.h"

#include <hidapi.h>

#include <algorithm>
#include <chrono>

namespace {

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
constexpr ViaKeyboard::Channel kChannels[] = {
    {.id = 3, .color = true, .effect = true},    // RGB matrix
    {.id = 2, .color = true, .effect = true},    // RGB light
    {.id = 5, .color = false, .effect = true},   // LED matrix, single color
    {.id = 1, .color = false, .effect = false},  // Backlight, single color
};
// Effect 1 is the solid color effect on every channel with an effect list.
constexpr int kSolidEffect = 1;

constexpr int kReplyTimeoutMs = 500;

// ponytail: non-ASCII characters become '?'; add UTF-8 encoding if a product name needs it.
std::string Narrow(const wchar_t* text) {
  std::string result;
  for (; text && *text; ++text) {
    result += *text < 0x80 ? static_cast<char>(*text) : '?';
  }
  // Some firmware pads its strings, such as "Keychron ".
  result.erase(result.find_last_not_of(' ') + 1);
  return result;
}

ViaKeyboard::Hardware MakeHardware(const hid_device_info& info) {
  return {
      .vendor_id = info.vendor_id,
      .product_id = info.product_id,
      .product_name = Narrow(info.product_string),
      .bluetooth = info.bus_type == HID_API_BUS_BLUETOOTH,
  };
}

}  // namespace

std::shared_ptr<ViaKeyboard> ViaKeyboard::Open(const hid_device_info& info) {
  hid_device* device = hid_open_path(info.path);
  if (!device) {
    return nullptr;
  }

  std::shared_ptr<ViaKeyboard> keyboard(new ViaKeyboard(device, MakeHardware(info)));
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

ViaKeyboard::~ViaKeyboard() {
  hid_close(device_);
}

bool ViaKeyboard::Transact(Report& report) {
  // hidapi expects a leading report ID; VIA reports have none, so it is 0.
  uint8_t out[1 + sizeof(Report)] = {0};
  std::copy(report.begin(), report.end(), out + 1);
  if (hid_write(device_, out, sizeof(out)) != static_cast<int>(sizeof(out))) {
    return false;
  }

  // VIA replies with the request, its command ID or 0xFF (unhandled) in front; custom
  // value replies keep the channel and value ID, and unhandled ones keep every byte.
  // Replies to other apps using the interface, such as VIA or Keychron Launcher, arrive
  // here too, as do unprompted reports such as layer changes when Fn is pressed, so
  // skip anything that does not answer this request until the deadline.
  const Report request = report;
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
    if (report[0] == kUnhandled &&
        std::equal(report.begin() + 1, report.end(), request.begin() + 1)) {
      return false;
    }
    if (report[0] == request[0] && (request[0] == kGetProtocolVersion ||
                                    (report[1] == request[1] && report[2] == request[2]))) {
      return true;
    }
  }
}

std::optional<ViaKeyboard::Report> ViaKeyboard::GetValue(uint8_t value_id) {
  Report report{kCustomGetValue, channel_->id, value_id};
  if (!Transact(report)) {
    return std::nullopt;
  }
  return report;
}

bool ViaKeyboard::SetValue(uint8_t value_id, uint8_t first, uint8_t second) {
  Report report{kCustomSetValue, channel_->id, value_id, first, second};
  return Transact(report);
}

std::optional<ViaKeyboard::Lighting> ViaKeyboard::ReadLighting() {
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

bool ViaKeyboard::WriteLighting(const Lighting& lighting) {
  const bool ok = !failed_ &&
                  (!channel_->effect || SetValue(kEffect, lighting.effect)) &&
                  (!channel_->color || SetValue(kColor, lighting.hue, lighting.saturation)) &&
                  SetValue(kBrightness, lighting.brightness);
  if (!ok) failed_ = true;
  return ok;
}

ViaScanner::Changes ViaScanner::Scan() {
  Changes changes;

  // Enumeration only reads the system's device list; no keyboard I/O happens here.
  std::map<std::string, hid_device_info*> present;
  hid_device_info* devices = hid_enumerate(0, 0);
  for (hid_device_info* info = devices; info; info = info->next) {
    if (info->usage_page == kViaUsagePage && info->usage == kViaUsage) {
      present[info->path] = info;
    }
  }

  for (auto it = open_.begin(); it != open_.end();) {
    if (!present.count(it->first) || it->second->failed()) {
      changes.removed.push_back(std::move(it->second));
      it = open_.erase(it);
    } else {
      ++it;
    }
  }
  // An unplugged interface is probed at once when it comes back.
  std::erase_if(retry_at_, [&](const auto& retry) { return !present.count(retry.first); });

  const auto now = std::chrono::steady_clock::now();
  for (const auto& [path, info] : present) {
    if (open_.count(path) || (retry_at_.count(path) && now < retry_at_[path])) {
      continue;
    }
    std::shared_ptr<ViaKeyboard> keyboard = ViaKeyboard::Open(*info);
    std::optional<ViaKeyboard::Lighting> lighting;
    if (keyboard) {
      lighting = keyboard->ReadLighting();
    }
    if (!lighting) {
      retry_at_[path] = now + retry_delay_;
      continue;
    }
    retry_at_.erase(path);
    open_[path] = keyboard;
    changes.added.push_back({std::move(keyboard), *lighting});
  }
  hid_free_enumeration(devices);
  return changes;
}
