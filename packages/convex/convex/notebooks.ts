import { v } from "convex/values";
import { mutation, query, internalMutation, QueryCtx, MutationCtx } from "./_generated/server";
import { getPlanLimitFor, type PlanId } from "./planLimits";
import { requireAuthUser as sharedRequireAuthUser } from "./authHelpers";
import { internal } from "./_generated/api";

// ── Auth helper ──────────────────────────────────────────
// Thin re-export of the shared authHelpers util so existing callers in this
// file keep using `requireAuthUser` without churn.
const requireAuthUser = sharedRequireAuthUser;

// --- Queries ---

export const listByUser = query({
  args: { userId: v.id("users"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { userId, sessionToken }) => {
    // Verify requesting user matches the userId
    const user = await requireAuthUser(ctx, sessionToken);
    if (user._id !== userId) throw new Error("Forbidden");
    const rows = await ctx.db
      .query("notebooks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    // Hide tombstoned notebooks (deletedAt set) — background sweeper
    // will hard-delete them once their children are gone.
    return rows.filter((nb) => !(nb as any).deletedAt);
  },
});

export const get = query({
  args: {
    id: v.id("notebooks"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { id, sessionToken }) => {
    const user = await requireAuthUser(ctx, sessionToken);
    const nb = await ctx.db.get(id);
    if (!nb) return null;
    if (nb.userId !== user._id) throw new Error("Forbidden");
    // Hide tombstoned notebooks from reads.
    if ((nb as any).deletedAt) return null;
    return nb;
  },
});

// --- Mutations ---

export const create = mutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    coverColor: v.string(),
    coverImageUrl: v.optional(v.string()),
    bookmarks: v.optional(v.array(v.string())),
    createdAt: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { userId, title, coverColor, coverImageUrl, bookmarks, createdAt, sessionToken }) => {
    const user = await requireAuthUser(ctx, sessionToken);
    if (user._id !== userId) throw new Error("Forbidden");

    // ── Plan limit enforcement ──────────────────────────────
    // Free users get 1 notebook by default; admin can change this in
    // AdminPanel via planLimits.update. Pro/Creator/Founder are unlimited.
    //
    // Scale: avoid .collect() — we only need to know whether the user has
    // reached the cap. `.take(limit + 1)` is bounded and answers the same
    // question. Also filter out tombstoned rows so a user who deleted a
    // notebook that's still in the background-sweep queue isn't blocked
    // from creating a replacement.
    const planId = (user.plan ?? "free") as PlanId;
    const limits = await getPlanLimitFor(ctx, planId);
    if (limits.maxNotebooks !== -1) {
      const probe = await ctx.db
        .query("notebooks")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .take(limits.maxNotebooks + 1);
      const active = probe.filter((nb) => !(nb as any).deletedAt);
      if (active.length >= limits.maxNotebooks) {
        throw new Error(
          `Your ${planId} plan allows ${limits.maxNotebooks} notebook${limits.maxNotebooks === 1 ? "" : "s"}. Upgrade to create more.`,
        );
      }
    }

    const notebookId = await ctx.db.insert("notebooks", {
      userId,
      title,
      coverColor,
      coverImageUrl,
      bookmarks: bookmarks ?? [],
      isShared: false,
      createdAt,
    });

    // ── Referral program hook ──────────────────────────────
    // If the admin has set the qualifying action to "first_notebook",
    // this call will flip a pending redemption to qualified and credit
    // both the referrer and referred user with bonus Ink. The helper is
    // idempotent — after the first qualifying call, subsequent notebook
    // creations are a no-op. Any failure here is swallowed so the
    // growth-loop side-path never blocks notebook creation.
    try {
      await ctx.runMutation(internal.referrals.onQualifyingEventInternal, {
        userId,
        event: "first_notebook",
      });
    } catch (e) {
      console.warn("Referral qualify on first_notebook failed (non-fatal):", e);
    }

    return notebookId;
  },
});

export const update = mutation({
  args: {
    id: v.id("notebooks"),
    title: v.optional(v.string()),
    coverColor: v.optional(v.string()),
    coverImageUrl: v.optional(v.string()),
    bookmarks: v.optional(v.array(v.string())),
    isShared: v.optional(v.boolean()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { id, sessionToken, ...fields }) => {
    const user = await requireAuthUser(ctx, sessionToken);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Notebook not found");
    if (existing.userId !== user._id) throw new Error("Forbidden");

    const updates: Record<string, unknown> = {};
    if (fields.title !== undefined) updates.title = fields.title;
    if (fields.coverColor !== undefined) updates.coverColor = fields.coverColor;
    if (fields.coverImageUrl !== undefined) updates.coverImageUrl = fields.coverImageUrl;
    if (fields.bookmarks !== undefined) updates.bookmarks = fields.bookmarks;
    if (fields.isShared !== undefined) updates.isShared = fields.isShared;

    await ctx.db.patch(id, updates);
  },
});

// Tombstone-based delete.
//
// Previously this was a synchronous cascade: load every page, load every
// block per page, delete one by one. At 20 pages × 50 blocks = 1000 serial
// DB ops inside a single mutation, this could time out and left users
// staring at a spinner. Now we flip a `deletedAt` tombstone and schedule
// a background sweeper. Reads filter tombstoned rows out (see `listByUser`
// and `get`) so the UX is identical to a hard delete.
export const remove = mutation({
  args: { id: v.id("notebooks"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { id, sessionToken }) => {
    const user = await requireAuthUser(ctx, sessionToken);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Notebook not found");
    if (existing.userId !== user._id) throw new Error("Forbidden");

    // Mark as tombstone. Background sweep will cascade-delete.
    await ctx.db.patch(id, { deletedAt: new Date().toISOString() });
    await ctx.scheduler.runAfter(0, internal.notebooks.sweepDeletedNotebook, {
      notebookId: id,
    });
    return { success: true };
  },
});

// Background sweeper. Deletes the pages + blocks attached to a tombstoned
// notebook in paginated batches so a single mutation never touches more
// than N documents. Re-schedules itself until the notebook is empty, then
// hard-deletes the notebook row.
export const sweepDeletedNotebook = internalMutation({
  args: { notebookId: v.id("notebooks") },
  handler: async (ctx, { notebookId }) => {
    const BATCH = 50;

    // Grab one page worth of child pages.
    const pages = await ctx.db
      .query("pages")
      .withIndex("by_notebook", (q) => q.eq("notebookId", notebookId))
      .take(BATCH);

    if (pages.length > 0) {
      for (const page of pages) {
        const blocks = await ctx.db
          .query("blocks")
          .withIndex("by_page", (q) => q.eq("pageId", page._id))
          .take(200);
        await Promise.all(blocks.map((b) => ctx.db.delete(b._id)));
        // Only hard-delete the page if all its blocks have been reaped.
        const remaining = await ctx.db
          .query("blocks")
          .withIndex("by_page", (q) => q.eq("pageId", page._id))
          .take(1);
        if (remaining.length === 0) {
          await ctx.db.delete(page._id);
        }
      }
      // More to do — re-schedule.
      await ctx.scheduler.runAfter(0, internal.notebooks.sweepDeletedNotebook, {
        notebookId,
      });
      return { done: false };
    }

    // No children left. Hard-delete the notebook row.
    const nb = await ctx.db.get(notebookId);
    if (nb) await ctx.db.delete(notebookId);
    return { done: true };
  },
});
