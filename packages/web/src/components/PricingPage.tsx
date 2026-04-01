import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
    Check, X, Sparkles, Crown, Zap, ArrowLeft, Star,
    Infinity, BookOpen, Palette, Download, Volume2
} from 'lucide-react';

// Stripe publishable key
const STRIPE_PK = 'pk_live_51SkEKrDEbr4pKiCH2J8giee38nLRjmfTAtNL8FY3LFrEEjAd3AmPRoOzKBT2RnqUrQTc906oXZjiKUIP0Dt2U8DG00f2nVwx6Y';

// Price IDs from user memory
const PRICE_IDS = {
    founder_ltd: 'price_1SlKWLDEbr4pKiCHGIr73XPQ',
    starter_monthly: 'price_1SlKWMDEbr4pKiCH6wiqopAa',
    pro_monthly: 'price_1SlKWMDEbr4pKiCHscvQPE8Y',
};

interface PlanFeature {
    text: string;
    included: boolean;
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
}

const TIERS: PricingTier[] = [
    {
        id: 'free',
        name: 'Free',
        price: '$0',
        period: 'forever',
        description: 'Try Papera with basic features',
        icon: <BookOpen size={24} />,
        gradient: 'from-gray-600 to-gray-700',
        cta: 'Get Started',
        features: [
            { text: '3 notebooks', included: true },
            { text: '10 pages per notebook', included: true },
            { text: '5 AI generations / month', included: true },
            { text: '4 paper types', included: true },
            { text: '8 basic block types', included: true },
            { text: 'PNG export', included: true },
            { text: 'ASMR sounds', included: false },
            { text: 'Cloud sync', included: false },
            { text: 'All 16 block types', included: false },
            { text: 'Template marketplace', included: false },
        ],
    },
    {
        id: 'starter',
        name: 'Starter',
        price: '$5',
        period: '/ month',
        description: 'Perfect for daily planning',
        icon: <Zap size={24} />,
        gradient: 'from-indigo-600 to-violet-600',
        cta: 'Start Planning',
        priceId: PRICE_IDS.starter_monthly,
        mode: 'subscription',
        features: [
            { text: 'Unlimited notebooks', included: true },
            { text: '50 pages per notebook', included: true },
            { text: '50 AI generations / month', included: true },
            { text: 'All 10 paper types', included: true },
            { text: 'All 16 block types', included: true },
            { text: 'PNG + Print export', included: true },
            { text: 'ASMR sounds', included: true },
            { text: 'Cloud sync', included: true },
            { text: 'Browse templates', included: true },
            { text: 'Create templates', included: false },
        ],
    },
    {
        id: 'pro',
        name: 'Pro',
        price: '$12',
        period: '/ month',
        description: 'For power users & creators',
        icon: <Crown size={24} />,
        gradient: 'from-amber-500 to-orange-600',
        cta: 'Go Pro',
        popular: true,
        priceId: PRICE_IDS.pro_monthly,
        mode: 'subscription',
        features: [
            { text: 'Unlimited everything', included: true },
            { text: 'Unlimited pages', included: true },
            { text: '500 AI generations / month', included: true },
            { text: 'All 10 paper types', included: true },
            { text: 'All 16 block types + custom', included: true },
            { text: 'PNG + Print + PDF export', included: true },
            { text: 'ASMR sounds', included: true },
            { text: 'Cloud sync', included: true },
            { text: 'Browse + Create templates', included: true },
            { text: 'Priority support', included: true },
        ],
    },
    {
        id: 'founder',
        name: 'Founder',
        price: '$39',
        period: 'one-time',
        description: 'Limited edition — Pro forever',
        icon: <Star size={24} />,
        gradient: 'from-emerald-500 to-teal-600',
        cta: 'Claim Yours',
        badge: '🔥 Limited',
        priceId: PRICE_IDS.founder_ltd,
        mode: 'payment',
        features: [
            { text: 'Everything in Pro', included: true },
            { text: 'Lifetime access', included: true },
            { text: '500 AI generations / month', included: true },
            { text: 'All current + future features', included: true },
            { text: 'Founder badge on profile', included: true },
            { text: 'Early access to new features', included: true },
            { text: 'No recurring charges', included: true },
            { text: 'Support indie development', included: true },
            { text: 'Only while supply lasts', included: true },
            { text: '', included: true },
        ],
    },
];

export const PricingPage: React.FC = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuth();
    const [loadingTier, setLoadingTier] = useState<string | null>(null);

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
            // For now, redirect to a placeholder
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

            // Placeholder: show alert until Convex is deployed
            alert(`Stripe Checkout will open for ${tier.name} plan (${tier.priceId}). Deploy Convex backend first.`);
        } catch (error) {
            console.error('Checkout error:', error);
        } finally {
            setLoadingTier(null);
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
                    Launch Pricing
                </div>
                <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-white via-indigo-200 to-violet-200 bg-clip-text text-transparent">
                    Choose Your Plan
                </h1>
                <p className="text-white/50 text-lg max-w-xl mx-auto">
                    Start free, upgrade when you need more. No hidden fees.
                </p>
            </div>

            {/* Pricing Grid */}
            <div className="max-w-7xl mx-auto px-4 pb-24">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {TIERS.map((tier) => (
                        <div
                            key={tier.id}
                            className={`relative rounded-3xl border transition-all duration-300 hover:scale-[1.02] ${tier.popular
                                    ? 'bg-white/[0.08] border-amber-500/30 shadow-2xl shadow-amber-500/10'
                                    : 'bg-white/[0.04] border-white/10 hover:border-white/20'
                                }`}
                        >
                            {/* Popular badge */}
                            {tier.popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full text-xs font-bold text-white shadow-lg">
                                    Most Popular
                                </div>
                            )}

                            {/* Limited badge */}
                            {tier.badge && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full text-xs font-bold text-white shadow-lg">
                                    {tier.badge}
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
                                <div className="mb-6">
                                    <span className="text-4xl font-bold text-white">{tier.price}</span>
                                    <span className="text-white/40 text-sm ml-1">{tier.period}</span>
                                </div>

                                {/* CTA */}
                                <button
                                    onClick={() => handleSelectPlan(tier)}
                                    disabled={loadingTier === tier.id || (user?.plan === tier.id)}
                                    className={`w-full py-3 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${tier.popular || tier.id === 'founder'
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
                                    {tier.features.filter(f => f.text).map((feature, i) => (
                                        <div key={i} className="flex items-start gap-3">
                                            {feature.included ? (
                                                <Check size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                                            ) : (
                                                <X size={16} className="text-white/20 mt-0.5 shrink-0" />
                                            )}
                                            <span className={`text-sm ${feature.included ? 'text-white/70' : 'text-white/30'}`}>
                                                {feature.text}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* FAQ / Trust */}
                <div className="mt-16 text-center">
                    <p className="text-white/30 text-sm">
                        All plans include the core Papera experience. Cancel anytime. Questions? Email us.
                    </p>
                </div>
            </div>
        </div>
    );
};
