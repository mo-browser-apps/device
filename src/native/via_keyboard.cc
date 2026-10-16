#include "via_keyboard.h"

#include <hidapi.h>

#include <algorithm>
#include <chrono>
#include <cstdio>
#include <thread>

#ifdef __APPLE__
#include <hidapi_darwin.h>
#endif

namespace {

// Keyboards whose effect lists are known, so the editor can offer more than solid color.
// Any other VIA keyboard works with solid color only. From Keychron's VIA definitions
// (keyboards/keychron/<model>/via_json in Keychron/qmk_firmware): 2 is Breathing and
// 5 is Cycle Left Right on all of them.
struct KnownModel {
  unsigned short vendor_id;
  unsigned short product_id;
  const char* id;
  int breathing_effect;
  int wave_effect;
};
constexpr KnownModel kKnownModels[] = {
    {0x3434, 0x0AA0, "keychron-k10-max", 2, 5},  // K10 Max ANSI RGB
    {0x3434, 0x0E20, "keychron-k2-he", 2, 5},    // K2 HE ANSI RGB
    {0x3434, 0x0E21, "keychron-k2-he", 2, 5},    // K2 HE ISO RGB
    {0x3434, 0x0E22, "keychron-k2-he", 2, 5},    // K2 HE JIS RGB
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

ViaKeyboard::Model MakeModel(const hid_device_info& info) {
  char id[16];
  std::snprintf(id, sizeof(id), "via-%04x-%04x", info.vendor_id, info.product_id);
  ViaKeyboard::Model model{.id = id, .name = Narrow(info.product_string)};
  if (model.name.empty()) {
    model.name = "Keyboard";
  }
  for (const KnownModel& known : kKnownModels) {
    if (known.vendor_id == info.vendor_id && known.product_id == info.product_id) {
      model.id = known.id;
      model.breathing_effect = known.breathing_effect;
      model.wave_effect = known.wave_effect;
    }
  }
  return model;
}

}  // namespace

std::shared_ptr<ViaKeyboard> ViaKeyboard::Open(const hid_device_info& info) {
  hid_device* device = hid_open_path(info.path);
  if (!device) {
    return nullptr;
  }

  std::shared_ptr<ViaKeyboard> keyboard(new ViaKeyboard(device, MakeModel(info)));
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
  return (!channel_->effect || SetValue(kEffect, lighting.effect)) &&
         (!channel_->color || SetValue(kColor, lighting.hue, lighting.saturation)) &&
         SetValue(kBrightness, lighting.brightness);
}

void ViaKeyboard::WriteLightingAsync(const Lighting& lighting, WriteDone done) {
  std::lock_guard lock(write_mutex_);
  pending_ = lighting;
  waiting_.push_back(std::move(done));
  if (writing_) {
    return;
  }
  writing_ = true;
  // The thread keeps the keyboard alive until it finishes, so it is never joined.
  std::thread([self = shared_from_this()] { self->DrainWrites(); }).detach();
}

void ViaKeyboard::DrainWrites() {
  while (true) {
    Lighting lighting;
    std::vector<WriteDone> waiting;
    {
      std::lock_guard lock(write_mutex_);
      if (!pending_) {
        writing_ = false;
        return;
      }
      lighting = *pending_;
      pending_.reset();
      waiting.swap(waiting_);
    }
    const bool ok = !failed_ && WriteLighting(lighting);
    if (!ok) {
      failed_ = true;
    }
    for (WriteDone& done : waiting) {
      done(ok);
    }
  }
}

ViaScanner::Changes ViaScanner::Scan() {
  Changes changes;
  if (!initialized_) {
    // Once, before any handle exists, as HIDAPI requires when threads share it.
    if (hid_init() != 0) {
      return changes;
    }
#ifdef __APPLE__
    // Share the interface so the VIA or Keychron Launcher apps can stay open.
    hid_darwin_set_open_exclusive(0);
#endif
    initialized_ = true;
  }

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
