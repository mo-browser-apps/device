import type { CSSProperties, ReactNode } from 'react';
import { LightEffect, type KeyboardSettings, type KeyboardSpec } from '@/gen/devices';
import { controlLabel } from '@/components/device/controls';
import { cn } from '@/lib/utils';

const KEYBOARD_ROWS = [
  'esc 1 2 3 4 5 6 7 8 9 0 minus equal backspace:2',
  'tab:1.5 q w e r t y u i o p bracketleft bracketright backslash:1.5',
  'capslock:1.75 a s d f g h j k l semicolon quote enter:2.25',
  'shiftleft:2.25 z x c v b n m comma period slash shiftright:2.75',
  'ctrlleft:1.25 metaleft:1.25 altleft:1.25 space:6.25 altright:1.25 fn:1.25 menu:1.25 ctrlright:1.25',
];

/**
 * Provides the short labels drawn on special key caps.
 */
const KEY_FACE_LABELS: Record<string, string> = {
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

const KEY_ROW_INSETS = ['1.4%', '1%', '0.55%', '0.2%', '0%'];

/**
 * Sets the length of one glow cycle and one wave across the keyboard.
 */
const LIGHTING_CYCLE_SECONDS = 2.4;

interface KeyLayout {
  id: string;
  width: number;
  waveAnimationDelay: string;
}

const KEY_LAYOUT: KeyLayout[][] = KEYBOARD_ROWS.map((row) => {
  const keys = row.split(' ').map((key) => {
    const [id, width = '1'] = key.split(':');
    return { id, width: Number(width) };
  });

  const totalWidth = keys.reduce((sum, key) => sum + key.width, 0);
  let currentWidth = 0;

  return keys.map((key) => {
    const centerOffset = (currentWidth + key.width / 2) / totalWidth;
    currentWidth += key.width;

    return {
      ...key,
      waveAnimationDelay: `-${(centerOffset * LIGHTING_CYCLE_SECONDS).toFixed(2)}s`,
    };
  });
});

/**
 * Builds the fixed grid geometry that keeps both keyboard layers aligned.
 */
const KEY_ROW_STYLES: CSSProperties[] = KEY_LAYOUT.map((row, index) => ({
  gridTemplateColumns: row.map(({ width }) => `${width}fr`).join(' '),
  marginInline: KEY_ROW_INSETS[index],
}));

export type Lighting = Pick<KeyboardSettings, 'effect' | 'hue' | 'brightness'>;

/**
 * Returns the short label drawn on one key cap.
 */
function keyFaceLabel(id: string): string {
  return KEY_FACE_LABELS[id] ?? id.toUpperCase();
}

/**
 * Reports whether a lighting effect should animate the key layer.
 */
function isAnimated(effect: LightEffect): boolean {
  return effect === LightEffect.BREATHING || effect === LightEffect.WAVE;
}

/**
 * Builds the glow style for one key from the current lighting settings.
 */
function lightingStyle(
  { effect, hue, brightness }: Lighting,
  keyLayout: KeyLayout,
): CSSProperties {
  const intensity = brightness / 100;
  const glowColor = (alpha: number, lightness = 55) =>
    `hsl(${hue} 100% ${lightness}% / ${(alpha * intensity).toFixed(3)})`;

  return {
    mixBlendMode: 'screen',
    boxShadow: [
      `0 ${1.5 * intensity}px ${2.5 * intensity}px ${0.25 * intensity}px ${glowColor(0.75, 62)}`,
      `0 ${4 * intensity}px ${8 * intensity}px ${-1.5 * intensity}px ${glowColor(0.42)}`,
    ].join(', '),
    color: `hsl(${hue} 100% 72% / ${(0.38 + 0.47 * intensity).toFixed(3)})`,
    textShadow: `0 1px ${2.5 * intensity}px ${glowColor(0.7, 65)}`,
    animationDelay: effect === LightEffect.WAVE ? keyLayout.waveAnimationDelay : '0s',
    animationDuration: `${LIGHTING_CYCLE_SECONDS}s`,
  };
}

/**
 * Draws the decorative label and glow for one key.
 */
function KeyFace({
  id,
  lighting,
  keyLayout,
}: {
  id: string;
  lighting: Lighting | null;
  keyLayout: KeyLayout;
}) {
  return (
    <span
      style={lighting ? lightingStyle(lighting, keyLayout) : undefined}
      className={cn(
        'flex min-w-0 items-center justify-center rounded-[14%]',
        'text-[8px] font-medium leading-none',
        !lighting && 'text-white/45',
        lighting && isAnimated(lighting.effect) &&
          'animate-[key-glow_ease-in-out_infinite] motion-reduce:animate-none',
      )}
    >
      {keyFaceLabel(id)}
    </span>
  );
}

/**
 * Adds the selectable hit target that sits over one key in the image.
 */
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
  const keyName = controlLabel(id);

  return (
    <button
      type="button"
      disabled={!selectable}
      aria-label={selectable ? `Select ${keyName} key` : undefined}
      aria-pressed={selectable ? selected : undefined}
      title={selectable ? `${keyName} key` : 'Fixed in firmware'}
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
 * Places one complete layer over the keyboard image.
 * Both the visual keys and hit targets use it so they stay aligned.
 */
interface KeyLayerProps {
  renderKey: (key: KeyLayout) => ReactNode;
  className?: string;
  role?: string;
  'aria-label'?: string;
  'aria-hidden'?: boolean;
}

/**
 * Renders every key in one shared keyboard layer.
 */
function KeyLayer({ renderKey, className, ...ariaProps }: KeyLayerProps) {
  return (
    <span
      {...ariaProps}
      className={cn(
        'absolute left-[7.4%] top-[24.1%] flex h-[43.9%] w-[85.2%] flex-col gap-[2.6%]',
        className,
      )}
    >
      {KEY_LAYOUT.map((row, rowIndex) => (
        <span
          key={rowIndex}
          className="grid min-h-0 flex-1 gap-[0.32%]"
          style={KEY_ROW_STYLES[rowIndex]}
        >
          {row.map(renderKey)}
        </span>
      ))}
    </span>
  );
}

interface KeyboardArtProps {
  spec: KeyboardSpec;
  src: string;
  alt: string;
  aspect: string;
  /**
   * The backlight to draw; omitted or zero brightness leaves the keys unlit.
   */
  lighting?: Lighting | null;
  selectedControl?: string | null;
  /**
   * Makes reported remappable keys selectable when provided.
   */
  onControlSelect?: (control: string) => void;
  className?: string;
}

/**
 * Draws the keyboard image, its lighting layer, and selectable key targets.
 */
export function KeyboardArt({
  spec,
  src,
  alt,
  aspect,
  lighting,
  selectedControl,
  onControlSelect,
  className,
}: KeyboardArtProps) {
  const selectableKeys = new Set(spec.keys);
  const activeLighting = lighting && lighting.brightness > 0 ? lighting : null;

  return (
    <span className={cn('relative block w-full', className)} style={{ aspectRatio: aspect }}>
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="pointer-events-none size-full select-none object-contain drop-shadow-[0_20px_22px_rgba(0,0,0,0.30)]"
      />

      <KeyLayer
        aria-hidden
        className="pointer-events-none"
        renderKey={(key) => (
          <KeyFace key={key.id} id={key.id} lighting={activeLighting} keyLayout={key} />
        )}
      />

      {onControlSelect && (
        <KeyLayer
          role="group"
          aria-label="Keys"
          renderKey={(key) => (
            <KeyCap
              key={key.id}
              id={key.id}
              selectable={selectableKeys.has(key.id)}
              selected={selectedControl === key.id}
              onSelect={onControlSelect}
            />
          )}
        />
      )}
    </span>
  );
}
