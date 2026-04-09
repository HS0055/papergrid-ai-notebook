import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { isIOSApp } from '../utils/platform';
import {
    Check, X, Sparkles, Crown, Zap, ArrowLeft, ShoppingCart, BookOpen,
} from 'lucide-react';
import {
    INK_COSTS,
    formatPrice,
    type PricingPlanId,
    type InkPack,
} from '@papergrid/core';
import { usePricingConfig, type EffectivePlan } from '../hooks/usePricingConfig';
import { type CheckoutTarget } from '../lib/billing';

/**
 * PricingPage — the authenticated in-app upgrade surface at /pricing.
 *
 * This page now reads pricing from usePricingConfig() (which merges the
 * admin-editable Convex keys "pricing-config" and "plan-limits"), so an
 * admin change in the panel propagates here instantly. Previously the
 * whole TIERS array was hardcoded and drifted from reality — the
 * classic "admin changed it but users still see old prices" trap.
 *
 * For web users, upgrade CTAs POST to /api/billing/checkout (Convex
 * Stripe Checkout wrapper in stripeWebhook.ts) and redirect to the
 * returned checkoutUrl. For iOS Papera builds, the flow routes through
 * Apple StoreKit (still a stub here — the native Capacitor plugin
 * integration lives outside this component).
 *
 * Graceful degradation:
 *   - If the Stripe env vars aren't set on the server, /api/billing/
 *     checkout returns 503 and the user is bounced back to the app with
 *     a helpful toast-worthy message. They don't see a dead button.
 *   - If the user isn't signed in, we route to /login first (not
 *     Stripe) so the webhook has a userId on return.
 */

// ── StoreKit product IDs for iOS (product IDs come from App Store
//    Connect — keep them here so the native layer can resolve them.) ──
const IOS_PRODUCT_IDS: Record<string, string> = {
    pro_monthly: 'com.papera.pro.monthly',
    pro_yearly: 'com.papera.pro.yearly',
    creator_monthly: 'com.papera.creator.monthly',
    creator_yearly: 'com.papera.creator.yearly',
    ink_25: 'com.papera.ink.25',
    ink_75: 'com.papera.ink.75',
    ink_200: 'com.papera.ink.200',
    ink_500: 'com.papera.ink.500',
};

/** Inline water-droplet SVG used next to Ink amounts. */
function InkDropIcon({ className = '' }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 16 20"
            fill="currentColor"
            className={`inline-block w-4 h-4 ${className}`}
            aria-hidden="true"
        >
            <path d="M8 0C8 0 0 9 0 13a8 8 0 0 0 16 0C16 9 8 0 8 0Zm0 18a6 6 0 0 1-6-5c0-2.8 4-8.5 6-11.2C10 4.5 14 10.2 14 13a6 6 0 0 1-6 5Z" />
            <path d="M8 2.5S2 9.5 2 13a6 6 0 0 0 12 0c0-3.5-6-10.5-6-10.5Z" opacity="0.25" />
        </svg>
    );
}

// ── Visual metadata per plan id — icon + gradient. Everything else
//    (name, price, ink, features) comes from usePricingConfig. ──
const PLAN_VISUALS: Record<string, { icon: React.ReactNode; gradient: string }> = {
    free:    { icon: <BookOpen size={24} />, gradient: 'from-gray-600 to-gray-700' },
    starter: { icon: <Sparkles size={24} />, gradient: 'from-sky-500 to-indigo-500' },
    pro:     { icon: <Zap size={24} />, gradient: 'from-indigo-600 to-violet-600' },
    creator: { icon: <Crown size={24} />, gradient: 'from-amber-500 to-orange-600' },
    founder: { icon: <Crown size={24} />, gradient: 'from-rose-500 to-pink-600' },
};

type BillingInterval = 'month' | 'year';

function formatMoney(n: number): string {
    return formatPrice(n);
}

/**
 * Map our plan id to the Stripe checkout target. Returns null for plans
 * that don't have Stripe wiring (free is not a paid checkout, founder
 * is a legacy lifetime tier with no recurring billing).
 *
 * The backend `stripeWebhook.ts` switch supports `pro`, `creator`, and
 * `starter`. If you add a new paid plan, update both this mapper AND
 * the backend switch in lockstep.
 */
function stripeTargetForPlan(id: PricingPlanId): CheckoutTarget | null {
    if (id === 'pro') return 'pro';
    if (id === 'creator') return 'creator';
    if (id === 'starter') return 'starter';
    return null;
}

function stripeTargetForPack(packId: string): CheckoutTarget | null {
    // Current backend supports ink_25 / 75 / 200 / 500.
    if (packId === 'drop') return 'ink_25';
    if (packId === 'bottle') return 'ink_75';
    if (packId === 'well') return 'ink_200';
    if (packId === 'barrel') return 'ink_500';
    // Convention fallback: "ink_{n}" maps directly.
    if (/^ink_(25|75|200|500)$/.test(packId)) return packId as CheckoutTarget;
    return null;
}

/** Build feature bullet list for display from an effective plan. */
function buildFeatureList(plan: EffectivePlan): Array<{ text: string; included: boolean; highlight?: boolean }> {
    const notebookLabel =
        plan.maxNotebooks === -1
            ? 'Unlimited notebooks'
            : `${plan.maxNotebooks} notebook${plan.maxNotebooks === 1 ? '' : 's'}`;
    const features: Array<{ text: string; included: boolean; highlight?: boolean }> = [
        { text: `${plan.monthlyInk} Ink / month`, included: true, highlight: true },
        { text: notebookLabel, included: true },
        { text: plan.allPaperTypes ? 'All paper types' : 'Standard paper types', included: true },
        {
            text: plan.cleanExport ? 'Clean PDF export' : 'Watermarked export',
            included: true,
        },
    ];
    if (plan.inkRolloverCap > 0) {
        features.push({
            text: `Rollover up to ${plan.inkRolloverCap} unused Ink`,
            included: true,
        });
    }
    features.push({
        text: plan.brandedExport ? 'Branded exports' : 'Branded exports',
        included: plan.brandedExport,
    });
    features.push({
        text: plan.priorityAI ? 'Priority AI queue' : 'Priority AI queue',
        included: plan.priorityAI,
    });
    features.push({
        text: plan.publishTemplates ? 'Marketplace publishing' : 'Marketplace publishing',
        included: plan.publishTemplates,
    });
    return features;
}

export const PricingPage: React.FC = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuth();
    const [loadingTier, setLoadingTier] = useState<string | null>(null);
    const [loadingPack, setLoadingPack] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [interval, setInterval] = useState<BillingInterval>('month');

    const pricing = usePricingConfig();
    // Visible plans only — `landingPlans` filters out anything the
    // admin marked `hiddenFromLanding`. The in-app /pricing route is
    // the SAME user-facing surface as the landing #pricing section,
    // so they should respect the same admin visibility toggle. If a
    // user lands here from a deep link to a hidden plan (e.g.
    // /pricing?plan=founder from an email), they'll see the visible
    // plans and can request the hidden plan via support.
    const tiers = pricing.landingPlans;

    const handleSelectPlan = async (plan: EffectivePlan) => {
        setError(null);

        // Free plan just drops the user into the app.
        if (plan.id === 'free') {
            navigate(isAuthenticated ? '/app' : '/login');
            return;
        }

        // Any paid plan requires an account. Round-trip through /login
        // so the webhook has a userId to attach the subscription to.
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }

        setLoadingTier(plan.id);
        try {
            if (isIOSApp()) {
                // iOS: StoreKit via Capacitor plugin (handled outside
                // this file). This path intentionally leaves a clear
                // TODO instead of silently failing.
                const key = `${plan.id}_${interval === 'year' ? 'yearly' : 'monthly'}`;
                const productId = IOS_PRODUCT_IDS[key];
                if (!productId) {
                    setError(`No StoreKit product for ${plan.name} (${interval}).`);
                    return;
                }
                // eslint-disable-next-line no-alert
                alert(`StoreKit purchase: ${plan.name} (${productId}). StoreKit 2 integration pending.`);
                return;
            }

            // Web: navigate to in-house /checkout page (Stripe Elements).
            // Replaces the previous redirectToCheckout flow that bounced
            // users out to checkout.stripe.com.
            const target = stripeTargetForPlan(plan.id);
            if (!target) {
                setError(`${plan.name} can only be upgraded by contacting support.`);
                return;
            }
            navigate(`/checkout?target=${target}&interval=${interval}`);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Upgrade failed.');
        } finally {
            setLoadingTier(null);
        }
    };

    const handleBuyPack = async (pack: InkPack) => {
        setError(null);
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }

        setLoadingPack(pack.id);
        try {
            if (isIOSApp()) {
                const productId = IOS_PRODUCT_IDS[`ink_${pack.ink}`];
                if (!productId) {
                    setError(`No StoreKit product for ${pack.ink} Ink pack.`);
                    return;
                }
                // eslint-disable-next-line no-alert
                alert(`StoreKit purchase: ${pack.ink} Ink (${productId}). StoreKit 2 integration pending.`);
                return;
            }

            const target = stripeTargetForPack(pack.id);
            if (!target) {
                setError(`Ink pack ${pack.name} is not available for purchase.`);
                return;
            }
            navigate(`/checkout?target=${target}`);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Ink purchase failed.');
        } finally {
            setLoadingPack(null);
        }
    };

    const handleRestorePurchases = async () => {
        if (!isIOSApp()) return;
        // eslint-disable-next-line no-alert
        alert('Restore purchases: StoreKit 2 integration pending.');
    };

    // Price label — annual plans show the monthly-equivalent with a
    // struck-through monthly price right next to it, matching the
    // landing page treatment.
    const priceLabelFor = (plan: EffectivePlan): { main: string; sub: string } => {
        if (plan.monthlyPrice === 0) return { main: '$0', sub: 'forever' };
        if (interval === 'year' && plan.annualEquivMonthly && plan.annualPrice) {
            return {
                main: `$${plan.annualEquivMonthly.toFixed(2)}`,
                sub: `/mo · ${formatMoney(plan.annualPrice)}/yr`,
            };
        }
        return {
            main: `$${plan.monthlyPrice.toFixed(2)}`,
            sub: '/month',
        };
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 text-white">
            {/* Header */}
            <div className="max-w-7xl mx-auto px-4 py-6">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors text-sm"
                >
                    <ArrowLeft size={16} />
                    Back
                </button>
            </div>

            {/* Hero */}
            <div className="text-center mb-10 px-4">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-300 text-xs font-medium mb-6">
                    <Sparkles size={14} />
                    Ink-Powered Pricing
                </div>
                <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-white via-indigo-200 to-violet-200 bg-clip-text text-transparent">
                    Choose Your Plan
                </h1>
                <p className="text-white/50 text-lg max-w-xl mx-auto">
                    Every AI action costs Ink. Pick a plan, top up when you need, and create without limits.
                </p>
            </div>

            {/* Billing interval toggle */}
            <div className="flex justify-center mb-10 px-4">
                <div className="inline-flex items-center gap-1 p-1 rounded-full border border-white/10 bg-white/5">
                    <button
                        onClick={() => setInterval('month')}
                        className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                            interval === 'month' ? 'bg-white text-slate-900' : 'text-white/70'
                        }`}
                    >
                        Monthly
                    </button>
                    <button
                        onClick={() => setInterval('year')}
                        className={`relative px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                            interval === 'year' ? 'bg-white text-slate-900' : 'text-white/70'
                        }`}
                    >
                        Annual
                        <span className="absolute -top-2 -right-3 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-500 text-white">
                            2 mo free
                        </span>
                    </button>
                </div>
            </div>

            {/* Inline error toast */}
            {error && (
                <div className="max-w-3xl mx-auto px-4 mb-4">
                    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-200 text-sm p-3 text-center">
                        {error}
                    </div>
                </div>
            )}

            {/* Pricing Grid */}
            <div className="max-w-7xl mx-auto px-4 pb-12">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {tiers.map((plan) => {
                        const visual = PLAN_VISUALS[plan.id] ?? PLAN_VISUALS.pro;
                        const price = priceLabelFor(plan);
                        const features = buildFeatureList(plan);
                        const isCurrent = user?.plan === plan.id;
                        const isLoading = loadingTier === plan.id;
                        return (
                            <div
                                key={plan.id}
                                className={`relative rounded-3xl border transition-all duration-300 hover:scale-[1.02] ${
                                    plan.featured
                                        ? 'bg-white/[0.08] border-indigo-500/30 shadow-2xl shadow-indigo-500/10'
                                        : 'bg-white/[0.04] border-white/10 hover:border-white/20'
                                }`}
                            >
                                {plan.featured && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full text-xs font-bold text-white shadow-lg">
                                        {plan.badge || 'Most Popular'}
                                    </div>
                                )}

                                <div className="p-6 md:p-8">
                                    <div
                                        className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${visual.gradient} flex items-center justify-center mb-4 shadow-lg`}
                                    >
                                        {visual.icon}
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                                    <p className="text-white/40 text-sm mb-4">{plan.tagline}</p>

                                    {/* Price */}
                                    <div className="mb-2">
                                        <span className="text-4xl font-bold text-white">{price.main}</span>
                                        <span className="text-white/40 text-sm ml-1">{price.sub}</span>
                                    </div>

                                    {/* Ink badge */}
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-300 text-xs font-medium mb-6">
                                        <InkDropIcon className="text-indigo-400" />
                                        {plan.monthlyInk} Ink/mo
                                    </div>

                                    {/* CTA */}
                                    <button
                                        onClick={() => handleSelectPlan(plan)}
                                        disabled={isLoading || isCurrent}
                                        className={`w-full py-3 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                                            plan.featured
                                                ? `bg-gradient-to-r ${visual.gradient} hover:opacity-90 text-white shadow-lg`
                                                : plan.id === 'free'
                                                    ? 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
                                                    : `bg-gradient-to-r ${visual.gradient} hover:opacity-90 text-white shadow-lg`
                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        {isLoading ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : isCurrent ? (
                                            'Current Plan'
                                        ) : (
                                            <>
                                                {plan.ctaLabel || 'Choose'}
                                                {plan.id !== 'free' && <Sparkles size={14} />}
                                            </>
                                        )}
                                    </button>

                                    {/* Features */}
                                    <div className="mt-6 space-y-3">
                                        {features.map((feature, i) => (
                                            <div key={i} className="flex items-start gap-3">
                                                {feature.included ? (
                                                    <Check size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                                                ) : (
                                                    <X size={16} className="text-white/20 mt-0.5 shrink-0" />
                                                )}
                                                <span
                                                    className={`text-sm ${
                                                        feature.highlight
                                                            ? 'text-indigo-300 font-semibold'
                                                            : feature.included
                                                                ? 'text-white/70'
                                                                : 'text-white/30'
                                                    }`}
                                                >
                                                    {feature.highlight && (
                                                        <InkDropIcon className="text-indigo-400 mr-1" />
                                                    )}
                                                    {feature.text}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ---- Ink Packs Section ---- */}
            <div className="max-w-4xl mx-auto px-4 py-16">
                <div className="text-center mb-10">
                    <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Need more Ink?</h2>
                    <p className="text-white/40 text-sm max-w-md mx-auto">
                        Buy packs anytime. Ink never expires and stacks with your monthly allowance.
                    </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {pricing.packs.map((pack) => {
                        const isLoading = loadingPack === pack.id;
                        return (
                            <div
                                key={pack.id}
                                className={`relative rounded-2xl border transition-all duration-200 p-5 flex flex-col items-center text-center ${
                                    pack.badge
                                        ? 'border-indigo-500/40 bg-white/[0.06] ring-1 ring-indigo-500/20'
                                        : 'border-white/10 bg-white/[0.04] hover:border-indigo-500/30 hover:bg-white/[0.06]'
                                }`}
                            >
                                {pack.badge && (
                                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r from-indigo-500 to-violet-500 text-white">
                                        {pack.badge}
                                    </div>
                                )}
                                <div className="flex items-center gap-1.5 text-xl font-bold text-white mb-1">
                                    <InkDropIcon className="text-indigo-400" />
                                    {pack.ink}
                                </div>
                                <span className="text-white/40 text-xs mb-4">Ink</span>
                                <span className="text-lg font-semibold text-white mb-4">{formatMoney(pack.price)}</span>
                                <button
                                    onClick={() => handleBuyPack(pack)}
                                    disabled={isLoading}
                                    className="w-full py-2 rounded-lg bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 hover:bg-indigo-500/25 text-sm font-medium transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <div className="w-4 h-4 border-2 border-indigo-300/30 border-t-indigo-300 rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <ShoppingCart size={14} />
                                            Buy
                                        </>
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ---- Ink Cost Reference — derived from @papergrid/core ---- */}
            <div className="max-w-2xl mx-auto px-4 pb-24">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
                    <h3 className="text-lg font-bold text-white mb-1">What does Ink cost?</h3>
                    <p className="text-white/40 text-xs mb-5">Each AI action uses a set amount of Ink from your balance.</p>

                    <div className="space-y-3">
                        {Object.values(INK_COSTS).map((item) => (
                            <div
                                key={item.action}
                                className="flex items-center justify-between py-2 border-b border-white/5 last:border-b-0"
                            >
                                <span className="text-sm text-white/70">{item.description}</span>
                                <span className="flex items-center gap-1.5 text-sm font-semibold text-indigo-300">
                                    <InkDropIcon className="text-indigo-400" />
                                    {item.cost} Ink
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {isIOSApp() && (
                <div className="max-w-7xl mx-auto px-4 pb-6 text-center">
                    <button
                        onClick={handleRestorePurchases}
                        className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors"
                    >
                        Restore Purchases
                    </button>
                </div>
            )}

            <div className="max-w-7xl mx-auto px-4 pb-12 text-center">
                <p className="text-white/30 text-sm">
                    All plans include the core Papera experience. Cancel anytime. Ink packs never expire.
                </p>
            </div>
        </div>
    );
};
