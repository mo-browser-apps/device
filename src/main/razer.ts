import { LightEffect, LinkType, type Device, type Settings } from './gen/devices';
import { ChromaKind, type ConnectedChromaDevice, type RawLighting } from './gen/native/devices';
import { modelSlug } from './model-id';
import { fromVia, toVia } from './via';

/** A wireless receiver names itself, such as "Razer Mamba Wireless Receiver". */
const RECEIVER_SUFFIX = /\s+receiver$/i;

/**
 * The name shown for a Razer device: the name it reports, minus a receiver suffix.
 */
function chromaName(device: ConnectedChromaDevice): string {
  return device.productName.replace(RECEIVER_SUFFIX, '').trim();
}

/**
 * Model ID for a Razer device, from the name it reports: "razer-huntsman".
 */
export function chromaModelId(device: ConnectedChromaDevice): string {
  const hex = device.productId.toString(16).padStart(4, '0');
  return `razer-${modelSlug(chromaName(device)) || hex}`;
}

/**
 * Turns the editor's lighting for a Razer keyboard or mouse into the values the native
 * module shows as one solid color.
 */
export function chromaRawLighting(settings: Settings): RawLighting {
  const lighting = settings.keyboard ?? settings.mouse;
  if (!lighting) throw new Error(`Settings have no lighting: ${settings.deviceId}`);
  return {
    effect: 1,
    hue: toVia(lighting.hue, 360),
    saturation: 255,
    brightness: toVia(lighting.brightness, 100),
  };
}

/**
 * Builds the device and settings shown for a Razer device that was just found. The
 * Chroma SDK sets one solid color and reads nothing back, so the settings start from
 * the color last written in this native session, or a default.
 */
export function chromaDevice(
  id: string,
  device: ConnectedChromaDevice,
): { device: Device; settings: Settings } {
  const raw = device.lighting ?? { effect: 1, hue: 0, saturation: 0, brightness: 0 };
  const hue = Math.min(fromVia(raw.hue, 360), 359);
  const brightness = fromVia(raw.brightness, 100);
  const isKeyboard = device.kind === ChromaKind.CHROMA_KEYBOARD;

  const shared = {
    id,
    modelId: chromaModelId(device),
    model: chromaName(device) || (isKeyboard ? 'Razer keyboard' : 'Razer mouse'),
    // Only a receiver tells how a device is connected; the SDK does not say.
    link: RECEIVER_SUFFIX.test(device.productName) ? LinkType.RECEIVER : LinkType.WIRED,
    firmware: 'Chroma SDK',
    connected: true,
    hasBattery: false,
    battery: 0,
    charging: false,
    live: true,
  };

  if (isKeyboard) {
    return {
      device: {
        ...shared,
        // Lighting only: the SDK offers one solid color and no key remapping.
        keyboard: { keys: [], backlight: true, color: true, effects: [LightEffect.STATIC] },
      },
      settings: {
        deviceId: id,
        keyboard: { bindings: [], effect: LightEffect.STATIC, hue, brightness },
      },
    };
  }
  return {
    device: {
      ...shared,
      // Lighting only: the SDK does not reach the sensor or the buttons.
      mouse: { buttons: [], minDpi: 0, maxDpi: 0, backlight: true },
    },
    settings: {
      deviceId: id,
      mouse: { bindings: [], dpi: 0, scrollSpeed: 3, naturalScroll: false, hue, brightness },
    },
  };
}
