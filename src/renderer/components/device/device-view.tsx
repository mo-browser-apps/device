import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { DeviceArt } from '@/components/art/device-art';
import { DeviceStatus } from '@/components/device-status';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useDeviceSettings } from '@/gateway/devices';
import { cn, FOCUS_RING } from '@/lib/utils';
import type { Device } from '@/gen/devices';
import { actionLabel, boundAction, controlLabel } from './controls';
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
    segment === 'buttons' && mouse && spec
      ? spec.buttons.map((control) => ({
          id: control,
          name: controlLabel(control),
          value: actionLabel(boundAction(mouse, control)),
        }))
      : [];

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center gap-3 px-8">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to devices"
          className={cn(
            'rounded-md p-1 text-muted-foreground transition-colors',
            'hover:bg-accent hover:text-foreground',
            FOCUS_RING,
          )}
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
            size="sm"
            className="mx-auto mb-5 w-fit rounded-lg border bg-muted/80 p-1 shadow-sm"
          >
            <ToggleGroupItem value="buttons" className={SEGMENT_ITEM}>
              Buttons
            </ToggleGroupItem>
            <ToggleGroupItem value="movement" className={SEGMENT_ITEM}>
              Movement
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="mx-auto flex min-h-0 w-full max-w-230 flex-1 gap-8 px-8">
            <div className="flex min-w-0 flex-1 items-center justify-center pb-10">
              <DeviceArt
                device={device}
                callouts={callouts}
                selectedControl={selectedControl}
                onControlSelect={segment === 'buttons' ? setSelectedControl : undefined}
              />
            </div>

            <aside
              key={segment}
              className="w-75 shrink-0 animate-in overflow-y-auto pb-4 fade-in duration-200 motion-reduce:animate-none"
            >
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
