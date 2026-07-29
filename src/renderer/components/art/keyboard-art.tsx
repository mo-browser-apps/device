import type { CSSProperties, ReactNode } from 'react';
import { LightEffect, type KeyboardSettings, type KeyboardSpec } from '@/gen/devices';
import { controlLabel } from '@/components/device/controls';
import { cn } from '@/lib/utils';

const ROWS = [
  'esc 1 2 3 4 5 6 7 8 9 0 minus equal backspace:2',
  'tab:1.5 q w e r t y u i o p bracketleft bracketright backslash:1.5',
  'capslock:1.75 a s d f g h j k l semicolon quote enter:2.25',
  'shiftleft:2.25 z x c v b n m comma period slash shiftright:2.75',
  'ctrlleft:1.25 metaleft:1.25 altleft:1.25 space:6.25 altright:1.25 fn:1.25 menu:1.25 ctrlright:1.25',
];

/** Key-cap faces. Purely visual — the accessible name comes from `controlLabel`. */
const KEY_FACES: Record<string, string> = {
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

const ROW_INSETS = ['1.4%', '1%', '0.55%', '0.2%', '0%'];

/** One full cycle of the glow animation, and the span a wave takes to cross the board. */
const CYCLE_SECONDS = 2.4;

type Key = {
  id: string;
  width: number;
  waveDelay: string;
};

const KEY_ROWS: Key[][] = ROWS.map((row) => {
  const keys = row.split(' ').map((key) => {
    const [id, width = '1'] = key.split(':');
    return { id, width: Number(width) };
  });

  const total = keys.reduce((sum, key) => sum + key.width, 0);
  let start = 0;
  return keys.map((key) => {
    const offset = (start + key.width / 2) / total;
    start += key.width;
    return { ...key, waveDelay: `-${(offset * CYCLE_SECONDS).toFixed(2)}s` };
  });
});

/** Row geometry is fixed by the art, so each row's grid is built once. */
const ROW_STYLES: CSSProperties[] = KEY_ROWS.map((row, index) => ({
  gridTemplateColumns: row.map(({ width }) => `${width}fr`).join(' '),
  marginInline: ROW_INSETS[index],
}));

export type Lighting = Pick<KeyboardSettings, 'effect' | 'hue' | 'brightness'>;

/** The face printed on a key cap. The render's caps are blank, so this is the legend. */
function keyFace(id: string): string {
  return KEY_FACES[id] ?? id.toUpperCase();
}

/** Only these effects move. Anything else, including an unrecognised value, stays still. */
function isAnimated(effect: LightEffect): boolean {
  return effect === LightEffect.BREATHING || effect === LightEffect.WAVE;
}

/**
 * The glow is drawn here rather than baked into the art, so one neutral render
 * covers every colour and effect.
 */
function lightStyle({ effect, hue, brightness }: Lighting, key: Key): CSSProperties {
  const level = brightness / 100;
  const light = (alpha: number, lightness = 55) =>
    `hsl(${hue} 100% ${lightness}% / ${(alpha * level).toFixed(3)})`;

  return {
    mixBlendMode: 'screen',
    background: light(0.14),
    boxShadow: `0 0 ${9 * level}px ${2.5 * level}px ${light(0.5)}`,
    color: `hsl(${hue} 100% 72% / ${(0.45 + 0.55 * level).toFixed(3)})`,
    textShadow: `0 0 ${5 * level}px ${light(0.9, 65)}`,
    animationDelay: effect === LightEffect.WAVE ? key.waveDelay : '0s',
    animationDuration: `${CYCLE_SECONDS}s`,
    transition: 'background 200ms, box-shadow 200ms, color 200ms, text-shadow 200ms',
  };
}

/** The lit cap face. Decorative — the legend it draws is the render's, which is blank. */
function KeyFace({ id, lighting, keyData }: { id: string; lighting: Lighting | null; keyData: Key }) {
  return (
    <span
      style={lighting ? lightStyle(lighting, keyData) : undefined}
      className={cn(
        'flex min-w-0 items-center justify-center rounded-[14%]',
        'text-[8px] font-medium leading-none',
        !lighting && 'text-white/45',
        lighting && isAnimated(lighting.effect) &&
          'animate-[key-glow_ease-in-out_infinite] motion-reduce:animate-none',
      )}
    >
      {keyFace(id)}
    </span>
  );
}

/** The hit target and selection outline, over the face. Carries no legend of its own. */
function KeyCap({
  id,
  selectable,
  selected,
  onSelect,
}: {
  id: string;
  selectable: boolean;
  selected: boolean;
  onSelect?: (control: string) => void;
}) {
  const name = controlLabel(id);

  return (
    <button
      type="button"
      disabled={!selectable}
      aria-label={selectable ? `Select ${name} key` : undefined}
      aria-pressed={selectable ? selected : undefined}
      title={selectable ? `${name} key` : 'Fixed in firmware'}
      onClick={() => onSelect?.(id)}
      className={cn(
        'min-w-0 rounded-[14%] border border-transparent bg-transparent',
        'outline-hidden transition-colors',
        selectable && 'hover:border-primary/70 hover:bg-primary/15',
        selectable &&
          'focus-visible:border-primary focus-visible:bg-primary/20 focus-visible:ring-1 focus-visible:ring-ring',
        selected && 'border-primary bg-primary/25 ring-1 ring-ring',
        !selectable && 'cursor-default',
      )}
    />
  );
}

/**
 * One pass of the key grid. Both layers go through this, so the faces and the
 * hit targets cannot drift out of alignment.
 */
function KeyLayer({
  render,
  className,
  ...aria
}: {
  render: (key: Key) => ReactNode;
  className?: string;
  role?: string;
  'aria-label'?: string;
  'aria-hidden'?: boolean;
}) {
  return (
    <span
      {...aria}
      className={cn(
        'absolute left-[7.4%] top-[24.1%] flex h-[43.9%] w-[85.2%] flex-col gap-[2.6%]',
        className,
      )}
    >
      {KEY_ROWS.map((row, rowIndex) => (
        <span key={rowIndex} className="grid min-h-0 flex-1 gap-[0.32%]" style={ROW_STYLES[rowIndex]}>
          {row.map(render)}
        </span>
      ))}
    </span>
  );
}

export function KeyboardArt({
  spec,
  src,
  alt,
  aspect,
  lighting,
  selectedControl,
  onControlSelect,
  className,
}: {
  spec: KeyboardSpec;
  src: string;
  alt: string;
  aspect: string;
  /** The backlight to draw. Omitted, or at zero brightness, the caps read unlit. */
  lighting?: Lighting | null;
  selectedControl?: string | null;
  /** Set to make the remappable keys selectable. */
  onControlSelect?: (control: string) => void;
  className?: string;
}) {
  const available = new Set(spec.keys);
  const lit = lighting && lighting.brightness > 0 ? lighting : null;

  return (
    <span className={cn('relative block w-full', className)} style={{ aspectRatio: aspect }}>
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="pointer-events-none size-full select-none object-contain drop-shadow-[0_18px_18px_rgba(0,0,0,0.24)]"
      />

      <KeyLayer
        aria-hidden
        className="pointer-events-none"
        render={(key) => <KeyFace key={key.id} id={key.id} lighting={lit} keyData={key} />}
      />

      {onControlSelect && (
        <KeyLayer
          role="group"
          aria-label="Keys"
          render={(key) => (
            <KeyCap
              key={key.id}
              id={key.id}
              selectable={available.has(key.id)}
              selected={selectedControl === key.id}
              onSelect={onControlSelect}
            />
          )}
        />
      )}
    </span>
  );
}
