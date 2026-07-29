import type { MouseSettings } from '@/gen/devices';

export const ACTIONS: Record<string, string> = {
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

export function boundAction(mouse: MouseSettings, control: string): string {
  return mouse.bindings.find((entry) => entry.control === control)?.action ?? '';
}

export function actionLabel(action: string): string {
  return ACTIONS[action] ?? action;
}
