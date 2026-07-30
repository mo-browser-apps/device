import type { Device } from '@/gen/devices';
import { cn } from '@/lib/utils';
import { KeyboardArt, type Lighting } from './keyboard-art';
import { MouseArt, type Callout, type MouseArtProfile } from './mouse-art';

interface DeviceArtwork {
  detailSrc: string;
  homeSrc: string;
  alt: string;
  aspectRatio: string;
  mouseProfile?: MouseArtProfile;
}

interface DeviceArtProps {
  device: Device;
  variant?: 'home' | 'detail';
  callouts?: Callout[];
  lighting?: Lighting | null;
  selectedControl?: string | null;
  onControlSelect?: (control: string) => void;
  className?: string;
}

const ARTWORK_BY_DEVICE_ID: Record<string, DeviceArtwork> = {
  'performance-mouse': {
    detailSrc: '/device-art/performance-mouse.webp',
    homeSrc: '/device-art/performance-mouse-home.webp',
    alt: 'Graphite wireless performance mouse',
    aspectRatio: '3 / 2',
    mouseProfile: 'performance',
  },
  'travel-mouse': {
    detailSrc: '/device-art/travel-mouse.webp',
    homeSrc: '/device-art/travel-mouse-home.webp',
    alt: 'Stone-gray compact travel mouse',
    aspectRatio: '3 / 2',
    mouseProfile: 'travel',
  },
  'compact-keyboard': {
    detailSrc: '/device-art/compact-keyboard.webp',
    homeSrc: '/device-art/compact-keyboard-home.webp',
    alt: 'Graphite compact keyboard',
    aspectRatio: '821 / 479',
  },
};

function artworkFor(device: Device): DeviceArtwork | null {
  if (!device.mouse && !device.keyboard) {
    return null;
  }

  const exactArtwork = ARTWORK_BY_DEVICE_ID[device.id];
  if (exactArtwork) {
    return exactArtwork;
  }

  if (device.keyboard) {
    return ARTWORK_BY_DEVICE_ID['compact-keyboard'];
  }

  return (device.mouse?.buttons.length ?? 0) > 3
    ? ARTWORK_BY_DEVICE_ID['performance-mouse']
    : ARTWORK_BY_DEVICE_ID['travel-mouse'];
}

export function DeviceArt({
  device,
  variant = 'detail',
  callouts = [],
  lighting,
  selectedControl,
  onControlSelect,
  className,
}: DeviceArtProps) {
  const artwork = artworkFor(device);
  if (!artwork) return null;

  const offlineClassName = !device.connected && 'grayscale opacity-45';

  if (variant === 'home') {
    return (
      <img
        src={artwork.homeSrc}
        alt=""
        draggable={false}
        className={cn(
          'pointer-events-none size-full select-none object-contain',
          'drop-shadow-[0_16px_18px_rgba(0,0,0,0.28)]',
          offlineClassName,
          className,
        )}
      />
    );
  }

  if (device.keyboard) {
    return (
      <KeyboardArt
        spec={device.keyboard}
        src={artwork.detailSrc}
        alt={artwork.alt}
        aspect={artwork.aspectRatio}
        lighting={lighting}
        selectedControl={selectedControl}
        onControlSelect={onControlSelect}
        className={cn('max-w-3xl', offlineClassName, className)}
      />
    );
  }

  if (device.mouse) {
    return (
      <MouseArt
        src={artwork.detailSrc}
        alt={artwork.alt}
        aspect={artwork.aspectRatio}
        profile={artwork.mouseProfile ?? 'travel'}
        callouts={callouts}
        selectedControl={selectedControl}
        onControlSelect={onControlSelect}
        className={cn('max-w-[520px]', offlineClassName, className)}
      />
    );
  }

  return null;
}
