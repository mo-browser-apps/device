# MōDevice — a peripherals configuration demo

MōDevice is a small reference application for configuring mice and keyboards, built with
[MōBrowser](https://teamdev.com/mobrowser/). It shows how a React interface communicates with a TypeScript main process
that owns the device model, and a native C++ module that drives real keyboards and mice over HID.

<a href="assets/screenshots/windows-devices.png"><img src="assets/screenshots/windows-devices.png" width="100%" alt="Device overview on Windows"></a>

## What the demo shows

- Find connected QMK/VIA keyboards and Logitech mice, add them, and remove them.
- See each device's connection, firmware, and a mouse's real battery level.
- Change a keyboard's backlight effect, color, and brightness, and a mouse's DPI, live as the
  sliders move.
- Change the app theme, launch it at login, manage updates, and enable low-battery alerts.
- Keep added devices between launches.

<p align="center">
  <a href="assets/screenshots/macos-devices.png"><img src="assets/screenshots/macos-devices.png" width="49%" alt="Device overview on macOS"></a>
  <a href="assets/screenshots/macos-mouse-buttons.png"><img src="assets/screenshots/macos-mouse-buttons.png" width="49%" alt="Mouse button configuration"></a>
</p>

<p align="center">
  <a href="assets/screenshots/macos-keyboard-lighting.png"><img src="assets/screenshots/macos-keyboard-lighting.png" width="49%" alt="Keyboard lighting configuration"></a>
  <a href="assets/screenshots/macos-settings.png"><img src="assets/screenshots/macos-settings.png" width="49%" alt="App settings"></a>
</p>

Every device is real hardware: see
[Example: QMK keyboards with VIA over USB](#example-qmk-keyboards-with-via-over-usb) and
[Example: Logitech mice with a Bolt receiver](#example-logitech-mice-with-a-bolt-receiver). On the
first launch the list is empty; **Add device** shows what is connected. This is a reference demo,
not production device software.

The demo requires no account or API key. Packaged versions contact GitHub Releases to check for
updates, but device data and settings are not sent anywhere.

## Requirements

- macOS 14 or later on Apple silicon, Windows 10 or later on x64, or Linux on x64. See
  [Supported platforms](#supported-platforms).
- [Node.js](https://nodejs.org/en/download/) 20.20.2, 22.22.2, or 24.14.1 and later.
- [MōBrowser](https://teamdev.com/mobrowser/) 2.18.0 or later.

## Run from source

```bash
npm install
npm run dev
```

To create a production build:

```bash
npm run build
```

## Project structure

- `src/main/device-state.ts` owns the device list and settings: pairing, validation, and the
  keyboards and mice the native module reports.
- `src/main/via.ts` maps VIA hardware to app devices: known models, effects, and value ranges.
- `src/main/logitech.ts` maps Logitech mice to app devices.
- `src/main/devices.ts` connects the device state to the interface, the native module, and saved
  preferences.
- `src/native/hardware_service.*` serves the open keyboards and mice to the main process over
  native RPC.
- `src/native/via_keyboard.*` speaks the VIA protocol over HIDAPI.
- `src/native/hidpp_mouse.*` speaks Logitech's HID++ 2.0 protocol over HIDAPI.
- `src/native/platform/` holds everything that differs per operating system: `platform.h` and
  one implementation file per supported platform.
- `src/renderer/gateway/devices.ts` is the interface's single entry point for device operations.
- `src/renderer/components/device/` contains the shared device screen and the separate mouse and
  keyboard editors.
- `src/renderer/public/device-art/` contains the product images shown in the app.

## Supported platforms

| Platform | Platform file | HIDAPI backend | Device access | CI checks | Release | Tested with devices |
|---|---|---|---|---|---|---|
| macOS 14+, Apple silicon | [`mac.cc`](src/native/platform/mac.cc) | IOHIDManager | Nothing to set up | Yes | Yes, signed and notarized | Yes |
| Windows 10+, x64 | [`windows.cc`](src/native/platform/windows.cc) | WinAPI | Nothing to set up | Yes | No | No |
| Linux, x64 | [`linux.cc`](src/native/platform/linux.cc) | hidraw (needs `libudev-dev` to build) | Install [`70-modevice.rules`](src/native/platform/70-modevice.rules) | Yes | No | No |

All device code is shared. Only the functions declared in
[`src/native/platform/platform.h`](src/native/platform/platform.h) differ per platform, and
[`CMakeLists.txt`](CMakeLists.txt) compiles one implementation of them. Building on any other
platform stops with an error that points here.

On Linux, HID devices are readable only by root until a udev rule grants access. Run this once,
then plug the devices in again:

```bash
sudo cp src/native/platform/70-modevice.rules /etc/udev/rules.d/
sudo udevadm control --reload-rules && sudo udevadm trigger
```

### Add a platform

1. Create `src/native/platform/<platform>.cc` and implement every function in `platform.h`. Copy
   the closest existing file and change what differs. Each function's comment says what to
   check: for example, whether the platform opens every top-level HID collection under its own
   path.
2. Add an `elseif` block for it in [`CMakeLists.txt`](CMakeLists.txt) that compiles the file and
   sets any HIDAPI backend options. Keep the platform's other dependencies in that block.
3. If users need permission to open HID devices, ship that setup next to the file, as Linux does
   with `70-modevice.rules`, and describe it above.
4. Add the platform's runner to the `os` matrix in
   [`.github/workflows/check.yml`](.github/workflows/check.yml). It runs the TypeScript and native
   tests and builds the app.
5. Configure the platform under `app.bundle` in [`mobrowser.conf.json`](mobrowser.conf.json), and
   add a build job to [`.github/workflows/ci.yml`](.github/workflows/ci.yml) to release it.
6. Add a row to the table above. Mark it tested only once a keyboard and a mouse work on it.

When a platform needs new behaviour, declare it in `platform.h` and implement it in every
platform file, even when some of them do nothing. A missing function then fails the build
instead of misbehaving on one platform.

## Connect real devices

The main process owns the app's device model; native code is a thin hardware adapter. Keep the
native contract coarse: one call lists the complete hardware state, one applies a complete setting,
and a callback sends a complete snapshot whenever hardware comes or goes. Do not expose one RPC per
SDK or HID command. See [`src/native/proto/devices.proto`](src/native/proto/devices.proto).

The demo saves the added devices and their last known settings in
[`src/main/devices.ts`](src/main/devices.ts), to show them while they are disconnected. Settings are
always read from the hardware when a device connects, never restored onto it.

### Example: QMK keyboards with VIA over USB

Every keyboard running [QMK](https://qmk.fm/) firmware with
[VIA](https://www.caniusevia.com/) enabled (Vial uses the same protocol) appears in **Add device**
within a second of being plugged in. Once added, it is listed with a **Live device** badge; unplugged,
it is shown as disconnected until it comes back. Its Lighting controls drive the physical backlight, and the
sliders update it 10 times a second while they move:

- **Effect**: Steady is the firmware's Solid Color and works on every keyboard. Pulse and Wave
  are offered only for models whose effect list is known (see below).
- **Hue** sets the backlight colour. It is hidden for single-colour backlights.
- **Brightness** sets the backlight level.

The app reads each keyboard's current lighting whenever it is plugged in.

How it works:

```
React slider → useDeviceSettings().commit → IPC → src/main/devices.ts
  → DeviceState.applySettings → native RPC HardwareService.ApplyLighting → ViaKeyboard → HIDAPI

ViaScanner, HidppScanner → HardwareEventsService.Changed(complete snapshot) → DeviceState.reconcile
  → IPC Watch → React device list
```

- [HIDAPI](https://github.com/libusb/hidapi) 0.15.0 is downloaded and statically linked by
  [`CMakeLists.txt`](CMakeLists.txt) with `FetchContent`, with the backend for each
  [supported platform](#supported-platforms).
- [`src/native/via_keyboard.cc`](src/native/via_keyboard.cc) opens every HID interface with the VIA
  usage page `0xFF60` and usage `0x61`, from any vendor, and skips those that do not answer or
  report a VIA protocol older than 12. QMK does not say which lighting it has, so the app probes
  the RGB matrix, RGB light, LED matrix, and backlight channels and uses the first one the firmware
  handles. It then sends the VIA `custom_get_value` and `custom_set_value` commands on that
  channel. Each open keyboard gets an opaque connection ID that changes whenever it is reopened.
  One native thread owns every HID handle: it scans for devices once a second and runs the
  main process's writes in between.
- Effect numbers depend on the effects compiled into each firmware, so only Solid Color (1) is the
  same everywhere. `KNOWN_MODELS` in [`src/main/via.ts`](src/main/via.ts) adds Pulse and Wave for the Keychron K10 Max (ANSI RGB) and K2 HE
  (RGB, ANSI/ISO/JIS), as listed in Keychron's VIA definitions. Add an entry with the vendor and
  product IDs and the effect numbers from a keyboard's VIA definition to enable them for it.
- [`src/main/via.ts`](src/main/via.ts) names the keyboard after its USB product string and
  converts the editor's hue (0–359°) and brightness (0–100%) to VIA's 0–255 range.
  [`src/main/device-state.ts`](src/main/device-state.ts) adds the keyboards to the device list and
  ignores a write that finishes after its keyboard was reopened.
- `npm run test:native` builds [`src/native/test/`](src/native/test/CMakeLists.txt) with CMake
  and runs [`via_test.cc`](src/native/test/via_test.cc), which checks the HID code against
  simulated QMK firmware through a fake HIDAPI. `npm test` runs
  [`src/main/devices.test.ts`](src/main/devices.test.ts) for the device model and VIA mapping.

To try it, connect a keyboard by cable (on wireless models, set the mode switch to USB), then run
`npm run dev`. The VIA app or Keychron Launcher can stay open at the same time.

Limitations:

- The app scans for keyboards once a second. An interface that does not answer, such as a
  wireless receiver with no keyboard, is probed again only every 30 seconds or when plugged in
  again.
- Lighting changes are not saved to the keyboard's memory. Unplugging the keyboard restores its own
  saved lighting.
- Firmware effects that have no matching editor option are shown as Wave, or with no effect
  selected when the keyboard has no Wave. Saturation is always set to full.
- Further units of the same model get `-2`, `-3` appended to their device ID in the order they are
  found. Tested on a Keychron K10 Max; the K2 HE entry follows Keychron's published firmware and
  has not been tested on the hardware.
- Key remapping and firmware other than QMK with VIA are not supported. Bluetooth and the
  Keychron Link receiver are labelled as such, but only work if they answer VIA. Only the K10 Max
  has its own artwork: `device-art/k10-max.webp` and its key overlay in
  [`k10-max-layout.ts`](src/renderer/components/art/k10-max-layout.ts) are built from the same
  key geometry in Keychron's QMK definition. Other keyboards show a generic compact keyboard,
  whose overlay in
  [`compact-keyboard-layout.ts`](src/renderer/components/art/compact-keyboard-layout.ts) only
  approximates their keys.

### Example: Logitech mice with a Bolt receiver

A Logitech mouse paired with a Logi Bolt receiver appears in **Add device** within a few seconds of
being awake. Once added, it shows its real battery level, and its Speed slider sets the sensor DPI
live. [`src/native/hidpp_mouse.cc`](src/native/hidpp_mouse.cc) opens the receiver's HID++ interface
(vendor `046D`, product `C548`, usage page `0xFF00`), asks each of its six slots for a HID++ 2.0
device, and uses the Device Name (`0x0005`), Unified Battery (`0x1004`), and Adjustable DPI
(`0x2201`) features. It reads the battery again every 3 seconds. On Windows, where the receiver's
short reports and error replies arrive on a separate HID collection, it reads that collection
too. `npm run test:native` also runs
[`src/native/test/hidpp_test.cc`](src/native/test/hidpp_test.cc) against a simulated receiver.

Limitations:

- Only Bolt receivers, and only mice with the three features above. Tested with a Signature
  M650 L. Every mouse shows the same generic compact mouse artwork.
- A sleeping mouse is shown as disconnected; moving it brings it back.
- Like the Logitech apps, a DPI set this way may be lost when the mouse is switched off. The app
  reads it again whenever the mouse connects.
- Buttons and scrolling are not configurable: that needs the app to handle the mouse's input.

### Add a device

**Another model of a supported kind** (a VIA keyboard or a mouse behind a Bolt receiver) needs
no native changes:

- For a VIA keyboard, add its vendor and product IDs and effect numbers to `KNOWN_MODELS` in
  [`src/main/via.ts`](src/main/via.ts). Without an entry it still works with Steady only.
- Optionally, add its artwork to `src/renderer/public/device-art/` and connect its `modelId` in
  [`device-art.tsx`](src/renderer/components/art/device-art.tsx). Without it, the device shows
  the default artwork for its kind.
- On Linux, add a line for a new vendor ID to
  [`70-modevice.rules`](src/native/platform/70-modevice.rules).

**A new kind of device**, such as another vendor's protocol or a headset, touches each layer once.
Work from the hardware up, and run `npm run gen` after changing either `.proto` file:

1. **Native driver**: add `src/native/<name>.h` and `.cc` with a device class and a scanner, like
   [`hidpp_mouse.h`](src/native/hidpp_mouse.h). The scanner enumerates HIDAPI and opens what
   answers; the device class has blocking reads and writes and marks itself `failed()` when I/O
   fails. Neither needs locks: only the hardware thread calls them. Add the files to `APP_SOURCES`
   in [`CMakeLists.txt`](CMakeLists.txt), plus a test against the fake HIDAPI in
   [`src/native/test/`](src/native/test/CMakeLists.txt).
2. **Native contract**: in [`src/native/proto/devices.proto`](src/native/proto/devices.proto),
   add a `Connected<Name>` message with a `connection_id` and the raw hardware facts, a field for
   it in `ConnectedDevices`, and one `Apply…` RPC that takes a complete setting. Keep app concepts,
   such as names shown in the app or value ranges, out of it.
3. **Hardware service**: in [`hardware_service.cc`](src/native/hardware_service.cc), add a map
   and scanner to `Hardware`, the new devices to `Snapshot()` and `Scan()`, and an `Apply…`
   handler that posts its write to the hardware thread.
4. **Platform**: if the protocol behaves differently on some platform, add a function to
   [`platform.h`](src/native/platform/platform.h) and implement it in every platform file. On
   Linux, add the vendor to `70-modevice.rules`.
5. **Main process mapping**: add `src/main/<name>.ts`, like [`logitech.ts`](src/main/logitech.ts),
   that turns a `Connected<Name>` into the app's `Device` and `Settings`, and back into a raw
   request.
6. **Device model**: in [`device-state.ts`](src/main/device-state.ts), add the kind to the
   `Connection` type, `connect()`, `applySettings()`, and `isValid()`. Add its write hook to
   [`devices.ts`](src/main/devices.ts) and cases to [`devices.test.ts`](src/main/devices.test.ts).
7. **App contract**: in [`src/renderer/proto/devices.proto`](src/renderer/proto/devices.proto),
   add a `<Name>Spec` to the `spec` oneof of `Device` and a `<Name>Settings` to the `kind` oneof of
   `Settings`.
8. **Interface**: add `<name>-device.ts` (sections and artwork behaviour) and `<name>-editor.tsx`
   (controls) in `src/renderer/components/device/`. Choose them in
   [`device-presentation.ts`](src/renderer/components/device/device-presentation.ts) and
   [`control-editor.tsx`](src/renderer/components/device/control-editor.tsx), and add artwork in
   [`device-art.tsx`](src/renderer/components/art/device-art.tsx).

Keep the shared device screen responsible only for layout and navigation.

## Download

You can download the app from the [releases page](https://github.com/mo-browser-apps/device/releases).
Releases are built for macOS only, code-signed and notarized by Apple. On Windows and Linux,
[run from source](#run-from-source).

## License

MIT — see [LICENSE](LICENSE).
