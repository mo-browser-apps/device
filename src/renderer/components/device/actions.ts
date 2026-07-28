const ACTION_LABELS: Record<string, string | undefined> = {
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
  disabled: 'Disabled',
};

export const ACTIONS = [
  'middle-click',
  'back',
  'forward',
  'overview',
  'show-desktop',
  'copy',
  'paste',
  'undo',
  'play-pause',
  'volume-up',
  'volume-down',
] as const;

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}
