import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";

// ── Auth helper ──────────────────────────────────────────
async function requireAuthUser(ctx: QueryCtx | MutationCtx, sessionToken?: string) {
  // Try Convex identity first
  const identity = await ctx.auth.getUserIdentity();
  if (identity) {
    const u = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (u) return u;
  }
  // Fall back to session token
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

// --- Queries ---

export const listByUser = query({
  args: { userId: v.id("users"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { userId, sessionToken }) => {
    // Verify requesting user matches the userId
    const user = await requireAuthUser(ctx, sessionToken);
    if (user._id !== userId) throw new Error("Forbidden");
    return await ctx.db
      .query("notebooks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const get = query({
  args: { id: v.id("notebooks") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

// --- Mutations ---

export const create = mutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    coverColor: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { userId, title, coverColor, sessionToken }) => {
    const user = await requireAuthUser(ctx, sessionToken);
    if (user._id !== userId) throw new Error("Forbidden");
    return await ctx.db.insert("notebooks", {
      userId,
      title,
      coverColor,
      bookmarks: [],
      isShared: false,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("notebooks"),
    title: v.optional(v.string()),
    coverColor: v.optional(v.string()),
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
    if (fields.bookmarks !== undefined) updates.bookmarks = fields.bookmarks;
    if (fields.isShared !== undefined) updates.isShared = fields.isShared;

    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("notebooks"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { id, sessionToken }) => {
    const user = await requireAuthUser(ctx, sessionToken);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Notebook not found");
    if (existing.userId !== user._id) throw new Error("Forbidden");

    // Cascade delete: remove all pages and their blocks
    const pages = await ctx.db
      .query("pages")
      .withIndex("by_notebook", (q) => q.eq("notebookId", id))
      .collect();

    for (const page of pages) {
      const blocks = await ctx.db
        .query("blocks")
        .withIndex("by_page", (q) => q.eq("pageId", page._id))
        .collect();
      for (const block of blocks) {
        await ctx.db.delete(block._id);
      }
      await ctx.db.delete(page._id);
    }

    await ctx.db.delete(id);
  },
});
