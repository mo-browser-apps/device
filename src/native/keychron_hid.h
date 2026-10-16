#ifndef KEYCHRON_HID_H_
#define KEYCHRON_HID_H_

#include <array>
#include <cstdint>
#include <memory>
#include <optional>

struct hid_device_;

// Controls the RGB backlight of a supported Keychron keyboard connected by USB cable.
//
// The keyboard speaks the QMK/VIA raw HID protocol on a vendor-defined interface,
// separate from the one that carries keystrokes. Only the VIA "custom value"
// get/set commands on the keyboard's lighting channel are used. They change the live
// lighting state without writing EEPROM, so unplugging the keyboard restores
// its saved lighting.
class KeychronHid {
 public:
  // A supported keyboard, identified by its USB product ID.
  struct Model {
    unsigned short product_id;
    const char* id;
    const char* name;
    // Firmware effect numbers for the editor's Pulse and Wave, or 0 when unavailable.
    // They depend on the effects compiled into the firmware, so they come from the
    // model's VIA definition; only solid color (1) is the same on every keyboard.
    int breathing_effect = 0;
    int wave_effect = 0;
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

  // Opens the first supported keyboard's VIA interface; returns nullptr when none answers.
  static std::unique_ptr<KeychronHid> Open();

  ~KeychronHid();
  KeychronHid(const KeychronHid&) = delete;
  KeychronHid& operator=(const KeychronHid&) = delete;

  const Model& model() const { return *model_; }

  // The VIA protocol version reported by the firmware.
  int protocol_version() const { return protocol_version_; }

  // False for single-color lighting, which ignores hue and saturation.
  bool has_color() const { return channel_->color; }

  std::optional<Lighting> ReadLighting();

  // Sends effect, color, and brightness; false if any command was not acknowledged.
  bool WriteLighting(const Lighting& lighting);

 private:
  using Report = std::array<uint8_t, 32>;

  KeychronHid(hid_device_* device, const Model* model) : device_(device), model_(model) {}

  // Sends one VIA report and replaces it with the keyboard's reply.
  bool Transact(Report& report);
  std::optional<Report> GetValue(uint8_t value_id);
  bool SetValue(uint8_t value_id, uint8_t first, uint8_t second = 0);

  hid_device_* device_;
  const Model* model_;
  const Channel* channel_ = nullptr;
  int protocol_version_ = 0;
};

#endif  // KEYCHRON_HID_H_
