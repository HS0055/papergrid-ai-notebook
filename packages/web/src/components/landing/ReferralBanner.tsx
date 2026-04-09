import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gift, X, ArrowRight } from 'lucide-react';
import {
  getStoredReferralCode,
  lookupReferralReward,
} from '../../utils/referralCapture';

// ─────────────────────────────────────────────────────────────
// ReferralBanner
//
// Bottom-right floating invitation card. Appears when a visitor lands
// on the site with a valid ?ref=CODE in the URL (the capture helper
// has already persisted the code to localStorage by the time this
// renders). Looks up the reward amount against the backend and shows
// a premium "You're invited → claim X Ink" card with a clear CTA
// that routes to the signup flow.
//
// Why floating instead of a top strip:
//   - NavBar is `position: fixed` — a top strip either overlaps it
//     or fights it for layout.
//   - A bottom-right card is the Linear/Vercel/modern pattern: out
//     of the main reading path, unmissable, and dismissible without
//     shifting page content.
//   - Mobile-responsive: collapses to a full-width sticky bar at the
//     bottom on small screens.
//
// Dismissal state persists in sessionStorage so it doesn't nag the
// visitor within a session but reappears on a fresh visit.
// ─────────────────────────────────────────────────────────────

const DISMISS_KEY = 'papergrid_referral_banner_dismissed';

interface Rewards {
  referrer: number;
  referred: number;
}

export const ReferralBanner: React.FC = () => {
  const navigate = useNavigate();
  const [rewards, setRewards] = useState<Rewards | null>(null);
  const [mounted, setMounted] = useState(false);
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
      if (r) {
        setRewards(r);
        // Small delay before showing so the slide-in animation
        // feels intentional, not jarring on first paint.
        setTimeout(() => setMounted(true), 600);
      }
    };

    void tryLoad();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDismiss = () => {
    setMounted(false);
    setTimeout(() => {
      setDismissed(true);
      try {
        sessionStorage.setItem(DISMISS_KEY, '1');
      } catch {
        // ignore
      }
    }, 200);
  };

  const handleClaim = () => {
    navigate('/login');
  };

  const handleLearnMore = () => {
    navigate('/referral');
  };

  if (!rewards || dismissed) return null;

  return (
    <div
      className={`fixed z-40 transition-all duration-500 ease-out ${
        mounted
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4 pointer-events-none'
      }
        bottom-4 left-4 right-4
        sm:left-auto sm:right-6 sm:bottom-6 sm:w-[360px]`}
      role="complementary"
      aria-label="Referral invitation"
    >
      <div
        className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10"
        style={{
          background:
            'linear-gradient(135deg, rgba(79,70,229,0.98) 0%, rgba(124,58,237,0.98) 55%, rgba(219,39,119,0.98) 100%)',
          backdropFilter: 'blur(16px)',
        }}
      >
        {/* Decorative blobs */}
        <div
          className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/15 blur-2xl pointer-events-none"
          aria-hidden
        />
        <div
          className="absolute -left-6 -bottom-8 w-28 h-28 rounded-full bg-pink-300/20 blur-2xl pointer-events-none"
          aria-hidden
        />

        <div className="relative p-5 text-white">
          {/* Dismiss */}
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1 rounded-full text-white/70 hover:text-white hover:bg-white/15 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label="Dismiss invitation"
          >
            <X size={14} />
          </button>

          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur text-[10px] font-bold uppercase tracking-wider mb-3">
            <Gift size={11} />
            You're invited
          </div>

          {/* Headline */}
          <h3 className="font-serif text-[20px] leading-tight font-bold mb-1.5 pr-6">
            A friend sent you {rewards.referred} free Ink
          </h3>
          <p className="text-xs text-white/80 leading-relaxed mb-4">
            Enough for a handful of AI-generated notebook layouts. Claim it when you sign up — no card needed.
          </p>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClaim}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white text-indigo-700 text-sm font-bold hover:bg-white/95 active:bg-white/85 transition-colors focus:outline-none focus:ring-2 focus:ring-white/80"
            >
              Claim {rewards.referred} Ink
              <ArrowRight size={14} />
            </button>
            <button
              type="button"
              onClick={handleLearnMore}
              className="px-3 py-2.5 rounded-xl text-xs font-semibold text-white/80 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
