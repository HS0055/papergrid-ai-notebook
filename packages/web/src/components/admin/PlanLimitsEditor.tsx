import React, { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';
const SESSION_KEY = 'papergrid_session';

type PlanId = 'free' | 'starter' | 'pro' | 'founder' | 'creator';

interface PlanLimitConfig {
  maxNotebooks: number;
  monthlyInk: number;
  inkRolloverCap: number;
  canUseAi: boolean;
  exportWatermark: boolean;
  canPublishTemplates: boolean;
}

type PlanLimitsMap = Record<PlanId, PlanLimitConfig>;

const PLANS: PlanId[] = ['free', 'starter', 'pro', 'founder', 'creator'];

const PLAN_LABELS: Record<PlanId, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  founder: 'Founder',
  creator: 'Creator',
};

const PLAN_COLORS: Record<PlanId, string> = {
  free: 'bg-gray-100 text-gray-700 border-gray-200',
  starter: 'bg-sky-50 text-sky-700 border-sky-200',
  pro: 'bg-purple-50 text-purple-700 border-purple-200',
  founder: 'bg-amber-50 text-amber-700 border-amber-200',
  creator: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

// useAuth.tsx stores the session token as a raw string, NOT as JSON.
// The prior JSON.parse version here silently returned null and every
// Plan Limits edit was dropped on the floor.
function getSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export const PlanLimitsEditor: React.FC = () => {
  const [limits, setLimits] = useState<PlanLimitsMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingPlan, setSavingPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PlanLimitsMap | null>(null);

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/plan-limits`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setLimits(data.limits as PlanLimitsMap);
        setDraft(data.limits as PlanLimitsMap);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateField = <K extends keyof PlanLimitConfig>(
    plan: PlanId,
    key: K,
    value: PlanLimitConfig[K],
  ) => {
    setDraft((prev) => (prev ? { ...prev, [plan]: { ...prev[plan], [key]: value } } : prev));
  };

  const savePlan = async (planId: PlanId) => {
    if (!draft || !limits) return;
    const sessionToken = getSessionToken();
    if (!sessionToken) {
      setError('You must be logged in as an admin.');
      return;
    }
    setSavingPlan(planId);
    setError(null);
    try {
      // Compute the diff from server-known limits
      const patch: Partial<PlanLimitConfig> = {};
      for (const k of Object.keys(draft[planId]) as (keyof PlanLimitConfig)[]) {
        if (draft[planId][k] !== limits[planId][k]) {
          (patch as Record<string, unknown>)[k] = draft[planId][k];
        }
      }
      if (Object.keys(patch).length === 0) {
        setSavingPlan(null);
        return;
      }
      const res = await fetch(`${API_BASE}/api/admin/plan-limits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Token': sessionToken },
        body: JSON.stringify({ planId, patch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setLimits(data.limits as PlanLimitsMap);
      setDraft(data.limits as PlanLimitsMap);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSavingPlan(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border p-6">
        <div className="text-sm text-gray-500">Loading plan limits…</div>
      </div>
    );
  }

  if (!limits || !draft) {
    return (
      <div className="bg-white rounded-xl border p-6">
        <div className="text-sm text-red-500">{error ?? 'Failed to load plan limits.'}</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Plan Limits</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Edit notebook caps, AI access, and export rules per plan. Changes apply immediately.
          </p>
        </div>
        <button
          onClick={() => {
            if (editing) setDraft(limits); // discard
            setEditing((v) => !v);
          }}
          className={`text-xs font-medium px-3 py-1 rounded-lg border transition-colors ${
            editing
              ? 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
              : 'border-indigo-200 text-indigo-600 hover:border-indigo-300'
          }`}
        >
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
              <th className="px-2 py-2">Plan</th>
              <th className="px-2 py-2">Notebooks</th>
              <th className="px-2 py-2">Ink/mo</th>
              <th className="px-2 py-2">Rollover</th>
              <th className="px-2 py-2">AI</th>
              <th className="px-2 py-2">Watermark</th>
              <th className="px-2 py-2">Templates</th>
              <th className="px-2 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {PLANS.map((planId) => {
              const config = draft[planId];
              const isUnlimited = config.maxNotebooks === -1;
              const isDirty = JSON.stringify(config) !== JSON.stringify(limits[planId]);
              return (
                <tr key={planId} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-2 py-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded-md border ${PLAN_COLORS[planId]}`}>
                      {PLAN_LABELS[planId]}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    {editing ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={-1}
                          max={9999}
                          value={config.maxNotebooks}
                          onChange={(e) => updateField(planId, 'maxNotebooks', parseInt(e.target.value) || 0)}
                          className="w-16 text-sm font-medium bg-indigo-50 border border-indigo-200 rounded px-2 py-0.5 focus:outline-none focus:border-indigo-400"
                        />
                        <span className="text-[10px] text-gray-400">−1=∞</span>
                      </div>
                    ) : (
                      <span className="text-sm font-medium text-gray-900">{isUnlimited ? '∞' : config.maxNotebooks}</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {editing ? (
                      <input
                        type="number"
                        min={0}
                        value={config.monthlyInk}
                        onChange={(e) => updateField(planId, 'monthlyInk', parseInt(e.target.value) || 0)}
                        className="w-16 text-sm font-medium bg-indigo-50 border border-indigo-200 rounded px-2 py-0.5 focus:outline-none focus:border-indigo-400"
                      />
                    ) : (
                      <span className="text-sm font-medium text-gray-900">{config.monthlyInk}</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {editing ? (
                      <input
                        type="number"
                        min={0}
                        value={config.inkRolloverCap}
                        onChange={(e) => updateField(planId, 'inkRolloverCap', parseInt(e.target.value) || 0)}
                        className="w-16 text-sm font-medium bg-indigo-50 border border-indigo-200 rounded px-2 py-0.5 focus:outline-none focus:border-indigo-400"
                      />
                    ) : (
                      <span className="text-sm font-medium text-gray-900">{config.inkRolloverCap}</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={config.canUseAi}
                      disabled={!editing}
                      onChange={(e) => updateField(planId, 'canUseAi', e.target.checked)}
                      className="w-4 h-4 accent-indigo-600 cursor-pointer"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={config.exportWatermark}
                      disabled={!editing}
                      onChange={(e) => updateField(planId, 'exportWatermark', e.target.checked)}
                      className="w-4 h-4 accent-indigo-600 cursor-pointer"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={config.canPublishTemplates}
                      disabled={!editing}
                      onChange={(e) => updateField(planId, 'canPublishTemplates', e.target.checked)}
                      className="w-4 h-4 accent-indigo-600 cursor-pointer"
                    />
                  </td>
                  <td className="px-2 py-2 text-right">
                    {editing && isDirty && (
                      <button
                        onClick={() => savePlan(planId)}
                        disabled={savingPlan === planId}
                        className="text-xs font-medium px-2 py-1 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {savingPlan === planId ? 'Saving…' : 'Save'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
