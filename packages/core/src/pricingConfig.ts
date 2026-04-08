/**
 * Papera Pricing Configuration -- Single Source of Truth
 *
 * This file is the authoritative source for all pricing on both the landing page
 * and the admin panel. Changes here propagate everywhere.
 *
 * Locked: 2026-04-05 per docs/strategy/2026-04-05-papera-monetization-final.md
 *
 * IRON LAWS:
 * - No trials. Pure freemium.
 * - Annual framing = "Get 2 months free" (never "Save 20%")
 * - 30-day money-back guarantee on annual only (not a trial)
 * - No model names in UI or marketing
 * - 1 Ink = 1 page layout, 4 Ink = 1 cover image
 * - Rollover caps protect margins
 */

// ============================================================================
// TYPES
// ============================================================================

export type PricingPlanId = 'free' | 'starter' | 'pro' | 'creator' | 'founder';

export interface PricingPlan {
  readonly id: PricingPlanId;
  readonly name: string;
  readonly tagline: string;
  readonly monthlyPrice: number;
  readonly annualPrice: number | null;
  readonly annualEquivMonthly: number | null;
  readonly annualSavingsFraming: string;
  readonly ink: {
    readonly monthly: number;
    readonly rollover: number;
  };
  readonly limits: {
    readonly notebooks: number; // -1 = unlimited
    readonly paperTypes: number;
    readonly blockTypes: number;
  };
  readonly features: {
    readonly allPaperTypes: boolean;
    readonly allBlockTypes: boolean;
    readonly cleanExport: boolean;
    readonly brandedExport: boolean;
    readonly priorityAI: boolean;
    readonly publishTemplates: boolean;
    readonly marketplaceRevShare: number; // 0 to 1
    readonly bookmarks: boolean;
    readonly inkRollover: boolean;
    readonly support: 'community' | 'email' | 'priority';
  };
  readonly badge: string | null;
  readonly ctaLabel: string;
  readonly featured: boolean;
  /** When true, the plan is hidden from the public landing page but still
   *  edited in the admin panel and assignable to users. Used for legacy
   *  lifetime plans (founder) and soft-rollout experiments (starter). */
  readonly hiddenFromLanding?: boolean;
}

export interface InkPack {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  readonly ink: number;
  readonly perInkCost: number;
  readonly badge: string | null;
  readonly webOnly: boolean; // XL is web-only to avoid Apple margin erosion
}

export interface InkCost {
  readonly action: string;
  readonly cost: number;
  readonly description: string;
}

// ============================================================================
// PRICING PLANS
// ============================================================================

export const PRICING_PLANS: Readonly<Record<PricingPlanId, PricingPlan>> = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Perfect for trying Papera',
    monthlyPrice: 0,
    annualPrice: null,
    annualEquivMonthly: null,
    annualSavingsFraming: '',
    ink: {
      monthly: 10,
      rollover: 0,
    },
    limits: {
      notebooks: 1,
      paperTypes: 5,
      blockTypes: 15,
    },
    features: {
      allPaperTypes: false,
      allBlockTypes: false,
      cleanExport: false,
      brandedExport: false,
      priorityAI: false,
      publishTemplates: false,
      marketplaceRevShare: 0,
      bookmarks: false,
      inkRollover: false,
      support: 'community',
    },
    badge: null,
    ctaLabel: 'Start Free',
    featured: false,
  },

  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'For planners who mean business',
    monthlyPrice: 9.99,
    annualPrice: 89,
    annualEquivMonthly: 7.42,
    annualSavingsFraming: 'Get 2 months free',
    ink: {
      monthly: 100,
      rollover: 50,
    },
    limits: {
      notebooks: -1, // unlimited
      paperTypes: 10,
      blockTypes: 22,
    },
    features: {
      allPaperTypes: true,
      allBlockTypes: true,
      cleanExport: true,
      brandedExport: false,
      priorityAI: false,
      publishTemplates: false,
      marketplaceRevShare: 0,
      bookmarks: true,
      inkRollover: true,
      support: 'email',
    },
    badge: 'MOST POPULAR',
    ctaLabel: 'Go Pro',
    featured: true,
  },

  creator: {
    id: 'creator',
    name: 'Creator',
    tagline: 'Pro + early access to upcoming features',
    monthlyPrice: 19.99,
    annualPrice: 179,
    annualEquivMonthly: 14.92,
    annualSavingsFraming: 'Get 2 months free',
    ink: {
      monthly: 250,
      rollover: 125,
    },
    limits: {
      notebooks: -1, // unlimited
      paperTypes: 10,
      blockTypes: 22,
    },
    features: {
      allPaperTypes: true,
      allBlockTypes: true,
      cleanExport: true,
      brandedExport: true,
      priorityAI: true,
      publishTemplates: true,
      marketplaceRevShare: 0.70, // 70/30 split
      bookmarks: true,
      inkRollover: true,
      support: 'priority',
    },
    badge: null,
    ctaLabel: 'Go Creator',
    featured: false,
  },

  // ── Public soft-launch tier — sits between Free and Pro. ──
  starter: {
    id: 'starter',
    name: 'Starter',
    tagline: 'Halfway house between Free and Pro',
    monthlyPrice: 4.99,
    annualPrice: 44,
    annualEquivMonthly: 3.67,
    annualSavingsFraming: 'Get 2 months free',
    ink: {
      monthly: 50,
      rollover: 25,
    },
    limits: {
      notebooks: 5,
      paperTypes: 10,
      blockTypes: 22,
    },
    features: {
      allPaperTypes: true,
      allBlockTypes: true,
      cleanExport: true,
      brandedExport: false,
      priorityAI: false,
      publishTemplates: false,
      marketplaceRevShare: 0,
      bookmarks: true,
      inkRollover: true,
      support: 'email',
    },
    badge: null,
    ctaLabel: 'Choose Starter',
    featured: false,
  },

  founder: {
    id: 'founder',
    name: 'Founder',
    tagline: 'Legacy lifetime plan — rewarded to early supporters',
    monthlyPrice: 0,
    annualPrice: null,
    annualEquivMonthly: null,
    annualSavingsFraming: 'Lifetime — paid once, forever',
    ink: {
      monthly: 100,
      rollover: 50,
    },
    limits: {
      notebooks: -1,
      paperTypes: 10,
      blockTypes: 22,
    },
    features: {
      allPaperTypes: true,
      allBlockTypes: true,
      cleanExport: true,
      brandedExport: false,
      priorityAI: false,
      publishTemplates: false,
      marketplaceRevShare: 0,
      bookmarks: true,
      inkRollover: true,
      support: 'email',
    },
    badge: 'LIFETIME',
    ctaLabel: 'Founder',
    featured: false,
    hiddenFromLanding: true,
  },
} as const;

// ============================================================================
// INK TOP-UP PACKS
// ============================================================================

export const INK_PACKS: readonly InkPack[] = [
  {
    id: 'drop',
    name: 'Ink Drop',
    price: 2.99,
    ink: 25,
    perInkCost: 0.120,
    badge: null,
    webOnly: false,
  },
  {
    id: 'bottle',
    name: 'Ink Bottle',
    price: 6.99,
    ink: 75,
    perInkCost: 0.093,
    badge: null,
    webOnly: false,
  },
  {
    id: 'well',
    name: 'Ink Well',
    price: 14.99,
    ink: 200,
    perInkCost: 0.075,
    badge: 'BEST VALUE',
    webOnly: false,
  },
  {
    id: 'barrel',
    name: 'Ink Barrel',
    price: 29.99,
    ink: 500,
    perInkCost: 0.060,
    badge: null,
    webOnly: true, // Critical: avoids Apple 30% cut that makes this pack margin-negative
  },
] as const;

// ============================================================================
// INK ACTION COSTS
// ============================================================================

export const INK_COSTS: Readonly<Record<string, InkCost>> = {
  layout_single_page: {
    action: 'layout_single_page',
    cost: 1,
    description: '1 page layout',
  },
  layout_two_page: {
    action: 'layout_two_page',
    cost: 2,
    description: '2-page spread',
  },
  layout_three_page: {
    action: 'layout_three_page',
    cost: 3,
    description: '3-page layout',
  },
  layout_multi_page: {
    action: 'layout_multi_page',
    cost: 4,
    description: 'Multi-page layout (4+)',
  },
  cover_image: {
    action: 'cover_image',
    cost: 4,
    description: 'AI cover image',
  },
  cover_premium: {
    action: 'cover_premium',
    cost: 6,
    description: 'Premium AI cover (high-res)',
  },
} as const;

// ============================================================================
// TRUST & GUARANTEES
// ============================================================================

export const GUARANTEES = {
  moneyBackDays: 30,
  moneyBackAppliesTo: 'annual' as const,
  cancelAnytime: true,
  dataOwnership: true,
  noCreditCardRequired: true,
} as const;

// ============================================================================
// COMPETITOR COMPARISON DATA (verified April 2026, official sources)
// ============================================================================
// Data verified from official pricing pages. Features marked boolean refer
// to NATIVE INTERACTIVE BLOCKS, not PDF template imports (which all apps allow).
// See docs/reports/ for source URLs and verification notes.

export const COMPETITORS = [
  {
    name: 'Papera',
    tier: 'Pro',
    annualPrice: 89,
    monthlyPrice: 9.99,
    aiIncluded: true,
    aiAddOnAnnual: 0,
    totalAnnualWithAI: 89,
    paperTypes: 10,
    paperTypesNote: 'Native CSS-rendered textures',
    blockTypes: 22,
    blockTypesNote: 'Interactive native blocks',
    aiLayoutGen: 'full-notebook',
    aiCover: true,
    kanban: true,
    musicStaff: true,
    habitTracker: true,
    moodTracker: true,
    priorityMatrix: true,
    platforms: ['Web', 'iOS'],
    sourceUrl: 'https://papera.app/pricing',
    featured: true,
  },
  {
    name: 'Goodnotes',
    tier: 'Pro',
    annualPrice: 35.99,
    monthlyPrice: 3.0,
    aiIncluded: false,
    aiAddOnName: 'AI Pass',
    aiAddOnMonthly: 9.99,
    aiAddOnAnnual: 119.88,
    totalAnnualWithAI: 155.87, // $35.99 + $119.88
    paperTypes: 20,
    paperTypesNote: '20+ PDF templates (company marketing)',
    blockTypes: null,
    blockTypesNote: 'PDF-based, no native blocks',
    aiLayoutGen: 'templates-only',
    aiLayoutGenNote: 'AI generates PDF templates from text prompts',
    aiCover: false,
    kanban: false,
    kanbanNote: 'PDF templates only',
    musicStaff: false,
    habitTracker: false,
    moodTracker: false,
    priorityMatrix: false,
    platforms: ['iPad', 'iPhone', 'Mac', 'Vision Pro', 'Android', 'Windows', 'Web'],
    sourceUrl: 'https://www.goodnotes.com/pricing',
    featured: false,
  },
  {
    name: 'Notability',
    tier: 'Plus',
    annualPrice: 14.99,
    monthlyPrice: 2.99,
    aiIncluded: 'limited',
    aiNote: 'Plus includes AI summaries + transcription',
    aiAddOnAnnual: 0,
    totalAnnualWithAI: 14.99,
    paperTypes: 3,
    paperTypesNote: 'Rule, Grid, Dot + color backgrounds',
    blockTypes: null,
    blockTypesNote: 'PDF/handwriting-focused',
    aiLayoutGen: false,
    aiCover: false,
    kanban: false,
    musicStaff: 'gallery',
    musicStaffNote: 'Available in Notability Gallery',
    habitTracker: false,
    moodTracker: false,
    priorityMatrix: false,
    platforms: ['iPad', 'iPhone', 'Mac'],
    sourceUrl: 'https://notability.com/pricing',
    featured: false,
  },
  {
    name: 'Notion',
    tier: 'Plus',
    annualPrice: 120, // $10/user/mo × 12
    monthlyPrice: 10,
    aiIncluded: false,
    aiNote: 'AI discontinued for Plus tier May 2025; now Business only',
    aiAddOnAnnual: null,
    totalAnnualWithAI: 180, // Estimated Business tier with AI
    paperTypes: 0,
    blockTypes: 30,
    blockTypesNote: '30+ text/database blocks, no paper simulation',
    aiLayoutGen: 'text-only',
    aiCover: false,
    kanban: true,
    musicStaff: false,
    habitTracker: 'manual',
    moodTracker: 'manual',
    priorityMatrix: 'manual',
    platforms: ['Web', 'Mac', 'Windows', 'iOS', 'Android'],
    sourceUrl: 'https://www.notion.com/pricing',
    featured: false,
  },
] as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getPlanById(id: PricingPlanId): PricingPlan {
  return PRICING_PLANS[id];
}

/** Canonical display order for pricing pages and the admin panel. */
export const PLAN_DISPLAY_ORDER: readonly PricingPlanId[] = [
  'free',
  'starter',
  'pro',
  'creator',
  'founder',
] as const;

/** All plans in display order, excluding those marked hiddenFromLanding. */
export function getLandingPlans(): readonly PricingPlan[] {
  return PLAN_DISPLAY_ORDER
    .map((id) => PRICING_PLANS[id])
    .filter((p): p is PricingPlan => !!p && !p.hiddenFromLanding);
}

/** Every plan, including hidden ones — used by the admin panel. */
export function getAllPlans(): readonly PricingPlan[] {
  return PLAN_DISPLAY_ORDER
    .map((id) => PRICING_PLANS[id])
    .filter((p): p is PricingPlan => !!p);
}

export function getInkPackById(id: InkPack['id']): InkPack | undefined {
  return INK_PACKS.find((p) => p.id === id);
}

export function calculateAnnualSavings(plan: PricingPlan): {
  totalSaved: number;
  monthsEquivalent: number;
  percentSaved: number;
} {
  if (!plan.annualPrice || !plan.monthlyPrice) {
    return { totalSaved: 0, monthsEquivalent: 0, percentSaved: 0 };
  }
  const annualAtMonthly = plan.monthlyPrice * 12;
  const totalSaved = annualAtMonthly - plan.annualPrice;
  const monthsEquivalent = totalSaved / plan.monthlyPrice;
  const percentSaved = (totalSaved / annualAtMonthly) * 100;
  return {
    totalSaved,
    monthsEquivalent: Math.round(monthsEquivalent * 10) / 10,
    percentSaved: Math.round(percentSaved),
  };
}

export function formatPrice(price: number): string {
  return `$${price.toFixed(2).replace(/\.00$/, '')}`;
}

export function getInkPacksForPlatform(platform: 'web' | 'ios'): readonly InkPack[] {
  if (platform === 'ios') {
    return INK_PACKS.filter((p) => !p.webOnly);
  }
  return INK_PACKS;
}
