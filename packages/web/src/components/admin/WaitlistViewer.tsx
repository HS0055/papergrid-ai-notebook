import React, { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw, CheckCircle2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';
const SESSION_KEY = 'papergrid_session';

interface WaitlistRow {
  _id: string;
  email: string;
  source?: string;
  referrer?: string;
  createdAt: string;
  redeemedAt?: string;
  convertedUserId?: string;
}

function authHeaders(): Record<string, string> {
  // Session is stored as a raw string by useAuth.tsx. The previous
  // JSON.parse path silently dropped the token and the Waitlist admin
  // tab always hit the server unauthenticated.
  const token = localStorage.getItem(SESSION_KEY);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/**
 * WaitlistViewer — iOS launch waitlist admin surface.
 *
 *  - Lists the 200 most recent signups (newest first).
 *  - Shows per-row redemption state (has the user signed up yet and
 *    claimed their 25 Ink launch bonus?).
 *  - CSV export for importing into Resend / Mailchimp.
 *  - "Backfill Ink" one-shot button to grant initial Ink to legacy users
 *    whose inkSubscription was never initialized (pre-fix accounts).
 */
export const WaitlistViewer: React.FC = () => {
  const [rows, setRows] = useState<WaitlistRow[]>([]);
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backfillState, setBackfillState] = useState<'idle' | 'running' | 'done'>('idle');
  const [backfillResult, setBackfillResult] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/waitlist?limit=200`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setRows(data.items ?? []);
      setCount(data.count ?? (data.items?.length ?? 0));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load waitlist');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const exportCsv = () => {
    const header = ['email', 'source', 'createdAt', 'redeemedAt'];
    const lines = [header.join(',')];
    for (const row of rows) {
      lines.push([
        row.email,
        row.source ?? '',
        row.createdAt,
        row.redeemedAt ?? '',
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `papera-waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const runBackfill = async () => {
    if (!confirm('Backfill Ink balances for all users with undefined inkSubscription?\n\nThis is idempotent — users who already have ink will be skipped.')) {
      return;
    }
    setBackfillState('running');
    setBackfillResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/backfill-ink`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setBackfillResult(`Backfilled ${data.updated} of ${data.total} users.`);
      setBackfillState('done');
    } catch (e: unknown) {
      setBackfillResult(e instanceof Error ? e.message : 'Backfill failed');
      setBackfillState('idle');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header + actions */}
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">iOS Launch Waitlist</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {count} total signup{count === 1 ? '' : 's'}. Each promised <strong>25 Ink</strong> on launch day + 20% lifetime Pro discount.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void fetchList()}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button
              onClick={exportCsv}
              disabled={rows.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>

        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">
            {error}
          </div>
        )}
      </div>

      {/* Ink backfill card */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="font-semibold text-amber-900">Backfill Ink (legacy users)</p>
            <p className="text-amber-800 text-xs mt-1 max-w-xl">
              Grants initial monthly Ink to users whose <code className="bg-amber-100 px-1 rounded">inkSubscription</code> field was never initialized (accounts created before the signup fix). Idempotent — safe to re-run.
            </p>
            {backfillResult && (
              <p className="text-xs text-amber-900 mt-2 font-medium">{backfillResult}</p>
            )}
          </div>
          <button
            onClick={runBackfill}
            disabled={backfillState === 'running'}
            className="shrink-0 px-3 py-2 text-xs font-bold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            {backfillState === 'running' ? 'Running…' : backfillState === 'done' ? 'Run Again' : 'Run Backfill'}
          </button>
        </div>
      </div>

      {/* Rows table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {loading && rows.length === 0 ? (
          <div className="px-5 py-6 text-sm text-gray-500">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-6 text-sm text-gray-500">No signups yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5">Source</th>
                  <th className="px-4 py-2.5">Joined</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-900">{row.email}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{row.source ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{formatDate(row.createdAt)}</td>
                    <td className="px-4 py-2.5 text-xs">
                      {row.redeemedAt ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                          <CheckCircle2 size={12} /> Claimed
                        </span>
                      ) : (
                        <span className="text-gray-400">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
