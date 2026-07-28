export const ACTIONS: Record<string, string> = {
  'middle-click': 'Middle click',
  back: 'Back',
  forward: 'Forward',
  overview: 'Show open windows',
  'show-desktop': 'Show desktop',
  copy: 'Copy',
  paste: 'Paste',
  undo: 'Undo',
  'play-pause': 'Play / pause',
  'volume-up': 'Volume up',
  'volume-down': 'Volume down',
};

export const DISABLED = 'disabled';

export function actionLabel(action: string): string {
  if (action === DISABLED) return 'Disabled';
  return ACTIONS[action] ?? action;
}
