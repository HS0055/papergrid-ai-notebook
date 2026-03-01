import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// --- Queries ---

export const listByNotebook = query({
  args: { notebookId: v.id("notebooks") },
  handler: async (ctx, { notebookId }) => {
    const pages = await ctx.db
      .query("pages")
      .withIndex("by_notebook", (q) => q.eq("notebookId", notebookId))
      .collect();
    return pages.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

export const get = query({
  args: { id: v.id("pages") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

// --- Mutations ---

export const create = mutation({
  args: {
    notebookId: v.id("notebooks"),
    title: v.string(),
    paperType: v.string(),
    aesthetic: v.optional(v.string()),
    themeColor: v.optional(v.string()),
  },
  handler: async (ctx, { notebookId, title, paperType, aesthetic, themeColor }) => {
    // Determine next sortOrder
    const existingPages = await ctx.db
      .query("pages")
      .withIndex("by_notebook", (q) => q.eq("notebookId", notebookId))
      .collect();
    const maxSort = existingPages.reduce(
      (max, p) => Math.max(max, p.sortOrder),
      -1
    );

    return await ctx.db.insert("pages", {
      notebookId,
      title,
      paperType,
      aesthetic,
      themeColor,
      sortOrder: maxSort + 1,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("pages"),
    title: v.optional(v.string()),
    paperType: v.optional(v.string()),
    aesthetic: v.optional(v.string()),
    themeColor: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Page not found");

    const updates: Record<string, unknown> = {};
    if (fields.title !== undefined) updates.title = fields.title;
    if (fields.paperType !== undefined) updates.paperType = fields.paperType;
    if (fields.aesthetic !== undefined) updates.aesthetic = fields.aesthetic;
    if (fields.themeColor !== undefined) updates.themeColor = fields.themeColor;

    await ctx.db.patch(id, updates);
  },
});

export const reorder = mutation({
  args: {
    pageIds: v.array(v.id("pages")),
  },
  handler: async (ctx, { pageIds }) => {
    for (let i = 0; i < pageIds.length; i++) {
      await ctx.db.patch(pageIds[i], { sortOrder: i });
    }
  },
});

export const remove = mutation({
  args: { id: v.id("pages") },
  handler: async (ctx, { id }) => {
    // Cascade delete: remove all blocks on this page
    const blocks = await ctx.db
      .query("blocks")
      .withIndex("by_page", (q) => q.eq("pageId", id))
      .collect();
    for (const block of blocks) {
      await ctx.db.delete(block._id);
    }

    // Remove page from any notebook bookmark lists
    const page = await ctx.db.get(id);
    if (page) {
      const notebook = await ctx.db.get(page.notebookId);
      if (notebook && notebook.bookmarks.includes(id)) {
        await ctx.db.patch(notebook._id, {
          bookmarks: notebook.bookmarks.filter((b) => b !== id),
        });
      }
    }

    await ctx.db.delete(id);
  },
});
