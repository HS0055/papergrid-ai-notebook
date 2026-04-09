import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";

/*
 * Site Config — Convex-backed live editing of landing-page content.
 *
 * Pricing and roadmap were previously edited via useEditableConfig (localStorage),
 * which meant changes only affected the admin's own browser. This module
 * moves them to the `appSettings` table so all visitors see the same edits.
 *
 * Keys:
 *   - "pricing-config" → { plans: Record<id, PricingPlan>, packs: InkPack[] }
 *   - "roadmap-config" → RoadmapItem[]
 *
 * Defaults live in packages/core/src/pricingConfig.ts and roadmapConfig.ts.
 * If no override exists, the Convex query returns null and the client falls
 * back to the hardcoded defaults. That way a fresh install works with no
 * database writes.
 */

const PRICING_KEY = "pricing-config";
const ROADMAP_KEY = "roadmap-config";
// Second key this module now auto-syncs to when pricing-config is
// updated, so the "Plans" tab in /admin and the backend enforcement
// (users.ts inkSubscription, notebooks.ts notebook-cap check) stay
// aligned without the admin having to touch two separate tabs.
const PLAN_LIMITS_KEY = "plan-limits";

// ── Admin guard ──────────────────────────────────────────
async function requireAdmin(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string,
) {
  const session = await ctx.db
    .query("authSessions")
    .withIndex("by_token", (q) => q.eq("token", sessionToken))
    .first();
  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) {
    throw new Error("Not authenticated");
  }
  const user = await ctx.db.get(session.userId);
  if (!user || user.role !== "admin") {
    throw new Error("Admin only");
  }
  return user;
}

// ── Pricing ──────────────────────────────────────────────
export const getPricing = query({
  args: {},
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", PRICING_KEY))
      .first();
    return (setting?.value as unknown) ?? null;
  },
});

/**
 * Derive the `plan-limits` shape (server-enforced caps) from a pricing
 * config payload. We touch only the subset the backend enforces:
 *
 *   - maxNotebooks  ← plan.limits.notebooks
 *   - monthlyInk    ← plan.ink.monthly
 *   - inkRolloverCap ← plan.ink.rollover
 *
 * Other plan-limits fields (canUseAi, exportWatermark, canPublishTemplates)
 * are preserved from the existing plan-limits row if set, because they
 * don't live on the pricing-config shape today and we don't want to
 * clobber them with nulls.
 *
 * This is the minimal glue that makes a single admin edit in the "Plans"
 * tab propagate to both the landing page (via pricing-config) AND the
 * backend enforcement (via plan-limits), without touching users.ts,
 * notebooks.ts, or planLimits.ts. A full refactor that removes the
 * plan-limits key entirely is tracked separately — this is the safe
 * additive fix.
 */
function derivePlanLimitsFromPricing(
  pricingValue: unknown,
  existingLimits: Record<string, Record<string, unknown>> | null,
): Record<string, Record<string, unknown>> | null {
  if (!pricingValue || typeof pricingValue !== "object") return null;
  const plans = (pricingValue as { plans?: Record<string, unknown> }).plans;
  if (!plans || typeof plans !== "object") return null;

  const next: Record<string, Record<string, unknown>> = { ...(existingLimits ?? {}) };
  const PLAN_IDS = ["free", "starter", "pro", "creator", "founder"] as const;
  let touched = false;

  for (const planId of PLAN_IDS) {
    const plan = (plans as Record<string, unknown>)[planId];
    if (!plan || typeof plan !== "object") continue;
    const p = plan as {
      limits?: { notebooks?: number };
      ink?: { monthly?: number; rollover?: number };
    };
    const merged = { ...(next[planId] ?? {}) };
    if (typeof p.limits?.notebooks === "number") {
      merged.maxNotebooks = p.limits.notebooks;
      touched = true;
    }
    if (typeof p.ink?.monthly === "number") {
      merged.monthlyInk = p.ink.monthly;
      touched = true;
    }
    if (typeof p.ink?.rollover === "number") {
      merged.inkRolloverCap = p.ink.rollover;
      touched = true;
    }
    next[planId] = merged;
  }

  return touched ? next : null;
}

export const updatePricing = mutation({
  args: {
    sessionToken: v.string(),
    value: v.any(),
  },
  handler: async (ctx, { sessionToken, value }) => {
    const user = await requireAdmin(ctx, sessionToken);

    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", PRICING_KEY))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value,
        updatedAt: new Date().toISOString(),
        updatedBy: user._id,
      });
    } else {
      await ctx.db.insert("appSettings", {
        key: PRICING_KEY,
        value,
        updatedAt: new Date().toISOString(),
        updatedBy: user._id,
      });
    }

    // Mirror the live-edited pricing into plan-limits so the backend
    // enforcement picks up the same numbers the landing page shows.
    // This is a one-way sync: pricing-config → plan-limits. The old
    // PlanLimitsEditor tab still writes to plan-limits directly for
    // fields that don't exist on the pricing shape (canUseAi, etc.),
    // and those survive because we only merge the subset we know about.
    const existingLimits = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", PLAN_LIMITS_KEY))
      .first();
    const existingLimitsValue =
      (existingLimits?.value as Record<string, Record<string, unknown>> | null) ?? null;
    const derived = derivePlanLimitsFromPricing(value, existingLimitsValue);
    if (derived) {
      if (existingLimits) {
        await ctx.db.patch(existingLimits._id, {
          value: derived,
          updatedAt: new Date().toISOString(),
          updatedBy: user._id,
        });
      } else {
        await ctx.db.insert("appSettings", {
          key: PLAN_LIMITS_KEY,
          value: derived,
          updatedAt: new Date().toISOString(),
          updatedBy: user._id,
        });
      }
    }

    // Fire-and-forget Stripe price sync. If the admin changed a
    // subscription plan's amount, the sync action creates a new
    // immutable Stripe price object and stores its id in the
    // stripe-price-map. Scheduled at delay=0 so it starts immediately
    // but the admin's mutation returns without waiting for Stripe.
    // Convex retries the action if it throws, so transient Stripe
    // errors don't block the admin's UI.
    await ctx.scheduler.runAfter(0, internal.stripeSync.syncPrices, {});

    return { success: true };
  },
});

export const resetPricing = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await requireAdmin(ctx, sessionToken);
    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", PRICING_KEY))
      .first();
    if (existing) await ctx.db.delete(existing._id);
    return { success: true };
  },
});

// ── Roadmap ──────────────────────────────────────────────
export const getRoadmap = query({
  args: {},
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", ROADMAP_KEY))
      .first();
    return (setting?.value as unknown) ?? null;
  },
});

export const updateRoadmap = mutation({
  args: {
    sessionToken: v.string(),
    value: v.any(),
  },
  handler: async (ctx, { sessionToken, value }) => {
    const user = await requireAdmin(ctx, sessionToken);

    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", ROADMAP_KEY))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value,
        updatedAt: new Date().toISOString(),
        updatedBy: user._id,
      });
    } else {
      await ctx.db.insert("appSettings", {
        key: ROADMAP_KEY,
        value,
        updatedAt: new Date().toISOString(),
        updatedBy: user._id,
      });
    }

    return { success: true };
  },
});

export const resetRoadmap = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await requireAdmin(ctx, sessionToken);
    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", ROADMAP_KEY))
      .first();
    if (existing) await ctx.db.delete(existing._id);
    return { success: true };
  },
});
