import { useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Settings, X } from 'lucide-react';
import { LinkType, type Device } from '@/gen/devices';
import { DeviceArt } from '@/components/art/device-art';
import { DeviceBatteryStatus, DeviceConnectionIcon } from '@/components/device-status';
import { RemoveDeviceDialog } from '@/components/device/remove-device-dialog';
import { useCarousel } from '@/lib/use-carousel';
import { BUTTON_OUTLINE, cn, FOCUS_RING } from '@/lib/utils';
import { AddDeviceDialog } from './add-device-dialog';

export type HomeFocusTarget =
  | { type: 'device'; id: string }
  | { type: 'settings' }
  | null;

interface HomeProps {
  devices: Device[];
  initialScrollLeft: number;
  restoreFocus: HomeFocusTarget;
  onOpen: (deviceId: string, scrollLeft: number) => void;
  onOpenSettings: (scrollLeft: number) => void;
}

function findDeviceCard(carousel: HTMLElement | null, deviceId: string) {
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
  const isPrevious = direction === 'previous';
  const Icon = isPrevious ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={() => !disabled && onClick()}
      aria-disabled={disabled}
      aria-label={`${isPrevious ? 'Previous' : 'Next'} devices`}
      aria-controls="device-carousel"
      className={cn(
        'absolute top-1/2 z-20 -translate-y-1/2 rounded-full border border-border/60',
        'bg-background/80 p-2 text-muted-foreground shadow-sm backdrop-blur-sm',
        'transition-[color,background-color,opacity]',
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
        disabled ? 'opacity-30' : 'hover:bg-accent/80 hover:text-foreground',
        isPrevious ? 'left-4' : 'right-4',
      )}
    >
      <Icon className="size-4" strokeWidth={1.75} />
    </button>
  );
}

export function Home({
  devices,
  initialScrollLeft,
  restoreFocus,
  onOpen,
  onOpenSettings,
}: HomeProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deviceToRemove, setDeviceToRemove] = useState<Device | null>(null);
  const pairedDeviceIdRef = useRef<string | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const {
    carouselRef,
    hasOverflow,
    canScrollPrevious,
    canScrollNext,
    scrollByItem,
  } = useCarousel(initialScrollLeft, devices.length);

  useLayoutEffect(() => {
    if (!restoreFocus) return;

    const focusTarget =
      restoreFocus.type === 'device'
        ? findDeviceCard(carouselRef.current, restoreFocus.id)
        : settingsButtonRef.current;
    focusTarget?.focus({ preventScroll: true });
  }, [carouselRef, restoreFocus]);

  useLayoutEffect(() => {
    const pairedDeviceId = pairedDeviceIdRef.current;
    if (!pairedDeviceId) return;

    const pairedDeviceCard = findDeviceCard(carouselRef.current, pairedDeviceId);
    if (!pairedDeviceCard) return;

    pairedDeviceIdRef.current = null;
    pairedDeviceCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    pairedDeviceCard.focus({ preventScroll: true });
  }, [carouselRef, devices]);

  const openDevice = (deviceId: string) => {
    onOpen(deviceId, carouselRef.current?.scrollLeft ?? 0);
  };

  const openSettings = () => {
    onOpenSettings(carouselRef.current?.scrollLeft ?? 0);
  };

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex items-center justify-between gap-4 px-8">
        <h1 className="text-xl font-semibold tracking-tight">Devices</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAddDialogOpen(true)}
            className={cn(BUTTON_OUTLINE, 'bg-card/50 shadow-xs')}
          >
            <Plus className="size-4" strokeWidth={1.75} />
            Add device
          </button>
          <button
            ref={settingsButtonRef}
            type="button"
            onClick={openSettings}
            aria-label="Settings"
            className={cn(BUTTON_OUTLINE, 'bg-card/50 px-2.5 text-muted-foreground shadow-xs')}
          >
            <Settings className="size-4.5" strokeWidth={1.75} />
          </button>
        </div>
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
                  onOpen={() => openDevice(device.id)}
                  onRemove={
                    device.link === LinkType.WIRED ? undefined : () => setDeviceToRemove(device)
                  }
                />
              ))}
            </div>
          </div>

          {canScrollPrevious && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-linear-to-r from-background via-background/85 to-transparent"
            />
          )}

          {canScrollNext && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-linear-to-l from-background via-background/85 to-transparent"
            />
          )}

          {hasOverflow && (
            <>
              <CarouselControl
                direction="previous"
                disabled={!canScrollPrevious}
                onClick={() => scrollByItem(-1)}
              />
              <CarouselControl
                direction="next"
                disabled={!canScrollNext}
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

      {isAddDialogOpen && (
        <AddDeviceDialog
          onClose={() => setIsAddDialogOpen(false)}
          onPaired={(deviceId) => {
            pairedDeviceIdRef.current = deviceId;
          }}
        />
      )}
      {deviceToRemove && (
        <RemoveDeviceDialog device={deviceToRemove} onClose={() => setDeviceToRemove(null)} />
      )}
    </div>
  );
}
