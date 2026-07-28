import type { Device } from '@/gen/devices';
import { cn } from '@/lib/utils';
import { KeyboardArt } from './keyboard-art';
import { MouseArt, type Callout, type MouseArtProfile } from './mouse-art';

type Art = {
  detail: string;
  home: string;
  alt: string;
  aspect: string;
  profile?: MouseArtProfile;
};

const ART: Record<string, Art> = {
  'performance-mouse': {
    detail: '/device-art/performance-mouse.webp',
    home: '/device-art/performance-mouse-home.webp',
    alt: 'Graphite wireless performance mouse',
    aspect: '3 / 2',
    profile: 'performance',
  },
  'travel-mouse': {
    detail: '/device-art/travel-mouse.webp',
    home: '/device-art/travel-mouse-home.webp',
    alt: 'Stone-gray compact travel mouse',
    aspect: '3 / 2',
    profile: 'travel',
  },
  'compact-keyboard': {
    detail: '/device-art/compact-keyboard.webp',
    home: '/device-art/compact-keyboard-home.webp',
    alt: 'Graphite compact keyboard',
    aspect: '821 / 479',
  },
};

function artFor(device: Device): Art | null {
  if (!device.mouse && !device.keyboard) {
    return null;
  }
  if (ART[device.id]) {
    return ART[device.id];
  }
  if (device.keyboard) {
    return ART['compact-keyboard'];
  }
  return (device.mouse?.buttons.length ?? 0) > 3 ? ART['performance-mouse'] : ART['travel-mouse'];
}

export function DeviceArt({
  device,
  variant = 'detail',
  interactive = false,
  callouts = [],
  selectedControl,
  onControlSelect,
  className,
}: {
  device: Device;
  variant?: 'home' | 'detail';
  interactive?: boolean;
  callouts?: Callout[];
  selectedControl?: string | null;
  onControlSelect?: (control: string) => void;
  className?: string;
}) {
  const art = artFor(device);
  if (!art) return null;

  const offline = !device.connected && 'grayscale opacity-45';

  if (variant === 'home') {
    return (
      <img
        src={art.home}
        alt=""
        draggable={false}
        className={cn(
          'pointer-events-none size-full select-none object-contain',
          'drop-shadow-[0_14px_14px_rgba(0,0,0,0.22)]',
          offline,
          className,
        )}
      />
    );
  }

  if (device.keyboard) {
    return (
      <KeyboardArt
        spec={device.keyboard}
        src={art.detail}
        alt={art.alt}
        aspect={art.aspect}
        interactive={interactive}
        selectedControl={selectedControl}
        onControlSelect={onControlSelect}
        className={cn('max-w-3xl', offline, className)}
      />
    );
  }

  if (device.mouse) {
    return (
      <MouseArt
        src={art.detail}
        alt={art.alt}
        aspect={art.aspect}
        profile={art.profile ?? 'travel'}
        callouts={callouts}
        selectedControl={selectedControl}
        onControlSelect={onControlSelect}
        className={cn('max-w-[520px]', offline, className)}
      />
    );
  }

  return null;
}
