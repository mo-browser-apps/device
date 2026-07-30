import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const SCROLL_EDGE_TOLERANCE = 2;

/**
 * Horizontal scroll state for a container holding one track of equally sized items.
 * `itemCount` re-measures when the track gains or loses items.
 */
export function useCarousel(initialScrollLeft: number, itemCount: number) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [canScrollPrevious, setCanScrollPrevious] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const updateScrollState = useCallback(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    const maxScrollLeft = Math.max(0, carousel.scrollWidth - carousel.clientWidth);
    setHasOverflow(maxScrollLeft > SCROLL_EDGE_TOLERANCE);
    setCanScrollPrevious(carousel.scrollLeft > SCROLL_EDGE_TOLERANCE);
    setCanScrollNext(carousel.scrollLeft < maxScrollLeft - SCROLL_EDGE_TOLERANCE);
  }, []);

  useLayoutEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    carousel.scrollLeft = initialScrollLeft;
    updateScrollState();
  }, [initialScrollLeft, updateScrollState]);

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    const track = carousel.firstElementChild;
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(carousel);
    if (track) observer.observe(track);
    carousel.addEventListener('scroll', updateScrollState, { passive: true });
    updateScrollState();

    return () => {
      observer.disconnect();
      carousel.removeEventListener('scroll', updateScrollState);
    };
  }, [itemCount, updateScrollState]);

  const scrollByItem = (direction: -1 | 1) => {
    const carousel = carouselRef.current;
    const track = carousel?.firstElementChild;
    const firstItem = track?.firstElementChild;
    if (!carousel || !track || !firstItem) return;

    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
    const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    carousel.scrollBy({
      left: direction * (firstItem.getBoundingClientRect().width + gap),
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  };

  return { carouselRef, hasOverflow, canScrollPrevious, canScrollNext, scrollByItem };
}
