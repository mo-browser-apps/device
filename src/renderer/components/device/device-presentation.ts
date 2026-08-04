import type { Device, Settings } from '@/gen/devices';
import type { Lighting } from '@/components/art/keyboard-art';
import type { Callout } from '@/components/art/mouse-art';
import { keyboardPresentation } from './keyboard-device';
import { mousePresentation } from './mouse-device';

export type Segment = 'buttons' | 'movement' | 'keys' | 'lighting' | 'info';
export type SegmentOption = readonly [segment: Segment, label: string];

interface DeviceArtState {
  callouts: Callout[];
  lighting: Lighting | null;
  canSelectControl: boolean;
}

/**
 * Describes the device-specific choices used by the shared device view.
 */
export interface DevicePresentation {
  segments: readonly SegmentOption[];
  initialControl: string | null;
  artState: (settings: Settings | null, segment: Segment) => DeviceArtState;
}

const INFO_PRESENTATION: DevicePresentation = {
  segments: [['info', 'Info']],
  initialControl: null,
  artState: () => ({
    callouts: [],
    lighting: null,
    canSelectControl: false,
  }),
};

/**
 * Chooses the presentation that matches the device category.
 */
export function presentationFor(device: Device): DevicePresentation {
  if (device.mouse) return mousePresentation(device.mouse);
  if (device.keyboard) return keyboardPresentation(device.keyboard);
  return INFO_PRESENTATION;
}
