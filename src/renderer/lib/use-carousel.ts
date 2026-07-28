import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const EDGE_TOLERANCE = 2;

/**
 * Horizontal scroll state for a container holding a single track of items.
 * `itemCount` re-measures when the track gains or loses items.
 */
export function useCarousel(initialScrollLeft: number, itemCount: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [canPrevious, setCanPrevious] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const measure = useCallback(() => {
    const carousel = ref.current;
    if (!carousel) return;

    const maxScrollLeft = Math.max(0, carousel.scrollWidth - carousel.clientWidth);
    setOverflows(maxScrollLeft > EDGE_TOLERANCE);
    setCanPrevious(carousel.scrollLeft > EDGE_TOLERANCE);
    setCanNext(carousel.scrollLeft < maxScrollLeft - EDGE_TOLERANCE);
  }, []);

  useLayoutEffect(() => {
    const carousel = ref.current;
    if (!carousel) return;

    carousel.scrollLeft = initialScrollLeft;
    measure();
  }, [initialScrollLeft, measure]);

  useEffect(() => {
    const carousel = ref.current;
    if (!carousel) return;

    const track = carousel.firstElementChild;
    const observer = new ResizeObserver(measure);
    observer.observe(carousel);
    if (track) observer.observe(track);
    carousel.addEventListener('scroll', measure, { passive: true });
    measure();

    return () => {
      observer.disconnect();
      carousel.removeEventListener('scroll', measure);
    };
  }, [itemCount, measure]);

  const scrollByItem = (direction: -1 | 1) => {
    const track = ref.current?.firstElementChild;
    const item = track?.firstElementChild;
    if (!ref.current || !track || !item) return;

    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    ref.current.scrollBy({
      left: direction * (item.getBoundingClientRect().width + gap),
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  };

  return { ref, overflows, canPrevious, canNext, scrollByItem };
}
