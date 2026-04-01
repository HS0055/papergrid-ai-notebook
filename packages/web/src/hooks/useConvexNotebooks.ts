import { useCallback, useRef } from 'react';
import type { Notebook } from '@papergrid/core';

const API_BASE = import.meta.env.VITE_API_URL || '';
const SESSION_KEY = 'papergrid_session';

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

    /** Save a single notebook. Returns the Convex document ID on success. */
    const saveNotebook = useCallback(async (notebook: Notebook): Promise<string | null> => {
        const token = getToken();
        if (!token || !API_BASE) return null;

        try {
            const res = await fetch(`${API_BASE}/api/notebooks/save`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ notebook }),
            });
            if (!res.ok) return null;
            const data = await res.json();
            return data.id || null;
        } catch {
            return null;
        }
    }, []);

    /**
     * Sync ALL notebooks to Convex. Returns a map of localId → convexId
     * for any notebooks whose IDs changed (new notebooks created in Convex).
     */
    const syncAllNotebooks = useCallback(async (notebooks: Notebook[]): Promise<Map<string, string>> => {
        const token = getToken();
        const idMap = new Map<string, string>();
        if (!token || !API_BASE || syncingRef.current) return idMap;

        syncingRef.current = true;
        try {
            for (const nb of notebooks) {
                try {
                    const convexId = await saveNotebook(nb);
                    if (convexId && convexId !== nb.id) {
                        idMap.set(nb.id, convexId);
                    }
                } catch {
                    // Continue syncing other notebooks
                }
            }
        } finally {
            syncingRef.current = false;
        }
        return idMap;
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
