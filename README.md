# MōDevice — a peripherals configuration demo

MōDevice is a small reference application for configuring mice and keyboards, built with
[MōBrowser](https://teamdev.com/mobrowser/). It shows how a React interface communicates with a TypeScript main process
that owns the device model, and a native C++ module that drives real keyboards over HID.

<a href="assets/screenshots/windows-devices.png"><img src="assets/screenshots/windows-devices.png" width="100%" alt="Device overview on Windows"></a>

## What the demo shows

- View simulated mice and real QMK/VIA keyboards with their connection, battery, and firmware
  information.
- Find, add, and remove wireless devices.
- Assign actions to mouse buttons and adjust pointer and scrolling behavior.
- Change a real keyboard's backlight effect, color, and brightness live as the sliders move.
- Change the app theme, launch it at login, manage updates, and enable low-battery alerts.
- Keep paired devices and settings between launches.

<p align="center">
  <a href="assets/screenshots/macos-devices.png"><img src="assets/screenshots/macos-devices.png" width="49%" alt="Device overview on macOS"></a>
  <a href="assets/screenshots/macos-mouse-buttons.png"><img src="assets/screenshots/macos-mouse-buttons.png" width="49%" alt="Mouse button configuration"></a>
</p>

<p align="center">
  <a href="assets/screenshots/macos-keyboard-lighting.png"><img src="assets/screenshots/macos-keyboard-lighting.png" width="49%" alt="Keyboard lighting configuration"></a>
  <a href="assets/screenshots/macos-settings.png"><img src="assets/screenshots/macos-settings.png" width="49%" alt="App settings"></a>
</p>

The mice are simulated in the main process. Keyboards are real: see
[Example: QMK keyboards with VIA over USB](#example-qmk-keyboards-with-via-over-usb). This is a
reference demo, not production device software.

The demo requires no account or API key. Packaged versions contact GitHub Releases to check for
updates, but device data and settings are not sent anywhere.

## Requirements

- macOS 14 or later on Apple silicon, or Windows 10 or later on 64-bit systems.
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

- `src/main/device-state.ts` owns the device list and settings: the simulated mice, pairing,
  validation, and the real keyboards the native module reports.
- `src/main/via.ts` maps VIA hardware to app devices: known models, effects, and value ranges.
- `src/main/devices.ts` connects the device state to the interface, the native module, and saved
  preferences.
- `src/native/via_service.*` serves the open VIA keyboards to the main process over native RPC.
- `src/native/via_keyboard.*` speaks the VIA protocol over HIDAPI.
- `src/renderer/gateway/devices.ts` is the interface's single entry point for device operations.
- `src/renderer/components/device/` contains the shared device screen and the separate mouse and
  keyboard editors.
- `src/renderer/public/device-art/` contains the product images shown in the app.

## Connect real devices

The main process owns the app's device model; native code is a thin hardware adapter. Keep the
native contract coarse: one call lists the complete hardware state, one applies a complete setting,
and a callback sends a complete snapshot whenever hardware comes or goes. Do not expose one RPC per
SDK or HID command. See [`src/native/proto/devices.proto`](src/native/proto/devices.proto).

The demo saves paired device IDs and settings in [`src/main/devices.ts`](src/main/devices.ts). If
your devices or SDK already store this data, remove that persistence and keep one source of truth.

### Example: QMK keyboards with VIA over USB

Every keyboard running [QMK](https://qmk.fm/) firmware with
[VIA](https://www.caniusevia.com/) enabled (Vial uses the same protocol) appears within a second
of being plugged in, first in the list, with a **Live device** badge. Unplugged, it is shown as
disconnected until it comes back. Its Lighting controls drive the physical backlight, and the
sliders update it 10 times a second while they move:

- **Effect**: Steady is the firmware's Solid Color and works on every keyboard. Pulse and Wave
  are offered only for models whose effect list is known (see below).
- **Hue** sets the backlight colour. It is hidden for single-colour backlights.
- **Brightness** sets the backlight level.

The app reads each keyboard's current lighting whenever it is plugged in.

How it works:

```
React slider → useDeviceSettings().commit → IPC → src/main/devices.ts
  → DeviceState.applySettings → native RPC ViaService.ApplyLighting → ViaKeyboard → HIDAPI → keyboard

ViaScanner (once a second) → ViaEventsService.Changed(complete snapshot) → DeviceState.reconcile
  → IPC Watch → React device list
```

- [HIDAPI](https://github.com/libusb/hidapi) 0.15.0 is downloaded and statically linked by
  [`CMakeLists.txt`](CMakeLists.txt) with `FetchContent`. Linux builds need `libudev-dev`.
- [`src/native/via_keyboard.cc`](src/native/via_keyboard.cc) opens every HID interface with the VIA
  usage page `0xFF60` and usage `0x61`, from any vendor, and skips those that do not answer or
  report a VIA protocol older than 12. QMK does not say which lighting it has, so the app probes
  the RGB matrix, RGB light, LED matrix, and backlight channels and uses the first one the firmware
  handles. It then sends the VIA `custom_get_value` and `custom_set_value` commands on that
  channel. Each open keyboard gets an opaque connection ID that changes whenever it is reopened,
  and writes queued behind a slow keyboard are merged so only the latest is sent.
- Effect numbers depend on the effects compiled into each firmware, so only Solid Color (1) is the
  same everywhere. `KNOWN_MODELS` in [`src/main/via.ts`](src/main/via.ts) adds Pulse and Wave for the Keychron K10 Max (ANSI RGB) and K2 HE
  (RGB, ANSI/ISO/JIS), as listed in Keychron's VIA definitions. Add an entry with the vendor and
  product IDs and the effect numbers from a keyboard's VIA definition to enable them for it.
- [`src/main/via.ts`](src/main/via.ts) names the keyboard after its USB product string and
  converts the editor's hue (0–359°) and brightness (0–100%) to VIA's 0–255 range.
  [`src/main/device-state.ts`](src/main/device-state.ts) adds the keyboards to the device list and
  ignores a write that finishes after its keyboard was reopened.
- `npm run test:native` runs [`src/native/test/via_test.cc`](src/native/test/via_test.cc), which
  checks the HID code against simulated QMK firmware through a fake HIDAPI. `npm test` runs
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
  has artwork: `device-art/k10-max.webp` and its key overlay in
  [`k10-max-layout.ts`](src/renderer/components/art/k10-max-layout.ts) are built from the same
  key geometry in Keychron's QMK definition.

### Add capabilities and device types

For another mouse or keyboard, reuse the existing screens where possible.

- `src/main/device-state.ts` and `src/main/via.ts` report the controls and value ranges supported
  by each device.
- `device-art.tsx` connects each `modelId` to its artwork, while
  `src/renderer/public/device-art/` stores the image files.
- `mouse-device.ts` and `keyboard-device.ts` define the sections, actions, and labels shown for each
  device type.
- `mouse-editor.tsx` and `keyboard-editor.tsx` render the controls used to change device settings.

For a different device category, give it its own capabilities, settings, editor, and artwork. Keep
the shared device screen responsible only for layout and navigation.

- `src/renderer/proto/devices.proto` describes the capabilities and settings shared between the
  main process and the interface.
- A new device module in `src/renderer/components/device/` describes the sections and artwork
  behavior for the device type.
- A new editor module in the same folder renders its settings controls.
- `device-presentation.ts` chooses the matching device module, and `control-editor.tsx` chooses its
  editor.
- `device-art.tsx` renders the matching artwork from `src/renderer/public/device-art/`.

## Download

You can download the app from the [releases page](https://github.com/mo-browser-apps/device/releases).
macOS releases are code-signed and notarized by Apple; Windows releases are code-signed.

## License

MIT — see [LICENSE](LICENSE).
