import { Keyboard, Mouse } from 'lucide-react';
import type { Device } from '@/gen/devices';
import { BatteryMeter, DeviceStatus } from '@/components/device-status';
import { cn } from '@/lib/utils';

function DeviceCard({ device, onOpen }: { device: Device; onOpen: () => void }) {
  const Art = device.keyboard ? Keyboard : Mouse;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group flex flex-col items-center gap-3 rounded-xl border border-border/60 bg-card/40 p-4',
        'transition-colors hover:border-border hover:bg-card',
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
        'focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      )}
    >
      <span
        className={cn(
          'flex h-24 w-full items-center justify-center rounded-lg bg-muted/40',
          !device.connected && 'opacity-50',
        )}
      >
        <Art
          className="size-14 text-foreground/75 transition-transform duration-200 motion-safe:group-hover:scale-105"
          strokeWidth={1.25}
        />
      </span>

      <span className="flex flex-col items-center gap-1">
        <span className="text-sm font-medium">{device.model}</span>
        <DeviceStatus device={device} />
      </span>

      <BatteryMeter device={device} />
    </button>
  );
}

export function Home({
  devices,
  onOpen,
}: {
  devices: Device[];
  onOpen: (deviceId: string) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-8 pb-10">
      <h1 className="mb-6 text-xl font-semibold tracking-tight">Devices</h1>
      {devices.length === 0 ? (
        <p className="text-sm text-muted-foreground">No devices are connected.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
          {devices.map((device) => (
            <DeviceCard key={device.id} device={device} onOpen={() => onOpen(device.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
