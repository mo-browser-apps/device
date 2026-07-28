import type { MouseSpec } from '@/gen/devices';
import { cn } from '@/lib/utils';

export type MouseArtProfile = 'performance' | 'travel';

const MOUSE_LABELS: Record<string, string> = {
  left: 'Left button',
  right: 'Right button',
  wheel: 'Middle button',
  forward: 'Forward button',
  back: 'Back button',
  gesture: 'Gesture button',
};

const HOTSPOTS: Record<MouseArtProfile, { id: string; x: number; y: number }[]> = {
  performance: [
    { id: 'left', x: 24, y: 49 },
    { id: 'right', x: 35, y: 57 },
    { id: 'wheel', x: 33, y: 42 },
    { id: 'forward', x: 55, y: 49 },
    { id: 'back', x: 62, y: 43 },
    { id: 'gesture', x: 52, y: 63 },
  ],
  travel: [
    { id: 'left', x: 30, y: 51 },
    { id: 'right', x: 47, y: 58 },
    { id: 'wheel', x: 39, y: 48 },
  ],
};

export function MouseArt({
  spec,
  src,
  alt,
  aspect,
  profile,
  interactive = false,
  selectedControl,
  onControlSelect,
  className,
}: {
  spec: MouseSpec;
  src: string;
  alt: string;
  aspect: string;
  profile: MouseArtProfile;
  interactive?: boolean;
  selectedControl?: string | null;
  onControlSelect?: (control: string) => void;
  className?: string;
}) {
  const available = new Set(spec.buttons);

  return (
    <span className={cn('relative block w-full', className)} style={{ aspectRatio: aspect }}>
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="pointer-events-none size-full select-none object-contain drop-shadow-[0_18px_18px_rgba(0,0,0,0.24)]"
      />

      {interactive &&
        HOTSPOTS[profile]
          .filter(({ id }) => available.has(id))
          .map(({ id, x, y }) => {
            const selected = selectedControl === id;
            return (
              <button
                key={id}
                type="button"
                aria-label={MOUSE_LABELS[id] ?? id}
                aria-pressed={selected}
                onClick={() => onControlSelect?.(id)}
                style={{ left: `${x}%`, top: `${y}%` }}
                className="group absolute flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-hidden"
              >
                <span
                  className={cn(
                    'size-3.5 rounded-full border-2 border-background/70 bg-primary shadow-sm',
                    'transition-transform group-hover:scale-125 group-focus-visible:scale-125',
                    selected
                      ? 'scale-125 ring-2 ring-ring ring-offset-2 ring-offset-background'
                      : 'opacity-85',
                  )}
                />
                <span
                  className={cn(
                    'pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2',
                    'whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1',
                    'text-xs text-popover-foreground shadow-md transition-opacity',
                    'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
                    selected && 'opacity-100',
                  )}
                >
                  {MOUSE_LABELS[id] ?? id}
                </span>
              </button>
            );
          })}
    </span>
  );
}
