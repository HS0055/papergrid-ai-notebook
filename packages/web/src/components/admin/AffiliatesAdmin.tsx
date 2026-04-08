import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2, CheckCircle2, XCircle, Ban, RefreshCw, DollarSign, ExternalLink,
  TrendingUp, MousePointerClick, Wallet,
} from 'lucide-react';
import { api as apiClient } from '../../services/apiClient';

// ─────────────────────────────────────────────────────────────
// AffiliatesAdmin — admin panel tab for managing affiliates + payouts
//
// Wires the existing api.affiliates.admin* functions through the
// /api/affiliate/* HTTP routes:
//   GET  /api/admin/affiliates           → list
//   POST /api/admin/affiliates/approve   → approve
//   POST /api/admin/affiliates/reject    → reject
//   POST /api/admin/affiliates/ban       → ban
//   POST /api/admin/affiliates/set-rate  → adjust commission rate
//   GET  /api/admin/affiliates/payouts   → list payouts
//   POST /api/admin/affiliates/mark-paid → mark a payout paid
//   POST /api/admin/affiliates/mark-failed → mark failed
// ─────────────────────────────────────────────────────────────

type AffiliateStatus = 'pending' | 'approved' | 'rejected' | 'banned';
type PayoutStatus = 'requested' | 'processing' | 'paid' | 'failed';

interface Affiliate {
  _id: string;
  userId: string;
  code: string;
  status: AffiliateStatus;
  commissionRate: number;
  cookieWindowDays: number;
  totalClicks: number;
  totalConversions: number;
  totalEarnedCents: number;
  totalPaidCents: number;
  payoutMethod?: 'paypal' | 'stripe' | 'bank';
  payoutEmail?: string;
  payoutCountry?: string;
  applicationNote?: string;
  audience?: string;
  websiteUrl?: string;
  appliedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  bannedAt?: string;
  banReason?: string;
  userEmail?: string;
  userName?: string;
}

interface Payout {
  _id: string;
  affiliateId: string;
  amountCents: number;
  currency: string;
  method: string;
  status: PayoutStatus;
  reference?: string;
  note?: string;
  requestedAt: string;
  paidAt?: string;
  affiliateCode?: string;
  userEmail?: string;
}

const formatMoney = (cents: number): string => `$${(cents / 100).toFixed(2)}`;
const formatDate = (iso: string): string => new Date(iso).toLocaleDateString();

const STATUS_COLORS: Record<AffiliateStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-100 text-rose-700 border-rose-200',
  banned: 'bg-gray-100 text-gray-700 border-gray-300',
};

const PAYOUT_COLORS: Record<PayoutStatus, string> = {
  requested: 'bg-amber-100 text-amber-700 border-amber-200',
  processing: 'bg-sky-100 text-sky-700 border-sky-200',
  paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  failed: 'bg-rose-100 text-rose-700 border-rose-200',
};

type View = 'applications' | 'active' | 'payouts';

export const AffiliatesAdmin: React.FC = () => {
  const [view, setView] = useState<View>('applications');

  return (
    <div>
      {/* View switcher */}
      <div className="flex gap-2 mb-6">
        {(
          [
            { id: 'applications', label: 'Applications' },
            { id: 'active', label: 'Active affiliates' },
            { id: 'payouts', label: 'Payouts' },
          ] as Array<{ id: View; label: string }>
        ).map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              view === v.id
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-black/5 hover:bg-slate-50'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === 'applications' && <AffiliateList status="pending" />}
      {view === 'active' && <AffiliateList status="approved" />}
      {view === 'payouts' && <PayoutList />}
    </div>
  );
};

// ────────── AffiliateList ──────────
const AffiliateList: React.FC<{ status: AffiliateStatus }> = ({ status }) => {
  const [rows, setRows] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await apiClient.get<{ affiliates: Affiliate[] }>(
        `/api/admin/affiliates?status=${status}&limit=200`,
      );
      setRows(data.affiliates);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load affiliates');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (affiliateId: string) => {
    setActing(affiliateId);
    try {
      await apiClient.post('/api/admin/affiliates/approve', { affiliateId });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to approve');
    } finally {
      setActing(null);
    }
  };

  const reject = async (affiliateId: string) => {
    const reason = prompt('Reason for rejection (optional):') ?? undefined;
    setActing(affiliateId);
    try {
      await apiClient.post('/api/admin/affiliates/reject', { affiliateId, reason });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to reject');
    } finally {
      setActing(null);
    }
  };

  const ban = async (affiliateId: string) => {
    const reason = prompt('Reason for ban:');
    if (!reason) return;
    if (!confirm('Confirm ban? Pending conversions will be voided.')) return;
    setActing(affiliateId);
    try {
      await apiClient.post('/api/admin/affiliates/ban', { affiliateId, reason });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to ban');
    } finally {
      setActing(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-lg font-bold text-slate-900">
          {status === 'pending'
            ? `${rows.length} pending application${rows.length === 1 ? '' : 's'}`
            : `${rows.length} active affiliate${rows.length === 1 ? '' : 's'}`}
        </h2>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-600 hover:bg-slate-100"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {err && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
          {err}
        </div>
      )}
      {loading && (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      )}
      {!loading && rows.length === 0 && (
        <p className="text-center text-gray-500 py-12">
          {status === 'pending' ? 'No pending applications.' : 'No active affiliates yet.'}
        </p>
      )}
      <ul className="space-y-3">
        {rows.map((aff) => {
          const isOpen = expanded === aff._id;
          return (
            <li key={aff._id} className="bg-white rounded-2xl border border-black/5 shadow-sm">
              <div
                className="p-4 cursor-pointer"
                onClick={() => setExpanded(isOpen ? null : aff._id)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-slate-900 truncate">
                        {aff.userName || aff.userEmail || 'Unknown'}
                      </p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${STATUS_COLORS[aff.status]}`}>
                        {aff.status}
                      </span>
                      {aff.status === 'approved' && (
                        <code className="text-[11px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                          {aff.code}
                        </code>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {aff.userEmail} · applied {formatDate(aff.appliedAt)}
                    </p>
                  </div>
                  {aff.status === 'approved' && (
                    <div className="hidden md:flex items-center gap-4 text-xs text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        <MousePointerClick size={12} /> {aff.totalClicks}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <TrendingUp size={12} /> {aff.totalConversions}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <DollarSign size={12} /> {formatMoney(aff.totalEarnedCents)}
                      </span>
                    </div>
                  )}
                </div>
                {isOpen && (
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-sm">
                    {aff.audience && (
                      <div>
                        <span className="font-semibold text-slate-600">Audience:</span>{' '}
                        <span className="text-slate-700">{aff.audience}</span>
                      </div>
                    )}
                    {aff.applicationNote && (
                      <div>
                        <span className="font-semibold text-slate-600">Note:</span>{' '}
                        <span className="text-slate-700 whitespace-pre-wrap">{aff.applicationNote}</span>
                      </div>
                    )}
                    {aff.websiteUrl && (
                      <div>
                        <span className="font-semibold text-slate-600">Website:</span>{' '}
                        <a href={aff.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline inline-flex items-center gap-1">
                          {aff.websiteUrl} <ExternalLink size={12} />
                        </a>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <div>
                        <span className="font-semibold text-slate-600">Commission:</span>{' '}
                        <span>{(aff.commissionRate * 100).toFixed(0)}%</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-600">Cookie:</span>{' '}
                        <span>{aff.cookieWindowDays}d</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-600">Payout:</span>{' '}
                        <span>{aff.payoutMethod ?? 'not set'}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-600">Country:</span>{' '}
                        <span>{aff.payoutCountry ?? '—'}</span>
                      </div>
                    </div>
                    {aff.rejectionReason && (
                      <div className="mt-2 p-2 rounded bg-rose-50 border border-rose-200 text-xs text-rose-700">
                        <strong>Rejected:</strong> {aff.rejectionReason}
                      </div>
                    )}
                    {aff.banReason && (
                      <div className="mt-2 p-2 rounded bg-rose-50 border border-rose-200 text-xs text-rose-700">
                        <strong>Banned:</strong> {aff.banReason}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* Actions */}
              <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap gap-2 bg-slate-50/50 rounded-b-2xl">
                {aff.status === 'pending' && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        approve(aff._id);
                      }}
                      disabled={acting === aff._id}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <CheckCircle2 size={12} /> Approve
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        reject(aff._id);
                      }}
                      disabled={acting === aff._id}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-rose-300 text-rose-700 text-xs font-bold hover:bg-rose-50 disabled:opacity-50"
                    >
                      <XCircle size={12} /> Reject
                    </button>
                  </>
                )}
                {aff.status === 'approved' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      ban(aff._id);
                    }}
                    disabled={acting === aff._id}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-rose-300 text-rose-700 text-xs font-bold hover:bg-rose-50 disabled:opacity-50"
                  >
                    <Ban size={12} /> Ban
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

// ────────── PayoutList ──────────
const PayoutList: React.FC = () => {
  const [rows, setRows] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<PayoutStatus | 'all'>('requested');

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const qs = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
      const data = await apiClient.get<{ payouts: Payout[] }>(
        `/api/admin/affiliates/payouts${qs}`,
      );
      setRows(data.payouts);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load payouts');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const markPaid = async (payoutId: string) => {
    const reference = prompt('Payment reference (e.g. PayPal transaction id):');
    if (!reference) return;
    setActing(payoutId);
    try {
      await apiClient.post('/api/admin/affiliates/payout/mark-paid', { payoutId, reference });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to mark paid');
    } finally {
      setActing(null);
    }
  };

  const markFailed = async (payoutId: string) => {
    const reason = prompt('Reason for failure:');
    if (!reason) return;
    setActing(payoutId);
    try {
      await apiClient.post('/api/admin/affiliates/payout/mark-failed', { payoutId, reason });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to mark failed');
    } finally {
      setActing(null);
    }
  };

  const totalPending = useMemo(
    () => rows.filter((r) => r.status === 'requested').reduce((sum, r) => sum + r.amountCents, 0),
    [rows],
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h2 className="font-serif text-lg font-bold text-slate-900">Payouts</h2>
          {totalPending > 0 && (
            <p className="text-xs text-gray-600 mt-0.5">
              {formatMoney(totalPending)} pending across {rows.filter((r) => r.status === 'requested').length} request(s)
            </p>
          )}
        </div>
        <div className="flex gap-1">
          {(['requested', 'processing', 'paid', 'failed', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize transition-colors ${
                statusFilter === s ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {err && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
          {err}
        </div>
      )}
      {loading && (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      )}
      {!loading && rows.length === 0 && (
        <p className="text-center text-gray-500 py-12">No payouts in this bucket.</p>
      )}
      <ul className="space-y-3">
        {rows.map((p) => (
          <li key={p._id} className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Wallet size={18} className="text-emerald-600" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm text-slate-900">
                    {formatMoney(p.amountCents)} {p.currency.toUpperCase()}
                  </p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${PAYOUT_COLORS[p.status]}`}>
                    {p.status}
                  </span>
                  <span className="text-[11px] text-gray-500">via {p.method}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {p.affiliateCode && <code className="bg-slate-100 px-1 py-0.5 rounded">{p.affiliateCode}</code>}
                  {p.userEmail && <> · {p.userEmail}</>}
                  <> · requested {formatDate(p.requestedAt)}</>
                  {p.paidAt && <> · paid {formatDate(p.paidAt)}</>}
                </p>
                {p.reference && (
                  <p className="text-[11px] text-gray-400 mt-1">ref: {p.reference}</p>
                )}
                {p.note && (
                  <p className="text-[11px] text-rose-600 mt-1">{p.note}</p>
                )}
              </div>
              {(p.status === 'requested' || p.status === 'processing') && (
                <div className="flex gap-1.5">
                  <button
                    onClick={() => markPaid(p._id)}
                    disabled={acting === p._id}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CheckCircle2 size={12} /> Mark paid
                  </button>
                  <button
                    onClick={() => markFailed(p._id)}
                    disabled={acting === p._id}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-rose-300 text-rose-700 text-xs font-bold hover:bg-rose-50 disabled:opacity-50"
                  >
                    <XCircle size={12} /> Failed
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
