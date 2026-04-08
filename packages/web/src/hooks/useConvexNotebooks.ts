import { useCallback, useRef } from 'react';
import type { Notebook } from '@papergrid/core';

const API_BASE = import.meta.env.VITE_API_URL || '';
const SESSION_KEY = 'papergrid_session';

/**
 * Authoritative result of /api/notebooks/save.
 *
 *  - `id`         — Convex document id (may differ from the local id when
 *                   a new notebook was just created on the server).
 *  - `pageIdMap`  — map of client-side page ids → new Convex page ids.
 *                   Needed so local state can keep pointing at the same
 *                   pages after the server recreates them.
 *  - `bookmarks`  — the server-remapped bookmarks array. Already translated
 *                   from old local page ids to new Convex page ids.
 */
export interface SaveResult {
    id: string;
    pageIdMap: Record<string, string>;
    bookmarks: string[] | null;
}

function getToken(): string | null {
    return localStorage.getItem(SESSION_KEY);
}

function authHeaders(): Record<string, string> {
    const token = getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

/**
 * Hook to sync notebooks with Convex backend.
 * Only makes API calls when user is authenticated (has session token).
 */
export function useConvexNotebooks() {
    const loadingRef = useRef(false);
    const syncingRef = useRef(false);

    const loadNotebooks = useCallback(async (): Promise<Notebook[] | null> => {
        const token = getToken();
        if (!token || !API_BASE) return null;

        try {
            loadingRef.current = true;
            const res = await fetch(`${API_BASE}/api/notebooks`, {
                method: 'GET',
                headers: authHeaders(),
            });
            if (!res.ok) return null;
            const data = await res.json();
            return data.notebooks || null;
        } catch {
            return null;
        } finally {
            loadingRef.current = false;
        }
    }, []);

    /**
     * Save a single notebook. Returns a SaveResult so the caller can
     * reconcile optimistic local state with the server's authoritative
     * shape (new Convex doc id + remapped bookmarks after a full save).
     *
     * THROWS a typed error on plan-limit rejections (HTTP 403) so the caller
     * can roll back optimistic UI and show the real message. Network or
     * unauthenticated failures still return null silently — those are
     * recoverable on the next sync.
     */
    const saveNotebook = useCallback(async (notebook: Notebook): Promise<SaveResult | null> => {
        const token = getToken();
        if (!token || !API_BASE) return null;

        let res: Response;
        try {
            res = await fetch(`${API_BASE}/api/notebooks/save`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ notebook }),
            });
        } catch {
            return null; // network failure → silent retry on next sync
        }

        if (res.ok) {
            const data = await res.json().catch(() => null) as
                | { id?: string; pageIdMap?: Record<string, string>; bookmarks?: string[] }
                | null;
            if (!data?.id) return null;
            return {
                id: data.id,
                pageIdMap: data.pageIdMap ?? {},
                bookmarks: Array.isArray(data.bookmarks) ? data.bookmarks : null,
            };
        }

        // Non-2xx — try to extract a real error message and propagate when
        // it's a plan-limit rejection so the UI can show it.
        const data = await res.json().catch(() => null) as { error?: string; code?: string } | null;
        if (res.status === 403 && data?.code === 'plan_limit') {
            const err = new Error(data.error || 'Plan limit reached');
            (err as Error & { code?: string }).code = 'plan_limit';
            throw err;
        }
        return null;
    }, []);

    /**
     * Sync ALL notebooks to Convex. Returns a map of localId → SaveResult
     * so callers can reconcile both the notebook id AND the bookmark page
     * ids that got remapped server-side.
     */
    const syncAllNotebooks = useCallback(async (notebooks: Notebook[]): Promise<Map<string, SaveResult>> => {
        const token = getToken();
        const results = new Map<string, SaveResult>();
        if (!token || !API_BASE || syncingRef.current) return results;

        syncingRef.current = true;
        try {
            for (const nb of notebooks) {
                try {
                    const res = await saveNotebook(nb);
                    if (res) results.set(nb.id, res);
                } catch {
                    // Continue syncing other notebooks
                }
            }
        } finally {
            syncingRef.current = false;
        }
        return results;
    }, [saveNotebook]);

    const deleteNotebook = useCallback(async (id: string): Promise<boolean> => {
        const token = getToken();
        if (!token || !API_BASE) return false;

        try {
            const res = await fetch(`${API_BASE}/api/notebooks/delete`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ id }),
            });
            return res.ok;
        } catch {
            return false;
        }
    }, []);

    return {
        loadNotebooks,
        saveNotebook,
        syncAllNotebooks,
        deleteNotebook,
        isLoading: loadingRef,
        isSyncing: syncingRef,
    };
}
