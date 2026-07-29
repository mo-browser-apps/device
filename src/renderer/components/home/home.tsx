import { useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { LinkType, type Device } from '@/gen/devices';
import { DeviceArt } from '@/components/art/device-art';
import { DeviceBatteryStatus, DeviceConnectionIcon } from '@/components/device-status';
import { RemoveDeviceDialog } from '@/components/device/remove-device-dialog';
import { useCarousel } from '@/lib/use-carousel';
import { BUTTON_OUTLINE, cn, FOCUS_RING } from '@/lib/utils';
import { AddDeviceDialog } from './add-device-dialog';

function deviceCard(carousel: HTMLElement | null, deviceId: string) {
  return carousel?.querySelector<HTMLElement>(`[data-device-id="${CSS.escape(deviceId)}"]`);
}

function DeviceCard({
  device,
  onOpen,
  onRemove,
}: {
  device: Device;
  onOpen: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="group relative w-64 shrink-0 snap-center">
      <button
        type="button"
        data-device-id={device.id}
        onClick={onOpen}
        className={cn(
          'flex w-full flex-col items-center gap-5 rounded-2xl px-6 py-7',
          'transition-colors hover:bg-foreground/4.5',
          FOCUS_RING,
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

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${device.model}`}
          title={`Remove ${device.model}`}
          className={cn(
            'absolute right-3 top-3 flex size-7 items-center justify-center rounded-full',
            'border border-border/60 bg-background/65 text-muted-foreground/70 shadow-sm',
            'opacity-70 backdrop-blur-sm transition-[color,background-color,opacity]',
            'hover:bg-accent hover:text-foreground hover:opacity-100',
            FOCUS_RING,
          )}
        >
          <X className="size-3.5" strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}

function CarouselControl({
  direction,
  disabled,
  onClick,
}: {
  direction: 'previous' | 'next';
  disabled: boolean;
  onClick: () => void;
}) {
  const previous = direction === 'previous';
  const Icon = previous ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={() => !disabled && onClick()}
      aria-disabled={disabled}
      aria-label={`${previous ? 'Previous' : 'Next'} devices`}
      aria-controls="device-carousel"
      className={cn(
        'absolute top-1/2 z-20 -translate-y-1/2 rounded-full border border-border/60',
        'bg-background/80 p-2 text-muted-foreground shadow-sm backdrop-blur-sm',
        'transition-[color,background-color,opacity]',
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
        disabled ? 'opacity-30' : 'hover:bg-accent/80 hover:text-foreground',
        previous ? 'left-4' : 'right-4',
      )}
    >
      <Icon className="size-4" strokeWidth={1.75} />
    </button>
  );
}

export function Home({
  devices,
  initialScrollLeft,
  restoreFocusId,
  onOpen,
}: {
  devices: Device[];
  initialScrollLeft: number;
  restoreFocusId: string | null;
  onOpen: (deviceId: string, scrollLeft: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Device | null>(null);
  const addedId = useRef<string | null>(null);
  const {
    ref: carouselRef,
    overflows,
    canPrevious,
    canNext,
    scrollByItem,
  } = useCarousel(initialScrollLeft, devices.length);

  useLayoutEffect(() => {
    if (restoreFocusId) {
      deviceCard(carouselRef.current, restoreFocusId)?.focus({ preventScroll: true });
    }
  }, [carouselRef, restoreFocusId]);

  useLayoutEffect(() => {
    const pending = addedId.current;
    if (!pending) return;

    const card = deviceCard(carouselRef.current, pending);
    if (!card) return;

    addedId.current = null;
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    card.focus({ preventScroll: true });
  }, [carouselRef, devices]);

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex items-center justify-between gap-4 px-8">
        <h1 className="text-xl font-semibold tracking-tight">Devices</h1>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className={cn(BUTTON_OUTLINE, 'bg-card/50 shadow-xs')}
        >
          <Plus className="size-4" strokeWidth={1.75} />
          Add device
        </button>
      </div>

      {devices.length > 0 ? (
        <div className="relative flex flex-1 items-center">
          <div
            id="device-carousel"
            ref={carouselRef}
            className="w-full snap-x snap-proximity overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden"
          >
            <div className="flex w-max min-w-full justify-center gap-4 px-12 pb-12">
              {devices.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  onOpen={() => onOpen(device.id, carouselRef.current?.scrollLeft ?? 0)}
                  onRemove={
                    device.link === LinkType.WIRED ? undefined : () => setRemoving(device)
                  }
                />
              ))}
            </div>
          </div>

          {canPrevious && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-linear-to-r from-background via-background/85 to-transparent"
            />
          )}

          {canNext && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-linear-to-l from-background via-background/85 to-transparent"
            />
          )}

          {overflows && (
            <>
              <CarouselControl
                direction="previous"
                disabled={!canPrevious}
                onClick={() => scrollByItem(-1)}
              />
              <CarouselControl
                direction="next"
                disabled={!canNext}
                onClick={() => scrollByItem(1)}
              />
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center pb-12 text-center">
          <p className="text-sm font-medium">No devices connected</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add a nearby device to get started.
          </p>
        </div>
      )}

      {adding && (
        <AddDeviceDialog
          onClose={() => setAdding(false)}
          onPaired={(deviceId) => (addedId.current = deviceId)}
        />
      )}
      {removing && (
        <RemoveDeviceDialog device={removing} onClose={() => setRemoving(null)} />
      )}
    </div>
  );
}
