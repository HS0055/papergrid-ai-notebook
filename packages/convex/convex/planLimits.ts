import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";

/*
 * Plan Limits — single source of truth for what each pricing tier can do.
 *
 * Defaults are baked into this file so the system works without any database
 * setup. Admins can override individual values via the AdminPanel, which writes
 * to the `appSettings` table under the key `plan-limits`. The override is
 * merged on top of the defaults so an admin can change "free notebooks" to
 * 2 without having to re-specify every other field.
 *
 * Used by:
 *   - notebooks.create  → enforce notebook count limits
 *   - users.ts          → enforce ink monthly grants
 *   - AdminPanel        → live editing
 */

// ── Defaults (mirror packages/core/src/pricingConfig.ts so server-side
//    enforcement matches the marketing/landing copy) ──────────────────
export type PlanId = "free" | "starter" | "pro" | "founder" | "creator";

export interface PlanLimitConfig {
  /** Max notebooks the user can create (-1 = unlimited). */
  maxNotebooks: number;
  /** Monthly ink grant (subscription refill). */
  monthlyInk: number;
  /** Ink rollover cap from one month to the next (0 = no rollover). */
  inkRolloverCap: number;
  /** Whether the user can use the AI cover/page generator. */
  canUseAi: boolean;
  /** Whether watermark is added to PDF/image exports. */
  exportWatermark: boolean;
  /** Whether the user can publish templates to the marketplace. */
  canPublishTemplates: boolean;
}

export const DEFAULT_PLAN_LIMITS: Record<PlanId, PlanLimitConfig> = {
  free: {
    maxNotebooks: 1,
    monthlyInk: 10,
    inkRolloverCap: 0,
    canUseAi: true,
    exportWatermark: true,
    canPublishTemplates: false,
  },
  starter: {
    maxNotebooks: 5,
    monthlyInk: 50,
    inkRolloverCap: 25,
    canUseAi: true,
    exportWatermark: false,
    canPublishTemplates: false,
  },
  pro: {
    maxNotebooks: -1,
    monthlyInk: 100,
    inkRolloverCap: 50,
    canUseAi: true,
    exportWatermark: false,
    canPublishTemplates: false,
  },
  creator: {
    maxNotebooks: -1,
    monthlyInk: 250,
    inkRolloverCap: 125,
    canUseAi: true,
    exportWatermark: false,
    canPublishTemplates: true,
  },
  // Legacy lifetime — treat as Pro
  founder: {
    maxNotebooks: -1,
    monthlyInk: 100,
    inkRolloverCap: 50,
    canUseAi: true,
    exportWatermark: false,
    canPublishTemplates: false,
  },
};

const APP_SETTINGS_KEY = "plan-limits";

// ── Helper: load merged limits (defaults + admin overrides) ─────────
export async function loadPlanLimits(
  ctx: QueryCtx | MutationCtx,
): Promise<Record<PlanId, PlanLimitConfig>> {
  const setting = await ctx.db
    .query("appSettings")
    .withIndex("by_key", (q) => q.eq("key", APP_SETTINGS_KEY))
    .first();

  if (!setting || !setting.value || typeof setting.value !== "object") {
    return DEFAULT_PLAN_LIMITS;
  }

  // Merge admin overrides onto defaults so partial updates don't blank fields.
  const merged = { ...DEFAULT_PLAN_LIMITS };
  for (const planId of Object.keys(DEFAULT_PLAN_LIMITS) as PlanId[]) {
    const override = (setting.value as Record<string, Partial<PlanLimitConfig>>)[planId];
    if (override) {
      merged[planId] = { ...DEFAULT_PLAN_LIMITS[planId], ...override };
    }
  }
  return merged;
}

export async function getPlanLimitFor(
  ctx: QueryCtx | MutationCtx,
  planId: PlanId,
): Promise<PlanLimitConfig> {
  const all = await loadPlanLimits(ctx);
  return all[planId] ?? DEFAULT_PLAN_LIMITS.free;
}

// ── Public query: returns the current effective limits for all plans ─
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await loadPlanLimits(ctx);
  },
});

// ── Admin mutation: update one or more plan limits ──────────────────
export const update = mutation({
  args: {
    sessionToken: v.string(),
    planId: v.union(
      v.literal("free"),
      v.literal("starter"),
      v.literal("pro"),
      v.literal("founder"),
      v.literal("creator"),
    ),
    patch: v.object({
      maxNotebooks: v.optional(v.number()),
      monthlyInk: v.optional(v.number()),
      inkRolloverCap: v.optional(v.number()),
      canUseAi: v.optional(v.boolean()),
      exportWatermark: v.optional(v.boolean()),
      canPublishTemplates: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, { sessionToken, planId, patch }) => {
    // Verify caller is an admin
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

    // Read existing setting (or initialize)
    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", APP_SETTINGS_KEY))
      .first();

    const currentValue =
      (existing?.value as Record<string, Partial<PlanLimitConfig>> | undefined) ?? {};
    const nextValue = {
      ...currentValue,
      [planId]: { ...(currentValue[planId] ?? {}), ...patch },
    };

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: nextValue,
        updatedAt: new Date().toISOString(),
        updatedBy: user._id,
      });
    } else {
      await ctx.db.insert("appSettings", {
        key: APP_SETTINGS_KEY,
        value: nextValue,
        updatedAt: new Date().toISOString(),
        updatedBy: user._id,
      });
    }

    return await loadPlanLimits(ctx);
  },
});

// ── Admin mutation: reset a plan back to defaults ───────────────────
export const resetPlan = mutation({
  args: {
    sessionToken: v.string(),
    planId: v.union(
      v.literal("free"),
      v.literal("starter"),
      v.literal("pro"),
      v.literal("founder"),
      v.literal("creator"),
    ),
  },
  handler: async (ctx, { sessionToken, planId }) => {
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

    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", APP_SETTINGS_KEY))
      .first();
    if (!existing) return await loadPlanLimits(ctx);

    const currentValue = (existing.value as Record<string, Partial<PlanLimitConfig>>) ?? {};
    const { [planId]: _removed, ...rest } = currentValue;
    void _removed;

    await ctx.db.patch(existing._id, {
      value: rest,
      updatedAt: new Date().toISOString(),
      updatedBy: user._id,
    });

    return await loadPlanLimits(ctx);
  },
});
