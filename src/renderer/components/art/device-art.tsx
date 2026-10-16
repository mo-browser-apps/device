import type { Device } from '@/gen/devices';
import { cn } from '@/lib/utils';
import { K10_MAX_LAYOUT } from './k10-max-layout';
import { KeyboardArt, type KeyboardLayout, type Lighting } from './keyboard-art';
import { MouseArt, type Callout, type MouseArtProfile } from './mouse-art';

interface DeviceArtwork {
  detailSrc: string;
  homeSrc: string;
  alt: string;
  aspectRatio: string;
  mouseProfile?: MouseArtProfile;
  keyboardLayout?: KeyboardLayout;
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

const ARTWORK_BY_MODEL_ID: Record<string, DeviceArtwork> = {
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
  'keychron-k10-max': {
    detailSrc: '/device-art/k10-max.webp',
    homeSrc: '/device-art/k10-max.webp',
    alt: 'Keychron K10 Max full-size keyboard',
    aspectRatio: '2349 / 1022',
    keyboardLayout: K10_MAX_LAYOUT,
  },
};

/**
 * Shows device artwork and adds interactive mouse or keyboard controls when requested.
 */
export function DeviceArt({
  device,
  variant = 'detail',
  callouts = [],
  lighting,
  selectedControl,
  onControlSelect,
  className,
}: DeviceArtProps) {
  const artwork = ARTWORK_BY_MODEL_ID[device.modelId];
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

  if (device.keyboard && artwork.keyboardLayout) {
    return (
      <KeyboardArt
        spec={device.keyboard}
        layout={artwork.keyboardLayout}
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
        className={cn('max-w-130', offlineClassName, className)}
      />
    );
  }

  return null;
}
