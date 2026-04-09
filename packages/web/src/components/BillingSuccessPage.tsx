import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Sparkles } from 'lucide-react';

/**
 * BillingSuccessPage — landing page after a successful Stripe checkout.
 *
 * Stripe redirects here as `success_url` from the Convex checkout
 * endpoint: `${PUBLIC_APP_URL}/billing/success?session_id=...`
 *
 * The actual plan upgrade or Ink grant happens server-side via the
 * `checkout.session.completed` webhook (see packages/convex/convex/
 * stripeWebhook.ts) — by the time the user lands here, the webhook has
 * usually already fired. We just show a friendly confirmation and let
 * the user continue into the app.
 *
 * There's a small race where the browser arrives before the webhook
 * has been processed. We handle that by auto-redirecting to /app after
 * 2 seconds, at which point the user's plan reflects the upgrade
 * (because /app re-fetches the user on load).
 */
export const BillingSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [countdown, setCountdown] = useState(3);

  const sessionId = params.get('session_id');

  useEffect(() => {
    if (countdown <= 0) {
      navigate('/app', { replace: true });
      return;
    }
    const t = window.setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [countdown, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 text-white px-4">
      <div className="max-w-md w-full rounded-3xl border border-emerald-500/30 bg-white/[0.04] backdrop-blur-md p-8 md:p-10 text-center shadow-2xl shadow-emerald-500/10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 mb-6">
          <Check size={32} strokeWidth={3} className="text-emerald-400" />
        </div>
        <h1 className="text-3xl font-bold mb-3 bg-gradient-to-r from-white via-emerald-200 to-indigo-200 bg-clip-text text-transparent">
          Payment confirmed!
        </h1>
        <p className="text-white/60 text-sm mb-8 leading-relaxed">
          Thank you for upgrading Papera. Your new plan is active — head
          back to your notebooks to see the extra Ink and unlocked features.
        </p>
        <button
          onClick={() => navigate('/app', { replace: true })}
          className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-indigo-500 to-violet-500 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <Sparkles size={16} />
          Continue to your notebooks
        </button>
        <p className="mt-4 text-xs text-white/30">
          Redirecting automatically in {countdown}s…
        </p>
        {sessionId && (
          <p className="mt-6 text-[10px] text-white/20 font-mono truncate">
            session: {sessionId}
          </p>
        )}
      </div>
    </div>
  );
};
