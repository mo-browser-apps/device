import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { DeviceArt } from '@/components/art/device-art';
import { DeviceStatus } from '@/components/device-status';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useDeviceSettings } from '@/gateway/devices';
import { BUTTON_ICON, TOGGLE_ITEM } from '@/lib/utils';
import type { Device } from '@/gen/devices';
import { actionLabel, boundAction, controlLabel } from './controls';
import { ControlEditor, type Segment } from './control-editor';
import { RemoveDeviceDialog } from './remove-device-dialog';

const MOUSE_SEGMENTS: [Segment, string][] = [
  ['buttons', 'Buttons'],
  ['movement', 'Movement'],
  ['info', 'Info'],
];

/** Panels come from the descriptor: a keyboard without a backlight has no Lighting tab. */
function segmentsFor(device: Device): [Segment, string][] {
  if (!device.keyboard) {
    return MOUSE_SEGMENTS;
  }
  const segments: [Segment, string][] = [['keys', 'Keys']];
  if (device.keyboard.backlight) {
    segments.push(['lighting', 'Lighting']);
  }
  segments.push(['info', 'Info']);
  return segments;
}

export function DeviceView({
  device,
  onBack,
  onRemoved,
}: {
  device: Device;
  onBack: () => void;
  onRemoved: () => void;
}) {
  const segments = segmentsFor(device);
  const [segment, setSegment] = useState<Segment>(segments[0][0]);
  const [selectedControl, setSelectedControl] = useState<string | null>(
    () => device.mouse?.buttons[0] ?? device.keyboard?.keys[0] ?? null,
  );
  const [removeOpen, setRemoveOpen] = useState(false);
  const { settings, preview, commit } = useDeviceSettings(device.id);

  const mouse = settings?.mouse;
  const callouts =
    segment === 'buttons' && mouse && device.mouse
      ? device.mouse.buttons.map((control) => ({
          id: control,
          name: controlLabel(control),
          value: actionLabel(boundAction(mouse.bindings, control)),
        }))
      : [];

  const selectable = segment === 'buttons' || segment === 'keys';

  return (
    <div className="flex h-full flex-col" aria-busy={settings === null}>
      <div className="mb-4 flex items-center gap-3 px-8">
        <button type="button" onClick={onBack} aria-label="Back to devices" className={BUTTON_ICON}>
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-xl font-semibold tracking-tight">{device.model}</h1>
        <span className="ml-auto">
          <DeviceStatus device={device} />
        </span>
      </div>

      {settings && (
        <>
          <ToggleGroup
            type="single"
            value={segment}
            onValueChange={(value) => value && setSegment(value as Segment)}
            aria-label="Settings section"
            size="sm"
            className="mx-auto mb-5 w-fit rounded-lg border bg-muted/80 p-1 shadow-sm"
          >
            {segments.map(([value, label]) => (
              <ToggleGroupItem key={value} value={value} className={TOGGLE_ITEM}>
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <div className="mx-auto flex min-h-0 w-full max-w-230 flex-1 gap-8 px-8">
            <div className="flex min-w-0 flex-1 items-center justify-center pb-10">
              <DeviceArt
                device={device}
                callouts={callouts}
                lighting={device.keyboard?.backlight ? settings.keyboard : null}
                selectedControl={selectedControl}
                onControlSelect={selectable ? setSelectedControl : undefined}
              />
            </div>

            <aside
              key={segment}
              className="w-75 shrink-0 animate-in overflow-y-auto pb-4 fade-in duration-200 motion-reduce:animate-none"
            >
              <ControlEditor
                device={device}
                settings={settings}
                selected={selectedControl}
                segment={segment}
                disabled={!device.connected}
                onRemove={() => setRemoveOpen(true)}
                onPreview={preview}
                onCommit={commit}
              />
            </aside>
          </div>
        </>
      )}

      {removeOpen && (
        <RemoveDeviceDialog
          device={device}
          onClose={() => setRemoveOpen(false)}
          onRemoved={onRemoved}
        />
      )}
    </div>
  );
}
