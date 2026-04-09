import { useEffect, useMemo, useState } from 'react';
import {
  PRICING_PLANS as DEFAULT_PRICING_PLANS,
  INK_PACKS as DEFAULT_INK_PACKS,
  PLAN_DISPLAY_ORDER,
  type PricingPlan,
  type PricingPlanId,
  type InkPack,
} from '@papergrid/core';
import { useServerConfig } from './useServerConfig';

/**
 * usePricingConfig — THE single source of truth for pricing on the client.
 *
 * Why this hook exists
 * --------------------
 * Before this hook, five different places in the codebase had their own
 * opinion about what Pro cost and how much Ink it included:
 *
 *   1. packages/core/src/pricingConfig.ts     — static defaults
 *   2. packages/convex/convex/planLimits.ts   — server-side enforcement
 *      defaults (duplicated from #1)
 *   3. Convex appSettings["pricing-config"]   — admin-editable via
 *      PricingEditor.tsx; the landing pricing grid uses it
 *   4. Convex appSettings["plan-limits"]      — admin-editable via
 *      PlanLimitsEditor.tsx; backend enforcement reads from this
 *   5. PricingPage.tsx (the in-app upgrade page) — hardcoded TIERS
 *      constant that didn't match ANY of the above
 *
 * Admins couldn't actually change pricing end-to-end: an edit to the
 * "Plans" tab updated the landing but not the backend Ink grant, while
 * an edit to "Plan Limits" updated the backend but not the landing copy.
 * PricingPage.tsx was immune to both because it was hardcoded.
 *
 * This hook merges the two Convex keys into ONE unified, strongly-typed
 * view that every pricing surface can consume. Static defaults from core
 * are the safety net when the server has no override yet (fresh install).
 *
 * Consumers
 * ---------
 *   - packages/web/src/components/PricingPage.tsx         (in-app upgrade)
 *   - packages/web/src/components/landing/PricingSection  (landing grid)
 *   - packages/web/src/components/landing/FAQSection      (FAQ answer copy)
 *   - packages/web/src/components/landing/ComparisonTable (Papera row)
 *
 * Any new pricing surface MUST read from this hook, never from imports
 * of PRICING_PLANS directly (those are only the static fallback).
 *
 * Backend-side unification of the two Convex keys (Phase 2) is tracked
 * separately and will not change this hook's shape.
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

interface PricingConfigShape {
  plans: Record<string, PricingPlan>;
  packs: readonly InkPack[];
}

/** Fields the admin "Plan Limits" tab controls. */
interface LivePlanLimit {
  maxNotebooks: number;
  monthlyInk: number;
  inkRolloverCap: number;
  canUseAi?: boolean;
  exportWatermark?: boolean;
  canPublishTemplates?: boolean;
}
type LivePlanLimitsMap = Record<PricingPlanId, LivePlanLimit>;

/**
 * Effective pricing plan — the merged view a UI should render.
 *
 * Fields like `monthlyInk` and `maxNotebooks` come from `plan-limits` when
 * present (because that's what the backend enforces), falling back to the
 * static `pricingConfig` values otherwise. Fields like `monthlyPrice` and
 * `badge` come from `pricing-config` (only place they live today).
 */
export interface EffectivePlan {
  readonly id: PricingPlanId;
  readonly name: string;
  readonly tagline: string;
  readonly monthlyPrice: number;
  readonly annualPrice: number | null;
  /** Display-friendly monthly equivalent when billed annually. */
  readonly annualEquivMonthly: number | null;
  readonly annualSavingsFraming: string;
  /** Monthly Ink grant. Prefers plan-limits override when set. */
  readonly monthlyInk: number;
  /** Ink rollover cap. Prefers plan-limits override when set. */
  readonly inkRolloverCap: number;
  /** Max notebooks (-1 = unlimited). Prefers plan-limits override. */
  readonly maxNotebooks: number;
  readonly allPaperTypes: boolean;
  readonly allBlockTypes: boolean;
  readonly brandedExport: boolean;
  readonly cleanExport: boolean;
  readonly exportWatermark: boolean;
  readonly priorityAI: boolean;
  readonly publishTemplates: boolean;
  readonly marketplaceRevShare: number;
  readonly bookmarks: boolean;
  readonly inkRollover: boolean;
  readonly support: 'community' | 'email' | 'priority';
  readonly badge: string | null;
  readonly ctaLabel: string;
  readonly featured: boolean;
  readonly hiddenFromLanding: boolean;
  /**
   * True when the server has an override for this plan's limits. Useful
   * for admin surfaces that want to show "live from DB" vs "default".
   */
  readonly hasLiveLimitOverride: boolean;
}

export interface UsePricingConfigResult {
  /** All plans in canonical display order, visible + hidden included. */
  readonly allPlans: readonly EffectivePlan[];
  /** Plans that should render on the public landing page. */
  readonly landingPlans: readonly EffectivePlan[];
  /** Ink top-up packs, in display order. */
  readonly packs: readonly InkPack[];
  /** Look up a plan by id. Returns undefined if unknown. */
  readonly getPlan: (id: PricingPlanId) => EffectivePlan | undefined;
  /** True while the initial fetch is in flight. */
  readonly isLoading: boolean;
  /** Force a re-fetch of plan-limits overrides (admin surfaces use this). */
  readonly refetchLimits: () => Promise<void>;
}

function mergePlan(
  plan: PricingPlan,
  limits: LivePlanLimit | undefined,
): EffectivePlan {
  return {
    id: plan.id,
    name: plan.name,
    tagline: plan.tagline,
    monthlyPrice: plan.monthlyPrice,
    annualPrice: plan.annualPrice,
    annualEquivMonthly: plan.annualEquivMonthly,
    annualSavingsFraming: plan.annualSavingsFraming,
    monthlyInk: limits?.monthlyInk ?? plan.ink.monthly,
    inkRolloverCap: limits?.inkRolloverCap ?? plan.ink.rollover,
    maxNotebooks: limits?.maxNotebooks ?? plan.limits.notebooks,
    allPaperTypes: plan.features.allPaperTypes,
    allBlockTypes: plan.features.allBlockTypes,
    brandedExport: plan.features.brandedExport,
    cleanExport: plan.features.cleanExport,
    exportWatermark: limits?.exportWatermark ?? !plan.features.cleanExport,
    priorityAI: plan.features.priorityAI,
    publishTemplates: plan.features.publishTemplates,
    marketplaceRevShare: plan.features.marketplaceRevShare,
    bookmarks: plan.features.bookmarks,
    inkRollover: plan.features.inkRollover,
    support: plan.features.support,
    badge: plan.badge,
    ctaLabel: plan.ctaLabel,
    featured: plan.featured,
    hiddenFromLanding: plan.hiddenFromLanding === true,
    hasLiveLimitOverride: limits !== undefined,
  };
}

export function usePricingConfig(): UsePricingConfigResult {
  // Source A: admin-editable pricing config (plans + packs).
  // Server key: appSettings["pricing-config"]
  const [config] = useServerConfig<PricingConfigShape>(
    '/api/site-config/pricing',
    { plans: DEFAULT_PRICING_PLANS, packs: DEFAULT_INK_PACKS },
  );

  // Source B: admin-editable plan limits (ink + notebook caps).
  // Server key: appSettings["plan-limits"]
  // This is what the backend enforces at runtime (see packages/convex/
  // convex/planLimits.ts and users.ts).
  const [liveLimits, setLiveLimits] = useState<LivePlanLimitsMap | null>(null);
  const [isLoadingLimits, setIsLoadingLimits] = useState(true);

  const fetchLimits = useMemo(() => {
    return async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/plan-limits`);
        if (!res.ok) {
          setLiveLimits(null);
          return;
        }
        const data = await res.json();
        if (data?.limits) {
          setLiveLimits(data.limits as LivePlanLimitsMap);
        } else {
          setLiveLimits(null);
        }
      } catch {
        // Silent — fall through to defaults baked into pricing-config.
        setLiveLimits(null);
      } finally {
        setIsLoadingLimits(false);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await fetchLimits();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchLimits]);

  // Build the merged, strongly-typed view every time either source changes.
  const merged = useMemo(() => {
    const all: EffectivePlan[] = [];
    for (const planId of PLAN_DISPLAY_ORDER) {
      const plan = config.plans[planId];
      if (!plan) continue;
      const limit = liveLimits?.[planId];
      all.push(mergePlan(plan, limit));
    }
    return all;
  }, [config.plans, liveLimits]);

  const landingPlans = useMemo(
    () => merged.filter((p) => !p.hiddenFromLanding),
    [merged],
  );

  const getPlan = useMemo(() => {
    const byId = new Map<PricingPlanId, EffectivePlan>();
    for (const p of merged) byId.set(p.id, p);
    return (id: PricingPlanId) => byId.get(id);
  }, [merged]);

  return {
    allPlans: merged,
    landingPlans,
    packs: config.packs,
    getPlan,
    isLoading: isLoadingLimits,
    refetchLimits: fetchLimits,
  };
}
