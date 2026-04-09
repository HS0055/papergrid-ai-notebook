import React, { useEffect, useState } from 'react';
import { Gift, X } from 'lucide-react';
import {
  getStoredReferralCode,
  lookupReferralReward,
} from '../../utils/referralCapture';

// ─────────────────────────────────────────────────────────────
// ReferralBanner
//
// When a visitor lands with ?ref=CODE, the capture helper has already
// persisted the code to localStorage and cleaned the URL. This banner
// reads the stored code, looks up the reward amount against the
// backend, and renders a high-contrast "You were invited → claim X
// Ink" bar above the hero.
//
// The biggest conversion lever in a referral program is making the
// reward obvious BEFORE the visitor scrolls to the CTA. Without this
// banner, an invited visitor sees the exact same landing page as an
// organic visitor — which is a huge waste of the friend's recommendation.
//
// Dismissal state persists in sessionStorage so a user who closes the
// banner doesn't see it again in the same tab, but re-opens it on a
// fresh visit.
// ─────────────────────────────────────────────────────────────

const DISMISS_KEY = 'papergrid_referral_banner_dismissed';

interface Rewards {
  referrer: number;
  referred: number;
}

export const ReferralBanner: React.FC = () => {
  const [rewards, setRewards] = useState<Rewards | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    // The capture helper is async and may still be validating/storing
    // the code when the landing page first mounts. Retry a couple of
    // times over ~1.5s so we don't miss the first paint.
    let cancelled = false;
    let attempts = 0;

    const tryLoad = async () => {
      if (cancelled) return;
      const code = getStoredReferralCode();
      if (!code) {
        attempts++;
        if (attempts < 4) {
          setTimeout(tryLoad, 400);
        }
        return;
      }
      const r = await lookupReferralReward(code);
      if (cancelled) return;
      if (r) setRewards(r);
    };

    void tryLoad();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
  };

  if (!rewards || dismissed) return null;

  return (
    <div
      className="relative z-30 w-full text-white shadow-lg"
      style={{
        background:
          'linear-gradient(90deg, #4f46e5 0%, #7c3aed 50%, #db2777 100%)',
      }}
      role="banner"
      aria-label="Referral bonus"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3">
        <div className="shrink-0 w-8 h-8 rounded-full bg-white/15 backdrop-blur flex items-center justify-center">
          <Gift size={16} className="text-white" />
        </div>
        <div className="flex-1 min-w-0 text-sm">
          <span className="font-bold">You were invited to Papera.</span>{' '}
          <span className="opacity-90">
            Sign up and claim{' '}
            <span className="font-bold">{rewards.referred} free Ink</span> —
            enough for a handful of AI-generated layouts, on us.
          </span>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 p-1.5 rounded-full hover:bg-white/15 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
          aria-label="Dismiss banner"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
