import { Bluetooth, Cable, Usb, type LucideIcon } from 'lucide-react';
import { LinkType, type Device } from '@/gen/devices';
import { cn } from '@/lib/utils';

const LOW_BATTERY = 20;

const RECEIVER = { label: 'Receiver', Icon: Usb };
const LINKS: Partial<Record<LinkType, { label: string; Icon: LucideIcon }>> = {
  [LinkType.BLUETOOTH]: { label: 'Bluetooth', Icon: Bluetooth },
  [LinkType.WIRED]: { label: 'Wired', Icon: Cable },
};

export function DeviceStatus({ device }: { device: Device }) {
  const { label, Icon } = LINKS[device.link] ?? RECEIVER;
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="size-3.5" strokeWidth={1.75} />
      {device.connected ? label : 'Disconnected'}
    </span>
  );
}

export function BatteryMeter({ device }: { device: Device }) {
  if (!device.hasBattery || !device.connected) {
    return null;
  }
  const low = device.battery <= LOW_BATTERY;
  return (
    <span
      role="img"
      aria-label={`Battery ${device.battery}%${low ? ', low' : ''}`}
      className="flex items-center gap-2"
    >
      <span className="h-1 w-12 overflow-hidden rounded-full bg-muted">
        <span
          className={cn('block h-full rounded-full', low ? 'bg-destructive' : 'bg-foreground/55')}
          style={{ width: `${device.battery}%` }}
        />
      </span>
      <span
        className={cn(
          'font-mono text-xs tabular-nums',
          low ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {device.battery}%
      </span>
    </span>
  );
}
