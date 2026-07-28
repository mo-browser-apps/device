import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Device } from '@/gen/devices';
import { DeviceArt } from '@/components/art/device-art';
import { DeviceBatteryStatus, DeviceConnectionIcon } from '@/components/device-status';
import { cn } from '@/lib/utils';

const SCROLL_EDGE_TOLERANCE = 2;

function DeviceCard({ device, onOpen }: { device: Device; onOpen: () => void }) {
  return (
    <button
      type="button"
      data-device-card
      data-device-id={device.id}
      onClick={onOpen}
      className={cn(
        'group flex w-64 shrink-0 snap-center flex-col items-center gap-5 rounded-2xl px-6 py-7',
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

function CarouselControl({
  direction,
  onClick,
}: {
  direction: 'previous' | 'next';
  onClick: () => void;
}) {
  const previous = direction === 'previous';
  const Icon = previous ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${previous ? 'Previous' : 'Next'} devices`}
      aria-controls="device-carousel"
      className={cn(
        'absolute top-1/2 z-20 -translate-y-1/2 rounded-full border border-border/60',
        'bg-background/80 p-2 text-muted-foreground shadow-sm backdrop-blur-sm',
        'transition-colors hover:bg-accent/80 hover:text-foreground',
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
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
  const carouselRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState({ previous: false, next: false });

  const updateScrollState = useCallback(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    const maxScrollLeft = Math.max(0, carousel.scrollWidth - carousel.clientWidth);
    const next = {
      previous: carousel.scrollLeft > SCROLL_EDGE_TOLERANCE,
      next: carousel.scrollLeft < maxScrollLeft - SCROLL_EDGE_TOLERANCE,
    };
    setCanScroll((current) =>
      current.previous === next.previous && current.next === next.next ? current : next,
    );
  }, []);

  useLayoutEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    carousel.scrollLeft = initialScrollLeft;
    updateScrollState();

    if (restoreFocusId) {
      const card = Array.from(
        carousel.querySelectorAll<HTMLElement>('[data-device-card]'),
      ).find((element) => element.dataset.deviceId === restoreFocusId);
      card?.focus({ preventScroll: true });
    }
  }, [initialScrollLeft, restoreFocusId, updateScrollState]);

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    const track = carousel.firstElementChild;
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(carousel);
    if (track) resizeObserver.observe(track);

    carousel.addEventListener('scroll', updateScrollState, { passive: true });
    updateScrollState();

    return () => {
      resizeObserver.disconnect();
      carousel.removeEventListener('scroll', updateScrollState);
    };
  }, [devices.length, updateScrollState]);

  const scrollByCard = (direction: -1 | 1) => {
    const carousel = carouselRef.current;
    const card = carousel?.querySelector<HTMLElement>('[data-device-card]');
    const track = card?.parentElement;
    if (!carousel || !card || !track) return;

    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    carousel.scrollBy({
      left: direction * (card.getBoundingClientRect().width + gap),
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  };

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

      <div className="relative flex flex-1 items-center">
        <div
          id="device-carousel"
          ref={carouselRef}
          data-device-carousel
          className="w-full snap-x snap-proximity overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div
            data-device-track
            className="flex w-max min-w-full justify-center gap-4 px-12 pb-12"
          >
            {devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                onOpen={() => onOpen(device.id, carouselRef.current?.scrollLeft ?? 0)}
              />
            ))}
          </div>
        </div>

        {canScroll.previous && (
          <>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-linear-to-r from-background via-background/85 to-transparent"
            />
            <CarouselControl direction="previous" onClick={() => scrollByCard(-1)} />
          </>
        )}

        {canScroll.next && (
          <>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-linear-to-l from-background via-background/85 to-transparent"
            />
            <CarouselControl direction="next" onClick={() => scrollByCard(1)} />
          </>
        )}
      </div>
    </div>
  );
}
