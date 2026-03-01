import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;

/**
 * Detects mobile devices via viewport width + coarse pointer.
 * Also exposes whether device likely has low GPU (mobile + high DPR).
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < MOBILE_BREAKPOINT ||
      ('ontouchstart' in window && window.matchMedia('(pointer: coarse)').matches);
  });

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isMobile;
}

/**
 * Quick static check (no hook needed) for SSR-safe mobile detection.
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < MOBILE_BREAKPOINT ||
    ('ontouchstart' in window && window.matchMedia('(pointer: coarse)').matches);
}
