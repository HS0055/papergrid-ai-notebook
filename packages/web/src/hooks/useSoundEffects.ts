import { useState, useCallback, useRef } from 'react';
import {
  playPenScratch,
  playPageFlip,
  playCheckboxClick,
  playBlockAdd,
  playBlockDelete,
  playDragRustle,
} from '../utils/soundEngine';

const STORAGE_KEY = 'papergrid_sounds_enabled';

export function useSoundEffects() {
  const [enabled, setEnabled] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === null ? false : saved === 'true';
  });

  // Throttle pen scratch to avoid machine-gun sound on fast typing
  const lastScratch = useRef(0);

  const toggle = useCallback(() => {
    setEnabled(prev => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const penScratch = useCallback(() => {
    if (!enabled) return;
    const now = Date.now();
    if (now - lastScratch.current < 60) return; // max ~16 sounds/sec
    lastScratch.current = now;
    playPenScratch();
  }, [enabled]);

  const pageFlip = useCallback(() => {
    if (!enabled) return;
    playPageFlip();
  }, [enabled]);

  const checkboxClick = useCallback(() => {
    if (!enabled) return;
    playCheckboxClick();
  }, [enabled]);

  const blockAdd = useCallback(() => {
    if (!enabled) return;
    playBlockAdd();
  }, [enabled]);

  const blockDelete = useCallback(() => {
    if (!enabled) return;
    playBlockDelete();
  }, [enabled]);

  const dragRustle = useCallback(() => {
    if (!enabled) return;
    playDragRustle();
  }, [enabled]);

  return {
    enabled,
    toggle,
    penScratch,
    pageFlip,
    checkboxClick,
    blockAdd,
    blockDelete,
    dragRustle,
  };
}
