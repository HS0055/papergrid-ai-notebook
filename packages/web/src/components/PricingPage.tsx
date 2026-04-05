import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
    Check, X, Sparkles, Crown, Zap, ArrowLeft, Star,
    BookOpen, ShoppingCart
} from 'lucide-react';

// Stripe publishable key
const STRIPE_PK = 'pk_live_51SkEKrDEbr4pKiCH2J8giee38nLRjmfTAtNL8FY3LFrEEjAd3AmPRoOzKBT2RnqUrQTc906oXZjiKUIP0Dt2U8DG00f2nVwx6Y';

// TODO: Update these price IDs to match new Ink-based plans in Stripe dashboard
const PRICE_IDS = {
    pro_monthly: 'price_1SlKWMDEbr4pKiCHscvQPE8Y',
    creator_monthly: 'price_TODO_CREATOR_MONTHLY',
    ink_25: 'price_TODO_INK_25',
    ink_75: 'price_TODO_INK_75',
    ink_200: 'price_TODO_INK_200',
    ink_500: 'price_TODO_INK_500',
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

interface PlanFeature {
    text: string;
    included: boolean;
    highlight?: boolean;
}

interface PricingTier {
    id: string;
    name: string;
    price: string;
    period: string;
    description: string;
    icon: React.ReactNode;
    features: PlanFeature[];
    cta: string;
    popular?: boolean;
    badge?: string;
    priceId?: string;
    mode?: 'subscription' | 'payment';
    gradient: string;
    inkAmount: string;
}

interface InkPack {
    amount: number;
    price: string;
    priceId: string;
}

interface InkCostItem {
    action: string;
    cost: number;
}

const TIERS: PricingTier[] = [
    {
        id: 'free',
        name: 'Free',
        price: '$0',
        period: '/ month',
        description: 'Get started with the basics',
        icon: <BookOpen size={24} />,
        gradient: 'from-gray-600 to-gray-700',
        cta: 'Get Started',
        inkAmount: '12 Ink/mo',
        features: [
            { text: '12 Ink / month', included: true, highlight: true },
            { text: '1 notebook', included: true },
            { text: 'Standard paper types', included: true },
            { text: 'Watermark on exports', included: true },
            { text: '1 AI cover attempt included', included: true },
            { text: 'Unlimited notebooks', included: false },
            { text: 'Full export (no watermark)', included: false },
            { text: 'Ink rollover', included: false },
        ],
    },
    {
        id: 'pro',
        name: 'Pro',
        price: '$9.99',
        period: '/ month',
        description: 'For daily planners and creators',
        icon: <Zap size={24} />,
        gradient: 'from-indigo-600 to-violet-600',
        cta: 'Go Pro',
        popular: true,
        priceId: PRICE_IDS.pro_monthly,
        mode: 'subscription',
        inkAmount: '120 Ink/mo',
        features: [
            { text: '120 Ink / month', included: true, highlight: true },
            { text: 'Unlimited notebooks', included: true },
            { text: 'All paper types', included: true },
            { text: 'Full export (no watermark)', included: true },
            { text: 'Rollover up to 60 unused Ink', included: true },
            { text: 'Discounted top-ups', included: true },
            { text: 'Marketplace publishing', included: false },
            { text: 'Priority AI queue', included: false },
        ],
    },
    {
        id: 'creator',
        name: 'Creator',
        price: '$19.99',
        period: '/ month',
        description: 'Publish, brand, and sell',
        icon: <Crown size={24} />,
        gradient: 'from-amber-500 to-orange-600',
        cta: 'Start Creating',
        priceId: PRICE_IDS.creator_monthly,
        mode: 'subscription',
        inkAmount: '350 Ink/mo',
        features: [
            { text: '350 Ink / month', included: true, highlight: true },
            { text: 'Everything in Pro', included: true },
            { text: 'Marketplace publishing', included: true },
            { text: 'Branded exports', included: true },
            { text: 'Priority AI queue', included: true },
            { text: 'Rollover up to 150 unused Ink', included: true },
        ],
    },
];

const INK_PACKS: InkPack[] = [
    { amount: 25, price: '$3.99', priceId: PRICE_IDS.ink_25 },
    { amount: 75, price: '$8.99', priceId: PRICE_IDS.ink_75 },
    { amount: 200, price: '$19.99', priceId: PRICE_IDS.ink_200 },
    { amount: 500, price: '$44.99', priceId: PRICE_IDS.ink_500 },
];

const INK_COSTS: InkCostItem[] = [
    { action: 'Layout generation', cost: 1 },
    { action: 'Advanced layout', cost: 2 },
    { action: 'Cover generation', cost: 4 },
    { action: 'Premium cover pack', cost: 6 },
];

export const PricingPage: React.FC = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuth();
    const [loadingTier, setLoadingTier] = useState<string | null>(null);
    const [loadingPack, setLoadingPack] = useState<number | null>(null);

    const handleSelectPlan = async (tier: PricingTier) => {
        if (tier.id === 'free') {
            if (isAuthenticated) {
                navigate('/app');
            } else {
                navigate('/login');
            }
            return;
        }

        if (!isAuthenticated) {
            navigate('/login');
            return;
        }

        if (!tier.priceId) return;

        setLoadingTier(tier.id);
        try {
            // TODO: Call Convex HTTP action to create Stripe Checkout Session
            // const response = await fetch('/api/create-checkout-session', {
            //   method: 'POST',
            //   headers: { 'Content-Type': 'application/json' },
            //   body: JSON.stringify({
            //     priceId: tier.priceId,
            //     mode: tier.mode,
            //     userId: user?.id,
            //     successUrl: `${window.location.origin}/app?upgraded=true`,
            //     cancelUrl: `${window.location.origin}/pricing`,
            //   }),
            // });
            // const { url } = await response.json();
            // window.location.href = url;

            // Placeholder until Convex + Stripe is wired
            alert(`Stripe Checkout will open for ${tier.name} plan (${tier.priceId}). Deploy Convex backend first.`);
        } catch (error) {
            if (error instanceof Error) {
                // eslint-disable-next-line no-console
                console.error('Checkout error:', error.message);
            }
        } finally {
            setLoadingTier(null);
        }
    };

    const handleBuyPack = async (pack: InkPack) => {
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }

        setLoadingPack(pack.amount);
        try {
            // TODO: Call Convex HTTP action to create Stripe Checkout Session for one-time pack
            alert(`Stripe Checkout will open for ${pack.amount} Ink pack (${pack.priceId}). Deploy Convex backend first.`);
        } catch (error) {
            if (error instanceof Error) {
                // eslint-disable-next-line no-console
                console.error('Ink pack purchase error:', error.message);
            }
        } finally {
            setLoadingPack(null);
        }
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
            <div className="text-center mb-16 px-4">
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

            {/* Pricing Grid */}
            <div className="max-w-6xl mx-auto px-4 pb-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {TIERS.map((tier) => (
                        <div
                            key={tier.id}
                            className={`relative rounded-3xl border transition-all duration-300 hover:scale-[1.02] ${
                                tier.popular
                                    ? 'bg-white/[0.08] border-indigo-500/30 shadow-2xl shadow-indigo-500/10'
                                    : 'bg-white/[0.04] border-white/10 hover:border-white/20'
                            }`}
                        >
                            {/* Popular badge */}
                            {tier.popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full text-xs font-bold text-white shadow-lg">
                                    Most Popular
                                </div>
                            )}

                            <div className="p-6 md:p-8">
                                {/* Icon + Name */}
                                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${tier.gradient} flex items-center justify-center mb-4 shadow-lg`}>
                                    {tier.icon}
                                </div>
                                <h3 className="text-xl font-bold text-white mb-1">{tier.name}</h3>
                                <p className="text-white/40 text-sm mb-4">{tier.description}</p>

                                {/* Price */}
                                <div className="mb-2">
                                    <span className="text-4xl font-bold text-white">{tier.price}</span>
                                    <span className="text-white/40 text-sm ml-1">{tier.period}</span>
                                </div>

                                {/* Ink amount badge */}
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-300 text-xs font-medium mb-6">
                                    <InkDropIcon className="text-indigo-400" />
                                    {tier.inkAmount}
                                </div>

                                {/* CTA */}
                                <button
                                    onClick={() => handleSelectPlan(tier)}
                                    disabled={loadingTier === tier.id || (user?.plan === tier.id)}
                                    className={`w-full py-3 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                                        tier.popular
                                            ? `bg-gradient-to-r ${tier.gradient} hover:opacity-90 text-white shadow-lg`
                                            : tier.id === 'free'
                                                ? 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
                                                : `bg-gradient-to-r ${tier.gradient} hover:opacity-90 text-white shadow-lg`
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {loadingTier === tier.id ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : user?.plan === tier.id ? (
                                        'Current Plan'
                                    ) : (
                                        <>
                                            {tier.cta}
                                            {tier.id !== 'free' && <Sparkles size={14} />}
                                        </>
                                    )}
                                </button>

                                {/* Features */}
                                <div className="mt-6 space-y-3">
                                    {tier.features.map((feature, i) => (
                                        <div key={i} className="flex items-start gap-3">
                                            {feature.included ? (
                                                <Check size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                                            ) : (
                                                <X size={16} className="text-white/20 mt-0.5 shrink-0" />
                                            )}
                                            <span className={`text-sm ${
                                                feature.highlight
                                                    ? 'text-indigo-300 font-semibold'
                                                    : feature.included
                                                        ? 'text-white/70'
                                                        : 'text-white/30'
                                            }`}>
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
                    ))}
                </div>
            </div>

            {/* ---- Ink Packs Section ---- */}
            <div className="max-w-4xl mx-auto px-4 py-16">
                <div className="text-center mb-10">
                    <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                        Need more Ink?
                    </h2>
                    <p className="text-white/40 text-sm max-w-md mx-auto">
                        Buy packs anytime. Ink never expires and stacks with your monthly allowance.
                    </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {INK_PACKS.map((pack) => (
                        <div
                            key={pack.amount}
                            className="relative rounded-2xl border border-white/10 bg-white/[0.04] hover:border-indigo-500/30 hover:bg-white/[0.06] transition-all duration-200 p-5 flex flex-col items-center text-center"
                        >
                            {/* Amount */}
                            <div className="flex items-center gap-1.5 text-xl font-bold text-white mb-1">
                                <InkDropIcon className="text-indigo-400" />
                                {pack.amount}
                            </div>
                            <span className="text-white/40 text-xs mb-4">Ink</span>

                            {/* Price */}
                            <span className="text-lg font-semibold text-white mb-4">{pack.price}</span>

                            {/* Buy button */}
                            <button
                                onClick={() => handleBuyPack(pack)}
                                disabled={loadingPack === pack.amount}
                                className="w-full py-2 rounded-lg bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 hover:bg-indigo-500/25 text-sm font-medium transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loadingPack === pack.amount ? (
                                    <div className="w-4 h-4 border-2 border-indigo-300/30 border-t-indigo-300 rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <ShoppingCart size={14} />
                                        Buy
                                    </>
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* ---- Ink Cost Reference ---- */}
            <div className="max-w-2xl mx-auto px-4 pb-24">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
                    <h3 className="text-lg font-bold text-white mb-1">What does Ink cost?</h3>
                    <p className="text-white/40 text-xs mb-5">Each AI action uses a set amount of Ink from your balance.</p>

                    <div className="space-y-3">
                        {INK_COSTS.map((item) => (
                            <div
                                key={item.action}
                                className="flex items-center justify-between py-2 border-b border-white/5 last:border-b-0"
                            >
                                <span className="text-sm text-white/70">{item.action}</span>
                                <span className="flex items-center gap-1.5 text-sm font-semibold text-indigo-300">
                                    <InkDropIcon className="text-indigo-400" />
                                    {item.cost} Ink
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer trust line */}
            <div className="max-w-7xl mx-auto px-4 pb-12 text-center">
                <p className="text-white/30 text-sm">
                    All plans include the core Papera experience. Cancel anytime. Ink packs never expire. Questions? Email us.
                </p>
            </div>
        </div>
    );
};
