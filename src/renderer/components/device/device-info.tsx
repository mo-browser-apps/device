import { Trash2 } from 'lucide-react';
import { LinkType, type Device } from '@/gen/devices';
import { connectionLabel } from '@/components/device-status';
import { BUTTON_OUTLINE, cn } from '@/lib/utils';
import { SettingsSection } from './editor-controls';

interface DeviceInfoProps {
  device: Device;
  onRemove: () => void;
}

/**
 * Shows the device details reported by the native stack and offers removal when allowed.
 */
export function DeviceInfo({ device, onRemove }: DeviceInfoProps) {
  const details: [label: string, value: string][] = [
    ['Connection', connectionLabel(device)],
    ['Firmware', device.firmware],
  ];

  if (device.keyboard) {
    details.push(
      ['Remappable keys', String(device.keyboard.keys.length)],
      ['Lighting', device.keyboard.backlight ? 'Supported' : 'Not supported'],
    );
  }
  if (device.mouse) {
    details.push(
      ['Remappable buttons', String(device.mouse.buttons.length)],
      ['Sensor', `${device.mouse.minDpi}–${device.mouse.maxDpi} DPI`],
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <SettingsSection title="Info">
        <dl className="flex flex-col gap-4">
          {details.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-4 text-sm">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </SettingsSection>

      {device.link !== LinkType.WIRED && (
        <button
          type="button"
          onClick={onRemove}
          className={cn(
            BUTTON_OUTLINE,
            'w-fit text-muted-foreground hover:border-destructive/35',
            'hover:bg-destructive/5 hover:text-foreground',
          )}
        >
          <Trash2 className="size-4" strokeWidth={1.75} />
          Remove device
        </button>
      )}
    </div>
  );
}
