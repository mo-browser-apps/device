import { LightEffect, type Binding } from '@/gen/devices';

/** Names for the controls a mouse reports. */
const MOUSE_CONTROL_LABELS: Record<string, string> = {
  wheel: 'Wheel',
  back: 'Back',
  forward: 'Forward',
  gesture: 'Thumb button',
};

/** Names for the keys whose id does not already read as one. Letters and digits do. */
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

/** Actions a control can be bound to. */
const ACTION_LABELS: Record<string, string> = {
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
export const MOUSE_ACTIONS = Object.keys(ACTION_LABELS).filter((action) => action !== 'default');

/** A key types a character unless rebound, so "Default" is what restores it. */
export const KEY_ACTIONS = Object.keys(ACTION_LABELS).filter(
  (action) => action !== 'middle-click',
);

const DEFAULT_MOUSE_ACTIONS: Record<string, string> = {
  wheel: 'middle-click',
  back: 'back',
  forward: 'forward',
  gesture: 'show-desktop',
};

/** The selectable light effects, in the order the picker offers them. */
export const EFFECTS: [effect: LightEffect, label: string][] = [
  [LightEffect.STATIC, 'Steady'],
  [LightEffect.BREATHING, 'Pulse'],
  [LightEffect.WAVE, 'Wave'],
];

export function boundAction(bindings: Binding[], control: string): string {
  return bindings.find((entry) => entry.control === control)?.action ?? '';
}

export function resetMouseBindings(bindings: Binding[]): Binding[] {
  return bindings.map((binding) => ({
    ...binding,
    action: DEFAULT_MOUSE_ACTIONS[binding.control] ?? binding.action,
  }));
}

export function resetKeyBindings(bindings: Binding[]): Binding[] {
  return bindings.map((binding) => ({ ...binding, action: 'default' }));
}

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function controlLabel(control: string): string {
  return MOUSE_CONTROL_LABELS[control] ?? KEY_LABELS[control] ?? control.toUpperCase();
}
