import {
  BatteryCharging,
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  Bluetooth,
  Cable,
  Unplug,
  Usb,
  type LucideIcon,
} from 'lucide-react';
import { LinkType, type Device } from '@/gen/devices';
import { cn } from '@/lib/utils';

const LOW_BATTERY = 20;
const FULL_BATTERY = 90;

const RECEIVER = { label: 'Receiver', Icon: Usb };
const LINKS: Partial<Record<LinkType, { label: string; Icon: LucideIcon }>> = {
  [LinkType.BLUETOOTH]: { label: 'Bluetooth', Icon: Bluetooth },
  [LinkType.WIRED]: { label: 'Wired', Icon: Cable },
};

function batteryOf(level: number, charging: boolean): { Icon: LucideIcon; tone: string } {
  if (charging) {
    return { Icon: BatteryCharging, tone: 'text-foreground' };
  }
  if (level <= LOW_BATTERY) {
    return { Icon: BatteryLow, tone: 'text-destructive' };
  }
  if (level >= FULL_BATTERY) {
    return { Icon: BatteryFull, tone: 'text-foreground' };
  }
  return { Icon: BatteryMedium, tone: 'text-muted-foreground' };
}

export function DeviceStatus({ device }: { device: Device }) {
  const link = device.connected
    ? (LINKS[device.link] ?? RECEIVER)
    : { label: 'Disconnected', Icon: Unplug };
  const battery =
    device.connected && device.hasBattery ? batteryOf(device.battery, device.charging) : null;
  const batteryLabel = `Battery ${device.battery}%${device.charging ? ', charging' : ''}`;

  return (
    <span className="flex items-center gap-3 text-xs">
      <span
        role="img"
        aria-label={link.label}
        title={link.label}
        className="text-muted-foreground"
      >
        <link.Icon className="size-4" strokeWidth={1.75} />
      </span>

      {battery && (
        <span
          role="img"
          aria-label={batteryLabel}
          title={batteryLabel}
          className={cn('flex items-center gap-1.5', battery.tone)}
        >
          <battery.Icon className="size-4" strokeWidth={1.75} />
          <span className="font-mono tabular-nums">{device.battery}%</span>
        </span>
      )}
    </span>
  );
}
