import { v } from "convex/values";
import { mutation, query, internalMutation, MutationCtx, QueryCtx } from "./_generated/server";
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

// Sensible defaults. Callers can override per-route.
export const RATE_LIMIT_RULES = {
  login:              { action: "auth.login",              limit: 5,   windowMs: 60 * 1000 },
  signup:             { action: "auth.signup",             limit: 3,   windowMs: 60 * 1000 },
  passwordResetReq:   { action: "auth.password_reset_req", limit: 3,   windowMs: 60 * 1000 },
  passwordResetConf:  { action: "auth.password_reset_conf",limit: 10,  windowMs: 60 * 1000 },
  aiLayout:           { action: "ai.generate_layout",      limit: 20,  windowMs: 60 * 60 * 1000 },
  aiCover:            { action: "ai.generate_cover",       limit: 20,  windowMs: 60 * 60 * 1000 },
  aiAdvanced:         { action: "ai.generate_advanced",    limit: 10,  windowMs: 60 * 60 * 1000 },
  // Per-IP global auth floor — combine with per-email login limit.
  authIpFloor:        { action: "auth.ip_floor",           limit: 30,  windowMs: 60 * 1000 },
  // Public landing endpoints that still write (waitlist).
  waitlistJoin:       { action: "public.waitlist_join",    limit: 5,   windowMs: 60 * 1000 },
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

// Thin Convex mutation wrapper so HTTP actions (which run mutation calls
// via ctx.runMutation) can use this. Uses the same consumeRateLimit.
export const consume = mutation({
  args: {
    scope: v.union(v.literal("ip"), v.literal("user"), v.literal("email"), v.literal("global")),
    subject: v.string(),
    action: v.string(),
    limit: v.number(),
    windowMs: v.number(),
  },
  handler: async (ctx, { scope, subject, action, limit, windowMs }) => {
    return await consumeRateLimit(ctx, {
      scope,
      subject,
      rule: { action, limit, windowMs },
    });
  },
});

// Admin helper: inspect a bucket.
export const inspect = query({
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

// Public entry point callable from a scheduled job or admin UI.
export const kickSweep = mutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.rateLimit.sweepExpired, {
      cursor: null,
    });
    return { scheduled: true };
  },
});
