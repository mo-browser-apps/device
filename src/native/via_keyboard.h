#ifndef VIA_KEYBOARD_H_
#define VIA_KEYBOARD_H_

#include <array>
#include <atomic>
#include <chrono>
#include <cstdint>
#include <functional>
#include <map>
#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <utility>
#include <vector>

struct hid_device_;
struct hid_device_info;

// Controls the backlight of a QMK keyboard with VIA enabled.
//
// The keyboard speaks the QMK/VIA raw HID protocol on a vendor-defined interface,
// separate from the one that carries keystrokes. Only the VIA "custom value"
// get/set commands on the keyboard's lighting channel are used. They change the live
// lighting state without writing EEPROM, so unplugging the keyboard restores
// its saved lighting.
//
// Opened by ViaScanner. After that, only WriteLightingAsync() may be called, from any
// thread; the handle is then used by one write thread at a time.
class ViaKeyboard : public std::enable_shared_from_this<ViaKeyboard> {
 public:
  // How the keyboard's VIA interface reaches the computer.
  enum class Link { kCable, kReceiver, kBluetooth };

  struct Model {
    // Shared by every unit of the product: a known model's ID, or "via-<vid>-<pid>".
    std::string id;
    // The USB product string.
    std::string name;
    // Firmware effect numbers for the editor's Pulse and Wave, or 0 when unavailable.
    // They depend on the effects compiled into the firmware, so they come from the
    // model's VIA definition; only solid color (1) is the same on every keyboard.
    int breathing_effect = 0;
    int wave_effect = 0;
    Link link = Link::kCable;
  };

  // A QMK lighting system as VIA exposes it.
  struct Channel {
    uint8_t id;
    // Has hue and saturation; single-color lighting has brightness only.
    bool color;
    // Has an effect list where 0 is off and 1 is solid color.
    bool effect;
  };

  // Raw VIA values, each from 0 to 255. Effect 0 means lighting off.
  struct Lighting {
    int effect = 0;
    int hue = 0;
    int saturation = 0;
    int brightness = 0;
  };

  using WriteDone = std::function<void(bool ok)>;

  // Opens the VIA interface if it answers and has lighting; nullptr otherwise.
  static std::shared_ptr<ViaKeyboard> Open(const hid_device_info& info);

  ~ViaKeyboard();
  ViaKeyboard(const ViaKeyboard&) = delete;
  ViaKeyboard& operator=(const ViaKeyboard&) = delete;

  const Model& model() const { return model_; }

  // The VIA protocol version reported by the firmware.
  int protocol_version() const { return protocol_version_; }

  // False for single-color lighting, which ignores hue and saturation.
  bool has_color() const { return channel_->color; }

  std::optional<Lighting> ReadLighting();

  // Sends effect, color, and brightness; false if any command was not acknowledged.
  bool WriteLighting(const Lighting& lighting);

  // Writes on a background thread and calls done there. Lighting queued while a write
  // is running is merged: only the latest is sent, and each waiting done gets its result.
  void WriteLightingAsync(const Lighting& lighting, WriteDone done);

  // True once a write failed, most likely because the keyboard was unplugged. Later
  // writes fail at once, and the next scan reopens the interface if it is still there.
  bool failed() const { return failed_; }

 private:
  using Report = std::array<uint8_t, 32>;

  ViaKeyboard(hid_device_* device, Model model) : device_(device), model_(std::move(model)) {}

  // Runs on the write thread until no lighting is pending.
  void DrainWrites();

  // Sends one VIA report and replaces it with the keyboard's reply.
  bool Transact(Report& report);
  std::optional<Report> GetValue(uint8_t value_id);
  bool SetValue(uint8_t value_id, uint8_t first, uint8_t second = 0);

  hid_device_* device_;
  Model model_;
  const Channel* channel_ = nullptr;
  int protocol_version_ = 0;
  std::atomic<bool> failed_ = false;

  std::mutex write_mutex_;
  std::optional<Lighting> pending_;
  std::vector<WriteDone> waiting_;
  bool writing_ = false;
};

// Tracks which VIA keyboards are plugged in by comparing HID enumerations. Every call
// must come from the same thread, since HIDAPI enumeration is not thread-safe.
class ViaScanner {
 public:
  struct Added {
    std::shared_ptr<ViaKeyboard> keyboard;
    ViaKeyboard::Lighting lighting;
  };
  struct Changes {
    std::vector<Added> added;
    std::vector<std::shared_ptr<ViaKeyboard>> removed;
  };

  // An interface that does not answer, such as a wireless receiver with no keyboard,
  // is probed again only after retry_delay, since each probe waits for a timeout.
  explicit ViaScanner(std::chrono::milliseconds retry_delay) : retry_delay_(retry_delay) {}

  // Reports keyboards plugged in or unplugged since the last call. Keyboards whose
  // writes failed are reported as removed and, if still present, added again.
  Changes Scan();

 private:
  std::chrono::milliseconds retry_delay_;
  bool initialized_ = false;
  std::map<std::string, std::shared_ptr<ViaKeyboard>> open_;
  std::map<std::string, std::chrono::steady_clock::time_point> retry_at_;
};

#endif  // VIA_KEYBOARD_H_
