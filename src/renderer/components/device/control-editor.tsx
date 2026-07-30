import type { Device, Settings } from '@/gen/devices';
import { DeviceInfo } from './device-info';
import { KeyboardEditor } from './keyboard-editor';
import { MouseEditor } from './mouse-editor';

export type Segment = 'buttons' | 'movement' | 'keys' | 'lighting' | 'info';

interface ControlEditorProps {
  device: Device;
  settings: Settings;
  selected: string | null;
  segment: Segment;
  disabled: boolean;
  onRemove: () => void;
  onPreview: (settings: Settings) => void;
  onCommit: (settings: Settings) => void;
}

/**
 * Chooses the settings panel that matches the device type and selected section.
 */
export function ControlEditor({
  device,
  settings,
  selected,
  segment,
  disabled,
  onRemove,
  onPreview,
  onCommit,
}: ControlEditorProps) {
  if (segment === 'info') {
    return <DeviceInfo device={device} onRemove={onRemove} />;
  }

  if (segment === 'keys' || segment === 'lighting') {
    if (!settings.keyboard) return null;

    return (
      <KeyboardEditor
        settings={settings}
        keyboard={settings.keyboard}
        selected={selected}
        segment={segment}
        disabled={disabled}
        onPreview={onPreview}
        onCommit={onCommit}
      />
    );
  }

  if (!settings.mouse || !device.mouse) return null;

  return (
    <MouseEditor
      settings={settings}
      mouse={settings.mouse}
      spec={device.mouse}
      selected={selected}
      segment={segment}
      disabled={disabled}
      onPreview={onPreview}
      onCommit={onCommit}
    />
  );
}
