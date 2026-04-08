import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";

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
