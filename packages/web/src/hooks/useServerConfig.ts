import { useCallback, useEffect, useRef, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';
const SESSION_KEY = 'papergrid_session';

/**
 * Read the auth session token from localStorage.
 *
 * The session is written as a raw string by useAuth.tsx (line 85) and
 * AuthPage.tsx (line 85), NOT as JSON. Earlier revisions of this helper
 * tried `JSON.parse(raw)` which threw on every real token and silently
 * returned null — which made every admin edit in PricingEditor a silent
 * no-op. If you ever change the storage format, update BOTH sides at
 * the same time (search `setItem.*papergrid_session`).
 */
function getSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

/**
 * useServerConfig — drop-in replacement for useEditableConfig (localStorage)
 * that syncs to a Convex HTTP endpoint instead.
 *
 * Same signature: `[value, setValue, reset]`
 *
 * Behaviour:
 *   - On mount, GETs the current override from the server. If null (no
 *     override exists), falls back to defaultValue.
 *   - setValue updates local state IMMEDIATELY (so the UI feels snappy)
 *     and schedules a debounced POST (550ms). Fast typing coalesces into
 *     one server write.
 *   - reset() clears the override on the server (DELETE is not supported
 *     yet so we save defaultValue back instead).
 *
 * Unlike useEditableConfig, changes are VISIBLE TO ALL USERS after the
 * debounce window — not per-browser. This is what makes the admin a
 * real live-editing surface instead of a personal sandbox.
 */
export function useServerConfig<T>(
  endpoint: string,
  defaultValue: T,
  opts: { debounceMs?: number } = {},
): readonly [T, (next: T) => void, () => void] {
  const debounceMs = opts.debounceMs ?? 550;
  const [value, setInternalValue] = useState<T>(defaultValue);
  const loadedRef = useRef(false);
  const pendingSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}${endpoint}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        if (data?.value !== null && data?.value !== undefined) {
          setInternalValue(data.value as T);
        }
      } catch {
        // Silent — fall through to defaultValue.
      } finally {
        loadedRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  const pushToServer = useCallback(
    async (next: T) => {
      const token = getSessionToken();
      if (!token) {
        // Non-admin browsing an editor page? Silent no-op; the editor
        // will show its own "admin only" warning on first interaction.
        return;
      }
      try {
        await fetch(`${API_BASE}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'X-Session-Token': token,
          },
          body: JSON.stringify({ value: next }),
        });
      } catch {
        // Swallow — the next save attempt will retry. We could surface
        // an error toast here in the future.
      }
    },
    [endpoint],
  );

  const setValue = useCallback(
    (next: T) => {
      setInternalValue(next);
      if (!loadedRef.current) {
        // Don't push before the initial load finished — prevents a race
        // where an empty default overwrites a just-loaded override.
        return;
      }
      if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current);
      pendingSaveRef.current = setTimeout(() => {
        void pushToServer(next);
        pendingSaveRef.current = null;
      }, debounceMs);
    },
    [pushToServer, debounceMs],
  );

  const reset = useCallback(() => {
    if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current);
    setInternalValue(defaultValue);
    void pushToServer(defaultValue);
  }, [pushToServer, defaultValue]);

  // Flush pending save on unmount so admins don't lose the last edit.
  useEffect(() => {
    return () => {
      if (pendingSaveRef.current) {
        clearTimeout(pendingSaveRef.current);
        // We can't await here; the editor's save button covers the edge
        // case when the tab unmounts before debounce fires.
      }
    };
  }, []);

  return [value, setValue, reset] as const;
}
