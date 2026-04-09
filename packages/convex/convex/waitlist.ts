import { mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Add an email to the iOS launch waitlist.
 *
 * Idempotent: existing emails return success without duplicating. The HTTP
 * layer must not reveal whether a given email is already on the list (no
 * email enumeration).
 *
 * Returns `{ success: true, isNew }` so the API layer can decide whether
 * to send a "thanks for joining" email vs a "you're already on the list"
 * email vs nothing.
 */
export const join = mutation({
  args: {
    email: v.string(),
    source: v.optional(v.string()),
    referrer: v.optional(v.string()),
  },
  handler: async (ctx, { email, source, referrer }) => {
    const normalized = normalizeEmail(email);
    if (!normalized || !EMAIL_RE.test(normalized)) {
      throw new Error("Invalid email");
    }

    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();

    if (existing) {
      return { success: true, isNew: false };
    }

    await ctx.db.insert("waitlist", {
      email: normalized,
      source: source?.slice(0, 64),
      referrer: referrer?.slice(0, 256),
      createdAt: new Date().toISOString(),
    });

    // Increment the denormalized counter so `count` is O(1) instead of a
    // full table scan. The `counters` table (see schema.ts) exists exactly
    // for this kind of aggregate.
    const counter = await ctx.db
      .query("counters")
      .withIndex("by_key", (q) => q.eq("key", "waitlist_total"))
      .first();
    const nowIso = new Date().toISOString();
    if (counter) {
      await ctx.db.patch(counter._id, { value: counter.value + 1, updatedAt: nowIso });
    } else {
      await ctx.db.insert("counters", { key: "waitlist_total", value: 1, updatedAt: nowIso });
    }

    return { success: true, isNew: true };
  },
});

/**
 * Admin-only: list waitlist entries with pagination + filtering.
 * Used by the AdminPanel waitlist tab.
 *
 * SECURITY: exposed ONLY as `internalQuery` so it can't be called from
 * the public Convex client. The only legitimate caller is the
 * /api/admin/waitlist HTTP route, which performs the admin role check
 * BEFORE invoking this via `ctx.runQuery(internal.waitlist.list, ...)`.
 * Previously this was a public `query`, which meant the admin HTTP
 * gate was trivially bypassable by calling `api.waitlist.list` from
 * any signed-in browser — returning raw email addresses of everyone
 * on the waitlist.
 */
export const list = internalQuery({
  args: {
    limit: v.optional(v.number()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, { limit, source }) => {
    const pageSize = Math.min(Math.max(limit ?? 100, 1), 500);

    const items = source
      ? await ctx.db
          .query("waitlist")
          .withIndex("by_source", (q) => q.eq("source", source))
          .order("desc")
          .take(pageSize)
      : await ctx.db.query("waitlist").order("desc").take(pageSize);

    return {
      items,
      total: items.length,
    };
  },
});

/**
 * Admin-only: count of waitlist entries (for dashboard stats).
 *
 * Reads the denormalized counter maintained by `join`. Previously this did a
 * full .collect() of the entire waitlist table on every admin dashboard
 * render — at 10k emails that's a guaranteed O(n) scan.
 *
 * SECURITY: same reasoning as `list` above — exposed ONLY as
 * `internalQuery`. The signal (exact waitlist size) is also admin-only.
 */
export const count = internalQuery({
  args: {},
  handler: async (ctx) => {
    const counter = await ctx.db
      .query("counters")
      .withIndex("by_key", (q) => q.eq("key", "waitlist_total"))
      .first();
    return { total: counter?.value ?? 0 };
  },
});
