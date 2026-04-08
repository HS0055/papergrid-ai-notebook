import React, { useState, useRef, useEffect } from 'react';
import { Check, Sparkles, Zap, Crown, Droplet } from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  PRICING_PLANS as DEFAULT_PRICING_PLANS,
  INK_PACKS as DEFAULT_INK_PACKS,
  PLAN_DISPLAY_ORDER,
  formatPrice,
  type PricingPlan,
  type InkPack,
} from '@papergrid/core';
import { useServerConfig } from '../../hooks/useServerConfig';

interface PricingConfigShape {
  plans: Record<string, PricingPlan>;
  packs: readonly InkPack[];
}

/** Subset of the live `/api/admin/plan-limits` shape we actually consume here. */
type PlanLimitId = 'free' | 'starter' | 'pro' | 'founder' | 'creator';
interface LivePlanLimit {
  maxNotebooks: number;
  monthlyInk: number;
  inkRolloverCap: number;
}
type LivePlanLimitsMap = Record<PlanLimitId, LivePlanLimit>;

const API_BASE = import.meta.env.VITE_API_URL || '';

gsap.registerPlugin(ScrollTrigger);

interface PricingSectionProps {
  onLaunch: () => void;
}

type BillingPeriod = 'monthly' | 'annual';

const PLAN_ICONS: Record<string, React.ReactNode> = {
  free: <Sparkles size={20} />,
  starter: <Zap size={20} />,
  pro: <Zap size={20} />,
  creator: <Crown size={20} />,
  founder: <Crown size={20} />,
};

/**
 * Feature row builders.
 *
 * The notebook count comes from the LIVE plan-limits override (set in
 * /admin → Plans tab) when present, falling back to the static
 * pricing-config value. This is the single source of truth that the
 * server enforces — keeping the landing in sync with reality.
 */
const buildFeatureLabels = (
  liveLimit: LivePlanLimit | undefined,
): Record<string, (plan: PricingPlan) => string | null> => ({
  notebooks: (p) => {
    const cap = liveLimit?.maxNotebooks ?? p.limits.notebooks;
    if (cap === -1) return 'Unlimited notebooks';
    return `${cap} notebook${cap === 1 ? '' : 's'}`;
  },
  papers: (p) => p.features.allPaperTypes ? 'All 10 paper types' : `${p.limits.paperTypes} basic paper types`,
  blocks: (p) => p.features.allBlockTypes ? 'All 22+ block types' : `${p.limits.blockTypes} basic block types`,
  ink: (p) => {
    const monthly = liveLimit?.monthlyInk ?? p.ink.monthly;
    return `${monthly} Ink / month`;
  },
  rollover: (p) => {
    const rollover = liveLimit?.inkRolloverCap ?? p.ink.rollover;
    return rollover > 0 ? `${rollover} Ink rollover` : null;
  },
  export: (p) => p.features.brandedExport ? 'Branded PDF export (coming soon)' : p.features.cleanExport ? 'Clean PDF export' : 'Watermarked export',
  bookmarks: (p) => p.features.bookmarks ? 'Bookmarks & favorites' : null,
  priority: (p) => p.features.priorityAI ? 'Priority AI queue (coming soon)' : null,
  publish: (p) => p.features.publishTemplates ? 'Publish templates (coming soon)' : null,
  support: (p) => p.features.support === 'priority' ? 'Priority support' : p.features.support === 'email' ? 'Email support' : 'Community support',
});

export const PricingSection: React.FC<PricingSectionProps> = ({ onLaunch }) => {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('annual');
  const sectionRef = useRef<HTMLElement>(null);

  // Live-edited plans + Ink packs from Convex (admin edits in /admin tab
  // propagate here after a ~500ms debounce). Falls back to hardcoded
  // defaults when no override exists on the server.
  const [config] = useServerConfig<PricingConfigShape>(
    '/api/site-config/pricing',
    { plans: DEFAULT_PRICING_PLANS, packs: DEFAULT_INK_PACKS },
  );
  const plansRecord = config.plans;
  const packsList = config.packs;
  // Iterate every plan in the canonical display order (free, starter, pro,
  // creator, founder) and drop the ones flagged hiddenFromLanding. This
  // lets the admin toggle visibility without editing component code, and
  // keeps landing parity with /admin → Plans tab.
  const plans = PLAN_DISPLAY_ORDER
    .map((id) => plansRecord[id])
    .filter((p): p is PricingPlan => p !== undefined && !p.hiddenFromLanding);

  // Live plan-limit overrides (the same source the server enforces against
  // when a user tries to create a notebook). When the admin lowers
  // free → 1 notebook, this is what the landing must show.
  const [liveLimits, setLiveLimits] = useState<LivePlanLimitsMap | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/plan-limits`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.limits) setLiveLimits(data.limits as LivePlanLimitsMap);
      } catch {
        // Silent fall-through to static pricing-config values.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      const cards = sectionRef.current!.querySelectorAll('.pricing-card');
      gsap.fromTo(
        cards,
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          stagger: 0.12,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 80%',
            once: true,
          },
        },
      );

      const packs = sectionRef.current!.querySelectorAll('.ink-pack-card');
      gsap.fromTo(
        packs,
        { y: 20, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.5,
          stagger: 0.08,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: sectionRef.current!.querySelector('.ink-packs-grid'),
            start: 'top 85%',
            once: true,
          },
        },
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const getPriceDisplay = (plan: PricingPlan) => {
    if (plan.monthlyPrice === 0) return { main: '$0', sub: 'forever' };
    if (billingPeriod === 'annual' && plan.annualEquivMonthly) {
      return {
        main: `$${plan.annualEquivMonthly.toFixed(2)}`,
        sub: `/mo billed annually (${formatPrice(plan.annualPrice!)}/yr)`,
        strikethrough: `$${plan.monthlyPrice.toFixed(2)}`,
      };
    }
    return {
      main: `$${plan.monthlyPrice.toFixed(2)}`,
      sub: '/month',
    };
  };

  return (
    <section
      id="pricing"
      ref={sectionRef}
      className="relative py-28 px-6 overflow-hidden"
      style={{ background: '#fdfbf7' }}
    >
      {/* Ambient glows */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(79,70,229,0.06) 0%, transparent 70%)', filter: 'blur(60px)' }}
      />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--color-indigo-brand)' }}>
            Honest Pricing
          </p>
          <h2
            className="font-serif font-bold mb-4"
            style={{ fontSize: 'clamp(2.2rem, 4vw, 3.5rem)', color: 'var(--color-ink)', lineHeight: 1.15 }}
          >
            Your AI notebook.{' '}
            <span className="italic" style={{ color: 'var(--color-indigo-brand)' }}>Your price.</span>
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto text-lg">
            Start free forever. Upgrade when your creativity demands more. No trials. No surprise charges.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex items-center gap-1 p-1 rounded-full border" style={{ background: '#fff', borderColor: 'rgba(0,0,0,0.08)' }}>
            <button
              onClick={() => setBillingPeriod('monthly')}
              className="px-5 py-2 rounded-full text-sm font-semibold transition-all"
              style={{
                background: billingPeriod === 'monthly' ? 'var(--color-ink)' : 'transparent',
                color: billingPeriod === 'monthly' ? '#fff' : '#64748b',
              }}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('annual')}
              className="relative px-5 py-2 rounded-full text-sm font-semibold transition-all"
              style={{
                background: billingPeriod === 'annual' ? 'var(--color-ink)' : 'transparent',
                color: billingPeriod === 'annual' ? '#fff' : '#64748b',
              }}
            >
              Annual
              <span
                className="absolute -top-2 -right-3 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
                style={{ background: '#10b981', color: '#fff' }}
              >
                2 mo free
              </span>
            </button>
          </div>
        </div>

        {/* Plan cards — 4 columns on desktop (free/starter/pro/creator).
             Grows to 5 if an admin un-hides founder. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {plans.map((plan) => {
            const price = getPriceDisplay(plan);
            const liveLimit = liveLimits?.[plan.id as PlanLimitId];
            const featureLabels = buildFeatureLabels(liveLimit);
            const features = Object.keys(featureLabels)
              .map((key) => featureLabels[key](plan))
              .filter((x): x is string => x !== null);

            return (
              <div
                key={plan.id}
                className={`pricing-card relative rounded-3xl overflow-hidden transition-all hover:scale-[1.02] ${
                  plan.featured ? 'ring-2 ring-indigo-500 ring-offset-4 ring-offset-[#fdfbf7]' : ''
                }`}
                style={{
                  background: plan.featured ? 'linear-gradient(180deg, #0f111a 0%, #1a1c23 100%)' : '#ffffff',
                  border: plan.featured ? 'none' : '1px solid rgba(0,0,0,0.08)',
                  boxShadow: plan.featured ? '0 20px 60px rgba(79,70,229,0.25)' : '0 4px 20px rgba(0,0,0,0.04)',
                  padding: '2.5rem 2rem',
                }}
              >
                {/* Badge */}
                {plan.badge && (
                  <div
                    className="absolute top-0 right-0 px-3 py-1.5 rounded-bl-2xl text-[10px] font-bold uppercase tracking-widest"
                    style={{
                      background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                      color: '#fff',
                    }}
                  >
                    {plan.badge}
                  </div>
                )}

                {/* Plan header */}
                <div className="mb-6">
                  <div
                    className="inline-flex items-center gap-2 mb-4"
                    style={{ color: plan.featured ? '#a5b4fc' : 'var(--color-indigo-brand)' }}
                  >
                    {PLAN_ICONS[plan.id]}
                    <span className="text-xs font-bold uppercase tracking-widest">{plan.name}</span>
                  </div>
                  <p
                    className="text-sm mb-6"
                    style={{ color: plan.featured ? '#94a3b8' : '#64748b' }}
                  >
                    {plan.tagline}
                  </p>

                  {/* Price */}
                  <div className="flex items-baseline gap-2 mb-2">
                    <span
                      className="font-serif font-bold"
                      style={{
                        fontSize: '3.25rem',
                        color: plan.featured ? '#fff' : 'var(--color-ink)',
                        lineHeight: 1,
                      }}
                    >
                      {price.main}
                    </span>
                    {price.strikethrough && (
                      <span
                        className="text-lg line-through"
                        style={{ color: plan.featured ? 'rgba(255,255,255,0.3)' : '#cbd5e1' }}
                      >
                        {price.strikethrough}
                      </span>
                    )}
                  </div>
                  <p className="text-sm" style={{ color: plan.featured ? '#94a3b8' : '#64748b' }}>
                    {price.sub}
                  </p>

                  {/* Annual savings badge */}
                  {billingPeriod === 'annual' && plan.annualPrice && (
                    <div
                      className="inline-block mt-3 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
                      style={{
                        background: plan.featured ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)',
                        color: '#10b981',
                      }}
                    >
                      {plan.annualSavingsFraming}
                    </div>
                  )}
                </div>

                {/* CTA */}
                <button
                  onClick={onLaunch}
                  className="w-full py-3.5 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] mb-6"
                  style={{
                    background: plan.featured
                      ? 'linear-gradient(135deg, #4f46e5, #7c3aed)'
                      : plan.id === 'free'
                        ? 'transparent'
                        : 'var(--color-ink)',
                    color: plan.featured ? '#fff' : plan.id === 'free' ? 'var(--color-ink)' : '#fff',
                    border: plan.id === 'free' ? '1.5px solid var(--color-ink)' : 'none',
                    boxShadow: plan.featured ? '0 10px 30px rgba(79,70,229,0.3)' : 'none',
                  }}
                >
                  {plan.ctaLabel}
                  {plan.id !== 'free' && billingPeriod === 'monthly' && ` — $${plan.monthlyPrice.toFixed(2)}/mo`}
                </button>

                {/* Features */}
                <ul className="space-y-3">
                  {features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <div
                        className="mt-0.5 shrink-0 rounded-full p-0.5"
                        style={{
                          background: plan.featured ? 'rgba(165,180,252,0.2)' : 'rgba(79,70,229,0.1)',
                          color: plan.featured ? '#a5b4fc' : 'var(--color-indigo-brand)',
                        }}
                      >
                        <Check size={12} strokeWidth={3} />
                      </div>
                      <span style={{ color: plan.featured ? 'rgba(255,255,255,0.85)' : '#475569' }}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Trust line */}
        <div className="text-center mb-16">
          <p className="text-sm font-medium" style={{ color: '#64748b' }}>
            ✓ 30-day money-back on annual &nbsp;·&nbsp; ✓ Cancel anytime &nbsp;·&nbsp; ✓ Your notebooks, always yours
          </p>
        </div>

        {/* Ink packs section */}
        <div className="border-t pt-16" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
          <div className="text-center mb-10">
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest mb-4"
              style={{ background: 'rgba(79,70,229,0.08)', color: 'var(--color-indigo-brand)' }}
            >
              <Droplet size={14} />
              Need more Ink?
            </div>
            <h3
              className="font-serif font-bold mb-3"
              style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', color: 'var(--color-ink)' }}
            >
              Top up anytime.
            </h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Purchased Ink never expires. Use whenever inspiration strikes.
            </p>
          </div>

          <div className="ink-packs-grid grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {packsList.map((pack) => (
              <div
                key={pack.id}
                className={`ink-pack-card relative rounded-2xl p-6 border transition-all hover:scale-[1.03] hover:shadow-lg text-center ${
                  pack.badge ? 'ring-2 ring-indigo-500/40' : ''
                }`}
                style={{
                  background: pack.badge ? 'linear-gradient(180deg, #fff 0%, #f8fafc 100%)' : '#fff',
                  borderColor: pack.badge ? 'rgba(79,70,229,0.3)' : 'rgba(0,0,0,0.08)',
                }}
              >
                {pack.badge && (
                  <div
                    className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest whitespace-nowrap"
                    style={{
                      background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                      color: '#fff',
                    }}
                  >
                    {pack.badge}
                  </div>
                )}

                <div className="mb-3 flex justify-center">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, rgba(79,70,229,0.1), rgba(124,58,237,0.1))',
                    }}
                  >
                    <Droplet size={20} style={{ color: 'var(--color-indigo-brand)' }} />
                  </div>
                </div>

                <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#64748b' }}>
                  {pack.name}
                </p>
                <p className="font-serif font-bold mb-1" style={{ fontSize: '1.5rem', color: 'var(--color-ink)' }}>
                  {pack.ink} Ink
                </p>
                <p className="font-serif font-bold mb-3" style={{ fontSize: '1.25rem', color: 'var(--color-indigo-brand)' }}>
                  {formatPrice(pack.price)}
                </p>
                <p className="text-[11px]" style={{ color: '#94a3b8' }}>
                  ${pack.perInkCost.toFixed(3)}/Ink
                </p>
              </div>
            ))}
          </div>

          <p className="text-center mt-8 text-sm" style={{ color: '#64748b' }}>
            1 Ink = 1 page layout &nbsp;·&nbsp; 4 Ink = 1 cover image
          </p>
        </div>
      </div>
    </section>
  );
};
