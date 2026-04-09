import { v } from "convex/values";
import {
  mutation,
  internalMutation,
  internalQuery,
  MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";

// Fixed-window rate limiter backed by the `rateLimits` table.
//
// Why not a sliding log? We're running inside Convex — each rate-limit
// check is a mutation read+write against a single document keyed by
// (scope, subject, action). Fixed window keeps that to one read + one
// write per check with no time-series bookkeeping. It's not perfect
// (spikes at window boundaries) but for auth / AI abuse protection
// it's the right trade-off: cheap, predictable, and DDoS-resistant.
//
// The key format is `<scope>:<subject>:<action>` where:
//   scope:   "ip" | "user" | "email" | "global"
//   subject: the scoped identifier (IP, userId, email, or "*")
//   action:  the endpoint name, e.g. "login", "signup", "ai.generate"
//
// Callers invoke `consumeRateLimit(...)` from the HTTP action layer.
// The helper performs the read, decides if the request is allowed, and
// returns `{ allowed, remaining, retryAfterSec }`.

export interface RateLimitRule {
  /** Human-readable action name used in the composite key. */
  action: string;
  /** Max requests allowed inside the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitRequest {
  scope: "ip" | "user" | "email" | "global";
  subject: string;
  rule: RateLimitRule;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

// ── Server-owned rate-limit rules ────────────────────────────
//
// SECURITY: These thresholds are the SOLE source of truth for
// rate-limit enforcement. Callers pass the `action` string and the
// server resolves the limit/windowMs — there is no way for a caller
// to override them any more. See RULE_BY_ACTION below for the lookup
// path used by the public `consume` mutation.
//
// When adding a new rate-limited action:
//   1. Add the entry here with a sensible (conservative) limit.
//   2. Call `api.rateLimit.consume({ scope, subject, action })` from
//      your HTTP action with the matching `action` string.
//   3. DO NOT pass limit/windowMs at the call site — the server owns
//      them. The public mutation no longer accepts those arguments.
export const RATE_LIMIT_RULES = {
  // ── Auth: per-email ──
  login:              { action: "auth.login",                 limit: 5,   windowMs: 60 * 1000 },
  signup:             { action: "auth.signup",                limit: 3,   windowMs: 60 * 1000 },
  passwordResetReq:   { action: "auth.password_reset_req",    limit: 3,   windowMs: 60 * 1000 },
  passwordResetConf:  { action: "auth.password_reset_conf",   limit: 10,  windowMs: 60 * 1000 },
  // ── Auth: per-IP floors ──
  authIpFloor:        { action: "auth.ip_floor",              limit: 30,  windowMs: 60 * 1000 },
  loginIp:            { action: "auth.login_ip",              limit: 30,  windowMs: 60 * 1000 },
  signupIp:           { action: "auth.signup_ip",             limit: 10,  windowMs: 60 * 1000 },
  passwordResetReqIp: { action: "auth.password_reset_req_ip", limit: 10,  windowMs: 60 * 1000 },
  // ── AI generation ──
  aiLayout:           { action: "ai.generate_layout",         limit: 20,  windowMs: 60 * 60 * 1000 },
  aiLayoutIp:         { action: "ai.generate_layout_ip",      limit: 60,  windowMs: 60 * 60 * 1000 },
  aiCover:            { action: "ai.generate_cover",          limit: 20,  windowMs: 60 * 60 * 1000 },
  aiAdvanced:         { action: "ai.generate_advanced",       limit: 10,  windowMs: 60 * 60 * 1000 },
  // ── Public landing ──
  waitlistJoin:       { action: "public.waitlist_join",       limit: 5,   windowMs: 60 * 1000 },
  // ── Affiliate tracking ──
  affiliateTrackClickIp:   { action: "affiliate.track_click_ip",   limit: 30,  windowMs: 60 * 1000 },
  affiliateTrackClickCode: { action: "affiliate.track_click_code", limit: 500, windowMs: 60 * 1000 },
  affiliateLookupIp:       { action: "affiliate.lookup_ip",        limit: 30,  windowMs: 60 * 1000 },
  // ── Referral tracking ──
  referralLookupIp:        { action: "referral.lookup_ip",         limit: 30,  windowMs: 60 * 1000 },
  referralTrackClickIp:    { action: "referral.track_click_ip",    limit: 30,  windowMs: 60 * 1000 },
} as const;

function buildKey(req: RateLimitRequest): string {
  // Subject is user-controlled (IP / email). Clamp to 200 chars so a
  // pathological header can't blow the document size.
  const safeSubject = (req.subject || "unknown").slice(0, 200);
  return `${req.scope}:${safeSubject}:${req.rule.action}`;
}

/**
 * Consume one unit from the rate-limit bucket for this (scope, subject,
 * action). Resets the window if it has expired. Must be called inside
 * a mutation context — it writes.
 *
 * Convex OCC protects us from two concurrent requests double-spending
 * the same bucket: the second will retry against the updated doc.
 */
export async function consumeRateLimit(
  ctx: MutationCtx,
  req: RateLimitRequest,
): Promise<RateLimitResult> {
  const key = buildKey(req);
  const now = Date.now();
  const existing = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();

  if (!existing) {
    await ctx.db.insert("rateLimits", {
      key,
      count: 1,
      windowStart: now,
      windowMs: req.rule.windowMs,
      limit: req.rule.limit,
      lastHitAt: now,
    });
    return { allowed: true, remaining: req.rule.limit - 1, retryAfterSec: 0 };
  }

  const windowEnd = existing.windowStart + existing.windowMs;
  if (now >= windowEnd) {
    // Old window expired — start a new one.
    await ctx.db.patch(existing._id, {
      count: 1,
      windowStart: now,
      windowMs: req.rule.windowMs,
      limit: req.rule.limit,
      lastHitAt: now,
    });
    return { allowed: true, remaining: req.rule.limit - 1, retryAfterSec: 0 };
  }

  if (existing.count >= existing.limit) {
    const retryAfterSec = Math.max(1, Math.ceil((windowEnd - now) / 1000));
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  await ctx.db.patch(existing._id, {
    count: existing.count + 1,
    lastHitAt: now,
  });
  return {
    allowed: true,
    remaining: existing.limit - (existing.count + 1),
    retryAfterSec: 0,
  };
}

// ── Server-side rule index ───────────────────────────────────
//
// SECURITY: Previously the `consume` mutation accepted caller-supplied
// `limit` and `windowMs` values and persisted them to the `rateLimits`
// table. On subsequent checks the bucket's persisted (attacker-poisoned)
// limit was used for enforcement, so any unauthenticated caller could:
//
//   1. Disable rate limiting for themselves by calling
//      `consume({ action: "ai.generate_layout", limit: 999999, windowMs: 1 })`
//      which poisoned the bucket with a 1M ceiling.
//   2. DoS another user by calling
//      `consume({ scope: "user", subject: victimId, limit: 0, windowMs: 1yr })`
//      which poisoned their bucket with a zero ceiling for a year.
//   3. Permanently rate-limit an IP or email with a huge window.
//
// The fix is to NEVER trust caller-supplied thresholds. The caller
// can only specify WHICH action is being throttled — the limit and
// window are looked up from the server-owned `RATE_LIMIT_RULES`
// constant by action-string key below.
const RULE_BY_ACTION: Record<string, RateLimitRule> = Object.freeze(
  Object.fromEntries(
    Object.values(RATE_LIMIT_RULES).map((r) => [r.action, r]),
  ),
);

// Public rate-limit check. Callers specify only (scope, subject, action);
// limit and windowMs are resolved server-side from RATE_LIMIT_RULES so
// they cannot be poisoned.
export const consume = mutation({
  args: {
    scope: v.union(v.literal("ip"), v.literal("user"), v.literal("email"), v.literal("global")),
    subject: v.string(),
    action: v.string(),
  },
  handler: async (ctx, { scope, subject, action }) => {
    const rule = RULE_BY_ACTION[action];
    if (!rule) {
      // Refuse unknown actions. An attacker can't conjure up a brand-new
      // bucket key and a brand-new (huge) limit any more — they'd have
      // to get the server config updated, which requires admin access.
      throw new Error(`Unknown rate-limit action: ${action}`);
    }
    return await consumeRateLimit(ctx, {
      scope,
      subject,
      rule,
    });
  },
});

// Admin helper: inspect a bucket. Internal-only now — previously a
// public query that leaked bucket state (and therefore implicitly
// leaked email/IP/user activity) to anyone who could guess the key.
export const inspectInternal = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    return await ctx.db
      .query("rateLimits")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
  },
});

// Periodic sweeper — deletes stale buckets so the table doesn't accrete
// forever. Can be invoked from a cron or manually by an admin.
export const sweepExpired = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db
      .query("rateLimits")
      .paginate({ numItems: 500, cursor });
    const now = Date.now();
    for (const row of page.page) {
      // Delete anything whose window ended more than an hour ago.
      if (row.windowStart + row.windowMs + 60 * 60 * 1000 < now) {
        await ctx.db.delete(row._id);
      }
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.rateLimit.sweepExpired, {
        cursor: page.continueCursor,
      });
    }
  },
});

// Admin-gated sweep trigger. Previously this was a public mutation
// that any caller could hit in a loop to schedule arbitrary amounts
// of scheduler work (each invocation paginates the entire rateLimits
// table). Now it's an internal mutation — callable only from server
// code (e.g. a cron job), never directly from the Convex client.
export const kickSweep = internalMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.rateLimit.sweepExpired, {
      cursor: null,
    });
    return { scheduled: true };
  },
});
