import {
  BatteryCharging,
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  Bluetooth,
  Cable,
  CircleHelp,
  Usb,
  type LucideIcon,
} from 'lucide-react';
import { LinkType, type Device } from '@/gen/devices';
import { cn } from '@/lib/utils';

const LOW_BATTERY = 20;
const FULL_BATTERY = 90;

const UNKNOWN_CONNECTION = { label: 'Unknown connection', Icon: CircleHelp };
const CONNECTIONS: Record<LinkType, { label: string; Icon: LucideIcon }> = {
  [LinkType.RECEIVER]: { label: 'USB receiver', Icon: Usb },
  [LinkType.BLUETOOTH]: { label: 'Bluetooth', Icon: Bluetooth },
  [LinkType.WIRED]: { label: 'Wired', Icon: Cable },
  [LinkType.UNRECOGNIZED]: UNKNOWN_CONNECTION,
};

function batteryOf(
  level: number,
  charging: boolean,
): { Icon: LucideIcon; tone: string; label: string } {
  if (charging) {
    return {
      Icon: BatteryCharging,
      tone: 'text-status-charging',
      label: `Battery ${level}%, charging`,
    };
  }
  if (level <= LOW_BATTERY) {
    return {
      Icon: BatteryLow,
      tone: 'text-status-low',
      label: `Battery low, ${level}%`,
    };
  }
  return {
    Icon: level >= FULL_BATTERY ? BatteryFull : BatteryMedium,
    tone: 'text-foreground/70',
    label: `Battery ${level}%`,
  };
}

export function DeviceConnectionIcon({ device }: { device: Device }) {
  const connection = CONNECTIONS[device.link] ?? UNKNOWN_CONNECTION;
  const label = device.connected ? connection.label : `${connection.label}, disconnected`;

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={device.connected ? 'text-muted-foreground/70' : 'text-muted-foreground/35'}
    >
      <connection.Icon className="size-3.5" strokeWidth={1.75} />
    </span>
  );
}

export function DeviceBatteryStatus({ device }: { device: Device }) {
  if (!device.connected || !device.hasBattery || device.link === LinkType.WIRED) return null;

  const battery = batteryOf(device.battery, device.charging);

  return (
    <span
      role="img"
      aria-label={battery.label}
      title={battery.label}
      className={cn('flex items-center gap-1.5 text-xs', battery.tone)}
    >
      <battery.Icon className="size-4" strokeWidth={1.75} />
      <span className="font-mono tabular-nums">{device.battery}%</span>
    </span>
  );
}

export function DeviceStatus({ device }: { device: Device }) {
  return (
    <span className="flex items-center gap-3">
      <DeviceConnectionIcon device={device} />
      <DeviceBatteryStatus device={device} />
    </span>
  );
}
