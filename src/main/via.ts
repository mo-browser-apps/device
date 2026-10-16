import {
  LightEffect,
  LinkType,
  type Device,
  type KeyboardSettings,
  type Settings,
} from './gen/devices';
import { Bus, type ConnectedKeyboard, type RawLighting } from './gen/native/devices';

/**
 * Keyboards whose effect lists are known, so the editor can offer more than solid color.
 * Any other VIA keyboard works with solid color only. From Keychron's VIA definitions
 * (keyboards/keychron/<model>/via_json in Keychron/qmk_firmware): 2 is Breathing and
 * 5 is Cycle Left Right on all of them.
 */
const KNOWN_MODELS = [
  { vendorId: 0x3434, productId: 0x0aa0, id: 'keychron-k10-max', breathing: 2, wave: 5 }, // K10 Max ANSI RGB
  { vendorId: 0x3434, productId: 0x0e20, id: 'keychron-k2-he', breathing: 2, wave: 5 }, // K2 HE ANSI RGB
  { vendorId: 0x3434, productId: 0x0e21, id: 'keychron-k2-he', breathing: 2, wave: 5 }, // K2 HE ISO RGB
  { vendorId: 0x3434, productId: 0x0e22, id: 'keychron-k2-he', breathing: 2, wave: 5 }, // K2 HE JIS RGB
  // A wireless receiver: it is plugged in by USB, but the keyboard is not.
  { vendorId: 0x3434, productId: 0xd030, id: 'keychron-link', breathing: 0, wave: 0, receiver: true },
];

/** The firmware effects every keyboard shares; the rest come from the known model. */
const VIA_OFF = 0;
const VIA_SOLID = 1;

export interface ViaModel {
  /** Shared by every unit of the product: a known model's ID, or "via-<vid>-<pid>". */
  id: string;
  name: string;
  link: LinkType;
  /** Firmware effect numbers for the editor's Pulse and Wave, or 0 when unavailable. */
  breathingEffect: number;
  waveEffect: number;
}

/**
 * Applies the known-model table to the hardware facts the native module reports.
 */
export function viaModel(keyboard: ConnectedKeyboard): ViaModel {
  const hex = (value: number) => value.toString(16).padStart(4, '0');
  const known = KNOWN_MODELS.find(
    (model) => model.vendorId === keyboard.vendorId && model.productId === keyboard.productId,
  );
  let link = keyboard.bus === Bus.BUS_BLUETOOTH ? LinkType.BLUETOOTH : LinkType.WIRED;
  if (known?.receiver) link = LinkType.RECEIVER;
  return {
    id: known?.id ?? `via-${hex(keyboard.vendorId)}-${hex(keyboard.productId)}`,
    name: keyboard.productName || 'Keyboard',
    link,
    breathingEffect: known?.breathing ?? 0,
    waveEffect: known?.wave ?? 0,
  };
}

/**
 * Converts an editor value from 0 to range (hue 0–359°, brightness 0–100%) to VIA's 0–255.
 */
export function toVia(value: number, range: number): number {
  return Math.min(255, Math.max(0, Math.floor((value * 255 + Math.floor(range / 2)) / range)));
}

/**
 * Converts a VIA value from 0 to 255 back to the editor's 0 to range.
 */
export function fromVia(value: number, range: number): number {
  return Math.floor((value * range + 127) / 255);
}

/**
 * Turns the editor's lighting into the raw values the keyboard's firmware understands.
 */
export function toRawLighting(keyboard: KeyboardSettings, model: ViaModel): RawLighting {
  let effect = VIA_SOLID;
  if (keyboard.effect === LightEffect.BREATHING && model.breathingEffect) {
    effect = model.breathingEffect;
  }
  if (keyboard.effect === LightEffect.WAVE && model.waveEffect) effect = model.waveEffect;
  return {
    effect,
    hue: toVia(keyboard.hue, 360),
    // Full saturation keeps hue changes clearly visible.
    saturation: 255,
    brightness: toVia(keyboard.brightness, 100),
  };
}

/**
 * Builds the device and settings shown for a keyboard that was just opened, from the
 * lighting it reported.
 */
export function viaKeyboard(
  id: string,
  keyboard: ConnectedKeyboard,
): { device: Device; settings: Settings } {
  const model = viaModel(keyboard);
  const effects = [LightEffect.STATIC];
  // Without an effect list, the firmware ignores the effect.
  if (keyboard.hasEffect && model.breathingEffect) effects.push(LightEffect.BREATHING);
  if (keyboard.hasEffect && model.waveEffect) effects.push(LightEffect.WAVE);

  const raw = keyboard.lighting ?? { effect: VIA_OFF, hue: 0, saturation: 0, brightness: 0 };
  // Firmware effects the editor cannot show are listed as the animated "Wave". When the
  // keyboard has no Wave, no option is selected, and choosing Steady still applies.
  let effect = LightEffect.WAVE;
  // Effect 0 means the backlight is off; it is shown as Steady at zero brightness.
  if (raw.effect === VIA_SOLID || raw.effect === VIA_OFF) effect = LightEffect.STATIC;
  if (model.breathingEffect && raw.effect === model.breathingEffect) {
    effect = LightEffect.BREATHING;
  }

  return {
    device: {
      id,
      modelId: model.id,
      model: model.name,
      link: model.link,
      firmware: `VIA protocol ${keyboard.protocolVersion}`,
      connected: true,
      hasBattery: false,
      battery: 0,
      charging: false,
      live: true,
      // Lighting only: key remapping is not implemented for the real keyboard.
      keyboard: { keys: [], backlight: true, color: keyboard.hasColor, effects },
    },
    settings: {
      deviceId: id,
      keyboard: {
        bindings: [],
        effect,
        hue: Math.min(fromVia(raw.hue, 360), 359),
        brightness: raw.effect === VIA_OFF ? 0 : fromVia(raw.brightness, 100),
      },
    },
  };
}
