import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { DeviceArt } from '@/components/art/device-art';
import type { Device } from '@/gen/devices';
import { DeviceStatus } from '@/components/device-status';

export function DeviceView({ device, onBack }: { device: Device; onBack: () => void }) {
  const [selectedControl, setSelectedControl] = useState<string | null>(null);
  const isKeyboard = device.keyboard !== undefined;

  return (
    <div className="mx-auto w-full max-w-4xl px-8 pb-10">
      <div className="mb-4 flex items-center gap-3">
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
        </span>
      </div>

      <div className="flex min-h-[500px] items-center justify-center px-6 pb-6">
        <DeviceArt
          device={device}
          interactive={device.connected}
          selectedControl={selectedControl}
          onControlSelect={setSelectedControl}
          className={isKeyboard ? 'max-w-3xl' : 'max-w-[560px]'}
        />
      </div>
    </div>
  );
}
