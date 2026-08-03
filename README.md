# MōDevice — a peripherals configuration demo

MōDevice is a small reference application for configuring mice and keyboards, built with
[MōBrowser](https://teamdev.com/mobrowser/). It demonstrates a desktop architecture with a React
interface, a TypeScript application process, and a native C++ device layer.

The demo looks and behaves like real device configuration software while keeping the source code
small and easy to follow.

## What the demo shows

- View mice and keyboards with their connection, battery, and firmware information.
- Find, add, and remove wireless devices.
- Assign actions to mouse buttons and adjust pointer and scrolling behavior.
- Remap keyboard keys and configure backlight effects, color, and brightness.
- Change the app theme, launch it at login, manage updates, and enable low-battery alerts.
- Keep paired devices and settings between launches.

All devices are simulated by an in-memory C++ backend. This app does not detect or change real
peripherals connected to the computer. It is a reference demo, not production device software.

The demo requires no account or API key. Packaged versions contact GitHub Releases to check for
updates, but device data and settings are not sent anywhere.

## Requirements

- macOS 14 or later on Apple silicon, or Windows 10 or later on 64-bit systems.
- [Node.js](https://nodejs.org/en/download/) 20.20.2, 22.22.2, or 24.14.1 and later.
- [MōBrowser](https://teamdev.com/mobrowser/) 2.13.0 or later.

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

- `src/native/device_stack.*` contains the simulated devices and is the main starting point for a
  real hardware integration.
- `src/native/device_service.*` exposes the device stack to MōBrowser.
- `src/main/devices.ts` passes device data between C++ and the interface and saves the demo state.
- `src/renderer/gateway/devices.ts` is the interface's single entry point for device operations.
- `src/renderer/components/device/` contains the shared device screen and the separate mouse and
  keyboard editors.
- `src/renderer/public/device-art/` contains the product images shown in the app.

## Connect real devices

Start with [`src/native/device_stack.cc`](src/native/device_stack.cc). Replace its seeded devices and
the `List`, `Discover`, `Pair`, `Forget`, `GetSettings`, and `ApplySettings` implementations with
calls to your device SDK or system APIs. Keep the public interface in
[`src/native/device_stack.h`](src/native/device_stack.h) if these operations fit your integration.

The demo saves paired device IDs and settings in the main process. Real hardware or a vendor SDK
may already store this data. Review the restore and save logic in
[`src/main/devices.ts`](src/main/devices.ts), decide which layer owns the data, and keep only one
source of truth so the app and device cannot restore conflicting values.

### Add capabilities and device types

For another mouse or keyboard, reuse the existing screens where possible:

- Report its supported controls and value ranges from
  [`src/native/device_stack.cc`](src/native/device_stack.cc).
- Add its images to [`src/renderer/public/device-art/`](src/renderer/public/device-art/) and map its
  `modelId` in [`src/renderer/components/art/device-art.tsx`](src/renderer/components/art/device-art.tsx).
- Add actions and labels to `mouse-device.ts` or `keyboard-device.ts`, and add controls to
  `mouse-editor.tsx` or `keyboard-editor.tsx` in
  [`src/renderer/components/device/`](src/renderer/components/device/).

For a different device category, give it its own capabilities, settings, editor, and artwork. Keep
the shared device screen responsible only for layout and navigation.

Where to make the changes:

- Device data — `src/native/proto/devices.proto` and `src/renderer/proto/devices.proto`.
- Device-specific behavior — a new device and editor module in
  `src/renderer/components/device/`.
- UI routing — `device-presentation.ts` and `control-editor.tsx`.
- Artwork — `device-art.tsx` and `src/renderer/public/device-art/`.

## Download

You can download the app from the [releases page](https://github.com/mo-browser-apps/device/releases).
macOS releases are code-signed and notarized by Apple; Windows releases are code-signed.

## License

MIT — see [LICENSE](LICENSE).
