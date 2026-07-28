import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { DeviceArt } from '@/components/art/device-art';
import { DeviceStatus } from '@/components/device-status';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useDeviceSettings } from '@/gateway/devices';
import type { Device } from '@/gen/devices';
import { actionLabel } from './actions';
import { ControlEditor } from './control-editor';

type Segment = 'buttons' | 'movement';

const SEGMENT_ITEM =
  'px-3 text-muted-foreground hover:bg-transparent hover:text-foreground ' +
  'data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm';

export function DeviceView({ device, onBack }: { device: Device; onBack: () => void }) {
  const [segment, setSegment] = useState<Segment>('buttons');
  const [selectedControl, setSelectedControl] = useState<string | null>(
    () => device.mouse?.buttons[0] ?? null,
  );
  const { settings, preview, commit } = useDeviceSettings(device.id);

  const mouse = settings?.mouse;
  const spec = device.mouse;
  const callouts =
    segment === 'buttons'
      ? (spec?.buttons ?? []).map((control) => ({
          id: control,
          value: actionLabel(
            mouse?.bindings.find((entry) => entry.control === control)?.action ?? '',
          ),
        }))
      : [];

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

      {settings && mouse && spec ? (
        <>
          <ToggleGroup
            type="single"
            value={segment}
            onValueChange={(value) => value && setSegment(value as Segment)}
            aria-label="Settings section"
            className="mx-auto w-fit rounded-lg border bg-muted/80 p-1 shadow-sm"
          >
            <ToggleGroupItem value="buttons" size="sm" className={SEGMENT_ITEM}>
              Buttons
            </ToggleGroupItem>
            <ToggleGroupItem value="movement" size="sm" className={SEGMENT_ITEM}>
              Movement
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="grid flex-1 grid-cols-[minmax(0,1fr)_300px] items-start gap-6 py-5">
            <div className="flex min-h-[400px] items-center justify-center">
              <DeviceArt
                device={device}
                callouts={callouts}
                selectedControl={selectedControl}
                onControlSelect={segment === 'buttons' ? setSelectedControl : undefined}
              />
            </div>

            <aside>
              <ControlEditor
                settings={settings}
                mouse={mouse}
                spec={spec}
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
