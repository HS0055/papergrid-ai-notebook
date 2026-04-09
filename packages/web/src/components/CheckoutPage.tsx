import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Lock,
  ShieldCheck,
  Sparkles,
  Loader2,
  AlertTriangle,
  Crown,
  Zap,
  BookOpen,
  Star,
  Droplet,
} from 'lucide-react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe, type StripeElementsOptions } from '@stripe/stripe-js';
import { formatPrice, type PricingPlanId } from '@papergrid/core';
import { usePricingConfig, type EffectivePlan } from '../hooks/usePricingConfig';
import { useAuth } from '../hooks/useAuth';
import { Logo } from './landing/Logo';

/**
 * CheckoutPage — in-house high-converting checkout that replaces the
 * redirect to Stripe-hosted Checkout.
 *
 * Why this exists
 * ---------------
 * Sending users off-domain to Stripe Checkout drops conversion ~10–20%
 * (Baymard Institute and Stripe's own A/B data). The Stripe page is
 * generic, lacks brand context, and breaks the visual continuity of
 * the upgrade journey. By using Stripe Elements, we keep PCI compliance
 * AND the UX inside Papera.
 *
 * Flow
 * ----
 *  1. URL: /checkout?target=pro&interval=month
 *  2. Mount → fetch publishable key from /api/config/stripe-publishable-key
 *  3. Mount → POST /api/billing/create-payment-intent
 *     → returns { clientSecret, customerId, amount, ... }
 *  4. Render <Elements stripe={loadStripe(pk)} options={{clientSecret}}>
 *  5. Inside Elements, render <PaymentElement/> + custom UI
 *  6. On submit → stripe.confirmPayment({ elements, redirect: 'if_required' })
 *  7. Success → navigate('/billing/success'); failure → inline error
 *  8. Stripe webhook fires asynchronously to upgrade the user's plan
 *
 * Why Elements (and not just <CardElement>)
 * -----------------------------------------
 * <PaymentElement> automatically renders ALL enabled payment methods
 * for the user's locale and browser: card, Apple Pay (Safari), Google
 * Pay (Chrome on Android), Link (Stripe's saved-card service), etc.
 * It's also one component instead of separate Card / Expiry / CVC
 * inputs which is the modern best practice.
 *
 * Customer save behaviour
 * -----------------------
 * The backend creates a Stripe customer on first checkout and saves
 * the id on the user row via internal.users.updatePlanInternal. So
 * the SECOND checkout reuses the customer — Stripe shows "Use saved
 * card" automatically via Link.
 */

const API_BASE = import.meta.env.VITE_API_URL || '';
const SESSION_KEY = 'papergrid_session';

function getSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

// ── Types matching the backend response shapes ─────────────
interface SubscriptionIntent {
  mode: 'subscription';
  clientSecret: string;
  subscriptionId: string;
  customerId: string;
  amount: number;
  currency: string;
  planId: PricingPlanId;
  interval: 'month' | 'year';
}

interface PaymentIntent {
  mode: 'payment';
  clientSecret: string;
  paymentIntentId: string;
  customerId: string;
  amount: number;
  currency: string;
  inkPack: string;
}

type CreateIntentResponse = SubscriptionIntent | PaymentIntent;

const PLAN_VISUALS: Record<string, { icon: React.ReactNode; gradient: string; description: string }> = {
  free: { icon: <BookOpen size={20} />, gradient: 'from-gray-500 to-gray-600', description: 'Get started' },
  starter: { icon: <Star size={20} />, gradient: 'from-sky-500 to-indigo-500', description: 'Halfway house between Free and Pro' },
  pro: { icon: <Zap size={20} />, gradient: 'from-indigo-600 to-violet-600', description: 'For daily planners and creators' },
  creator: { icon: <Crown size={20} />, gradient: 'from-amber-500 to-orange-600', description: 'Publish, brand, and sell' },
  founder: { icon: <Crown size={20} />, gradient: 'from-rose-500 to-pink-600', description: 'Lifetime founder benefits' },
};

function formatMoney(cents: number, currency: string): string {
  const dollars = cents / 100;
  // formatPrice from core handles the $ + decimals
  if (currency.toLowerCase() === 'usd') return formatPrice(dollars);
  return `${dollars.toFixed(2)} ${currency.toUpperCase()}`;
}

// ── Top-level page ────────────────────────────────────────
export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const auth = useAuth();
  const pricing = usePricingConfig();

  const target = (params.get('target') ?? 'pro') as PricingPlanId | 'ink_25' | 'ink_75' | 'ink_200' | 'ink_500';
  const initialInterval = (params.get('interval') === 'year' ? 'year' : 'month') as 'month' | 'year';
  const [interval, setInterval] = useState<'month' | 'year'>(initialInterval);

  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [intent, setIntent] = useState<CreateIntentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  // Plan from live pricing for sidebar display. May be null briefly
  // while usePricingConfig is loading.
  const plan: EffectivePlan | null = useMemo(() => {
    if (target === 'pro' || target === 'creator' || target === 'starter' || target === 'free' || target === 'founder') {
      return pricing.getPlan(target as PricingPlanId) ?? null;
    }
    return null;
  }, [pricing, target]);

  const isInkPack = target.startsWith('ink_');

  // Bootstrap: load publishable key + create payment intent in parallel.
  useEffect(() => {
    if (fetchedRef.current) return;
    if (!auth.isAuthenticated) {
      navigate(`/login?next=${encodeURIComponent(`/checkout?target=${target}&interval=${interval}`)}`, { replace: true });
      return;
    }
    const token = getSessionToken();
    if (!token || !API_BASE) {
      setBootError('You must be signed in to check out.');
      setLoading(false);
      return;
    }
    fetchedRef.current = true;

    (async () => {
      try {
        // 1) Publishable key (for Elements init)
        const pkRes = await fetch(`${API_BASE}/api/config/stripe-publishable-key`);
        if (!pkRes.ok) {
          const data = (await pkRes.json().catch(() => null)) as { error?: string } | null;
          throw new Error(
            data?.error ||
              'Stripe is not yet configured on the server. Please contact support.',
          );
        }
        const { publishableKey } = (await pkRes.json()) as { publishableKey: string };
        setStripePromise(loadStripe(publishableKey));

        // 2) Create payment intent / subscription incomplete
        const intentRes = await fetch(`${API_BASE}/api/billing/create-payment-intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'X-Session-Token': token,
          },
          body: JSON.stringify({ target, interval }),
        });
        if (!intentRes.ok) {
          const data = (await intentRes.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error || `Could not start checkout (${intentRes.status})`);
        }
        const data = (await intentRes.json()) as CreateIntentResponse;
        setIntent(data);
      } catch (e) {
        setBootError(e instanceof Error ? e.message : 'Could not load checkout.');
      } finally {
        setLoading(false);
      }
    })();
  }, [auth.isAuthenticated, navigate, target, interval]);

  // Switching billing interval recreates the payment intent.
  const handleIntervalChange = (next: 'month' | 'year') => {
    if (next === interval) return;
    setInterval(next);
    setIntent(null);
    setLoading(true);
    setBootError(null);
    fetchedRef.current = false; // re-trigger the useEffect
  };

  // Elements options. The clientSecret is required AT MOUNT TIME — we
  // can't change it later, which is why we recreate the whole Elements
  // tree (key={intent.clientSecret}) when the user toggles annual.
  const elementsOptions: StripeElementsOptions | null = useMemo(() => {
    if (!intent) return null;
    return {
      clientSecret: intent.clientSecret,
      appearance: {
        theme: 'flat',
        variables: {
          colorPrimary: '#4f46e5',
          colorBackground: '#ffffff',
          colorText: '#1a1c23',
          colorDanger: '#e11d48',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          spacingUnit: '4px',
          borderRadius: '12px',
        },
        rules: {
          '.Input': {
            border: '1.5px solid rgba(0,0,0,0.08)',
            boxShadow: 'none',
            padding: '14px 16px',
            fontSize: '16px',
          },
          '.Input:focus': {
            border: '1.5px solid #4f46e5',
            boxShadow: '0 0 0 4px rgba(79,70,229,0.12)',
          },
          '.Label': {
            fontWeight: '600',
            fontSize: '13px',
            color: '#475569',
          },
          '.Tab': {
            border: '1.5px solid rgba(0,0,0,0.08)',
            padding: '14px',
          },
          '.Tab--selected': {
            border: '1.5px solid #4f46e5',
            boxShadow: '0 0 0 4px rgba(79,70,229,0.12)',
          },
        },
      },
    };
  }, [intent]);

  // ── Loading state ──────────────────────────────────────
  if (loading || !intent || !stripePromise || !elementsOptions) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f6f3] px-4">
        <div className="text-center">
          {bootError ? (
            <div className="max-w-md mx-auto rounded-2xl border border-rose-200 bg-rose-50 px-6 py-6">
              <AlertTriangle size={28} className="text-rose-500 mx-auto mb-3" />
              <p className="font-serif text-lg font-bold text-gray-900 mb-2">
                Could not load checkout
              </p>
              <p className="text-sm text-gray-600 mb-4">{bootError}</p>
              <button
                onClick={() => navigate('/pricing')}
                className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
              >
                <ArrowLeft size={14} /> Back to pricing
              </button>
            </div>
          ) : (
            <>
              <Loader2 size={32} className="animate-spin text-indigo-500 mx-auto mb-4" />
              <p className="text-sm text-gray-500">Preparing your secure checkout…</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f6f3]">
      {/* ── Header ────────────────────────────────────── */}
      <header className="border-b border-black/[0.06] bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <Logo variant="light" size={32} />
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
            <Lock size={12} />
            Secure checkout
          </div>
        </div>
      </header>

      {/* ── Main grid ──────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-14 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* ── Order summary (sticky on desktop) ──────── */}
        <aside className="lg:col-span-5 lg:sticky lg:top-8 lg:self-start space-y-5">
          <OrderSummary
            target={target}
            plan={plan}
            interval={interval}
            isInkPack={isInkPack}
            intent={intent}
            onIntervalChange={handleIntervalChange}
          />
          <TrustBar />
          <SocialProofMicro />
        </aside>

        {/* ── Payment form (right column) ────────────── */}
        <main className="lg:col-span-7">
          <div className="bg-white rounded-3xl border border-black/[0.06] shadow-sm overflow-hidden">
            <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-3">
              <h1 className="font-serif font-bold text-2xl sm:text-3xl text-gray-900 mb-1">
                Payment details
              </h1>
              <p className="text-sm text-gray-500">
                Signed in as <span className="font-medium text-gray-700">{auth.user?.email}</span>
              </p>
            </div>
            <Elements stripe={stripePromise} options={elementsOptions} key={intent.clientSecret}>
              <CheckoutForm intent={intent} plan={plan} interval={interval} target={target} />
            </Elements>
          </div>

          <p className="text-center text-xs text-gray-400 mt-5">
            By continuing, you agree to Papera's Terms of Service and Privacy Policy.
          </p>
        </main>
      </div>
    </div>
  );
};

// ── Order summary card ───────────────────────────────────
interface OrderSummaryProps {
  target: string;
  plan: EffectivePlan | null;
  interval: 'month' | 'year';
  isInkPack: boolean;
  intent: CreateIntentResponse;
  onIntervalChange: (next: 'month' | 'year') => void;
}

const OrderSummary: React.FC<OrderSummaryProps> = ({
  target,
  plan,
  interval,
  isInkPack,
  intent,
  onIntervalChange,
}) => {
  const visual = plan ? PLAN_VISUALS[plan.id] ?? PLAN_VISUALS.pro : PLAN_VISUALS.pro;

  // Ink pack display
  if (isInkPack) {
    const inkAmount = parseInt(target.replace('ink_', ''), 10);
    return (
      <div className="bg-white rounded-3xl border border-black/[0.06] shadow-sm p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-lg">
            <Droplet size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Ink Pack
            </p>
            <p className="font-serif text-xl font-bold text-gray-900">{inkAmount} Ink</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-4 leading-relaxed">
          Top up your creative fuel. Purchased Ink never expires and stacks with your monthly allowance.
        </p>
        <div className="border-t border-black/[0.06] pt-4">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-sm text-gray-500">{inkAmount} Ink</span>
            <span className="text-sm font-medium text-gray-700">
              {formatMoney(intent.amount, intent.currency)}
            </span>
          </div>
          <div className="flex items-baseline justify-between pt-3 border-t border-black/[0.06] mt-3">
            <span className="text-base font-bold text-gray-900">Total</span>
            <span className="font-serif text-2xl font-bold text-gray-900">
              {formatMoney(intent.amount, intent.currency)}
            </span>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">One-time payment · No subscription</p>
        </div>
      </div>
    );
  }

  // Subscription plan display
  const showAnnualSavings = plan && plan.annualPrice && plan.monthlyPrice > 0;
  const annualSavings =
    plan && plan.annualPrice ? plan.monthlyPrice * 12 - plan.annualPrice : 0;

  return (
    <div className="bg-white rounded-3xl border border-black/[0.06] shadow-sm p-6">
      {/* Plan header */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${visual.gradient} flex items-center justify-center text-white shadow-lg`}
        >
          {visual.icon}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            {plan?.name ? `${plan.name} Plan` : 'Plan'}
          </p>
          <p className="font-serif text-xl font-bold text-gray-900">
            {plan?.tagline || visual.description}
          </p>
        </div>
      </div>

      {/* Feature bullets */}
      {plan && (
        <ul className="space-y-2.5 mb-5">
          <li className="flex items-start gap-2.5 text-sm text-gray-700">
            <Check size={16} className="text-emerald-500 shrink-0 mt-0.5" />
            <span>
              <strong>{plan.monthlyInk} Ink</strong> per month
            </span>
          </li>
          <li className="flex items-start gap-2.5 text-sm text-gray-700">
            <Check size={16} className="text-emerald-500 shrink-0 mt-0.5" />
            <span>
              {plan.maxNotebooks === -1
                ? 'Unlimited notebooks'
                : `${plan.maxNotebooks} notebook${plan.maxNotebooks === 1 ? '' : 's'}`}
            </span>
          </li>
          <li className="flex items-start gap-2.5 text-sm text-gray-700">
            <Check size={16} className="text-emerald-500 shrink-0 mt-0.5" />
            <span>{plan.allPaperTypes ? 'All paper types' : 'Standard paper types'}</span>
          </li>
          {plan.cleanExport && (
            <li className="flex items-start gap-2.5 text-sm text-gray-700">
              <Check size={16} className="text-emerald-500 shrink-0 mt-0.5" />
              <span>Clean PDF export</span>
            </li>
          )}
          {plan.inkRolloverCap > 0 && (
            <li className="flex items-start gap-2.5 text-sm text-gray-700">
              <Check size={16} className="text-emerald-500 shrink-0 mt-0.5" />
              <span>Rollover up to {plan.inkRolloverCap} Ink</span>
            </li>
          )}
          {plan.publishTemplates && (
            <li className="flex items-start gap-2.5 text-sm text-gray-700">
              <Check size={16} className="text-emerald-500 shrink-0 mt-0.5" />
              <span>Marketplace publishing (keep 70%)</span>
            </li>
          )}
        </ul>
      )}

      {/* Billing interval toggle */}
      {showAnnualSavings && (
        <div className="mb-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
            Billing
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onIntervalChange('month')}
              className={`relative px-3 py-3 rounded-xl text-xs font-bold transition-all ${
                interval === 'month'
                  ? 'bg-indigo-50 border-2 border-indigo-500 text-indigo-700'
                  : 'bg-white border-2 border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              Monthly
              {interval === 'month' && (
                <span className="absolute top-1 right-1.5">
                  <Check size={12} className="text-indigo-500" />
                </span>
              )}
            </button>
            <button
              onClick={() => onIntervalChange('year')}
              className={`relative px-3 py-3 rounded-xl text-xs font-bold transition-all ${
                interval === 'year'
                  ? 'bg-indigo-50 border-2 border-indigo-500 text-indigo-700'
                  : 'bg-white border-2 border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              Annual
              <span className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider bg-emerald-500 text-white whitespace-nowrap">
                2 mo free
              </span>
              {interval === 'year' && (
                <span className="absolute top-1 right-1.5">
                  <Check size={12} className="text-indigo-500" />
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Total */}
      <div className="border-t border-black/[0.06] pt-4">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-sm text-gray-500">
            {plan?.name} {interval === 'year' ? 'annual' : 'monthly'}
          </span>
          <span className="text-sm font-medium text-gray-700">
            {formatMoney(intent.amount, intent.currency)}
          </span>
        </div>
        {interval === 'year' && annualSavings > 0 && (
          <div className="flex items-baseline justify-between text-xs text-emerald-600 font-medium mb-1">
            <span>Annual savings</span>
            <span>−{formatPrice(annualSavings)}</span>
          </div>
        )}
        <div className="flex items-baseline justify-between pt-3 border-t border-black/[0.06] mt-3">
          <span className="text-base font-bold text-gray-900">Total</span>
          <div className="text-right">
            <span className="font-serif text-2xl font-bold text-gray-900">
              {formatMoney(intent.amount, intent.currency)}
            </span>
            <span className="text-xs text-gray-500 ml-1">/{interval === 'year' ? 'yr' : 'mo'}</span>
          </div>
        </div>
        <p className="text-[11px] text-gray-400 mt-2">
          {interval === 'year'
            ? 'Billed annually · cancel anytime'
            : 'Billed monthly · cancel anytime'}
        </p>
      </div>
    </div>
  );
};

// ── Trust bar ─────────────────────────────────────────────
const TrustBar: React.FC = () => (
  <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm p-5">
    <div className="grid grid-cols-3 gap-3">
      <div className="text-center">
        <ShieldCheck size={22} className="text-emerald-500 mx-auto mb-1.5" />
        <p className="text-[11px] font-bold text-gray-700 leading-tight">30-day money-back</p>
      </div>
      <div className="text-center">
        <Check size={22} className="text-emerald-500 mx-auto mb-1.5" />
        <p className="text-[11px] font-bold text-gray-700 leading-tight">Cancel anytime</p>
      </div>
      <div className="text-center">
        <Lock size={22} className="text-emerald-500 mx-auto mb-1.5" />
        <p className="text-[11px] font-bold text-gray-700 leading-tight">Secured by Stripe</p>
      </div>
    </div>
  </div>
);

// ── Mini social proof ─────────────────────────────────────
const SocialProofMicro: React.FC = () => (
  <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl border border-indigo-100 p-5 text-center">
    <div className="flex justify-center mb-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <Sparkles key={i} size={14} className="text-amber-400 fill-current" />
      ))}
    </div>
    <p className="text-xs text-gray-600 italic leading-relaxed">
      "The notebook that finally thinks with me. Worth every cent."
    </p>
    <p className="text-[11px] text-gray-400 mt-1.5 font-medium">— Papera writer</p>
  </div>
);

// ── Inner form (uses Stripe hooks, must be inside <Elements>) ──
interface CheckoutFormProps {
  intent: CreateIntentResponse;
  plan: EffectivePlan | null;
  interval: 'month' | 'year';
  target: string;
}

const CheckoutForm: React.FC<CheckoutFormProps> = ({ intent, plan, interval, target }) => {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const ctaLabel = useMemo(() => {
    if (intent.mode === 'payment') {
      return `Pay ${formatMoney(intent.amount, intent.currency)}`;
    }
    const planLabel = plan?.name || 'plan';
    const priceLabel = formatMoney(intent.amount, intent.currency);
    return `Start ${planLabel} — ${priceLabel}/${interval === 'year' ? 'yr' : 'mo'}`;
  }, [intent, plan, interval]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setErrorMsg(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/billing/success?target=${target}&interval=${interval}`,
      },
      // 'if_required' keeps the user on this page unless 3DS forces a redirect.
      // The vast majority of card payments confirm in place.
      redirect: 'if_required',
    });

    if (error) {
      setErrorMsg(error.message ?? 'Your payment could not be processed.');
      setSubmitting(false);
      return;
    }

    // Success — most card payments land here without a redirect.
    if (paymentIntent && paymentIntent.status === 'succeeded') {
      navigate(
        `/billing/success?session_id=${paymentIntent.id}&target=${target}&interval=${interval}`,
        { replace: true },
      );
      return;
    }

    // For other terminal states (requires_action handled by Stripe SDK)
    // we just leave the form for the user to retry.
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="px-6 sm:px-8 pb-6 sm:pb-8 pt-3 space-y-5">
      {/* Stripe-managed payment input */}
      <div className="rounded-2xl bg-[#fcfbf8] border border-black/[0.06] p-4">
        <PaymentElement
          options={{
            layout: { type: 'tabs', defaultCollapsed: false },
          }}
        />
      </div>

      {/* Error message */}
      {errorMsg && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-rose-500 shrink-0 mt-0.5" />
          <p className="text-sm text-rose-700">{errorMsg}</p>
        </div>
      )}

      {/* Trust line above the button — last conversion lever */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
        <span className="flex items-center gap-1">
          <ShieldCheck size={11} className="text-emerald-500" />
          30-day money-back
        </span>
        <span className="flex items-center gap-1">
          <Check size={11} className="text-emerald-500" />
          Cancel anytime
        </span>
        <span className="flex items-center gap-1">
          <Lock size={11} className="text-emerald-500" />
          Secured by Stripe
        </span>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={!stripe || !elements || submitting}
        className="w-full py-4 rounded-2xl font-bold text-base text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Processing…
          </>
        ) : (
          <>
            <Lock size={16} />
            {ctaLabel}
          </>
        )}
      </button>
    </form>
  );
};
