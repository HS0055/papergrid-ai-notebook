import { useRef, useCallback, useEffect } from 'react';
import { gsap } from 'gsap';

/**
 * Hook that makes an element "magnetically" attract toward the cursor
 * when within a given radius, then snap back on leave.
 */
export function useMagneticButton(radius = 80, strength = 0.3) {
  const ref = useRef<HTMLElement>(null);
  const pos = useRef({ x: 0, y: 0 });

  const onMove = useCallback((e: MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < radius) {
      const pull = 1 - dist / radius;
      pos.current.x = dx * strength * pull;
      pos.current.y = dy * strength * pull;
      gsap.to(ref.current, {
        x: pos.current.x,
        y: pos.current.y,
        duration: 0.3,
        ease: 'power2.out',
      });
    }
  }, [radius, strength]);

  const onLeave = useCallback(() => {
    if (!ref.current) return;
    gsap.to(ref.current, {
      x: 0,
      y: 0,
      duration: 0.5,
      ease: 'elastic.out(1, 0.4)',
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Check for reduced motion preference
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    // Check if touch device (no persistent cursor)
    const isTouch = window.matchMedia('(hover: none)').matches;
    if (isTouch) return;

    const parent = el.parentElement || document;
    parent.addEventListener('mousemove', onMove as EventListener);
    el.addEventListener('mouseleave', onLeave);

    return () => {
      parent.removeEventListener('mousemove', onMove as EventListener);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [onMove, onLeave]);

  return ref;
}
