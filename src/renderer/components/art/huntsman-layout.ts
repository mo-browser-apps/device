import type { KeyboardLayout } from './keyboard-art';
import { K10_MAX_LAYOUT } from './k10-max-layout';

const HUNTSMAN_LABELS: Record<string, string> = {
  ctana: 'ScrLk',
  light: 'Pause',
};

/** The Huntsman shares ANSI key positions with the K10, minus its four extra top-row keys. */
export const HUNTSMAN_LAYOUT: KeyboardLayout = {
  area: {
    left: 82 / 1909,
    top: 171 / 824,
    width: (22.5 * 77.2) / 1909,
    height: (6.25 * 77.8) / 824,
  },
  keys: K10_MAX_LAYOUT.keys
    .filter((key) => !key.id.startsWith('blank-'))
    .map((key) => ({ ...key, label: HUNTSMAN_LABELS[key.id] ?? key.label })),
  mark: {
    src: '/device-art/razer-logo.webp',
    area: {
      left: 1630 / 1909,
      top: 175 / 824,
      width: 88 / 1909,
      height: 80 / 824,
    },
  },
};
