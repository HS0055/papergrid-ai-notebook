import React, { useCallback, useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';
const SESSION_KEY = 'papergrid_session';

function authHeaders(): Record<string, string> {
  const raw = localStorage.getItem(SESSION_KEY);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const token = parsed?.token;
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch {
      /* ignore */
    }
  }
  return headers;
}

interface InkCosts {
  layout: number;
  advanced_layout: number;
  cover: number;
  premium_cover: number;
}

const DEFAULT_COSTS: InkCosts = {
  layout: 1,
  advanced_layout: 2,
  cover: 4,
  premium_cover: 6,
};

/**
 * InkCostsEditor — the leftover after splitting the legacy "Ink Economy"
 * section. This ONLY edits the per-action ink costs (how much ink a layout,
 * cover, etc. consumes). The per-plan monthly ink allocation moved to
 * PlanLimitsEditor — don't duplicate it here.
 */
export const InkCostsEditor: React.FC = () => {
  const [costs, setCosts] = useState<InkCosts>(DEFAULT_COSTS);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCosts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/ink/config`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data?.costs) setCosts({ ...DEFAULT_COSTS, ...data.costs });
      }
    } catch {
      /* keep defaults */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchCosts();
  }, [fetchCosts]);

  const saveCosts = async () => {
    setSaving(true);
    setError(null);
    try {
      // The legacy endpoint expects the full { plans, costs } shape.
      // We send costs only and preserve the server-known plans by reading first.
      const current = await fetch(`${API_BASE}/api/ink/config`, { headers: authHeaders() })
        .then((r) => r.json())
        .catch(() => ({ plans: {} }));
      const res = await fetch(`${API_BASE}/api/admin/ink-config`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          config: {
            plans: current?.plans ?? {},
            costs,
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const updateCost = (key: keyof InkCosts, value: number) => {
    setCosts((prev) => ({ ...prev, [key]: value }));
  };

  if (!loaded) {
    return (
      <div className="bg-white rounded-xl border p-6">
        <div className="text-sm text-gray-500">Loading ink costs…</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Ink Action Costs</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            How many ink each action consumes. Per-plan monthly allocation lives in the Plans tab.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={saveCosts}
                disabled={saving}
                className="text-xs text-white bg-indigo-600 hover:bg-indigo-700 font-medium px-3 py-1 rounded-lg disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  fetchCosts();
                  setError(null);
                }}
                disabled={saving}
                className="text-xs text-gray-600 hover:text-gray-700 font-medium px-3 py-1 rounded-lg border border-gray-200 hover:border-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium px-3 py-1 rounded-lg border border-indigo-200 hover:border-indigo-300"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(
          [
            { key: 'layout', label: 'Layout', sub: 'Single page' },
            { key: 'advanced_layout', label: 'Advanced', sub: 'Multi-page / spread' },
            { key: 'cover', label: 'Cover', sub: 'Standard AI cover' },
            { key: 'premium_cover', label: 'Premium Cover', sub: 'Photo-quality cover' },
          ] as Array<{ key: keyof InkCosts; label: string; sub: string }>
        ).map(({ key, label, sub }) => (
          <div key={key} className="bg-white rounded-xl border p-3">
            <div className="text-xs text-gray-500 mb-1">{label}</div>
            {editing ? (
              <input
                type="number"
                min={0}
                value={costs[key]}
                onChange={(e) => updateCost(key, parseInt(e.target.value) || 0)}
                className="w-full text-lg font-bold text-gray-900 bg-indigo-50 border border-indigo-200 rounded px-2 py-0.5 focus:outline-none focus:border-indigo-400"
              />
            ) : (
              <div className="text-lg font-bold text-gray-900">{costs[key]}</div>
            )}
            <div className="text-[10px] text-gray-400">{sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
