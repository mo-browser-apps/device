import { useState } from 'react';
import { ArrowLeft, Keyboard, MousePointer2 } from 'lucide-react';
import { DeviceArt, controlLabel } from '@/components/art/device-art';
import type { Device } from '@/gen/devices';
import { DeviceStatus } from '@/components/device-status';

export function DeviceView({ device, onBack }: { device: Device; onBack: () => void }) {
  const [selectedControl, setSelectedControl] = useState<string | null>(null);
  const isKeyboard = device.keyboard !== undefined;
  const controlCount = device.keyboard?.keys.length ?? device.mouse?.buttons.length ?? 0;

  return (
    <div className="mx-auto w-full max-w-4xl px-8 pb-10">
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
        </span>
      </div>

      <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/35">
        <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3 text-xs text-muted-foreground">
          {isKeyboard ? (
            <Keyboard className="size-3.5" strokeWidth={1.6} />
          ) : (
            <MousePointer2 className="size-3.5" strokeWidth={1.6} />
          )}
          <span>{isKeyboard ? 'Keyboard layout' : 'Button layout'}</span>
          <span aria-hidden="true" className="text-border">
            /
          </span>
          <span>{controlCount} configurable controls</span>
        </div>

        <div className="flex min-h-[410px] flex-col items-center justify-center px-8 pb-7 pt-5">
          <DeviceArt
            device={device}
            interactive={device.connected}
            selectedControl={selectedControl}
            onControlSelect={setSelectedControl}
            className={isKeyboard ? 'max-w-3xl' : 'max-w-[560px]'}
          />

          <p
            aria-live="polite"
            className="mt-1 min-h-7 rounded-full border border-border/60 bg-background/55 px-3 py-1 text-xs text-muted-foreground"
          >
            {device.connected
              ? selectedControl
                ? `${controlLabel(device, selectedControl)} selected`
                : `Select a ${isKeyboard ? 'key' : 'button'} on the device`
              : 'Reconnect this device to configure it'}
          </p>
        </div>
      </section>
    </div>
  );
}
