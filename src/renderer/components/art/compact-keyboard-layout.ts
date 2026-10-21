import type { KeyboardLayout, KeyRect } from './keyboard-art';

/**
 * A generic 60% ANSI keyboard, row by row, as "id:width" in key units. It draws the
 * lighting on `device-art/compact-keyboard.webp`, the artwork shown for any keyboard
 * that has none of its own.
 */
const ROWS = [
  'esc 1 2 3 4 5 6 7 8 9 0 minus equal backspace:2',
  'tab:1.5 q w e r t y u i o p bracketleft bracketright backslash:1.5',
  'capslock:1.75 a s d f g h j k l semicolon quote enter:2.25',
  'shiftleft:2.25 z x c v b n m comma period slash shiftright:2.75',
  'ctrlleft:1.25 metaleft:1.25 altleft:1.25 space:6.25 altright:1.25 fn:1.25 menu:1.25 ctrlright:1.25',
];

/** Every row is 15 keys wide. */
const ROW_WIDTH = 15;

/**
 * How far each row's ends sit inside the grid, as a fraction of its width: the artwork
 * is drawn in slight perspective, so upper rows look narrower.
 */
const ROW_INSETS = [0.014, 0.01, 0.0055, 0.002, 0];

const LABELS: Record<string, string> = {
  esc: 'Esc',
  minus: '−',
  equal: '=',
  backspace: '⌫',
  tab: 'Tab',
  bracketleft: '[',
  bracketright: ']',
  backslash: '\\',
  capslock: 'Caps',
  semicolon: ';',
  quote: "'",
  enter: 'Enter',
  shiftleft: 'Shift',
  comma: ',',
  period: '.',
  slash: '/',
  shiftright: 'Shift',
  ctrlleft: 'Ctrl',
  metaleft: 'Win',
  altleft: 'Alt',
  space: '',
  altright: 'Alt',
  fn: 'Fn',
  menu: 'Menu',
  ctrlright: 'Ctrl',
};

function rowKeys(row: string, y: number): KeyRect[] {
  const scale = 1 - 2 * ROW_INSETS[y];
  let x = ROW_INSETS[y] * ROW_WIDTH;
  return row.split(' ').map((key) => {
    const [id, width = '1'] = key.split(':');
    const w = Number(width) * scale;
    const rect = { id, label: LABELS[id] ?? id.toUpperCase(), x, y, w, h: 1 };
    x += w;
    return rect;
  });
}

export const COMPACT_KEYBOARD_LAYOUT: KeyboardLayout = {
  // Where the key grid sits in the 821 × 479 artwork.
  area: { left: 0.074, top: 0.241, width: 0.852, height: 0.439 },
  keys: ROWS.flatMap(rowKeys),
};
