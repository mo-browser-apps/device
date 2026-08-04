import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { DeviceArt } from '@/components/art/device-art';
import { DeviceStatus } from '@/components/device-status';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useDeviceSettings } from '@/gateway/devices';
import { BUTTON_ICON, TOGGLE_ITEM } from '@/lib/utils';
import type { Device } from '@/gen/devices';
import { ControlEditor } from './control-editor';
import { presentationFor, type Segment } from './device-presentation';
import { RemoveDeviceDialog } from './remove-device-dialog';

interface DeviceViewProps {
  device: Device;
  onBack: () => void;
  onRemoved: () => void;
}

/**
 * Combines the artwork, status, and settings editor for one managed device.
 */
export function DeviceView({ device, onBack, onRemoved }: DeviceViewProps) {
  const presentation = presentationFor(device);
  const { settings, preview, commit } = useDeviceSettings(device.id);

  const [segment, setSegment] = useState<Segment>(presentation.segments[0][0]);
  const [selectedControl, setSelectedControl] = useState<string | null>(
    presentation.initialControl,
  );
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);

  const artState = presentation.artState(settings, segment);

  const selectSegment = (value: string) => {
    if (value) setSegment(value as Segment);
  };

  const openRemoveDialog = () => setRemoveDialogOpen(true);
  const closeRemoveDialog = () => setRemoveDialogOpen(false);

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
            onValueChange={selectSegment}
            aria-label="Settings section"
            size="sm"
            className="mx-auto mb-5 w-fit rounded-lg border bg-muted/80 p-1 shadow-sm"
          >
            {presentation.segments.map(([value, label]) => (
              <ToggleGroupItem key={value} value={value} className={TOGGLE_ITEM}>
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <div className="mx-auto flex min-h-0 w-full max-w-230 flex-1 gap-8 px-8">
            <div className="flex min-w-0 flex-1 items-center justify-center pb-10">
              <DeviceArt
                device={device}
                callouts={artState.callouts}
                lighting={artState.lighting}
                selectedControl={selectedControl}
                onControlSelect={artState.canSelectControl ? setSelectedControl : undefined}
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
                onRemove={openRemoveDialog}
                onPreview={preview}
                onCommit={commit}
              />
            </aside>
          </div>
        </>
      )}

      {removeDialogOpen && (
        <RemoveDeviceDialog
          device={device}
          onClose={closeRemoveDialog}
          onRemoved={onRemoved}
        />
      )}
    </div>
  );
}
