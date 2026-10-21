#ifndef HIDPP_MOUSE_H_
#define HIDPP_MOUSE_H_

#include <array>
#include <chrono>
#include <cstdint>
#include <map>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <vector>

// A Logitech Bolt receiver's HID++ interface, shared by the mice paired with it.
class HidppReceiver;

// A wireless mouse behind a Logitech Bolt receiver that speaks HID++ 2.0.
//
// Only what the app shows is used: the name, battery level, and sensor DPI, which can
// also be set. Like the Logitech apps, a DPI set this way lasts until the mouse is
// switched off.
//
// Opened by HidppScanner, and used only on the thread that calls it.
class HidppMouse {
 public:
  struct Battery {
    int percent = 0;
    bool charging = false;
  };

  HidppMouse(const HidppMouse&) = delete;
  HidppMouse& operator=(const HidppMouse&) = delete;

  const std::string& name() const { return name_; }
  // The HID++ protocol version, such as "4.5".
  const std::string& protocol() const { return protocol_; }
  int min_dpi() const { return min_dpi_; }
  int max_dpi() const { return max_dpi_; }

  std::optional<Battery> ReadBattery();
  std::optional<int> ReadDpi();

  // Clamps dpi to the sensor's range and writes it; false if the mouse did not answer.
  // A failed mouse rejects writes without touching the receiver.
  bool WriteDpi(int dpi);

  // True once a request failed, most likely because the mouse fell asleep or the
  // receiver was unplugged. The next scan then looks for the mouse again.
  bool failed() const { return failed_; }

 private:
  friend class HidppScanner;
  using Params = std::array<uint8_t, 16>;

  HidppMouse(std::shared_ptr<HidppReceiver> receiver, uint8_t index)
      : receiver_(std::move(receiver)), index_(index) {}

  // Reads everything the app needs; false if the mouse does not answer or lacks a feature.
  bool Open();
  std::optional<Params> Request(uint8_t feature, uint8_t function,
                                std::initializer_list<uint8_t> params = {});
  // The index of a HID++ 2.0 feature on this mouse, or 0 when it has none.
  uint8_t FeatureIndex(uint16_t feature);

  std::shared_ptr<HidppReceiver> receiver_;
  uint8_t index_;
  std::string name_;
  std::string protocol_;
  uint8_t battery_feature_ = 0;
  uint8_t dpi_feature_ = 0;
  int min_dpi_ = 0;
  int max_dpi_ = 0;
  bool failed_ = false;
};

// Finds mice paired with Logitech Bolt receivers. Every call must come from the same
// thread, since HIDAPI enumeration is not thread-safe.
class HidppScanner {
 public:
  struct Found {
    std::shared_ptr<HidppMouse> mouse;
    HidppMouse::Battery battery;
    // The DPI read when the mouse was found; unset for mice found earlier.
    std::optional<int> dpi;
  };

  // Mice are looked for at most once per interval, since a sleeping mouse makes each
  // probe wait for a timeout.
  explicit HidppScanner(std::chrono::milliseconds interval) : interval_(interval) {}

  // Every mouse that answers, or nothing if the interval has not passed. A mouse that
  // stays awake keeps its HidppMouse; one that fell asleep and woke up gets a new one.
  std::optional<std::vector<Found>> Scan();

 private:
  std::chrono::milliseconds interval_;
  std::optional<std::chrono::steady_clock::time_point> next_scan_;
  // By receiver HID path.
  std::map<std::string, std::shared_ptr<HidppReceiver>> receivers_;
  // By receiver HID path and paired device index.
  std::map<std::pair<std::string, uint8_t>, std::shared_ptr<HidppMouse>> open_;
};

#endif  // HIDPP_MOUSE_H_
