import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { DeviceArt } from '@/components/art/device-art';
import type { Callout } from '@/components/art/mouse-art';
import { DeviceStatus } from '@/components/device-status';
import { useDeviceSettings } from '@/gateway/devices';
import type { Device, MouseSettings } from '@/gen/devices';
import { cn } from '@/lib/utils';
import { actionLabel } from './actions';
import { ControlEditor } from './control-editor';

type Segment = 'buttons' | 'movement';

const SEGMENTS: { id: Segment; label: string }[] = [
  { id: 'buttons', label: 'Buttons' },
  { id: 'movement', label: 'Movement' },
];

function buttonCalloutsFor(device: Device, mouse: MouseSettings): Callout[] {
  return (device.mouse?.buttons ?? []).map((control) => ({
    id: control,
    value: actionLabel(mouse.bindings.find((entry) => entry.control === control)?.action ?? ''),
  }));
}

function SegmentedControl({
  segment,
  onSelect,
}: {
  segment: Segment;
  onSelect: (segment: Segment) => void;
}) {
  return (
    <div role="tablist" className="mx-auto flex w-fit gap-1 rounded-lg bg-muted/60 p-1">
      {SEGMENTS.map(({ id, label }) => (
        <button
          key={id}
          role="tab"
          type="button"
          aria-selected={segment === id}
          onClick={() => onSelect(id)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm transition-colors',
            'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
            segment === id
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function DeviceView({ device, onBack }: { device: Device; onBack: () => void }) {
  const [segment, setSegment] = useState<Segment>('buttons');
  const [selectedControl, setSelectedControl] = useState<string | null>(
    () => device.mouse?.buttons[0] ?? null,
  );
  const { settings, preview, commit } = useDeviceSettings(device.id);

  const mouse = settings?.mouse;
  const buttonCallouts = mouse ? buttonCalloutsFor(device, mouse) : [];

  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-8 pb-10">
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to devices"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-xl font-semibold tracking-tight">{device.model}</h1>
        <span className="ml-auto">
          <DeviceStatus device={device} />
        </span>
      </div>

      {mouse && settings ? (
        <>
          <SegmentedControl segment={segment} onSelect={setSegment} />

          <div className="grid flex-1 grid-cols-[minmax(0,1fr)_300px] items-start gap-6 py-5">
            <div className="flex min-h-[400px] items-center justify-center">
              <DeviceArt
                device={device}
                callouts={segment === 'buttons' ? buttonCallouts : []}
                selectedControl={selectedControl}
                onControlSelect={segment === 'buttons' ? setSelectedControl : undefined}
              />
            </div>

            <aside>
              <ControlEditor
                settings={settings}
                mouse={mouse}
                minDpi={device.mouse?.minDpi ?? 0}
                maxDpi={device.mouse?.maxDpi ?? 0}
                selected={selectedControl}
                segment={segment}
                disabled={!device.connected}
                onPreview={preview}
                onCommit={commit}
              />
            </aside>
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center py-6">
          <DeviceArt device={device} interactive={device.connected} />
        </div>
      )}
    </div>
  );
}
