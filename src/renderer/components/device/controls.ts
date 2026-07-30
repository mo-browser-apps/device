import { LightEffect, type Binding } from '@/gen/devices';

/**
 * Maps native mouse control IDs to names shown in the renderer.
 */
const MOUSE_CONTROL_LABELS: Record<string, string> = {
  wheel: 'Wheel',
  back: 'Back',
  forward: 'Forward',
  gesture: 'Thumb button',
};

/**
 * Maps special key IDs to readable names; letters and digits need no entry.
 */
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
 * Maps action IDs shared with the native stack to names shown in the renderer.
 */
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

/**
 * Lists the actions offered for mouse buttons.
 */
export const MOUSE_ACTIONS = Object.keys(ACTION_LABELS).filter((action) => action !== 'default');

/**
 * Lists the actions offered for keyboard keys, including their default behavior.
 */
export const KEY_ACTIONS = Object.keys(ACTION_LABELS).filter(
  (action) => action !== 'middle-click',
);

const DEFAULT_MOUSE_ACTIONS: Record<string, string> = {
  wheel: 'middle-click',
  back: 'back',
  forward: 'forward',
  gesture: 'show-desktop',
};

/**
 * Lists the keyboard lighting effects in the order shown by the editor.
 */
export const EFFECTS: [effect: LightEffect, label: string][] = [
  [LightEffect.STATIC, 'Steady'],
  [LightEffect.BREATHING, 'Pulse'],
  [LightEffect.WAVE, 'Wave'],
];

/**
 * Finds the action assigned to one control, or falls back to its default behavior.
 */
export function boundAction(bindings: Binding[], control: string): string {
  return bindings.find((entry) => entry.control === control)?.action ?? '';
}

/**
 * Restores the known default action for every mouse button.
 */
export function resetMouseBindings(bindings: Binding[]): Binding[] {
  return bindings.map((binding) => ({
    ...binding,
    action: DEFAULT_MOUSE_ACTIONS[binding.control] ?? binding.action,
  }));
}

/**
 * Restores every keyboard key to its normal typing behavior.
 */
export function resetKeyBindings(bindings: Binding[]): Binding[] {
  return bindings.map((binding) => ({ ...binding, action: 'default' }));
}

/**
 * Turns an action ID into the name shown in editors and callouts.
 */
export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

/**
 * Turns a mouse button or key ID into the name shown in the UI.
 */
export function controlLabel(control: string): string {
  return MOUSE_CONTROL_LABELS[control] ?? KEY_LABELS[control] ?? control.toUpperCase();
}
