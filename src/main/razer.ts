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
 * The editor's hue and brightness for the values the native module reports.
 */
function fromChromaLighting(raw: RawLighting): { hue: number; brightness: number } {
  return { hue: Math.min(fromVia(raw.hue, 360), 359), brightness: fromVia(raw.brightness, 100) };
}

/**
 * The settings updated to the color the native module reports for a Razer device, or
 * undefined when they show it already. The SDK lights every Razer keyboard, or every
 * mouse, as one, so a color written to one unit reaches the others too.
 */
export function syncChromaLighting(
  settings: Settings,
  device: ConnectedChromaDevice,
): Settings | undefined {
  const raw = device.lighting;
  if (!raw) return undefined;
  const shown = chromaRawLighting(settings);
  if (shown.hue === raw.hue && shown.brightness === raw.brightness) return undefined;
  const lighting = fromChromaLighting(raw);
  if (settings.keyboard) return { ...settings, keyboard: { ...settings.keyboard, ...lighting } };
  if (settings.mouse) return { ...settings, mouse: { ...settings.mouse, ...lighting } };
  return undefined;
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
  const { hue, brightness } = fromChromaLighting(
    device.lighting ?? { effect: 1, hue: 0, saturation: 0, brightness: 0 },
  );
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
    connectionId: device.connectionId,
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
        keyboard: {
          bindings: [],
          effect: LightEffect.STATIC,
          hue,
          brightness,
          rawEffect: 1,
          saturation: 255,
        },
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
      mouse: { bindings: [], dpi: 0, hue, brightness },
    },
  };
}
