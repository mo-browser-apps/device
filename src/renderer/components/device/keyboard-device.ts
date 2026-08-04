import { LightEffect, type Binding, type KeyboardSpec } from '@/gen/devices';
import type { DevicePresentation, SegmentOption } from './device-presentation';

const KEY_LABELS: Record<string, string> = {
  esc: 'Esc',
  minus: 'Minus',
  equal: 'Equal',
  backspace: 'Backspace',
  tab: 'Tab',
  bracketleft: 'Left bracket',
  bracketright: 'Right bracket',
  backslash: 'Backslash',
  capslock: 'Caps Lock',
  semicolon: 'Semicolon',
  quote: 'Quote',
  enter: 'Enter',
  shiftleft: 'Left Shift',
  shiftright: 'Right Shift',
  comma: 'Comma',
  period: 'Period',
  slash: 'Slash',
  ctrlleft: 'Left Ctrl',
  ctrlright: 'Right Ctrl',
  metaleft: 'Win',
  altleft: 'Left Alt',
  altright: 'Right Alt',
  space: 'Space',
  menu: 'Menu',
};

/**
 * Lists the actions offered for keyboard keys.
 */
export const KEY_ACTIONS = [
  'default',
  'back',
  'forward',
  'show-desktop',
  'copy',
  'paste',
  'undo',
  'play-pause',
  'volume-up',
  'volume-down',
  'disabled',
];

/**
 * Lists the keyboard lighting effects in the order shown by the editor.
 */
export const KEYBOARD_EFFECTS: [effect: LightEffect, label: string][] = [
  [LightEffect.STATIC, 'Steady'],
  [LightEffect.BREATHING, 'Pulse'],
  [LightEffect.WAVE, 'Wave'],
];

/**
 * Turns a keyboard control ID into the name shown in the UI.
 */
export function keyboardControlLabel(control: string): string {
  return KEY_LABELS[control] ?? control.toUpperCase();
}

/**
 * Restores every keyboard key to its normal typing behavior.
 */
export function resetKeyBindings(bindings: Binding[]): Binding[] {
  return bindings.map((binding) => ({ ...binding, action: 'default' }));
}

/**
 * Provides the sections and artwork behavior for a keyboard.
 */
export function keyboardPresentation(spec: KeyboardSpec): DevicePresentation {
  const segments: SegmentOption[] = [['keys', 'Keys']];
  if (spec.backlight) segments.push(['lighting', 'Lighting']);
  segments.push(['info', 'Info']);

  return {
    segments,
    initialControl: spec.keys[0] ?? null,
    artState: (settings, segment) => ({
      callouts: [],
      lighting: spec.backlight ? (settings?.keyboard ?? null) : null,
      canSelectControl: segment === 'keys',
    }),
  };
}
