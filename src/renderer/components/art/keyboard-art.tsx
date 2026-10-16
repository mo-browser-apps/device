import type { CSSProperties, ReactNode } from 'react';
import { LightEffect, type KeyboardSettings, type KeyboardSpec } from '@/gen/devices';
import { keyboardControlLabel } from '@/components/device/keyboard-device';
import { cn } from '@/lib/utils';

/**
 * One key in key units (1 = a standard key), with the label drawn on its cap.
 */
export interface KeyRect {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The keys of one keyboard artwork, and where their grid sits in the image.
 */
export interface KeyboardLayout {
  /** Fractions of the image's width and height. */
  area: { left: number; top: number; width: number; height: number };
  keys: KeyRect[];
}

/**
 * The gap between a key's slot and its cap face, in key units.
 */
const KEY_INSET = 0.09;

/**
 * Sets the length of one glow cycle and one wave across the keyboard.
 */
const LIGHTING_CYCLE_SECONDS = 2.4;

interface KeyLayout extends KeyRect {
  style: CSSProperties;
  waveAnimationDelay: string;
}

/**
 * Positions every key as a percentage of the grid, so the layers scale with the image.
 */
function placeKeys(keys: KeyRect[]): KeyLayout[] {
  const width = Math.max(...keys.map((key) => key.x + key.w));
  const height = Math.max(...keys.map((key) => key.y + key.h));
  const percent = (value: number, total: number) => `${(value / total) * 100}%`;

  return keys.map((key) => ({
    ...key,
    style: {
      position: 'absolute',
      left: percent(key.x + KEY_INSET, width),
      top: percent(key.y + KEY_INSET, height),
      width: percent(key.w - 2 * KEY_INSET, width),
      height: percent(key.h - 2 * KEY_INSET, height),
    },
    waveAnimationDelay: `-${(((key.x + key.w / 2) / width) * LIGHTING_CYCLE_SECONDS).toFixed(2)}s`,
  }));
}

export type Lighting = Pick<KeyboardSettings, 'effect' | 'hue' | 'brightness'>;

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
function KeyFace({ lighting, keyLayout }: { lighting: Lighting | null; keyLayout: KeyLayout }) {
  return (
    <span
      style={{ ...keyLayout.style, ...(lighting ? lightingStyle(lighting, keyLayout) : {}) }}
      className={cn(
        'flex min-w-0 items-center justify-center rounded-[14%]',
        'text-[6px] font-medium leading-none',
        !lighting && 'text-white/45',
        lighting && isAnimated(lighting.effect) &&
          'animate-[key-glow_ease-in-out_infinite] motion-reduce:animate-none',
      )}
    >
      {keyLayout.label}
    </span>
  );
}

/**
 * Adds the selectable hit target that sits over one key in the image.
 */
function KeyCap({
  id,
  style,
  selectable,
  selected,
  onSelect,
}: {
  id: string;
  style: CSSProperties;
  selectable: boolean;
  selected: boolean;
  onSelect?: (control: string) => void;
}) {
  const keyName = keyboardControlLabel(id);

  return (
    <button
      type="button"
      disabled={!selectable}
      aria-label={selectable ? `Select ${keyName} key` : undefined}
      aria-pressed={selectable ? selected : undefined}
      title={selectable ? `${keyName} key` : 'Fixed in firmware'}
      onClick={() => onSelect?.(id)}
      style={style}
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
  layout: KeyboardLayout;
  keys: KeyLayout[];
  renderKey: (key: KeyLayout) => ReactNode;
  className?: string;
  role?: string;
  'aria-label'?: string;
  'aria-hidden'?: boolean;
}

/**
 * Renders every key in one shared keyboard layer.
 */
function KeyLayer({ layout, keys, renderKey, className, ...ariaProps }: KeyLayerProps) {
  const { left, top, width, height } = layout.area;
  return (
    <span
      {...ariaProps}
      className={cn('absolute', className)}
      style={{
        left: `${left * 100}%`,
        top: `${top * 100}%`,
        width: `${width * 100}%`,
        height: `${height * 100}%`,
      }}
    >
      {keys.map(renderKey)}
    </span>
  );
}

interface KeyboardArtProps {
  spec: KeyboardSpec;
  layout: KeyboardLayout;
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
  layout,
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
  const keys = placeKeys(layout.keys);

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
        layout={layout}
        keys={keys}
        renderKey={(key) => <KeyFace key={key.id} lighting={activeLighting} keyLayout={key} />}
      />

      {onControlSelect && (
        <KeyLayer
          role="group"
          aria-label="Keys"
          layout={layout}
          keys={keys}
          renderKey={(key) => (
            <KeyCap
              key={key.id}
              id={key.id}
              style={key.style}
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
