import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  QueryCtx,
  MutationCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthUser, requireAuthUser, requireAdminUser } from "./authHelpers";

// ─────────────────────────────────────────────────────────────
// Referral program — built-in user→user growth loop
//
// Every signup user gets a unique code on first visit to /referral
// (or explicitly via `ensureMyCode`). When a new user signs up with
// `?ref=CODE`, a pending redemption row is created. On qualifying
// event (first notebook save, for now) the redemption flips to
// `qualified` and BOTH sides receive a fixed Ink bonus.
//
// Admin-tunable knobs live in `appSettings` under key
// `referralConfig` so the payout + rules can be changed without a
// redeploy. Defaults used when no config exists:
// ─────────────────────────────────────────────────────────────

const DEFAULT_REFERRER_REWARD = 25;  // Ink granted to the sharer
const DEFAULT_REFERRED_REWARD = 25;  // Ink granted to the new user
const MAX_LEADERBOARD_ROWS = 100;

interface ReferralConfig {
  referrerReward: number;
  referredReward: number;
  qualifyingAction: "signup" | "first_notebook" | "first_ink_spend";
  enabled: boolean;
}

async function getConfig(ctx: QueryCtx | MutationCtx): Promise<ReferralConfig> {
  const row = await ctx.db
    .query("appSettings")
    .withIndex("by_key", (q) => q.eq("key", "referralConfig"))
    .first();
  const v = row?.value as Partial<ReferralConfig> | undefined;
  return {
    referrerReward: v?.referrerReward ?? DEFAULT_REFERRER_REWARD,
    referredReward: v?.referredReward ?? DEFAULT_REFERRED_REWARD,
    qualifyingAction: v?.qualifyingAction ?? "signup",
    enabled: v?.enabled ?? true,
  };
}

function randomCodeSuffix(len: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  // Base32-ish alphabet (no 0/1/I/O to avoid misreads)
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

async function generateUniqueCode(
  ctx: MutationCtx,
  seed: string,
): Promise<string> {
  // Try a readable seed-based code first (e.g. "hayk-xyz23"), then
  // fall back to pure random if we collide.
  const cleanSeed = seed
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 8);
  for (let attempt = 0; attempt < 8; attempt++) {
    const suffix = randomCodeSuffix(attempt < 3 ? 4 : 6);
    const code = cleanSeed ? `${cleanSeed}${suffix}` : suffix;
    const collision = await ctx.db
      .query("referralCodes")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (!collision) return code;
  }
  throw new Error("Could not generate a unique referral code");
}

// ─────────────────────────────────────────────────────────────
// USER-FACING
// ─────────────────────────────────────────────────────────────

// Get or create the caller's referral code + stats. Used by the
// user-facing referral page on first visit — mutates on purpose so
// the code is provisioned lazily (avoids a schema migration over
// existing users).
export const ensureMyCode = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireAuthUser(ctx, sessionToken);
    const existing = await ctx.db
      .query("referralCodes")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (existing) return existing;

    const seed = user.name || (user.email ? user.email.split("@")[0] : String(user._id));
    const code = await generateUniqueCode(ctx, seed);
    const id = await ctx.db.insert("referralCodes", {
      userId: user._id,
      code,
      totalClicks: 0,
      totalSignups: 0,
      totalQualified: 0,
      totalRewardInk: 0,
      createdAt: new Date().toISOString(),
    });
    const row = await ctx.db.get(id);
    if (!row) throw new Error("Failed to create referral code");
    return row;
  },
});

// Get the current user's referral stats without writing. If they don't
// have a code yet this returns null — the UI should call `ensureMyCode`
// on mount which does the lazy provisioning.
export const getMyStats = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    const user = await getAuthUser(ctx, sessionToken);
    if (!user) return null;
    const row = await ctx.db
      .query("referralCodes")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!row) return null;
    // List recent redemptions for the "Who I referred" section.
    const recent = await ctx.db
      .query("referralRedemptions")
      .withIndex("by_referrer", (q) => q.eq("referrerId", user._id))
      .order("desc")
      .take(20);
    const config = await getConfig(ctx);
    return {
      code: row.code,
      totalClicks: row.totalClicks,
      totalSignups: row.totalSignups,
      totalQualified: row.totalQualified,
      totalRewardInk: row.totalRewardInk,
      recent,
      rewards: {
        referrer: config.referrerReward,
        referred: config.referredReward,
        enabled: config.enabled,
      },
    };
  },
});

// Public lookup — validate a code exists and the program is enabled.
// Returned shape is DELIBERATELY minimal so we don't leak internal ids
// or other users' identities.
export const lookupCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const config = await getConfig(ctx);
    if (!config.enabled) return { valid: false, reason: "disabled" as const };
    const normalized = code.toLowerCase().slice(0, 32);
    const row = await ctx.db
      .query("referralCodes")
      .withIndex("by_code", (q) => q.eq("code", normalized))
      .first();
    if (!row) return { valid: false, reason: "not_found" as const };
    return {
      valid: true,
      rewards: {
        referrer: config.referrerReward,
        referred: config.referredReward,
      },
    };
  },
});

// Internal: increment the click counter when someone visits a referral
// URL. Called from the HTTP route which handles dedupe + rate limiting.
export const recordClickInternal = internalMutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const normalized = code.toLowerCase().slice(0, 32);
    const row = await ctx.db
      .query("referralCodes")
      .withIndex("by_code", (q) => q.eq("code", normalized))
      .first();
    if (!row) return { ok: false as const };
    await ctx.db.patch(row._id, { totalClicks: row.totalClicks + 1 });
    return { ok: true as const };
  },
});

// Internal: called from the signup flow with the captured `?ref=CODE`.
// Creates a pending redemption row and increments the referrer's
// signup counter. This is INTERNAL so only trusted server code can
// invoke it — previously we learned the hard way that making this
// kind of attribution mutation public leads to attribution hijacking.
export const attachOnSignupInternal = internalMutation({
  args: {
    userId: v.id("users"),
    code: v.string(),
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, { userId, code, ip, userAgent }) => {
    const config = await getConfig(ctx);
    if (!config.enabled) return null;

    const normalized = code.toLowerCase().slice(0, 32);
    const referralRow = await ctx.db
      .query("referralCodes")
      .withIndex("by_code", (q) => q.eq("code", normalized))
      .first();
    if (!referralRow) return null;

    // Self-referral protection.
    if (referralRow.userId === userId) return null;

    // First-referral-wins — if the same user already has a referral
    // binding, ignore the new code.
    const existing = await ctx.db
      .query("referralRedemptions")
      .withIndex("by_referred", (q) => q.eq("referredUserId", userId))
      .first();
    if (existing) return existing._id;

    const nowIso = new Date().toISOString();
    const id = await ctx.db.insert("referralRedemptions", {
      referrerId: referralRow.userId,
      referredUserId: userId,
      code: normalized,
      status: "pending",
      ip: ip?.slice(0, 64),
      userAgent: userAgent?.slice(0, 256),
      createdAt: nowIso,
    });
    await ctx.db.patch(referralRow._id, {
      totalSignups: referralRow.totalSignups + 1,
    });

    // If the qualifying action is plain "signup", flip to qualified
    // immediately and credit both sides.
    if (config.qualifyingAction === "signup") {
      await qualifyRedemption(ctx, id, config);
    }

    return id;
  },
});

// Internal helper: mark a redemption qualified and credit both sides.
async function qualifyRedemption(
  ctx: MutationCtx,
  redemptionId: Id<"referralRedemptions">,
  config: ReferralConfig,
): Promise<void> {
  const redemption = await ctx.db.get(redemptionId);
  if (!redemption) return;
  if (redemption.status !== "pending") return;

  // Credit both sides. We bump the `inkPurchased` field (the
  // permanent "bonus ink" bucket that rolls over month to month and
  // is spent LAST so the monthly subscription quota stays in play).
  const referrer = await ctx.db.get(redemption.referrerId);
  const referred = await ctx.db.get(redemption.referredUserId);
  if (!referrer || !referred) return;

  const nowIso = new Date().toISOString();
  await ctx.db.patch(referrer._id, {
    inkPurchased: (referrer.inkPurchased ?? 0) + config.referrerReward,
    inkLastActivity: nowIso,
  });
  await ctx.db.patch(referred._id, {
    inkPurchased: (referred.inkPurchased ?? 0) + config.referredReward,
    inkLastActivity: nowIso,
  });

  // Log both ink transactions so the user's ink wallet shows a
  // readable "Referral bonus" line.
  const newReferrerBalance =
    (referrer.inkSubscription ?? 0) + (referrer.inkPurchased ?? 0) + config.referrerReward;
  await ctx.db.insert("inkTransactions", {
    userId: referrer._id,
    type: "reward",
    amount: config.referrerReward,
    balance: newReferrerBalance,
    action: "referral_reward",
    description: `Referral bonus — you invited a friend`,
    createdAt: nowIso,
  });
  const newReferredBalance =
    (referred.inkSubscription ?? 0) + (referred.inkPurchased ?? 0) + config.referredReward;
  await ctx.db.insert("inkTransactions", {
    userId: referred._id,
    type: "reward",
    amount: config.referredReward,
    balance: newReferredBalance,
    action: "referral_welcome",
    description: `Referral bonus — you were invited`,
    createdAt: nowIso,
  });

  // Patch the redemption + referral stats.
  await ctx.db.patch(redemption._id, {
    status: "qualified",
    qualifiedAt: nowIso,
    referrerInkReward: config.referrerReward,
    referredInkReward: config.referredReward,
  });
  const referralRow = await ctx.db
    .query("referralCodes")
    .withIndex("by_user", (q) => q.eq("userId", redemption.referrerId))
    .first();
  if (referralRow) {
    await ctx.db.patch(referralRow._id, {
      totalQualified: referralRow.totalQualified + 1,
      totalRewardInk: referralRow.totalRewardInk + config.referrerReward,
    });
  }
}

// Internal: called when a referred user hits a qualifying event
// (first notebook save, first ink spend, etc). Idempotent — if the
// redemption is already qualified this is a no-op.
export const onQualifyingEventInternal = internalMutation({
  args: {
    userId: v.id("users"),
    event: v.union(v.literal("signup"), v.literal("first_notebook"), v.literal("first_ink_spend")),
  },
  handler: async (ctx, { userId, event }) => {
    const config = await getConfig(ctx);
    if (!config.enabled) return;
    if (config.qualifyingAction !== event) return;
    const redemption = await ctx.db
      .query("referralRedemptions")
      .withIndex("by_referred", (q) => q.eq("referredUserId", userId))
      .first();
    if (!redemption || redemption.status !== "pending") return;
    await qualifyRedemption(ctx, redemption._id, config);
  },
});

// ─────────────────────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────────────────────

export const adminListTopReferrers = query({
  args: {
    sessionToken: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { sessionToken, limit }) => {
    await requireAdminUser(ctx, sessionToken);
    const cap = Math.min(limit ?? 50, MAX_LEADERBOARD_ROWS);
    const rows = await ctx.db
      .query("referralCodes")
      .withIndex("by_qualified")
      .order("desc")
      .take(cap);
    const withUsers = await Promise.all(
      rows.map(async (r) => {
        const user = await ctx.db.get(r.userId);
        return {
          ...r,
          userEmail: user?.email,
          userName: user?.name,
        };
      }),
    );
    return withUsers;
  },
});

export const adminListRedemptions = query({
  args: {
    sessionToken: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("qualified"),
      v.literal("voided"),
    )),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { sessionToken, status, limit }) => {
    await requireAdminUser(ctx, sessionToken);
    const cap = Math.min(limit ?? 100, MAX_LEADERBOARD_ROWS);
    const rows = status
      ? await ctx.db
          .query("referralRedemptions")
          .withIndex("by_status_created", (q) => q.eq("status", status))
          .order("desc")
          .take(cap)
      : await ctx.db
          .query("referralRedemptions")
          .order("desc")
          .take(cap);
    const hydrated = await Promise.all(
      rows.map(async (r) => {
        const [referrer, referred] = await Promise.all([
          ctx.db.get(r.referrerId),
          ctx.db.get(r.referredUserId),
        ]);
        return {
          ...r,
          referrerEmail: referrer?.email,
          referrerName: referrer?.name,
          referredEmail: referred?.email,
          referredName: referred?.name,
        };
      }),
    );
    return hydrated;
  },
});

export const adminGetSummary = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    await requireAdminUser(ctx, sessionToken);
    // Lightweight aggregate over capped row counts. We deliberately
    // don't scan every row of every table — these numbers are the
    // "at-a-glance" tiles on the admin referral page.
    const topReferrers = await ctx.db
      .query("referralCodes")
      .withIndex("by_qualified")
      .order("desc")
      .take(1);
    const allRecentCodes = await ctx.db
      .query("referralCodes")
      .order("desc")
      .take(500);
    const totalClicks = allRecentCodes.reduce((s, r) => s + r.totalClicks, 0);
    const totalSignups = allRecentCodes.reduce((s, r) => s + r.totalSignups, 0);
    const totalQualified = allRecentCodes.reduce((s, r) => s + r.totalQualified, 0);
    const totalRewardInk = allRecentCodes.reduce((s, r) => s + r.totalRewardInk, 0);
    const config = await getConfig(ctx);
    return {
      totalReferrers: allRecentCodes.length,
      totalClicks,
      totalSignups,
      totalQualified,
      totalRewardInk,
      conversionRate:
        totalSignups > 0 ? totalQualified / totalSignups : 0,
      clickToSignupRate:
        totalClicks > 0 ? totalSignups / totalClicks : 0,
      topReferrerQualified: topReferrers[0]?.totalQualified ?? 0,
      config,
    };
  },
});

export const adminUpdateConfig = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    referrerReward: v.optional(v.number()),
    referredReward: v.optional(v.number()),
    enabled: v.optional(v.boolean()),
    qualifyingAction: v.optional(v.union(
      v.literal("signup"),
      v.literal("first_notebook"),
      v.literal("first_ink_spend"),
    )),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminUser(ctx, args.sessionToken);
    const current = await getConfig(ctx);
    const next: ReferralConfig = {
      referrerReward: args.referrerReward ?? current.referrerReward,
      referredReward: args.referredReward ?? current.referredReward,
      enabled: args.enabled ?? current.enabled,
      qualifyingAction: args.qualifyingAction ?? current.qualifyingAction,
    };
    if (next.referrerReward < 0 || next.referrerReward > 10000) {
      throw new Error("Referrer reward out of range");
    }
    if (next.referredReward < 0 || next.referredReward > 10000) {
      throw new Error("Referred reward out of range");
    }
    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "referralConfig"))
      .first();
    const nowIso = new Date().toISOString();
    if (existing) {
      await ctx.db.patch(existing._id, {
        value: next,
        updatedAt: nowIso,
        updatedBy: admin._id,
      });
    } else {
      await ctx.db.insert("appSettings", {
        key: "referralConfig",
        value: next,
        updatedAt: nowIso,
        updatedBy: admin._id,
      });
    }
    await ctx.db.insert("adminAuditLog", {
      actorUserId: admin._id,
      actorEmail: admin.email,
      action: "referrals.adminUpdateConfig",
      details: next,
      createdAt: nowIso,
    });
    return next;
  },
});

export const adminVoidRedemption = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    redemptionId: v.id("referralRedemptions"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { sessionToken, redemptionId, reason }) => {
    const admin = await requireAdminUser(ctx, sessionToken);
    const row = await ctx.db.get(redemptionId);
    if (!row) throw new Error("Redemption not found");
    if (row.status === "voided") return;

    // If it was qualified, roll back the Ink from both sides so fraud
    // can't pocket the reward.
    if (row.status === "qualified") {
      const [referrer, referred] = await Promise.all([
        ctx.db.get(row.referrerId),
        ctx.db.get(row.referredUserId),
      ]);
      if (referrer) {
        await ctx.db.patch(referrer._id, {
          inkPurchased: Math.max(0, (referrer.inkPurchased ?? 0) - (row.referrerInkReward ?? 0)),
        });
      }
      if (referred) {
        await ctx.db.patch(referred._id, {
          inkPurchased: Math.max(0, (referred.inkPurchased ?? 0) - (row.referredInkReward ?? 0)),
        });
      }
      // Decrement stats.
      const referralCode = await ctx.db
        .query("referralCodes")
        .withIndex("by_user", (q) => q.eq("userId", row.referrerId))
        .first();
      if (referralCode) {
        await ctx.db.patch(referralCode._id, {
          totalQualified: Math.max(0, referralCode.totalQualified - 1),
          totalRewardInk: Math.max(0, referralCode.totalRewardInk - (row.referrerInkReward ?? 0)),
        });
      }
    }

    await ctx.db.patch(row._id, {
      status: "voided",
      voidedAt: new Date().toISOString(),
      voidReason: reason,
    });
    await ctx.db.insert("adminAuditLog", {
      actorUserId: admin._id,
      actorEmail: admin.email,
      action: "referrals.adminVoidRedemption",
      details: { redemptionId, reason },
      targetUserId: row.referrerId,
      createdAt: new Date().toISOString(),
    });
  },
});
