import { LightEffect, type Binding } from '@/gen/devices';

/** Names for the controls a mouse reports. */
const CONTROLS: Record<string, string> = {
  wheel: 'Wheel',
  back: 'Back',
  forward: 'Forward',
  gesture: 'Thumb button',
};

/** Names for the keys whose id does not already read as one. Letters and digits do. */
const KEYS: Record<string, string> = {
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

/** Actions a control can be bound to. */
const ACTIONS: Record<string, string> = {
  default: 'Default',
  'middle-click': 'Middle click',
  back: 'Back',
  forward: 'Forward',
  'show-desktop': 'Show desktop',
  copy: 'Copy',
  paste: 'Paste',
  undo: 'Undo',
  'play-pause': 'Play / pause',
  'volume-up': 'Volume up',
  'volume-down': 'Volume down',
  disabled: 'Disabled',
};

/** A mouse button always holds an action, so it has nothing to restore to. */
export const MOUSE_ACTIONS = Object.keys(ACTIONS).filter((id) => id !== 'default');

/** A key types a character unless rebound, so "Default" is what restores it. */
export const KEY_ACTIONS = Object.keys(ACTIONS).filter((id) => id !== 'middle-click');

/** The selectable light effects, in the order the picker offers them. */
export const EFFECTS: [LightEffect, string][] = [
  [LightEffect.STATIC, 'Steady'],
  [LightEffect.BREATHING, 'Pulse'],
  [LightEffect.WAVE, 'Wave'],
];

export function boundAction(bindings: Binding[], control: string): string {
  return bindings.find((entry) => entry.control === control)?.action ?? '';
}

export function actionLabel(action: string): string {
  return ACTIONS[action] ?? action;
}

export function controlLabel(control: string): string {
  return CONTROLS[control] ?? KEYS[control] ?? control.toUpperCase();
}
