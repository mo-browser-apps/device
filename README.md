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
- Change the app theme, launch it at login, and enable low-battery alerts.
- Keep paired devices and settings between launches.

All devices are simulated by an in-memory C++ backend. MōDevice does not detect or change real
peripherals connected to the computer. It is a reference demo, not production device software.

The demo requires no account, API key, or external service, and it does not transmit user data.

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

```text
src/native/     C++ device stack and MōBrowser RPC adapter
src/main/       TypeScript application process and desktop integration
src/renderer/   React interface and MōBrowser IPC client
```

## Download

You can download the app from the [releases page](https://github.com/mo-browser-apps/device/releases).
macOS releases are code-signed and notarized by Apple; Windows releases are code-signed.

## License

MIT — see [LICENSE](LICENSE).
