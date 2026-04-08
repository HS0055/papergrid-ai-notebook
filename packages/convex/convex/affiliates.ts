import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  QueryCtx,
  MutationCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

// ─────────────────────────────────────────────────────────────
// Affiliate program — schema-backed CRUD + tracking
// ─────────────────────────────────────────────────────────────
//
// Conventions match notebooks.ts / users.ts:
//  • Auth via session token, fallback to Convex identity
//  • Owner check: existing.userId !== user._id → "Forbidden"
//  • Admin actions go through requireAdmin
//  • Denormalized counts on `affiliates` so the dashboard never scans
//    the high-volume click/conversion tables.
//
// Money is stored in **cents** as integers throughout to avoid float
// rounding bugs in commission math.

const DEFAULT_COMMISSION_RATE = 0.30;     // 30% recurring
const DEFAULT_COOKIE_DAYS = 60;           // attribution window
const MAX_LIST = 500;
const PAYOUT_MIN_CENTS = 5000;            // $50.00 minimum payout

// ── Auth helpers ──────────────────────────────────────────────
async function requireAuthUser(
  ctx: QueryCtx | MutationCtx,
  sessionToken?: string,
): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity) {
    const u = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (u) return u;
  }
  if (sessionToken) {
    const session = await ctx.db
      .query("authSessions")
      .withIndex("by_token", (q) => q.eq("token", sessionToken))
      .first();
    if (session && new Date(session.expiresAt).getTime() > Date.now()) {
      const u = await ctx.db.get(session.userId);
      if (u) return u;
    }
  }
  throw new Error("Not authenticated");
}

async function requireAdmin(
  ctx: QueryCtx | MutationCtx,
  sessionToken?: string,
): Promise<Doc<"users">> {
  const user = await requireAuthUser(ctx, sessionToken);
  if (user.role !== "admin") throw new Error("Forbidden: admin only");
  return user;
}

// Generate a short, URL-safe referral code. Collision-checked by caller.
// Uses crypto.getRandomValues for an 8-char base36 suffix (~41 bits of
// entropy) — Math.random() was fine in dev but too predictable for the
// public lookup surface at scale.
function generateCode(seed: string): string {
  const clean = seed.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  const bytes = crypto.getRandomValues(new Uint32Array(2));
  const suffix = (bytes[0].toString(36) + bytes[1].toString(36))
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 8)
    .padEnd(6, "x");
  return `${clean || "ref"}${suffix}`;
}

// ─────────────────────────────────────────────────────────────
// USER-FACING QUERIES
// ─────────────────────────────────────────────────────────────

export const getMyAffiliate = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireAuthUser(ctx, sessionToken);
    return await ctx.db
      .query("affiliates")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
  },
});

export const getMyStats = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireAuthUser(ctx, sessionToken);
    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!affiliate) return null;

    // Pending balance = approved conversions not yet attached to a payout
    const approved = await ctx.db
      .query("affiliateConversions")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", affiliate._id))
      .filter((q) => q.eq(q.field("status"), "approved"))
      .take(MAX_LIST);
    const pendingPayoutCents = approved.reduce((sum, c) => sum + c.commissionCents, 0);

    return {
      affiliate,
      pendingPayoutCents,
      payoutMinCents: PAYOUT_MIN_CENTS,
      canRequestPayout: pendingPayoutCents >= PAYOUT_MIN_CENTS,
    };
  },
});

export const listMyConversions = query({
  args: {
    sessionToken: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { sessionToken, limit }) => {
    const user = await requireAuthUser(ctx, sessionToken);
    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!affiliate) return [];
    const cap = Math.min(limit ?? 100, MAX_LIST);
    return await ctx.db
      .query("affiliateConversions")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", affiliate._id))
      .order("desc")
      .take(cap);
  },
});

export const listMyClicks = query({
  args: {
    sessionToken: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { sessionToken, limit }) => {
    const user = await requireAuthUser(ctx, sessionToken);
    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!affiliate) return [];
    const cap = Math.min(limit ?? 100, MAX_LIST);
    return await ctx.db
      .query("affiliateClicks")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", affiliate._id))
      .order("desc")
      .take(cap);
  },
});

export const listMyPayouts = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireAuthUser(ctx, sessionToken);
    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!affiliate) return [];
    return await ctx.db
      .query("affiliatePayouts")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", affiliate._id))
      .order("desc")
      .take(MAX_LIST);
  },
});

// Public lookup by referral code — used by the click tracker. Returns the
// _id only so the click writer doesn't need to expose internal fields.
export const findByCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const aff = await ctx.db
      .query("affiliates")
      .withIndex("by_code", (q) => q.eq("code", code.toLowerCase()))
      .first();
    if (!aff || aff.status !== "approved") return null;
    return { _id: aff._id, code: aff.code, cookieWindowDays: aff.cookieWindowDays };
  },
});

// ─────────────────────────────────────────────────────────────
// USER-FACING MUTATIONS
// ─────────────────────────────────────────────────────────────

export const apply = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    applicationNote: v.optional(v.string()),
    audience: v.optional(v.string()),
    promotionChannels: v.optional(v.array(v.string())),
    websiteUrl: v.optional(v.string()),
    socialHandles: v.optional(v.array(v.string())),
    payoutMethod: v.optional(v.union(
      v.literal("paypal"),
      v.literal("stripe"),
      v.literal("bank"),
    )),
    payoutEmail: v.optional(v.string()),
    payoutCountry: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx, args.sessionToken);

    // Idempotent — if already applied, return existing row
    const existing = await ctx.db
      .query("affiliates")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (existing) return existing._id;

    // Generate a unique referral code (retry on collision)
    let code = generateCode(user.name || user.email);
    for (let attempt = 0; attempt < 5; attempt++) {
      const collision = await ctx.db
        .query("affiliates")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();
      if (!collision) break;
      code = generateCode(user.name || user.email);
    }

    return await ctx.db.insert("affiliates", {
      userId: user._id,
      code,
      status: "pending",
      commissionRate: DEFAULT_COMMISSION_RATE,
      cookieWindowDays: DEFAULT_COOKIE_DAYS,
      applicationNote: args.applicationNote,
      audience: args.audience,
      promotionChannels: args.promotionChannels,
      websiteUrl: args.websiteUrl,
      socialHandles: args.socialHandles,
      payoutMethod: args.payoutMethod,
      payoutEmail: args.payoutEmail,
      payoutCountry: args.payoutCountry,
      totalClicks: 0,
      totalConversions: 0,
      totalEarnedCents: 0,
      totalPaidCents: 0,
      appliedAt: new Date().toISOString(),
    });
  },
});

export const updateMyPayoutInfo = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    payoutMethod: v.optional(v.union(
      v.literal("paypal"),
      v.literal("stripe"),
      v.literal("bank"),
    )),
    payoutEmail: v.optional(v.string()),
    payoutCountry: v.optional(v.string()),
  },
  handler: async (ctx, { sessionToken, ...fields }) => {
    const user = await requireAuthUser(ctx, sessionToken);
    const aff = await ctx.db
      .query("affiliates")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!aff) throw new Error("Not an affiliate");
    const updates: Record<string, unknown> = {};
    if (fields.payoutMethod !== undefined) updates.payoutMethod = fields.payoutMethod;
    if (fields.payoutEmail !== undefined) updates.payoutEmail = fields.payoutEmail;
    if (fields.payoutCountry !== undefined) updates.payoutCountry = fields.payoutCountry;
    await ctx.db.patch(aff._id, updates);
  },
});

export const requestPayout = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireAuthUser(ctx, sessionToken);
    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!affiliate) throw new Error("Not an affiliate");
    if (affiliate.status !== "approved") {
      throw new Error("Affiliate account is not active");
    }
    if (!affiliate.payoutMethod || !affiliate.payoutEmail) {
      throw new Error("Set your payout method and email before requesting a payout");
    }

    // Refuse if any payout is already in-flight. Without this check the
    // handler below would happily create a second payout pointing at the
    // same conversion rows → double-pay on admin mark-paid.
    const inFlight = await ctx.db
      .query("affiliatePayouts")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", affiliate._id))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "requested"),
          q.eq(q.field("status"), "processing"),
        ),
      )
      .first();
    if (inFlight) {
      throw new Error(
        "You already have a payout in progress. Wait for it to clear before requesting another.",
      );
    }

    // CRITICAL FIX: filter by payoutId === undefined. Previously the query
    // selected every approved conversion for this affiliate regardless of
    // whether it was already attached to an earlier payout — so calling
    // requestPayout twice would grab the same rows twice and create a
    // second payout for money already requested. This was a revenue bug.
    const approved = await ctx.db
      .query("affiliateConversions")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", affiliate._id))
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "approved"),
          q.eq(q.field("payoutId"), undefined),
        ),
      )
      .take(MAX_LIST);
    if (approved.length === 0) throw new Error("No approved earnings to pay out");
    const total = approved.reduce((sum, c) => sum + c.commissionCents, 0);
    if (total < PAYOUT_MIN_CENTS) {
      throw new Error(
        `Payouts require a minimum of $${(PAYOUT_MIN_CENTS / 100).toFixed(2)}`,
      );
    }

    const payoutId = await ctx.db.insert("affiliatePayouts", {
      affiliateId: affiliate._id,
      amountCents: total,
      currency: "usd",
      method: affiliate.payoutMethod,
      status: "requested",
      requestedAt: new Date().toISOString(),
    });

    // Mark every approved conversion as belonging to this payout (still in
    // "approved" status until admin marks the payout paid). Parallelized.
    await Promise.all(approved.map((c) => ctx.db.patch(c._id, { payoutId })));

    return payoutId;
  },
});

// ─────────────────────────────────────────────────────────────
// CLICK TRACKING (called from trusted HTTP route only)
// ─────────────────────────────────────────────────────────────

// Internal click recorder. Previously this was a public `mutation` which
// meant any client could call it directly with attacker-controlled
// `visitorId` / `ip` / `country`, flooding the click table and inflating
// an affiliate's totalClicks without bound. It's now only callable from
// the `affiliateHttp.ts` HTTP action which sources ip from request
// headers, rate-limits per IP, and deduplicates by visitor.
export const recordClickInternal = internalMutation({
  args: {
    code: v.string(),
    visitorId: v.string(),
    landingPath: v.optional(v.string()),
    referrer: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    ip: v.optional(v.string()),
    country: v.optional(v.string()),
    // Dedupe window in ms — if the same (affiliate, visitor) pair wrote
    // a click inside this window, we don't insert again.
    dedupeWindowMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const code = args.code.toLowerCase();
    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (!affiliate || affiliate.status !== "approved") {
      return { ok: false, reason: "invalid_code" as const };
    }

    // Dedupe within the window: the same visitor hitting the same ref
    // link 10 times in 5 minutes should count as ONE click, not 10.
    const window = args.dedupeWindowMs ?? 5 * 60 * 1000;
    const nowIso = new Date().toISOString();
    const recentByVisitor = await ctx.db
      .query("affiliateClicks")
      .withIndex("by_visitor", (q) => q.eq("visitorId", args.visitorId))
      .order("desc")
      .take(5);
    const recentForThisAffiliate = recentByVisitor.find(
      (c) =>
        c.affiliateId === affiliate._id &&
        Date.now() - new Date(c.createdAt).getTime() < window,
    );
    if (recentForThisAffiliate) {
      return {
        ok: true as const,
        deduped: true,
        cookieWindowDays: affiliate.cookieWindowDays,
      };
    }

    // Clamp caller-supplied strings so a pathological header can't blow
    // document size or the `ip` rate-limit key.
    const clamp = (s: string | undefined, n: number) =>
      s ? s.slice(0, n) : undefined;

    await ctx.db.insert("affiliateClicks", {
      affiliateId: affiliate._id,
      code,
      visitorId: args.visitorId.slice(0, 64),
      landingPath: clamp(args.landingPath, 256),
      referrer: clamp(args.referrer, 256),
      userAgent: clamp(args.userAgent, 256),
      ip: clamp(args.ip, 64),
      country: clamp(args.country, 8),
      createdAt: nowIso,
    });

    await ctx.db.patch(affiliate._id, {
      totalClicks: affiliate.totalClicks + 1,
    });

    // Note: affiliateId is deliberately NOT returned to the caller —
    // previous version leaked the internal Convex id to the public
    // HTTP response, enabling affiliate enumeration.
    return {
      ok: true as const,
      deduped: false,
      cookieWindowDays: affiliate.cookieWindowDays,
    };
  },
});

// Called from the signup flow with the captured `?ref=` cookie. Records the
// referral attribution so future paid events get credited to the affiliate.
//
// INTERNAL-ONLY. Previously this was a public `mutation` which meant any
// user could call api.affiliates.attachReferralOnSignup({ userId, code })
// directly and bind arbitrary signups to their own referral code before
// the real signup flow got the chance. First-mover-wins race = fraud.
// The signup HTTP action calls this from the trusted server side after
// reading a SIGNED httpOnly cookie (see affiliateHttp.ts).
export const attachReferralOnSignupInternal = internalMutation({
  args: {
    userId: v.id("users"),
    code: v.string(),
    landingPath: v.optional(v.string()),
  },
  handler: async (ctx, { userId, code, landingPath }) => {
    const normalized = code.toLowerCase();
    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_code", (q) => q.eq("code", normalized))
      .first();
    if (!affiliate || affiliate.status !== "approved") return null;

    // Self-referral protection
    if (affiliate.userId === userId) return null;

    // One referral per user — first one wins
    const existing = await ctx.db
      .query("userReferrals")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) return existing._id;

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + affiliate.cookieWindowDays * 24 * 60 * 60 * 1000,
    );
    return await ctx.db.insert("userReferrals", {
      userId,
      affiliateId: affiliate._id,
      code: normalized,
      cookieSetAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      firstSeenLandingPath: landingPath,
      createdAt: now.toISOString(),
    });
  },
});

// Called from the Stripe webhook on a successful payment. Looks up the
// referral attribution and (if still inside the cookie window) creates a
// commissionable conversion.
export const recordConversion = internalMutation({
  args: {
    userId: v.id("users"),
    type: v.union(
      v.literal("signup"),
      v.literal("subscription"),
      v.literal("renewal"),
      v.literal("ink_purchase"),
    ),
    grossAmountCents: v.number(),
    currency: v.optional(v.string()),
    stripePaymentIntentId: v.optional(v.string()),
    stripeInvoiceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const referral = await ctx.db
      .query("userReferrals")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!referral) return null;

    // Cookie window check
    if (new Date(referral.expiresAt).getTime() < Date.now()) return null;

    const affiliate = await ctx.db.get(referral.affiliateId);
    if (!affiliate || affiliate.status !== "approved") return null;

    // Global idempotency check on BOTH payment_intent_id and invoice_id.
    // Previously scoped to `by_affiliate` + in-memory filter, which
    // (a) was a full scan of every conversion the affiliate had ever had
    // and (b) would double-count if Stripe replayed the same invoice with
    // a different payment intent (possible on retries).
    //
    // The scan is unavoidable without a new compound index; scale audit
    // flagged this to be replaced by `by_stripe_payment_intent` /
    // `by_stripe_invoice` compound indexes. Until those ship we at least
    // fail safe by checking both ids globally.
    if (args.stripePaymentIntentId || args.stripeInvoiceId) {
      const affiliateConversions = await ctx.db
        .query("affiliateConversions")
        .withIndex("by_affiliate", (q) => q.eq("affiliateId", affiliate._id))
        .collect();
      const existing = affiliateConversions.find(
        (c) =>
          (args.stripePaymentIntentId &&
            c.stripePaymentIntentId === args.stripePaymentIntentId) ||
          (args.stripeInvoiceId && c.stripeInvoiceId === args.stripeInvoiceId),
      );
      if (existing) return existing._id;
    }

    const commissionCents = Math.round(
      args.grossAmountCents * affiliate.commissionRate,
    );

    // Free signups create a row for tracking but with zero commission and
    // status=approved (no refund risk).
    const isFreeSignup = args.type === "signup";

    const conversionId = await ctx.db.insert("affiliateConversions", {
      affiliateId: affiliate._id,
      referredUserId: args.userId,
      type: args.type,
      grossAmountCents: args.grossAmountCents,
      commissionCents: isFreeSignup ? 0 : commissionCents,
      commissionRate: affiliate.commissionRate,
      currency: args.currency ?? "usd",
      stripePaymentIntentId: args.stripePaymentIntentId,
      stripeInvoiceId: args.stripeInvoiceId,
      // Paid conversions sit in "pending" until the refund window passes
      // (admin can flip to approved manually or via a scheduled job).
      status: isFreeSignup ? "approved" : "pending",
      createdAt: new Date().toISOString(),
      approvedAt: isFreeSignup ? new Date().toISOString() : undefined,
    });

    await ctx.db.patch(affiliate._id, {
      totalConversions: affiliate.totalConversions + 1,
      totalEarnedCents: affiliate.totalEarnedCents + (isFreeSignup ? 0 : commissionCents),
    });

    return conversionId;
  },
});

// ─────────────────────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────────────────────

export const adminListAffiliates = query({
  args: {
    sessionToken: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("banned"),
    )),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { sessionToken, status, limit }) => {
    await requireAdmin(ctx, sessionToken);
    const cap = Math.min(limit ?? 200, MAX_LIST);
    let rows: Doc<"affiliates">[];
    if (status) {
      rows = await ctx.db
        .query("affiliates")
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("desc")
        .take(cap);
    } else {
      rows = await ctx.db.query("affiliates").order("desc").take(cap);
    }
    // Hydrate user info
    const out = [] as Array<Doc<"affiliates"> & { userEmail?: string; userName?: string }>;
    for (const row of rows) {
      const u = await ctx.db.get(row.userId);
      out.push({ ...row, userEmail: u?.email, userName: u?.name });
    }
    return out;
  },
});

export const adminApprove = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    affiliateId: v.id("affiliates"),
    commissionRate: v.optional(v.number()),
    cookieWindowDays: v.optional(v.number()),
  },
  handler: async (ctx, { sessionToken, affiliateId, commissionRate, cookieWindowDays }) => {
    const admin = await requireAdmin(ctx, sessionToken);
    const aff = await ctx.db.get(affiliateId);
    if (!aff) throw new Error("Affiliate not found");
    if (commissionRate !== undefined && (commissionRate < 0 || commissionRate > 0.5)) {
      throw new Error("Commission rate must be between 0 and 0.5");
    }
    if (cookieWindowDays !== undefined && (cookieWindowDays < 1 || cookieWindowDays > 90)) {
      throw new Error("Cookie window must be between 1 and 90 days");
    }
    await ctx.db.patch(affiliateId, {
      status: "approved",
      commissionRate: commissionRate ?? aff.commissionRate,
      cookieWindowDays: cookieWindowDays ?? aff.cookieWindowDays,
      approvedAt: new Date().toISOString(),
      approvedBy: admin._id,
    });
  },
});

export const adminReject = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    affiliateId: v.id("affiliates"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { sessionToken, affiliateId, reason }) => {
    await requireAdmin(ctx, sessionToken);
    await ctx.db.patch(affiliateId, {
      status: "rejected",
      rejectedAt: new Date().toISOString(),
      rejectionReason: reason,
    });
  },
});

export const adminBan = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    affiliateId: v.id("affiliates"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { sessionToken, affiliateId, reason }) => {
    await requireAdmin(ctx, sessionToken);
    await ctx.db.patch(affiliateId, {
      status: "banned",
      bannedAt: new Date().toISOString(),
      banReason: reason,
    });
    // Auto-void any pending conversions — a fraud-detected affiliate
    // should not be able to have their in-flight conversions later
    // flipped to approved and paid out.
    const pending = await ctx.db
      .query("affiliateConversions")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", affiliateId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .take(MAX_LIST);
    await Promise.all(
      pending.map((c) => ctx.db.patch(c._id, { status: "voided" })),
    );
  },
});

export const adminSetRate = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    affiliateId: v.id("affiliates"),
    commissionRate: v.number(),
  },
  handler: async (ctx, { sessionToken, affiliateId, commissionRate }) => {
    await requireAdmin(ctx, sessionToken);
    // Clamp at 50% — higher than that is almost certainly a fat-finger.
    if (commissionRate < 0 || commissionRate > 0.5) {
      throw new Error("Commission rate must be between 0 and 0.5 (50%)");
    }
    await ctx.db.patch(affiliateId, { commissionRate });
  },
});

export const adminApproveConversion = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    conversionId: v.id("affiliateConversions"),
  },
  handler: async (ctx, { sessionToken, conversionId }) => {
    await requireAdmin(ctx, sessionToken);
    await ctx.db.patch(conversionId, {
      status: "approved",
      approvedAt: new Date().toISOString(),
    });
  },
});

export const adminVoidConversion = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    conversionId: v.id("affiliateConversions"),
  },
  handler: async (ctx, { sessionToken, conversionId }) => {
    await requireAdmin(ctx, sessionToken);
    const conv = await ctx.db.get(conversionId);
    if (!conv) throw new Error("Conversion not found");
    await ctx.db.patch(conversionId, { status: "voided" });
    // Roll back the affiliate's denormalized totals
    const aff = await ctx.db.get(conv.affiliateId);
    if (aff) {
      await ctx.db.patch(aff._id, {
        totalEarnedCents: Math.max(0, aff.totalEarnedCents - conv.commissionCents),
        totalConversions: Math.max(0, aff.totalConversions - 1),
      });
    }
  },
});

export const adminListPayouts = query({
  args: {
    sessionToken: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("requested"),
      v.literal("processing"),
      v.literal("paid"),
      v.literal("failed"),
    )),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { sessionToken, status, limit }) => {
    await requireAdmin(ctx, sessionToken);
    const cap = Math.min(limit ?? 200, MAX_LIST);
    let rows: Doc<"affiliatePayouts">[];
    if (status) {
      rows = await ctx.db
        .query("affiliatePayouts")
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("desc")
        .take(cap);
    } else {
      rows = await ctx.db.query("affiliatePayouts").order("desc").take(cap);
    }
    // Hydrate affiliate handle
    const out = [] as Array<
      Doc<"affiliatePayouts"> & {
        affiliateCode?: string;
        userEmail?: string;
      }
    >;
    for (const row of rows) {
      const aff = await ctx.db.get(row.affiliateId);
      const user = aff ? await ctx.db.get(aff.userId) : null;
      out.push({ ...row, affiliateCode: aff?.code, userEmail: user?.email });
    }
    return out;
  },
});

export const adminMarkPayoutPaid = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    payoutId: v.id("affiliatePayouts"),
    reference: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { sessionToken, payoutId, reference, note }) => {
    const admin = await requireAdmin(ctx, sessionToken);
    const payout = await ctx.db.get(payoutId);
    if (!payout) throw new Error("Payout not found");
    if (payout.status === "paid") return; // idempotent

    const now = new Date().toISOString();
    await ctx.db.patch(payoutId, {
      status: "paid",
      reference,
      note,
      paidAt: now,
      paidBy: admin._id,
    });

    // Move every conversion in this payout from approved → paid
    const conversions = await ctx.db
      .query("affiliateConversions")
      .withIndex("by_payout", (q) => q.eq("payoutId", payoutId))
      .take(MAX_LIST);
    for (const c of conversions) {
      await ctx.db.patch(c._id, { status: "paid", paidAt: now });
    }

    // Bump affiliate's totalPaidCents
    const affiliate = await ctx.db.get(payout.affiliateId);
    if (affiliate) {
      await ctx.db.patch(affiliate._id, {
        totalPaidCents: affiliate.totalPaidCents + payout.amountCents,
      });
    }
  },
});

export const adminMarkPayoutFailed = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    payoutId: v.id("affiliatePayouts"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { sessionToken, payoutId, reason }) => {
    await requireAdmin(ctx, sessionToken);
    const payout = await ctx.db.get(payoutId);
    if (!payout) throw new Error("Payout not found");
    await ctx.db.patch(payoutId, {
      status: "failed",
      note: reason,
    });
    // Detach the conversions so they're available for the next payout
    const conversions = await ctx.db
      .query("affiliateConversions")
      .withIndex("by_payout", (q) => q.eq("payoutId", payoutId))
      .take(MAX_LIST);
    for (const c of conversions) {
      await ctx.db.patch(c._id, { payoutId: undefined });
    }
  },
});

export const adminGetAffiliateDetail = query({
  args: {
    sessionToken: v.optional(v.string()),
    affiliateId: v.id("affiliates"),
  },
  handler: async (ctx, { sessionToken, affiliateId }) => {
    await requireAdmin(ctx, sessionToken);
    const aff = await ctx.db.get(affiliateId);
    if (!aff) return null;
    const user = await ctx.db.get(aff.userId);
    const recentConversions = await ctx.db
      .query("affiliateConversions")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", affiliateId))
      .order("desc")
      .take(50);
    const recentPayouts = await ctx.db
      .query("affiliatePayouts")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", affiliateId))
      .order("desc")
      .take(20);
    return {
      affiliate: aff,
      user: user
        ? { _id: user._id, email: user.email, name: user.name, plan: user.plan }
        : null,
      recentConversions,
      recentPayouts,
    };
  },
});
