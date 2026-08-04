import type { Binding } from '@/gen/devices';

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
 * Finds the action assigned to one control, or falls back to its default behavior.
 */
export function boundAction(bindings: Binding[], control: string): string {
  return bindings.find((entry) => entry.control === control)?.action ?? '';
}

/**
 * Turns an action ID into the name shown in editors and callouts.
 */
export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}
