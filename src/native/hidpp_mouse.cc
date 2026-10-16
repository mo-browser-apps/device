#include "hidpp_mouse.h"

#include <hidapi.h>

#include <algorithm>
#include <set>
#include <thread>

namespace {

constexpr unsigned short kLogitech = 0x046D;
constexpr unsigned short kBoltReceiver = 0xC548;
// HID++ uses a vendor-defined usage page: usage 1 carries short reports, 2 long ones.
constexpr unsigned short kHidppUsagePage = 0xFF00;
constexpr unsigned short kHidppLongUsage = 0x02;
// A Bolt receiver pairs up to six devices, numbered from 1.
constexpr uint8_t kMaxPaired = 6;

constexpr uint8_t kShortReport = 0x10;
constexpr uint8_t kLongReport = 0x11;
constexpr size_t kLongLength = 20;
// Marks this app's requests, so replies to other apps such as Logi Options+ are skipped.
constexpr uint8_t kSoftwareId = 0x0A;
// The receiver answers a request for an empty or unreachable slot with this HID++ 1.0
// error; the mouse answers a request it cannot handle with the HID++ 2.0 one.
constexpr uint8_t kHidpp10Error = 0x8F;
constexpr uint8_t kHidpp20Error = 0xFF;

// HID++ 2.0 features, from Logitech's published specifications and Solaar.
constexpr uint8_t kRoot = 0x00;  // Always at index 0.
constexpr uint16_t kDeviceName = 0x0005;
constexpr uint16_t kUnifiedBattery = 0x1004;
constexpr uint16_t kAdjustableDpi = 0x2201;
constexpr uint8_t kPingData = 0x5A;

constexpr int kReplyTimeoutMs = 500;

}  // namespace

class HidppReceiver {
 public:
  explicit HidppReceiver(hid_device* device) : device_(device) {}
  ~HidppReceiver() { hid_close(device_); }
  HidppReceiver(const HidppReceiver&) = delete;
  HidppReceiver& operator=(const HidppReceiver&) = delete;

  // Sends one long HID++ request to a paired device and returns its reply's parameters.
  std::optional<std::array<uint8_t, 16>> Request(uint8_t index, uint8_t feature,
                                                 uint8_t function,
                                                 std::initializer_list<uint8_t> params) {
    // The scanning thread and write threads share the interface.
    std::lock_guard lock(mutex_);
    uint8_t request[kLongLength] = {kLongReport, index, feature,
                                    static_cast<uint8_t>((function << 4) | kSoftwareId)};
    std::copy(params.begin(), params.end(), request + 4);
    if (hid_write(device_, request, sizeof(request)) != static_cast<int>(sizeof(request))) {
      return std::nullopt;
    }

    // Notifications, such as a mouse connecting, and replies to other apps arrive here
    // too, so skip anything that does not answer this request until the deadline.
    const auto deadline =
        std::chrono::steady_clock::now() + std::chrono::milliseconds(kReplyTimeoutMs);
    while (true) {
      const auto remaining = std::chrono::duration_cast<std::chrono::milliseconds>(
          deadline - std::chrono::steady_clock::now());
      uint8_t reply[kLongLength] = {};
      if (remaining.count() <= 0 ||
          hid_read_timeout(device_, reply, sizeof(reply),
                           static_cast<int>(remaining.count())) <= 0) {
        return std::nullopt;
      }
      if (reply[1] != index) continue;
      const bool error = (reply[0] == kShortReport && reply[2] == kHidpp10Error) ||
                         (reply[0] == kLongReport && reply[2] == kHidpp20Error);
      if (error && reply[3] == request[2] && reply[4] == request[3]) return std::nullopt;
      if (reply[0] == kLongReport && reply[2] == request[2] && reply[3] == request[3]) {
        std::array<uint8_t, 16> result;
        std::copy(reply + 4, reply + kLongLength, result.begin());
        return result;
      }
    }
  }

 private:
  std::mutex mutex_;
  hid_device* device_;
};

std::optional<HidppMouse::Params> HidppMouse::Request(uint8_t feature, uint8_t function,
                                                      std::initializer_list<uint8_t> params) {
  return receiver_->Request(index_, feature, function, params);
}

uint8_t HidppMouse::FeatureIndex(uint16_t feature) {
  std::optional<Params> reply =
      Request(kRoot, 0, {static_cast<uint8_t>(feature >> 8), static_cast<uint8_t>(feature)});
  return reply ? (*reply)[0] : 0;
}

bool HidppMouse::Open() {
  // Ping echoes its last byte after the protocol version; HID++ 1.0 devices reject it.
  std::optional<Params> ping = Request(kRoot, 1, {0, 0, kPingData});
  if (!ping || (*ping)[2] != kPingData) return false;
  protocol_ = std::to_string((*ping)[0]) + "." + std::to_string((*ping)[1]);

  const uint8_t name_feature = FeatureIndex(kDeviceName);
  battery_feature_ = FeatureIndex(kUnifiedBattery);
  dpi_feature_ = FeatureIndex(kAdjustableDpi);
  if (!name_feature || !battery_feature_ || !dpi_feature_) return false;

  std::optional<Params> length = Request(name_feature, 0);
  if (!length) return false;
  while (name_.size() < (*length)[0]) {
    std::optional<Params> chunk =
        Request(name_feature, 1, {static_cast<uint8_t>(name_.size())});
    if (!chunk) return false;
    for (uint8_t c : *chunk) {
      if (name_.size() < (*length)[0]) name_ += static_cast<char>(c);
    }
  }

  // Sensor 0's DPI list: values in ascending order, where an entry 0xE000 | step means
  // every step between the values around it is supported. A 0 ends the list.
  // ponytail: reads the list's first reply only (7 entries); enough for a min and max.
  std::optional<Params> list = Request(dpi_feature_, 1, {0});
  if (!list) return false;
  for (size_t i = 1; i + 1 < list->size(); i += 2) {
    const int value = ((*list)[i] << 8) | (*list)[i + 1];
    if (value == 0) break;
    if ((value >> 13) == 7) continue;
    if (!min_dpi_) min_dpi_ = value;
    max_dpi_ = value;
  }
  return min_dpi_ > 0;
}

std::optional<HidppMouse::Battery> HidppMouse::ReadBattery() {
  // Replies with state of charge, level flags, and charging status.
  std::optional<Params> status = Request(battery_feature_, 1);
  if (!status) return std::nullopt;
  Battery battery{.percent = (*status)[0]};
  // Mice that only report a level: full, good, low, or critical.
  if (battery.percent == 0) {
    const uint8_t level = (*status)[1];
    battery.percent = level & 8 ? 100 : level & 4 ? 50 : level & 2 ? 20 : 5;
  }
  // 1 is charging and 2 is charging slowly; 3 is fully charged.
  battery.charging = (*status)[2] == 1 || (*status)[2] == 2;
  return battery;
}

std::optional<int> HidppMouse::ReadDpi() {
  std::optional<Params> dpi = Request(dpi_feature_, 2, {0});
  if (!dpi) return std::nullopt;
  return ((*dpi)[1] << 8) | (*dpi)[2];
}

void HidppMouse::WriteDpiAsync(int dpi, WriteDone done) {
  std::lock_guard lock(write_mutex_);
  pending_ = std::clamp(dpi, min_dpi_, max_dpi_);
  waiting_.push_back(std::move(done));
  if (writing_) return;
  writing_ = true;
  // The thread keeps the mouse alive until it finishes, so it is never joined.
  std::thread([self = shared_from_this()] { self->DrainWrites(); }).detach();
}

void HidppMouse::DrainWrites() {
  while (true) {
    int dpi;
    std::vector<WriteDone> waiting;
    {
      std::lock_guard lock(write_mutex_);
      if (!pending_) {
        writing_ = false;
        return;
      }
      dpi = *pending_;
      pending_.reset();
      waiting.swap(waiting_);
    }
    const bool ok =
        !failed_ && Request(dpi_feature_, 3,
                            {0, static_cast<uint8_t>(dpi >> 8), static_cast<uint8_t>(dpi)});
    if (!ok) failed_ = true;
    for (WriteDone& done : waiting) done(ok);
  }
}

std::optional<std::vector<HidppScanner::Found>> HidppScanner::Scan() {
  const auto now = std::chrono::steady_clock::now();
  if (next_scan_ && now < *next_scan_) return std::nullopt;
  next_scan_ = now + interval_;

  std::vector<Found> found;
  if (hid_init() != 0) return found;

  // ponytail: Bolt receivers only, through the long-report interface. On Windows, where
  // short reports arrive on a separate interface, an empty slot waits for the timeout.
  std::set<std::string> present;
  hid_device_info* devices = hid_enumerate(kLogitech, kBoltReceiver);
  for (hid_device_info* info = devices; info; info = info->next) {
    if (info->usage_page != kHidppUsagePage || info->usage != kHidppLongUsage) continue;
    present.insert(info->path);
    if (!receivers_.count(info->path)) {
      if (hid_device* device = hid_open_path(info->path)) {
        receivers_[info->path] = std::make_shared<HidppReceiver>(device);
      }
    }
  }
  hid_free_enumeration(devices);
  std::erase_if(receivers_, [&](const auto& receiver) { return !present.count(receiver.first); });
  std::erase_if(open_, [&](const auto& open) { return !present.count(open.first.first); });

  for (const auto& [path, receiver] : receivers_) {
    for (uint8_t index = 1; index <= kMaxPaired; ++index) {
      const auto key = std::make_pair(path, index);
      if (auto open = open_.find(key); open != open_.end()) {
        std::optional<HidppMouse::Battery> battery;
        if (!open->second->failed()) battery = open->second->ReadBattery();
        if (battery) {
          found.push_back({open->second, *battery, std::nullopt});
          continue;
        }
        open_.erase(open);
      }

      std::shared_ptr<HidppMouse> mouse(new HidppMouse(receiver, index));
      if (!mouse->Open()) continue;
      std::optional<HidppMouse::Battery> battery = mouse->ReadBattery();
      std::optional<int> dpi = mouse->ReadDpi();
      if (!battery || !dpi) continue;
      open_[key] = mouse;
      found.push_back({mouse, *battery, dpi});
    }
  }
  return found;
}
