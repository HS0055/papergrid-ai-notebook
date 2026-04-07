import { mutation, query } from "./_generated/server";
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

    return { success: true, isNew: true };
  },
});

/**
 * Admin-only: list waitlist entries with pagination + filtering.
 * Used by the AdminPanel waitlist tab.
 */
export const list = query({
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
 */
export const count = query({
  args: {},
  handler: async (ctx) => {
    // Convex doesn't have a fast count(*); for the launch waitlist this is
    // expected to be small (<10k) so a full scan is fine. Revisit if it
    // grows beyond that.
    const all = await ctx.db.query("waitlist").collect();
    return { total: all.length };
  },
});
