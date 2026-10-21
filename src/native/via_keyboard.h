#ifndef VIA_KEYBOARD_H_
#define VIA_KEYBOARD_H_

#include <array>
#include <chrono>
#include <cstdint>
#include <map>
#include <memory>
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
// Opened by ViaScanner, and used only on the thread that calls it.
class ViaKeyboard {
 public:
  // What HIDAPI reports about the VIA interface. Known-model policy, such as effect
  // numbers or which product is a wireless receiver, belongs to the main process.
  struct Hardware {
    unsigned short vendor_id = 0;
    unsigned short product_id = 0;
    // The USB product string with trailing spaces removed; may be empty.
    std::string product_name;
    // Bluetooth; anything else, including USB and a wireless receiver, is a cable.
    bool bluetooth = false;
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

  // Opens the VIA interface if it answers and has lighting; nullptr otherwise.
  static std::shared_ptr<ViaKeyboard> Open(const hid_device_info& info);

  ~ViaKeyboard();
  ViaKeyboard(const ViaKeyboard&) = delete;
  ViaKeyboard& operator=(const ViaKeyboard&) = delete;

  const Hardware& hardware() const { return hardware_; }

  // The VIA protocol version reported by the firmware.
  int protocol_version() const { return protocol_version_; }

  // False for single-color lighting, which ignores hue and saturation.
  bool has_color() const { return channel_->color; }

  // False for lighting without an effect list, which ignores the effect.
  bool has_effect() const { return channel_->effect; }

  std::optional<Lighting> ReadLighting();

  // Sends effect, color, and brightness; false if any command was not acknowledged.
  // A failed keyboard rejects writes without touching the device.
  bool WriteLighting(const Lighting& lighting);

  // True once a write failed, most likely because the keyboard was unplugged. Later
  // writes fail at once, and the next scan reopens the interface if it is still there.
  bool failed() const { return failed_; }

 private:
  using Report = std::array<uint8_t, 32>;

  ViaKeyboard(hid_device_* device, std::string path, Hardware hardware)
      : device_(device), path_(std::move(path)), hardware_(std::move(hardware)) {}

  // Sends one VIA report and replaces it with the keyboard's reply.
  bool Transact(Report& report);
  std::optional<Report> GetValue(uint8_t value_id);
  bool SetValue(uint8_t value_id, uint8_t first, uint8_t second = 0);

  hid_device_* device_;
  std::string path_;
  Hardware hardware_;
  const Channel* channel_ = nullptr;
  int protocol_version_ = 0;
  bool failed_ = false;
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
  std::map<std::string, std::shared_ptr<ViaKeyboard>> open_;
  std::map<std::string, std::chrono::steady_clock::time_point> retry_at_;
};

#endif  // VIA_KEYBOARD_H_
