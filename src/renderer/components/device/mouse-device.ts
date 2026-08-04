import type { Binding, MouseSettings, MouseSpec } from '@/gen/devices';
import { actionLabel, boundAction } from './controls';
import type { DevicePresentation, Segment } from './device-presentation';

const MOUSE_CONTROL_LABELS: Record<string, string> = {
  wheel: 'Wheel',
  back: 'Back',
  forward: 'Forward',
  gesture: 'Thumb button',
};

/**
 * Lists the actions offered for mouse buttons.
 */
export const MOUSE_ACTIONS = [
  'middle-click',
  'back',
  'forward',
  'show-desktop',
  'copy',
  'paste',
  'undo',
  'play-pause',
  'volume-up',
  'volume-down',
  'disabled',
];

const DEFAULT_MOUSE_ACTIONS: Record<string, string> = {
  wheel: 'middle-click',
  back: 'back',
  forward: 'forward',
  gesture: 'show-desktop',
};

/**
 * Turns a mouse control ID into the name shown in the UI.
 */
export function mouseControlLabel(control: string): string {
  return MOUSE_CONTROL_LABELS[control] ?? control.toUpperCase();
}

/**
 * Restores the known default action for every mouse button.
 */
export function resetMouseBindings(bindings: Binding[]): Binding[] {
  return bindings.map((binding) => ({
    ...binding,
    action: DEFAULT_MOUSE_ACTIONS[binding.control] ?? binding.action,
  }));
}

/**
 * Builds the labels shown beside the interactive mouse artwork.
 */
function buttonCallouts(spec: MouseSpec, settings: MouseSettings | undefined, segment: Segment) {
  if (!settings || segment !== 'buttons') return [];

  return spec.buttons.map((control) => ({
    id: control,
    name: mouseControlLabel(control),
    value: actionLabel(boundAction(settings.bindings, control)),
  }));
}

/**
 * Provides the sections and artwork behavior for a mouse.
 */
export function mousePresentation(spec: MouseSpec): DevicePresentation {
  return {
    segments: [
      ['buttons', 'Buttons'],
      ['movement', 'Movement'],
      ['info', 'Info'],
    ],
    initialControl: spec.buttons[0] ?? null,
    artState: (settings, segment) => ({
      callouts: buttonCallouts(spec, settings?.mouse, segment),
      lighting: null,
      canSelectControl: segment === 'buttons',
    }),
  };
}
