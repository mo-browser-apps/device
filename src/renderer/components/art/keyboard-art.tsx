import type { CSSProperties } from 'react';
import type { KeyboardSpec } from '@/gen/devices';
import { cn } from '@/lib/utils';

const ROWS = [
  'esc 1 2 3 4 5 6 7 8 9 0 minus equal backspace:2',
  'tab:1.5 q w e r t y u i o p bracketleft bracketright backslash:1.5',
  'capslock:1.75 a s d f g h j k l semicolon quote enter:2.25',
  'shiftleft:2.25 z x c v b n m comma period slash shiftright:2.75',
  'ctrlleft:1.25 metaleft:1.25 altleft:1.25 space:6.25 altright:1.25 fn:1.25 metaright:1.25 ctrlright:1.25',
];

const KEY_LABELS: Record<string, string> = {
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
  metaleft: '⌘',
  altleft: 'Alt',
  space: '',
  altright: 'Alt',
  fn: 'Fn',
  metaright: '⌘',
  ctrlright: 'Ctrl',
};

const ROW_INSETS = ['1.4%', '1%', '0.55%', '0.2%', '0%'];

type Key = {
  id: string;
  width: number;
};

function parseRow(row: string): Key[] {
  return row.split(' ').map((key) => {
    const [id, width = '1'] = key.split(':');
    return { id, width: Number(width) };
  });
}

function rowStyle(row: Key[], index: number): CSSProperties {
  return {
    gridTemplateColumns: row.map(({ width }) => `${width}fr`).join(' '),
    marginInline: ROW_INSETS[index],
  };
}

export function KeyboardArt({
  spec,
  src,
  alt,
  aspect,
  interactive = false,
  selectedControl,
  onControlSelect,
  className,
}: {
  spec: KeyboardSpec;
  src: string;
  alt: string;
  aspect: string;
  interactive?: boolean;
  selectedControl?: string | null;
  onControlSelect?: (control: string) => void;
  className?: string;
}) {
  const available = new Set(spec.keys);

  return (
    <span className={cn('relative block w-full', className)} style={{ aspectRatio: aspect }}>
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="pointer-events-none size-full select-none object-contain drop-shadow-[0_18px_18px_rgba(0,0,0,0.24)]"
      />

      {interactive && (
        <span
          role="group"
          aria-label="Keys"
          className="absolute left-[7.4%] top-[24.1%] flex h-[43.9%] w-[85.2%] flex-col gap-[2.6%]"
        >
          {ROWS.map(parseRow).map((row, rowIndex) => (
            <span
              key={rowIndex}
              className="grid min-h-0 flex-1 gap-[0.32%]"
              style={rowStyle(row, rowIndex)}
            >
              {row.map(({ id }) => {
                const selectable = available.has(id);
                const selected = selectedControl === id;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={!selectable}
                    aria-label={selectable ? `Select ${KEY_LABELS[id] || id} key` : undefined}
                    aria-pressed={selectable ? selected : undefined}
                    title={selectable ? `${KEY_LABELS[id] || id} key` : 'Fixed in firmware'}
                    onClick={() => onControlSelect?.(id)}
                    className={cn(
                      'min-w-0 rounded-[14%] border border-transparent bg-transparent',
                      'text-[8px] font-medium leading-none text-white/45',
                      'outline-hidden transition-colors',
                      selectable &&
                        'hover:border-primary/70 hover:bg-primary/15 hover:text-primary-foreground',
                      selectable &&
                        'focus-visible:border-primary focus-visible:bg-primary/20 focus-visible:ring-1 focus-visible:ring-ring',
                      selected && 'border-primary bg-primary/25 text-primary-foreground ring-1 ring-ring',
                      !selectable && 'cursor-default text-white/25',
                    )}
                  >
                    {KEY_LABELS[id] ?? id.toUpperCase()}
                  </button>
                );
              })}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
