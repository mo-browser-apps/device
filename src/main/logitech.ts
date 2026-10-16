import { LinkType, type Device, type Settings } from './gen/devices';
import type { ConnectedMouse } from './gen/native/devices';

/**
 * Model ID for a Logitech mouse, from the name it reports: "logitech-signature-m650-l".
 */
export function logitechModelId(mouse: ConnectedMouse): string {
  const slug = mouse.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `logitech-${slug || 'mouse'}`;
}

/**
 * Builds the device and settings shown for a mouse that was just found, from what it
 * reported. Only its DPI can be changed: button diversion and scrolling need the app to
 * handle input, which it does not.
 */
export function logitechMouse(
  id: string,
  mouse: ConnectedMouse,
): { device: Device; settings: Settings } {
  return {
    device: {
      id,
      modelId: logitechModelId(mouse),
      model: mouse.name || 'Logitech mouse',
      link: LinkType.RECEIVER,
      firmware: `HID++ ${mouse.protocol}`,
      connected: true,
      hasBattery: true,
      battery: mouse.battery,
      charging: mouse.charging,
      live: true,
      mouse: { buttons: [], minDpi: mouse.minDpi, maxDpi: mouse.maxDpi },
    },
    settings: {
      deviceId: id,
      mouse: { bindings: [], dpi: mouse.dpi, scrollSpeed: 3, naturalScroll: false },
    },
  };
}
