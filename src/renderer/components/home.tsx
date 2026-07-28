import type { Device } from '@/gen/devices';
import { DeviceArt } from '@/components/art/device-art';
import { DeviceBatteryStatus, DeviceConnectionIcon } from '@/components/device-status';
import { cn } from '@/lib/utils';

function DeviceCard({ device, onOpen }: { device: Device; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group flex w-64 shrink-0 flex-col items-center gap-5 rounded-2xl px-6 py-7',
        'transition-colors hover:bg-foreground/[0.045]',
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
        'focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      )}
    >
      <span className="flex h-44 w-full items-center justify-center">
        <DeviceArt
          device={device}
          variant="home"
          className={cn(
            'max-h-full transition-transform duration-300 ease-out',
            'motion-safe:group-hover:scale-[1.06]',
          )}
        />
      </span>

      <span className="flex flex-col items-center gap-2.5">
        <span className="inline-flex items-center gap-1.5 text-[15px] font-medium tracking-tight">
          <span>{device.model}</span>
          <DeviceConnectionIcon device={device} />
        </span>
        <span className="flex min-h-4 items-center">
          <DeviceBatteryStatus device={device} />
        </span>
      </span>
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
  if (devices.length === 0) {
    return (
      <p className="px-8 pt-10 text-center text-sm text-muted-foreground">
        No devices are connected.
      </p>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <h1 className="px-8 text-lg font-semibold tracking-tight">Devices</h1>

      <div className="flex flex-1 items-center overflow-x-auto">
        <div className="mx-auto flex w-max gap-4 px-8 pb-12">
          {devices.map((device) => (
            <DeviceCard key={device.id} device={device} onOpen={() => onOpen(device.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}
