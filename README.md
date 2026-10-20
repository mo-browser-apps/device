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

The app supports QMK/VIA keyboards and Logitech mice connected through a Bolt receiver. When no
real device has been added, it shows clearly labelled dummy devices; **Add device** shows connected
hardware. This is a reference demo, not production device software.

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
   the closest existing file and change what differs. Each function's comment says what to check,
   such as whether the platform opens every top-level HID collection under its own path.
2. Add an `elseif` block for it in [`CMakeLists.txt`](CMakeLists.txt) that compiles the file and
   sets any HIDAPI backend options. Keep the platform's other dependencies in that block.
3. If users need permission to open HID devices, ship that setup next to the file, as Linux does
   with `70-modevice.rules`, and describe it above.
4. Add the platform's runner to the `os` matrix in
   [`.github/workflows/check.yml`](.github/workflows/check.yml). It checks and builds the app.
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
   in [`CMakeLists.txt`](CMakeLists.txt).
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
   [`devices.ts`](src/main/devices.ts).
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
