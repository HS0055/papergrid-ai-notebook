import { useState, useEffect, useCallback } from 'react';

/**
 * useEditableConfig — admin-editable config persisted to localStorage with
 * default fallback. Synchronizes across tabs via the storage event so that
 * editing in /admin instantly updates the landing page in another tab.
 *
 * Usage:
 *   const [roadmap, setRoadmap, reset] = useEditableConfig('papera_roadmap_override', DEFAULT_ROADMAP);
 *
 * Storage strategy:
 *   - localStorage key holds JSON-encoded override
 *   - If no override exists, defaultValue is used
 *   - reset() clears the override (back to defaults)
 *   - Multi-tab sync via 'storage' event
 *
 * Future: swap localStorage for a Convex query/mutation pair.
 */
export function useEditableConfig<T>(
  storageKey: string,
  defaultValue: T,
): readonly [T, (next: T) => void, () => void] {
  // Initial state: read from localStorage if present
  const [value, setInternalValue] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed as T;
      }
    } catch {
      // ignore corrupted localStorage
    }
    return defaultValue;
  });

  // Sync across tabs
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onStorage = (e: StorageEvent) => {
      if (e.key !== storageKey) return;
      if (e.newValue === null) {
        setInternalValue(defaultValue);
        return;
      }
      try {
        setInternalValue(JSON.parse(e.newValue) as T);
      } catch {
        // ignore
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [storageKey, defaultValue]);

  // Setter that persists immediately
  const setValue = useCallback(
    (next: T) => {
      setInternalValue(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
        // Manually dispatch a synthetic storage event for same-tab listeners
        // (the native event only fires across tabs, not in the originating tab)
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: storageKey,
            newValue: JSON.stringify(next),
          }),
        );
      } catch {
        // localStorage quota exceeded or unavailable
      }
    },
    [storageKey],
  );

  // Reset to defaults
  const reset = useCallback(() => {
    setInternalValue(defaultValue);
    try {
      localStorage.removeItem(storageKey);
      window.dispatchEvent(new StorageEvent('storage', { key: storageKey, newValue: null }));
    } catch {
      // ignore
    }
  }, [storageKey, defaultValue]);

  return [value, setValue, reset] as const;
}
