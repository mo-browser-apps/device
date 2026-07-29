# MōDevice — a peripherals configuration demo

MōDevice is a cross-platform reference application for configuring computer peripherals, built with
[MōBrowser](https://teamdev.com/mobrowser/). It demonstrates how a manufacturer can connect a native
C++ device layer to a responsive web interface in a desktop application for Windows and macOS.

The project is intentionally focused: it presents a polished mouse and keyboard configuration
experience without the complexity of a production device suite.

## Demo experience

The in-memory native device backend supports the primary workflows expected from peripheral
software:

- Browse mice and keyboards with connection, battery, and firmware information.
- Discover, add, and remove wireless devices, with the paired roster restored on restart.
- Assign actions to mouse buttons and adjust pointer and scrolling behaviour.
- Remap keyboard keys and configure backlight effects, color, and brightness.
- Observe the interface react to native device-list changes in real time.

MōDevice does not access peripherals connected to the host computer. Its devices and settings are
provided by an in-memory C++ implementation of the same device-stack interface a real hardware
integration would use, making the demo deterministic and portable across supported platforms.

## Requirements

- macOS 14 or later on Apple silicon, or Windows 10 or later on 64-bit systems.
- [Node.js](https://nodejs.org/en/download/) 20.20.2, 22.22.2, or 24.14.1 and later.
- [MōBrowser](https://teamdev.com/mobrowser/) 2.13.0 or later.

The demo requires no account, API key, or external service, and it does not transmit user data.

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
