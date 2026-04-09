import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Copy, Check, Loader2, Gift, TrendingUp, Users, Sparkles,
  Twitter, Mail, MessageCircle, Share2, AlertCircle,
} from 'lucide-react';
import { api as apiClient } from '../../services/apiClient';
import { useAuth } from '../../hooks/useAuth';
import {
  getStoredReferralCode,
  clearStoredReferralCode,
} from '../../utils/referralCapture';

// ─────────────────────────────────────────────────────────────
// ReferralPage — high-conversion user referral dashboard
//
// The referral program is the built-in viral loop. Every user gets a
// unique code, and both the referrer and the new signup get bonus
// Ink when a qualifying action happens (currently: signup).
//
// Design goals (high-conversion checklist):
//  1. ABOVE-THE-FOLD reward clarity — "You get X. They get Y."
//     in big numbers, immediately.
//  2. ONE-CLICK copy. Plus ready-made share buttons for Twitter,
//     WhatsApp, Email so the user never has to think.
//  3. REAL-TIME stats so the loop feels alive.
//  4. Social proof via a recent-referrals list.
// ─────────────────────────────────────────────────────────────

interface Redemption {
  _id: string;
  status: 'pending' | 'qualified' | 'voided';
  createdAt: string;
  qualifiedAt?: string;
  referrerInkReward?: number;
  referredInkReward?: number;
}

interface MyStats {
  code: string;
  totalClicks: number;
  totalSignups: number;
  totalQualified: number;
  totalRewardInk: number;
  recent: Redemption[];
  rewards: {
    referrer: number;
    referred: number;
    enabled: boolean;
  };
}

const formatDate = (iso: string): string => new Date(iso).toLocaleDateString();

export const ReferralPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [stats, setStats] = useState<MyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selfReferralNotice, setSelfReferralNotice] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Ensure the user has a code (creates on first call), then
      // fetch stats. The mutation is idempotent.
      await apiClient.post('/api/referral/ensure-code');
      const data = await apiClient.get<{ stats: MyStats | null }>('/api/referral/me');
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load referral data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    load();
  }, [authLoading, isAuthenticated, navigate, load]);

  // Self-referral guard: if the logged-in user has their own code
  // stored from a prior ?ref= visit (e.g. they opened their own share
  // link in the same browser), clear it and show a friendly notice.
  // Server-side attachOnSignupInternal blocks self-referral anyway,
  // but clearing here prevents the stale code from silently travelling
  // to a future logout/signup flow on this device.
  useEffect(() => {
    if (!stats?.code) return;
    const stored = getStoredReferralCode();
    if (stored && stored === stats.code) {
      clearStoredReferralCode();
      setSelfReferralNotice(true);
    }
  }, [stats?.code]);

  const referralUrl = useMemo(
    () => (stats ? `${window.location.origin}/?ref=${stats.code}` : ''),
    [stats],
  );

  const copyLink = async () => {
    if (!referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Some browsers block clipboard without a user gesture fallback;
      // give them the URL in a prompt as a last resort.
      window.prompt('Copy this link:', referralUrl);
    }
  };

  const shareText = stats
    ? `I'm using Papera for planning & journaling — it's actually good. Grab ${stats.rewards.referred} free Ink with my link:`
    : '';

  const shareTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(referralUrl)}`;
    window.open(url, '_blank');
  };
  const shareWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${referralUrl}`)}`;
    window.open(url, '_blank');
  };
  const shareEmail = () => {
    const subject = 'Check out Papera';
    const body = `${shareText}\n\n${referralUrl}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };
  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Papera', text: shareText, url: referralUrl });
      } catch {
        // User cancelled
      }
    } else {
      copyLink();
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex flex-col items-center justify-center gap-3">
        <p className="text-sm text-rose-600">{error ?? 'Referral program not available'}</p>
        <button
          onClick={load}
          className="px-4 py-2 rounded-full bg-indigo-600 text-white text-sm font-semibold"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats.rewards.enabled) {
    return (
      <div className="min-h-screen bg-[#f0f2f5]">
        <Header onBack={() => navigate('/app')} />
        <main className="max-w-3xl mx-auto px-4 py-12 text-center">
          <Gift size={40} className="mx-auto mb-4 text-gray-300" />
          <h2 className="font-serif text-2xl font-bold text-slate-800 mb-2">Referrals paused</h2>
          <p className="text-sm text-gray-500">The referral program is temporarily disabled.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <Header onBack={() => navigate('/app')} />

      <main className="max-w-3xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
            {error}
          </div>
        )}

        {selfReferralNotice && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">That's your own referral link.</p>
              <p className="text-xs mt-0.5 opacity-90">
                You can't refer yourself — share the link with a friend instead. The stored code has been cleared.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelfReferralNotice(false)}
              className="shrink-0 text-amber-700/60 hover:text-amber-900"
              aria-label="Dismiss notice"
            >
              <Check size={14} />
            </button>
          </div>
        )}

        {/* Hero reward card */}
        <section
          className="rounded-3xl p-6 md:p-8 mb-6 text-white shadow-xl relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #db2777 100%)',
          }}
        >
          <div className="relative z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur text-[11px] font-bold uppercase tracking-wider mb-4">
              <Gift size={12} /> Give Ink, get Ink
            </div>
            <h1 className="font-serif text-3xl md:text-4xl font-bold mb-3 leading-tight">
              Invite a friend.<br className="hidden md:inline" /> Both of you get free Ink.
            </h1>
            <div className="flex flex-wrap gap-6 mt-5">
              <div>
                <div className="text-xs uppercase tracking-wider opacity-80">You get</div>
                <div className="font-serif text-4xl font-bold">
                  {stats.rewards.referrer}
                  <span className="text-lg ml-1 opacity-80">Ink</span>
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider opacity-80">They get</div>
                <div className="font-serif text-4xl font-bold">
                  {stats.rewards.referred}
                  <span className="text-lg ml-1 opacity-80">Ink</span>
                </div>
              </div>
            </div>
          </div>
          {/* Decorative blobs */}
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -right-20 bottom-0 w-32 h-32 rounded-full bg-pink-300/30 blur-2xl" />
        </section>

        {/* Referral link + share */}
        <section className="bg-white rounded-3xl border border-black/5 shadow-sm p-6 mb-6">
          <h2 className="font-serif text-lg font-bold text-slate-900 mb-3">Your referral link</h2>
          <div className="flex items-stretch gap-2 mb-4">
            <code className="flex-1 px-4 py-3 rounded-xl bg-slate-50 text-slate-800 text-sm font-mono truncate border border-slate-200">
              {referralUrl}
            </code>
            <button
              onClick={copyLink}
              className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-colors ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>

          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
            Or share directly
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <ShareButton onClick={shareTwitter} icon={<Twitter size={16} />} label="Twitter" />
            <ShareButton onClick={shareWhatsApp} icon={<MessageCircle size={16} />} label="WhatsApp" />
            <ShareButton onClick={shareEmail} icon={<Mail size={16} />} label="Email" />
            <ShareButton onClick={shareNative} icon={<Share2 size={16} />} label="More…" />
          </div>
        </section>

        {/* Stats grid */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatTile icon={<Users size={16} />} label="Clicks" value={stats.totalClicks} />
          <StatTile icon={<TrendingUp size={16} />} label="Signups" value={stats.totalSignups} />
          <StatTile icon={<Check size={16} />} label="Qualified" value={stats.totalQualified} />
          <StatTile
            icon={<Sparkles size={16} />}
            label="Ink earned"
            value={stats.totalRewardInk}
            highlight
          />
        </section>

        {/* Recent referrals */}
        <section className="bg-white rounded-3xl border border-black/5 shadow-sm p-6">
          <h2 className="font-serif text-lg font-bold text-slate-900 mb-1">Your recent referrals</h2>
          <p className="text-xs text-gray-500 mb-4">
            Friends you've invited. They get their bonus Ink as soon as they sign up.
          </p>
          {stats.recent.length === 0 ? (
            <div className="py-8 text-center">
              <Gift size={32} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-500">No referrals yet.</p>
              <p className="text-xs text-gray-400 mt-1">Share your link to start earning.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {stats.recent.map((r) => (
                <li
                  key={r._id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Friend joined {formatDate(r.createdAt)}
                    </p>
                    {r.qualifiedAt && (
                      <p className="text-[11px] text-emerald-700">
                        Qualified · +{r.referrerInkReward ?? stats.rewards.referrer} Ink earned
                      </p>
                    )}
                  </div>
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
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
};

const Header: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-black/5">
    <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
      <button
        onClick={onBack}
        className="p-2 -ml-2 rounded-full hover:bg-black/5 transition-colors"
        aria-label="Back to notebooks"
      >
        <ArrowLeft size={20} />
      </button>
      <div className="flex-1">
        <h1 className="font-serif text-xl font-bold leading-tight">Refer a friend</h1>
        <p className="text-xs text-gray-500">Give Ink, get Ink. Real peer-to-peer rewards.</p>
      </div>
    </div>
  </div>
);

const ShareButton: React.FC<{
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}> = ({ onClick, icon, label }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-100 transition-colors"
  >
    {icon}
    {label}
  </button>
);

const StatTile: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
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
      className={`font-serif text-2xl font-bold tabular-nums ${
        highlight ? 'text-emerald-700' : 'text-slate-900'
      }`}
    >
      {value.toLocaleString()}
    </p>
  </div>
);
