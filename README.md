# MōDevice — configure your mice and keyboards

MōDevice is a desktop app for configuring computer peripherals. It shows connected mice and
keyboards, remaps their buttons and keys, tunes pointer and scroll behaviour, and controls keyboard
backlighting.

Built with [MōBrowser](https://teamdev.com/mobrowser/).

## What it does

* Lists connected devices with battery level, connection type, and firmware version.
* Reassigns mouse buttons to actions such as copy, paste, back, forward, and volume.
* Adjusts pointer sensitivity, DPI, scroll speed, and scroll direction.
* Remaps keyboard keys and controls backlight effect, color, and brightness.
* Reacts live as devices connect and disconnect, and warns when a battery runs low.

## Requirements

* macOS 14 (Apple Silicon) or later, or Windows 10 (64-bit) or later.
* [Node.js](https://nodejs.org/en/download/) 20.20.2, 22.22.2, or 24.14.1 and later.
* [MōBrowser](https://teamdev.com/mobrowser/) 2.13.0 or later.

No accounts, API keys, or third-party services are required. The app sends no data anywhere.

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

## Production build

```bash
npm run build
```

## Usage

Open the app to see the connected devices. Select a device to configure it: mice offer **Buttons**
and **Pointer & Scroll**, keyboards offer **Keys** and **Backlight**, and both offer **Info**.

### Simulator

The device layer is simulated rather than talking to real hardware, so the app runs the same on Windows and
macOS and can be driven live from a built-in **Simulator** panel. Use it to add and edit devices, change battery
levels, and connect or disconnect a device to watch the interface react.

## Project layout

```
src/native/     C++ device stack — the layer a manufacturer replaces with their own SDK
src/main/       main process — window, menu, tray, notifications, preferences
src/renderer/   React interface
```

## Download

You can download the app from the [releases page](https://github.com/mo-browser-apps/device/releases).
Release builds are code-signed; macOS releases are notarized by Apple.

## License

MIT — see [LICENSE](LICENSE).
