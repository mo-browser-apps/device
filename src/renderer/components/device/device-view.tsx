import { ArrowLeft } from 'lucide-react';
import type { Device } from '@/gen/devices';
import { BatteryMeter, DeviceStatus } from '@/components/device-status';

export function DeviceView({ device, onBack }: { device: Device; onBack: () => void }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-8 pb-10">
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to devices"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-xl font-semibold tracking-tight">{device.model}</h1>
        <span className="ml-auto flex items-center gap-4">
          <DeviceStatus device={device} />
          <BatteryMeter device={device} />
        </span>
      </div>
    </div>
  );
}
