import { cn, FOCUS_RING } from '@/lib/utils';

export type MouseArtProfile = 'performance' | 'travel';

/**
 * Describes one mouse control and the action shown beside it.
 */
export type Callout = { id: string; name: string; value: string };

interface ControlHotspot {
  markerX: number;
  markerY: number;
  labelSide: 'left' | 'right';
  labelY: number;
}

interface ControlCalloutProps extends Callout {
  hotspot: ControlHotspot;
  selected: boolean;
  onSelect?: (control: string) => void;
}

interface MouseArtProps {
  src: string;
  alt: string;
  aspect: string;
  profile: MouseArtProfile;
  callouts: Callout[];
  selectedControl?: string | null;
  onControlSelect?: (control: string) => void;
  className?: string;
}

const HOTSPOTS_BY_PROFILE: Record<MouseArtProfile, Record<string, ControlHotspot>> = {
  performance: {
    wheel: { markerX: 33, markerY: 43, labelSide: 'left', labelY: 36 },
    back: { markerX: 62, markerY: 42, labelSide: 'right', labelY: 37 },
    forward: { markerX: 55, markerY: 49, labelSide: 'right', labelY: 52 },
    gesture: { markerX: 52, markerY: 63, labelSide: 'right', labelY: 66 },
  },
  travel: {
    wheel: { markerX: 39, markerY: 51, labelSide: 'left', labelY: 44 },
  },
};

/**
 * Places one selectable control label beside its marker on the mouse image.
 */
function ControlCallout({
  id,
  name,
  value,
  hotspot,
  selected,
  onSelect,
}: ControlCalloutProps) {
  const labelPosition =
    hotspot.labelSide === 'right'
      ? { top: `${hotspot.labelY}%`, left: `${hotspot.markerX}%` }
      : { top: `${hotspot.labelY}%`, right: `${100 - hotspot.markerX}%` };

  return (
    <span className="group">
      <span
        aria-hidden="true"
        style={{ left: `${hotspot.markerX}%`, top: `${hotspot.markerY}%` }}
        className={cn(
          'absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full',
          'border border-background/70 transition duration-200',
          'group-hover:scale-125 group-hover:bg-primary',
          'group-focus-within:scale-125 group-focus-within:bg-primary',
          selected ? 'scale-125 bg-primary' : 'bg-foreground/45',
        )}
      />

      <button
        type="button"
        style={labelPosition}
        aria-pressed={selected}
        aria-label={`${name}, ${value}`}
        onClick={() => onSelect?.(id)}
        className={cn(
          'absolute flex -translate-y-1/2 items-center gap-1.5 whitespace-nowrap',
          'rounded-lg border px-2.5 py-1.5 text-xs backdrop-blur-sm',
          'transition-colors',
          FOCUS_RING,
          hotspot.labelSide === 'right' ? 'translate-x-3' : '-translate-x-3',
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
}

/**
 * Draws a mouse image with interactive labels for its reported controls.
 */
export function MouseArt({
  src,
  alt,
  aspect,
  profile,
  callouts,
  selectedControl,
  onControlSelect,
  className,
}: MouseArtProps) {
  const profileHotspots = HOTSPOTS_BY_PROFILE[profile];

  return (
    <span className={cn('relative block w-full', className)} style={{ aspectRatio: aspect }}>
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="pointer-events-none size-full select-none object-contain drop-shadow-[0_20px_22px_rgba(0,0,0,0.30)]"
      />

      {callouts.map((callout) => {
        const hotspot = profileHotspots[callout.id];
        if (!hotspot) return null;

        return (
          <ControlCallout
            key={callout.id}
            {...callout}
            hotspot={hotspot}
            selected={selectedControl === callout.id}
            onSelect={onControlSelect}
          />
        );
      })}
    </span>
  );
}
