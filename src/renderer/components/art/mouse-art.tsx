import { useState } from 'react';
import { cn } from '@/lib/utils';

export type MouseArtProfile = 'performance' | 'travel';

export const MOUSE_LABELS: Record<string, string> = {
  wheel: 'Wheel',
  back: 'Back',
  forward: 'Forward',
  gesture: 'Thumb button',
};

type Hotspot = { x: number; y: number; side: 'left' | 'right'; labelY: number };

const HOTSPOTS: Record<MouseArtProfile, Record<string, Hotspot>> = {
  performance: {
    wheel: { x: 33, y: 43, side: 'left', labelY: 36 },
    back: { x: 62, y: 42, side: 'right', labelY: 37 },
    forward: { x: 55, y: 49, side: 'right', labelY: 52 },
    gesture: { x: 52, y: 63, side: 'right', labelY: 66 },
  },
  travel: {
    wheel: { x: 39, y: 51, side: 'left', labelY: 44 },
  },
};

export type Callout = { id: string; value: string };

export function MouseArt({
  src,
  alt,
  aspect,
  profile,
  callouts,
  selectedControl,
  onControlSelect,
  className,
}: {
  src: string;
  alt: string;
  aspect: string;
  profile: MouseArtProfile;
  callouts: Callout[];
  selectedControl?: string | null;
  onControlSelect?: (control: string) => void;
  className?: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const hotspots = HOTSPOTS[profile];

  return (
    <span className={cn('relative block w-full', className)} style={{ aspectRatio: aspect }}>
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="pointer-events-none size-full select-none object-contain drop-shadow-[0_18px_18px_rgba(0,0,0,0.24)]"
      />

      {callouts.map(({ id, value }) => {
        const spot = hotspots[id];
        if (!spot) return null;

        const name = MOUSE_LABELS[id] ?? id;
        const selected = selectedControl === id;
        const active = selected || hovered === id;
        const anchor =
          spot.side === 'right'
            ? { left: `${spot.x}%`, top: `${spot.labelY}%` }
            : { right: `${100 - spot.x}%`, top: `${spot.labelY}%` };

        return (
          <span key={id}>
            <span
              aria-hidden="true"
              style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
              className={cn(
                'absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full',
                'border border-background/70 transition-transform duration-200',
                active ? 'scale-125 bg-primary' : 'bg-foreground/45',
              )}
            />

            <button
              type="button"
              style={anchor}
              aria-pressed={selected}
              aria-label={`${name}, ${value}`}
              onClick={() => onControlSelect?.(id)}
              onPointerEnter={() => setHovered(id)}
              onPointerLeave={() => setHovered(null)}
              onFocus={() => setHovered(id)}
              onBlur={() => setHovered(null)}
              className={cn(
                'absolute flex -translate-y-1/2 items-center gap-1.5 whitespace-nowrap',
                'rounded-lg border px-2.5 py-1.5 text-xs backdrop-blur-sm',
                'transition-colors focus-visible:outline-hidden focus-visible:ring-2',
                'focus-visible:ring-ring focus-visible:ring-offset-2',
                'focus-visible:ring-offset-background',
                spot.side === 'right' ? 'translate-x-3' : '-translate-x-3',
                selected
                  ? 'border-primary/70 bg-primary/15 text-foreground'
                  : 'border-border/60 bg-background/80 hover:border-border',
              )}
            >
              <span className={selected ? 'opacity-80' : 'text-muted-foreground'}>{name}</span>
              <span aria-hidden="true" className="opacity-40">
                ·
              </span>
              <span className="font-medium">{value}</span>
            </button>
          </span>
        );
      })}
    </span>
  );
}
