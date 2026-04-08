import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Copy, Check, Loader2, DollarSign, MousePointerClick,
  TrendingUp, Wallet, Link as LinkIcon,
} from 'lucide-react';
import { api as apiClient } from '../../services/apiClient';
import { useAuth } from '../../hooks/useAuth';

// ─────────────────────────────────────────────────────────────
// AffiliatePage — MVP dashboard + application form
//
// Shows the current user's affiliate status, lifetime stats, referral
// link, and a payout request button. If the user is not yet an
// affiliate they see the application form instead.
// ─────────────────────────────────────────────────────────────

interface AffiliateRow {
  _id: string;
  userId: string;
  code: string;
  status: 'pending' | 'approved' | 'rejected' | 'banned';
  commissionRate: number;
  cookieWindowDays: number;
  totalClicks: number;
  totalConversions: number;
  totalEarnedCents: number;
  totalPaidCents: number;
  payoutMethod?: 'paypal' | 'stripe' | 'bank';
  payoutEmail?: string;
  payoutCountry?: string;
  appliedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

interface StatsResponse {
  stats: {
    affiliate: AffiliateRow;
    pendingPayoutCents: number;
    approvedConversions: number;
  } | null;
}

const formatMoney = (cents: number): string =>
  `$${(cents / 100).toFixed(2)}`;

export const AffiliatePage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatsResponse['stats']>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [payoutMsg, setPayoutMsg] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<StatsResponse>('/api/affiliate/me');
      setStats(data.stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load affiliate data');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
      return;
    }
    loadStats();
  }, [authLoading, isAuthenticated, navigate, loadStats]);

  const affiliate = stats?.affiliate ?? null;
  const referralUrl = affiliate
    ? `${window.location.origin}/?ref=${affiliate.code}`
    : '';

  const copyLink = async () => {
    if (!referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const requestPayout = async () => {
    setRequestingPayout(true);
    setPayoutMsg(null);
    try {
      await apiClient.post('/api/affiliate/payout-request');
      setPayoutMsg('Payout requested. We will notify you when it clears.');
      await loadStats();
    } catch (e) {
      setPayoutMsg(e instanceof Error ? e.message : 'Payout request failed');
    } finally {
      setRequestingPayout(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-black/5">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/app')}
            className="p-2 -ml-2 rounded-full hover:bg-black/5 transition-colors"
            aria-label="Back to notebooks"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="font-serif text-xl font-bold leading-tight">Affiliate Program</h1>
            <p className="text-xs text-gray-500">Earn 30% recurring commission on every referral.</p>
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
            {error}
          </div>
        )}

        {!affiliate && <ApplyForm onApplied={loadStats} />}

        {affiliate && affiliate.status === 'pending' && (
          <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200">
            <h2 className="font-serif text-lg font-bold text-amber-900 mb-1">Application received</h2>
            <p className="text-sm text-amber-800">
              Your affiliate application is under review. We usually respond within 2 business days.
            </p>
          </div>
        )}

        {affiliate && affiliate.status === 'rejected' && (
          <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200">
            <h2 className="font-serif text-lg font-bold text-rose-900 mb-1">Application declined</h2>
            {affiliate.rejectionReason && (
              <p className="text-sm text-rose-800">{affiliate.rejectionReason}</p>
            )}
          </div>
        )}

        {affiliate && affiliate.status === 'banned' && (
          <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200">
            <h2 className="font-serif text-lg font-bold text-rose-900">Account suspended</h2>
            <p className="text-sm text-rose-800">Contact support for details.</p>
          </div>
        )}

        {affiliate && affiliate.status === 'approved' && stats && (
          <>
            {/* Referral link */}
            <div className="p-5 rounded-2xl bg-white border border-black/5 shadow-sm mb-4">
              <div className="flex items-center gap-2 mb-2 text-gray-500">
                <LinkIcon size={14} />
                <span className="text-xs font-semibold uppercase tracking-wider">Your referral link</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2.5 rounded-lg bg-slate-50 text-slate-800 text-sm font-mono truncate">
                  {referralUrl}
                </code>
                <button
                  onClick={copyLink}
                  className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Commission: {(affiliate.commissionRate * 100).toFixed(0)}% ·
                Cookie window: {affiliate.cookieWindowDays} days
              </p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <StatCard
                icon={<MousePointerClick size={16} />}
                label="Clicks"
                value={affiliate.totalClicks.toLocaleString()}
              />
              <StatCard
                icon={<TrendingUp size={16} />}
                label="Conversions"
                value={affiliate.totalConversions.toLocaleString()}
              />
              <StatCard
                icon={<DollarSign size={16} />}
                label="Lifetime earned"
                value={formatMoney(affiliate.totalEarnedCents)}
              />
              <StatCard
                icon={<Wallet size={16} />}
                label="Pending payout"
                value={formatMoney(stats.pendingPayoutCents)}
                highlight
              />
            </div>

            {/* Payout request */}
            <div className="p-5 rounded-2xl bg-white border border-black/5 shadow-sm">
              <h2 className="font-serif text-lg font-bold mb-1">Request a payout</h2>
              <p className="text-sm text-gray-600 mb-3">
                Approved earnings are paid out on request once they reach the $50 minimum.
                Payments go to your configured method: <strong>{affiliate.payoutMethod ?? 'not set'}</strong>
                {affiliate.payoutEmail && ` (${affiliate.payoutEmail})`}.
              </p>
              <button
                onClick={requestPayout}
                disabled={
                  requestingPayout ||
                  stats.pendingPayoutCents < 5000 ||
                  !affiliate.payoutMethod ||
                  !affiliate.payoutEmail
                }
                className="px-4 py-2 rounded-full bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {requestingPayout
                  ? 'Requesting…'
                  : stats.pendingPayoutCents < 5000
                    ? `$${((5000 - stats.pendingPayoutCents) / 100).toFixed(2)} more to minimum`
                    : `Request ${formatMoney(stats.pendingPayoutCents)} payout`}
              </button>
              {payoutMsg && (
                <p
                  className={`mt-3 text-sm ${
                    payoutMsg.startsWith('Payout requested')
                      ? 'text-emerald-700'
                      : 'text-rose-700'
                  }`}
                >
                  {payoutMsg}
                </p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}> = ({ icon, label, value, highlight }) => (
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
      className={`font-serif text-2xl font-bold ${
        highlight ? 'text-emerald-700' : 'text-slate-900'
      }`}
    >
      {value}
    </p>
  </div>
);

// ────────── ApplyForm ──────────
interface ApplyFormProps {
  onApplied: () => void;
}

const ApplyForm: React.FC<ApplyFormProps> = ({ onApplied }) => {
  const [note, setNote] = useState('');
  const [audience, setAudience] = useState('');
  const [website, setWebsite] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<'paypal' | 'stripe' | 'bank'>('paypal');
  const [payoutEmail, setPayoutEmail] = useState('');
  const [payoutCountry, setPayoutCountry] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!payoutEmail.trim()) {
      setErr('Payout email is required');
      return;
    }
    if (!payoutCountry.trim()) {
      setErr('Country is required (tax compliance)');
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      await apiClient.post('/api/affiliate/apply', {
        applicationNote: note || undefined,
        audience: audience || undefined,
        websiteUrl: website || undefined,
        payoutMethod,
        payoutEmail: payoutEmail.trim(),
        payoutCountry: payoutCountry.trim(),
      });
      onApplied();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to submit application');
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-white border border-black/5 shadow-sm">
      <h2 className="font-serif text-xl font-bold mb-1">Apply to become an affiliate</h2>
      <p className="text-sm text-gray-600 mb-5">
        Get a unique referral link and earn 30% recurring commission on every paid customer
        you send our way. Applications are typically reviewed within 2 business days.
      </p>

      <div className="space-y-3">
        <Field label="Tell us about your audience">
          <textarea
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="Who will you promote PaperGrid to? Journaling community, productivity YouTubers, students, etc."
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-black/10 focus:outline-none focus:border-indigo-500 text-sm resize-y"
          />
        </Field>
        <Field label="Website or main channel (optional)">
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://…"
            className="w-full px-3 py-2 rounded-lg border border-black/10 focus:outline-none focus:border-indigo-500 text-sm"
          />
        </Field>
        <Field label="Anything else we should know?">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-black/10 focus:outline-none focus:border-indigo-500 text-sm resize-y"
          />
        </Field>

        <div className="pt-2 mt-2 border-t border-black/5">
          <h3 className="font-semibold text-sm text-slate-900 mb-3">Payout details</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Method">
              <select
                value={payoutMethod}
                onChange={(e) => setPayoutMethod(e.target.value as 'paypal' | 'stripe' | 'bank')}
                className="w-full px-3 py-2 rounded-lg border border-black/10 focus:outline-none focus:border-indigo-500 text-sm bg-white"
              >
                <option value="paypal">PayPal</option>
                <option value="stripe">Stripe Connect</option>
                <option value="bank">Bank transfer</option>
              </select>
            </Field>
            <Field label="Country">
              <input
                type="text"
                value={payoutCountry}
                onChange={(e) => setPayoutCountry(e.target.value)}
                placeholder="e.g. US, DE, AM"
                maxLength={2}
                className="w-full px-3 py-2 rounded-lg border border-black/10 focus:outline-none focus:border-indigo-500 text-sm uppercase"
              />
            </Field>
          </div>
          <Field label={payoutMethod === 'bank' ? 'Payout email (we will follow up for bank details)' : 'Payout email'}>
            <input
              type="email"
              value={payoutEmail}
              onChange={(e) => setPayoutEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2 rounded-lg border border-black/10 focus:outline-none focus:border-indigo-500 text-sm"
            />
          </Field>
        </div>

        {err && (
          <div className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {err}
          </div>
        )}
        <button
          onClick={submit}
          disabled={submitting}
          className="w-full mt-2 py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-wait transition-colors"
        >
          {submitting ? 'Submitting…' : 'Submit application'}
        </button>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="block text-xs font-semibold text-slate-600 mb-1">{label}</span>
    {children}
  </label>
);
