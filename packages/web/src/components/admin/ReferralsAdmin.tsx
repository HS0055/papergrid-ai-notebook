import React, { useCallback, useEffect, useState } from 'react';
import {
  Loader2, TrendingUp, Users, Check, Sparkles, MousePointerClick,
  Save, Ban, RefreshCw,
} from 'lucide-react';
import { api as apiClient } from '../../services/apiClient';

// ─────────────────────────────────────────────────────────────
// ReferralsAdmin — admin dashboard for the user-referral growth loop
//
// Three sections:
//   1. Summary tiles — clicks, signups, qualified, conversion rate
//   2. Config panel — referrer reward, referred reward, qualifying
//      action, kill switch
//   3. Leaderboard + recent redemptions with void-for-fraud action
// ─────────────────────────────────────────────────────────────

interface Summary {
  totalReferrers: number;
  totalClicks: number;
  totalSignups: number;
  totalQualified: number;
  totalRewardInk: number;
  conversionRate: number;
  clickToSignupRate: number;
  topReferrerQualified: number;
  config: {
    referrerReward: number;
    referredReward: number;
    qualifyingAction: 'signup' | 'first_notebook' | 'first_ink_spend';
    enabled: boolean;
  };
}

interface TopReferrer {
  _id: string;
  code: string;
  totalClicks: number;
  totalSignups: number;
  totalQualified: number;
  totalRewardInk: number;
  userEmail?: string;
  userName?: string;
}

interface Redemption {
  _id: string;
  referrerId: string;
  referredUserId: string;
  code: string;
  status: 'pending' | 'qualified' | 'voided';
  referrerInkReward?: number;
  referredInkReward?: number;
  createdAt: string;
  qualifiedAt?: string;
  voidReason?: string;
  referrerEmail?: string;
  referrerName?: string;
  referredEmail?: string;
  referredName?: string;
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString();
const formatPercent = (n: number) => `${(n * 100).toFixed(1)}%`;

type View = 'leaderboard' | 'redemptions';

export const ReferralsAdmin: React.FC = () => {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<View>('leaderboard');

  // Config form state
  const [formEnabled, setFormEnabled] = useState(true);
  const [formReferrer, setFormReferrer] = useState('25');
  const [formReferred, setFormReferred] = useState('25');
  const [formAction, setFormAction] = useState<'signup' | 'first_notebook' | 'first_ink_spend'>('signup');
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMsg, setConfigMsg] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await apiClient.get<{ summary: Summary }>('/api/admin/referrals/summary');
      setSummary(data.summary);
      setFormEnabled(data.summary.config.enabled);
      setFormReferrer(String(data.summary.config.referrerReward));
      setFormReferred(String(data.summary.config.referredReward));
      setFormAction(data.summary.config.qualifyingAction);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load summary');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const saveConfig = async () => {
    setSavingConfig(true);
    setConfigMsg(null);
    try {
      const referrerReward = Math.max(0, Math.min(10000, parseInt(formReferrer, 10) || 0));
      const referredReward = Math.max(0, Math.min(10000, parseInt(formReferred, 10) || 0));
      await apiClient.post('/api/admin/referrals/config', {
        referrerReward,
        referredReward,
        qualifyingAction: formAction,
        enabled: formEnabled,
      });
      setConfigMsg('Saved');
      setTimeout(() => setConfigMsg(null), 2000);
      await loadSummary();
    } catch (e) {
      setConfigMsg(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSavingConfig(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }
  if (err || !summary) {
    return (
      <div className="p-6 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
        {err ?? 'Failed to load'}
      </div>
    );
  }

  return (
    <div>
      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Tile icon={<Users size={16} />} label="Referrers" value={summary.totalReferrers} />
        <Tile icon={<MousePointerClick size={16} />} label="Clicks" value={summary.totalClicks} />
        <Tile icon={<TrendingUp size={16} />} label="Signups" value={summary.totalSignups} />
        <Tile icon={<Check size={16} />} label="Qualified" value={summary.totalQualified} highlight />
        <Tile
          icon={<Sparkles size={16} />}
          label="Conv. rate"
          valueText={formatPercent(summary.conversionRate)}
        />
      </div>

      {/* Config */}
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg font-bold text-slate-900">Program config</h2>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formEnabled}
              onChange={(e) => setFormEnabled(e.target.checked)}
              className="rounded border-black/10"
            />
            Enabled
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Referrer reward (Ink)">
            <input
              type="number"
              min={0}
              max={10000}
              value={formReferrer}
              onChange={(e) => setFormReferrer(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-black/10 focus:outline-none focus:border-indigo-500 text-sm"
            />
          </Field>
          <Field label="Referred reward (Ink)">
            <input
              type="number"
              min={0}
              max={10000}
              value={formReferred}
              onChange={(e) => setFormReferred(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-black/10 focus:outline-none focus:border-indigo-500 text-sm"
            />
          </Field>
          <Field label="Qualifying action">
            <select
              value={formAction}
              onChange={(e) => setFormAction(e.target.value as typeof formAction)}
              className="w-full px-3 py-2 rounded-lg border border-black/10 focus:outline-none focus:border-indigo-500 text-sm bg-white"
            >
              <option value="signup">On signup (immediate)</option>
              <option value="first_notebook">After first notebook save</option>
              <option value="first_ink_spend">After first Ink spend</option>
            </select>
          </Field>
        </div>
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-gray-500">
            Lower = safer against fraud. Higher = shorter feedback loop.
          </p>
          <div className="flex items-center gap-3">
            {configMsg && (
              <span className={`text-xs font-semibold ${configMsg === 'Saved' ? 'text-emerald-600' : 'text-rose-600'}`}>
                {configMsg}
              </span>
            )}
            <button
              onClick={saveConfig}
              disabled={savingConfig}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
            >
              <Save size={14} />
              {savingConfig ? 'Saving…' : 'Save config'}
            </button>
          </div>
        </div>
      </div>

      {/* View switcher */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setView('leaderboard')}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              view === 'leaderboard' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-black/5'
            }`}
          >
            Leaderboard
          </button>
          <button
            onClick={() => setView('redemptions')}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              view === 'redemptions' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-black/5'
            }`}
          >
            Redemptions
          </button>
        </div>
        <button
          onClick={loadSummary}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-600 hover:bg-slate-100"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {view === 'leaderboard' && <Leaderboard />}
      {view === 'redemptions' && <Redemptions />}
    </div>
  );
};

// ────────── Leaderboard ──────────
const Leaderboard: React.FC = () => {
  const [rows, setRows] = useState<TopReferrer[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiClient.get<{ rows: TopReferrer[] }>(
          '/api/admin/referrals/top?limit=50',
        );
        setRows(data.rows);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load leaderboard');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }
  if (err) return <p className="text-sm text-rose-600">{err}</p>;
  if (rows.length === 0) return <p className="text-sm text-gray-500 text-center py-8">No referrers yet.</p>;

  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600 uppercase tracking-wider">
          <tr>
            <th className="text-left px-4 py-3 font-semibold">#</th>
            <th className="text-left px-4 py-3 font-semibold">User</th>
            <th className="text-left px-4 py-3 font-semibold">Code</th>
            <th className="text-right px-4 py-3 font-semibold">Clicks</th>
            <th className="text-right px-4 py-3 font-semibold">Signups</th>
            <th className="text-right px-4 py-3 font-semibold">Qualified</th>
            <th className="text-right px-4 py-3 font-semibold">Ink earned</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r._id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
              <td className="px-4 py-3 text-slate-400 font-mono">{i + 1}</td>
              <td className="px-4 py-3">
                <div className="font-semibold text-slate-900">{r.userName || 'Unknown'}</div>
                {r.userEmail && <div className="text-xs text-gray-500">{r.userEmail}</div>}
              </td>
              <td className="px-4 py-3">
                <code className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                  {r.code}
                </code>
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{r.totalClicks}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.totalSignups}</td>
              <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-700">
                {r.totalQualified}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{r.totalRewardInk}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ────────── Redemptions ──────────
const Redemptions: React.FC = () => {
  const [rows, setRows] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState<'all' | 'pending' | 'qualified' | 'voided'>('all');
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const qs = status === 'all' ? '' : `?status=${status}`;
      const data = await apiClient.get<{ rows: Redemption[] }>(
        `/api/admin/referrals/redemptions${qs}`,
      );
      setRows(data.rows);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load redemptions');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const voidRedemption = async (redemptionId: string) => {
    const reason = prompt('Reason for voiding (fraud, refund, etc.):');
    if (!reason) return;
    if (!confirm('Confirm void? Ink granted will be rolled back from both sides.')) return;
    setActing(redemptionId);
    try {
      await apiClient.post('/api/admin/referrals/void', { redemptionId, reason });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to void');
    } finally {
      setActing(null);
    }
  };

  return (
    <div>
      <div className="flex gap-1 mb-4">
        {(['all', 'pending', 'qualified', 'voided'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize transition-colors ${
              status === s ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      {loading && (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <Loader2 size={20} className="animate-spin" />
        </div>
      )}
      {err && <p className="text-sm text-rose-600">{err}</p>}
      {!loading && rows.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-8">No redemptions in this bucket.</p>
      )}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r._id} className="bg-white rounded-xl border border-black/5 shadow-sm p-3 flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-slate-900">
                  {r.referrerName || r.referrerEmail || 'Unknown'}
                </span>
                <span className="text-xs text-gray-400">→</span>
                <span className="text-sm text-slate-700">
                  {r.referredName || r.referredEmail || 'Unknown'}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    r.status === 'qualified'
                      ? 'bg-emerald-100 text-emerald-700'
                      : r.status === 'pending'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {r.status}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                <code className="bg-slate-100 px-1 py-0.5 rounded">{r.code}</code>
                {' · '}
                {formatDate(r.createdAt)}
                {r.qualifiedAt && ` · qualified ${formatDate(r.qualifiedAt)}`}
                {r.voidReason && ` · ${r.voidReason}`}
              </p>
            </div>
            {r.status === 'qualified' && (
              <button
                onClick={() => voidRedemption(r._id)}
                disabled={acting === r._id}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-rose-300 text-rose-700 text-xs font-bold hover:bg-rose-50 disabled:opacity-50"
              >
                <Ban size={12} /> Void
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

// ────────── shared bits ──────────
const Tile: React.FC<{
  icon: React.ReactNode;
  label: string;
  value?: number;
  valueText?: string;
  highlight?: boolean;
}> = ({ icon, label, value, valueText, highlight }) => (
  <div
    className={`p-4 rounded-2xl border shadow-sm ${
      highlight
        ? 'bg-gradient-to-br from-emerald-50 to-white border-emerald-200'
        : 'bg-white border-black/5'
    }`}
  >
    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5">
      {icon}
      {label}
    </div>
    <p
      className={`font-serif text-2xl font-bold tabular-nums ${
        highlight ? 'text-emerald-700' : 'text-slate-900'
      }`}
    >
      {valueText ?? (value ?? 0).toLocaleString()}
    </p>
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="block text-xs font-semibold text-slate-600 mb-1">{label}</span>
    {children}
  </label>
);
