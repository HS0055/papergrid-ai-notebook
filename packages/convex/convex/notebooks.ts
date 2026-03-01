import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// --- Queries ---

export const listByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
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
  },
  handler: async (ctx, { userId, title, coverColor }) => {
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
    bookmarks: v.optional(v.array(v.id("pages"))),
    isShared: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Notebook not found");

    const updates: Record<string, unknown> = {};
    if (fields.title !== undefined) updates.title = fields.title;
    if (fields.coverColor !== undefined) updates.coverColor = fields.coverColor;
    if (fields.bookmarks !== undefined) updates.bookmarks = fields.bookmarks;
    if (fields.isShared !== undefined) updates.isShared = fields.isShared;

    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("notebooks") },
  handler: async (ctx, { id }) => {
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
