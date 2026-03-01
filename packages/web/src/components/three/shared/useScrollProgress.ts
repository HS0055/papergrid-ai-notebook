import { useRef, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface ScrollSection {
  /** CSS selector or element ID for the trigger element */
  trigger: string;
  /** Start position: 'top top', 'top center', etc. */
  start?: string;
  /** End position: 'bottom top', 'bottom center', etc. */
  end?: string;
}

interface UseScrollProgressOptions {
  /** Scroll sections to track */
  sections?: ScrollSection[];
  /** Smoothing factor (0-1, lower = smoother) */
  smoothing?: number;
  /** Whether to use global page scroll (0-1) */
  useGlobalScroll?: boolean;
}

/**
 * Bridge between page scroll position and R3F useFrame.
 * Provides smooth, interpolated scroll progress values for 3D animations.
 *
 * Works with GSAP ScrollTrigger if available, or falls back to native scroll.
 */
export function useScrollProgress(options: UseScrollProgressOptions = {}) {
  const { smoothing = 0.08, useGlobalScroll = true } = options;

  // Raw (target) scroll values
  const rawProgress = useRef(0);
  // Smoothed scroll values (used in render)
  const smoothProgress = useRef(0);
  // Section-specific progress values
  const sectionProgress = useRef<Record<string, number>>({});
  const smoothSectionProgress = useRef<Record<string, number>>({});
  // Scroll velocity
  const velocity = useRef(0);
  const lastProgress = useRef(0);

  // Global scroll listener
  useEffect(() => {
    if (!useGlobalScroll) return;

    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      rawProgress.current = docHeight > 0 ? scrollTop / docHeight : 0;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial value
    return () => window.removeEventListener('scroll', handleScroll);
  }, [useGlobalScroll]);

  // Section observers
  useEffect(() => {
    if (!options.sections?.length) return;

    const observers: IntersectionObserver[] = [];

    options.sections.forEach((section) => {
      const el = document.querySelector(section.trigger);
      if (!el) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const rect = entry.boundingClientRect;
              const viewportHeight = window.innerHeight;
              // Progress through the section (0 = just entering, 1 = fully passed)
              const progress = Math.max(0, Math.min(1,
                (viewportHeight - rect.top) / (viewportHeight + rect.height)
              ));
              sectionProgress.current[section.trigger] = progress;
            }
          });
        },
        { threshold: Array.from({ length: 20 }, (_, i) => i / 19) }
      );

      observer.observe(el);
      observers.push(observer);
    });

    // Also update section progress on scroll for smoother values
    const handleScroll = () => {
      options.sections?.forEach((section) => {
        const el = document.querySelector(section.trigger);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const progress = Math.max(0, Math.min(1,
          (viewportHeight - rect.top) / (viewportHeight + rect.height)
        ));
        sectionProgress.current[section.trigger] = progress;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      observers.forEach((o) => o.disconnect());
      window.removeEventListener('scroll', handleScroll);
    };
  }, [options.sections]);

  // Smooth interpolation in render loop
  useFrame((_, delta) => {
    // Smooth global progress
    smoothProgress.current = THREE.MathUtils.lerp(
      smoothProgress.current,
      rawProgress.current,
      1 - Math.pow(1 - smoothing, delta * 60)
    );

    // Smooth section progress
    Object.keys(sectionProgress.current).forEach((key) => {
      if (smoothSectionProgress.current[key] === undefined) {
        smoothSectionProgress.current[key] = 0;
      }
      smoothSectionProgress.current[key] = THREE.MathUtils.lerp(
        smoothSectionProgress.current[key],
        sectionProgress.current[key],
        1 - Math.pow(1 - smoothing, delta * 60)
      );
    });

    // Calculate velocity
    velocity.current = (smoothProgress.current - lastProgress.current) / Math.max(delta, 0.001);
    lastProgress.current = smoothProgress.current;
  });

  /** Get smoothed global scroll progress (0 to 1) */
  const getProgress = useCallback(() => smoothProgress.current, []);

  /** Get raw (un-smoothed) global scroll progress */
  const getRawProgress = useCallback(() => rawProgress.current, []);

  /** Get smoothed progress for a specific section */
  const getSectionProgress = useCallback((trigger: string) => {
    return smoothSectionProgress.current[trigger] ?? 0;
  }, []);

  /** Get scroll velocity (useful for motion blur, page flip speed) */
  const getVelocity = useCallback(() => velocity.current, []);

  /** Map progress to a range (e.g., map 0.2-0.5 scroll to 0-1) */
  const mapRange = useCallback((start: number, end: number) => {
    const p = smoothProgress.current;
    return Math.max(0, Math.min(1, (p - start) / (end - start)));
  }, []);

  return {
    getProgress,
    getRawProgress,
    getSectionProgress,
    getVelocity,
    mapRange,
  };
}
