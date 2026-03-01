import { useRef, useCallback, useEffect, useState } from 'react';

export type PerformanceTier = 'high' | 'medium' | 'low';

interface PerformanceState {
  fps: number;
  tier: PerformanceTier;
  shouldDisableEffects: boolean;
  shouldDisable3D: boolean;
}

/**
 * Monitors FPS and provides auto-degradation signals.
 * - high: 45+ fps → all features enabled
 * - medium: 30-45 fps → disable FloatingPapers, heavy effects
 * - low: <30 fps → disable PostEffects, simplify animations
 *
 * Only active in development or when explicitly enabled.
 */
export function usePerformanceMonitor(enabled = true): PerformanceState {
  const [state, setState] = useState<PerformanceState>({
    fps: 60,
    tier: 'high',
    shouldDisableEffects: false,
    shouldDisable3D: false,
  });

  const frameTimesRef = useRef<number[]>([]);
  const lastFrameRef = useRef(performance.now());
  const rafRef = useRef<number>(0);
  const lowFpsStartRef = useRef<number | null>(null);
  const medFpsStartRef = useRef<number | null>(null);

  const measure = useCallback(() => {
    const now = performance.now();
    const delta = now - lastFrameRef.current;
    lastFrameRef.current = now;

    // Rolling window of 60 frame times
    const frameTimes = frameTimesRef.current;
    frameTimes.push(delta);
    if (frameTimes.length > 60) frameTimes.shift();

    // Calculate average FPS every 30 frames
    if (frameTimes.length % 30 === 0 && frameTimes.length >= 30) {
      const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      const fps = Math.round(1000 / avg);

      let tier: PerformanceTier = 'high';
      let shouldDisableEffects = false;
      let shouldDisable3D = false;

      const currentTime = performance.now();

      // Check sustained low FPS (< 30 for 2+ seconds)
      if (fps < 30) {
        if (!lowFpsStartRef.current) {
          lowFpsStartRef.current = currentTime;
        } else if (currentTime - lowFpsStartRef.current > 2000) {
          tier = 'low';
          shouldDisableEffects = true;
          shouldDisable3D = true;
        }
      } else {
        lowFpsStartRef.current = null;
      }

      // Check medium FPS (< 45 for 2+ seconds)
      if (fps < 45 && tier !== 'low') {
        if (!medFpsStartRef.current) {
          medFpsStartRef.current = currentTime;
        } else if (currentTime - medFpsStartRef.current > 2000) {
          tier = 'medium';
          shouldDisable3D = true;
        }
      } else if (fps >= 45) {
        medFpsStartRef.current = null;
      }

      setState({ fps, tier, shouldDisableEffects, shouldDisable3D });
    }

    rafRef.current = requestAnimationFrame(measure);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    rafRef.current = requestAnimationFrame(measure);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, measure]);

  return state;
}

/**
 * Dev-only FPS display component.
 * Usage: {import.meta.env.DEV && <FpsCounter />}
 */
export function useFpsDisplay(): { fps: number } {
  const { fps } = usePerformanceMonitor(import.meta.env.DEV);
  return { fps };
}
