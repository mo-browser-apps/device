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

export const LOW_BATTERY = 20;
const FULL_BATTERY = 90;

interface ConnectionStatus {
  label: string;
  Icon: LucideIcon;
}

interface BatteryStatus {
  label: string;
  Icon: LucideIcon;
  toneClassName: string;
}

interface DeviceStatusProps {
  device: Device;
  className?: string;
}

const UNKNOWN_CONNECTION: ConnectionStatus = {
  label: 'Unknown connection',
  Icon: CircleHelp,
};

const CONNECTIONS: Record<LinkType, ConnectionStatus> = {
  [LinkType.RECEIVER]: { label: 'USB receiver', Icon: Usb },
  [LinkType.BLUETOOTH]: { label: 'Bluetooth', Icon: Bluetooth },
  [LinkType.WIRED]: { label: 'Wired', Icon: Cable },
  [LinkType.UNRECOGNIZED]: UNKNOWN_CONNECTION,
};

/**
 * Turns a device link type into the connection name shown in the UI.
 */
export function connectionLabel(device: Device): string {
  return (CONNECTIONS[device.link] ?? UNKNOWN_CONNECTION).label;
}

/**
 * Chooses the battery icon, label, and color for a battery reading.
 */
function getBatteryStatus(level: number, charging: boolean): BatteryStatus {
  if (charging) {
    return {
      Icon: BatteryCharging,
      toneClassName: 'text-status-charging',
      label: `Battery ${level}%, charging`,
    };
  }
  if (level <= LOW_BATTERY) {
    return {
      Icon: BatteryLow,
      toneClassName: 'text-status-low',
      label: `Battery low, ${level}%`,
    };
  }
  return {
    Icon: level >= FULL_BATTERY ? BatteryFull : BatteryMedium,
    toneClassName: 'text-foreground/70',
    label: `Battery ${level}%`,
  };
}

/**
 * Shows the icon and accessible label for a device's connection type.
 */
export function DeviceConnectionIcon({ device, className }: DeviceStatusProps) {
  const connection = CONNECTIONS[device.link] ?? UNKNOWN_CONNECTION;
  const label = device.connected ? connection.label : `${connection.label}, disconnected`;

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        '[&_svg]:size-3.5',
        device.connected ? 'text-muted-foreground/70' : 'text-muted-foreground/35',
        className,
      )}
    >
      <connection.Icon strokeWidth={1.75} />
    </span>
  );
}

/**
 * Shows a wireless device's battery level when it is available.
 */
export function DeviceBatteryStatus({ device, className }: DeviceStatusProps) {
  if (!device.connected || !device.hasBattery || device.link === LinkType.WIRED) return null;

  const batteryStatus = getBatteryStatus(device.battery, device.charging);

  return (
    <span
      role="img"
      aria-label={batteryStatus.label}
      title={batteryStatus.label}
      className={cn(
        'flex items-center gap-1.5 text-xs [&_svg]:size-4',
        batteryStatus.toneClassName,
        className,
      )}
    >
      <batteryStatus.Icon strokeWidth={1.75} />
      <span className="font-mono tabular-nums">{device.battery}%</span>
    </span>
  );
}

/**
 * Combines the connection and battery indicators used on a device screen.
 */
export function DeviceStatus({ device, className }: DeviceStatusProps) {
  return (
    <span className={cn('flex items-center gap-4', className)}>
      <DeviceConnectionIcon device={device} className="[&_svg]:size-5" />
      <DeviceBatteryStatus device={device} className="gap-2 text-sm [&_svg]:size-5" />
    </span>
  );
}
