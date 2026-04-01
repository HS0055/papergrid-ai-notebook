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

    return { loadNotebooks, saveNotebook, deleteNotebook, isLoading: loadingRef };
}
