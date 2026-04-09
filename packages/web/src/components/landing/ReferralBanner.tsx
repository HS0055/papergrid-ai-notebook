import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gift, X, ArrowRight } from 'lucide-react';
import {
  getCurrentVisitReferralCode,
  lookupReferralReward,
} from '../../utils/referralCapture';
import { useAuth } from '../../hooks/useAuth';

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

const DISMISS_KEY_PREFIX = 'papergrid_referral_banner_dismissed:';

interface Rewards {
  referrer: number;
  referred: number;
}

export const ReferralBanner: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const [rewards, setRewards] = useState<Rewards | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isAuthenticated) return;

    // The capture helper is async and may still be validating/storing
    // the code when the landing page first mounts. Retry a couple of
    // times over ~1.5s so we don't miss the first paint.
    let cancelled = false;
    let attempts = 0;

    const tryLoad = async () => {
      if (cancelled) return;
      const code = getCurrentVisitReferralCode();
      if (!code) {
        attempts++;
        if (attempts < 4) {
          setTimeout(tryLoad, 400);
        }
        return;
      }
      setReferralCode(code);
      try {
        setDismissed(sessionStorage.getItem(`${DISMISS_KEY_PREFIX}${code}`) === '1');
      } catch {
        setDismissed(false);
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
  }, [isAuthenticated]);

  const handleDismiss = () => {
    setMounted(false);
    setTimeout(() => {
      setDismissed(true);
      try {
        if (referralCode) {
          sessionStorage.setItem(`${DISMISS_KEY_PREFIX}${referralCode}`, '1');
        }
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

  if (isLoading || isAuthenticated || !rewards || dismissed) return null;

  return (
    <div
      className={`fixed z-40 transition-all duration-500 ease-out ${
        mounted
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4 pointer-events-none'
      }
        left-4 right-4
        sm:left-auto sm:right-6 sm:w-[360px]`}
      style={{
        zIndex: 60,
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)',
      }}
      role="complementary"
      aria-label="Referral invitation"
    >
      <div
        className="relative overflow-hidden rounded-[22px] border border-white/10 shadow-2xl"
        style={{
          background:
            'linear-gradient(135deg, rgba(79,70,229,0.98) 0%, rgba(124,58,237,0.98) 55%, rgba(219,39,119,0.98) 100%)',
          backdropFilter: 'blur(16px)',
        }}
      >
        {/* Decorative blobs */}
        <div
          className="pointer-events-none absolute -right-8 -top-8 hidden h-32 w-32 rounded-full bg-white/15 blur-2xl sm:block"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-6 -bottom-8 hidden h-28 w-28 rounded-full bg-pink-300/20 blur-2xl sm:block"
          aria-hidden
        />

        <div className="relative p-4 text-white sm:p-5">
          {/* Dismiss */}
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute right-3 top-3 rounded-full p-1 text-white/70 transition-colors hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label="Dismiss invitation"
          >
            <X size={14} />
          </button>

          <div className="sm:hidden">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/14 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] backdrop-blur">
              <Gift size={11} />
              Invited
            </div>
            <h3 className="pr-7 font-serif text-[17px] font-bold leading-[1.05]">
              Get {rewards.referred} free Ink
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-white/78">
              Claim it when you sign up.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleClaim}
                className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-bold text-indigo-700 transition-colors hover:bg-white/95 active:bg-white/85 focus:outline-none focus:ring-2 focus:ring-white/80"
              >
                Claim
                <ArrowRight size={14} />
              </button>
              <button
                type="button"
                onClick={handleLearnMore}
                className="inline-flex min-h-10 items-center justify-center rounded-xl px-3 text-[11px] font-semibold text-white/78 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                Details
              </button>
            </div>
          </div>

          <div className="hidden sm:block">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur">
              <Gift size={11} />
              You're invited
            </div>

            <h3 className="mb-1.5 pr-6 font-serif text-[20px] font-bold leading-tight">
              A friend sent you {rewards.referred} free Ink
            </h3>
            <p className="mb-4 text-xs leading-relaxed text-white/80">
              Enough for a handful of AI-generated notebook layouts. Claim it when you sign up — no card needed.
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClaim}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-indigo-700 transition-colors hover:bg-white/95 active:bg-white/85 focus:outline-none focus:ring-2 focus:ring-white/80"
              >
                Claim {rewards.referred} Ink
                <ArrowRight size={14} />
              </button>
              <button
                type="button"
                onClick={handleLearnMore}
                className="rounded-xl px-3 py-2.5 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                Details
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
