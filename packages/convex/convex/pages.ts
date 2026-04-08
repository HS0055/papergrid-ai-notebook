import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireNotebookOwner, requirePageOwner } from "./authHelpers";

// Safety cap on how many pages a single notebook query will return.
// Prevents a 1000-page notebook from doing an unbounded scan per load.
const MAX_PAGES_PER_NOTEBOOK = 500;

// --- Queries ---

export const listByNotebook = query({
  args: {
    notebookId: v.id("notebooks"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { notebookId, sessionToken }) => {
    // Ownership check: caller must own the notebook.
    await requireNotebookOwner(ctx, notebookId, sessionToken);
    // Compound index (notebookId, sortOrder) returns already-ordered rows.
    return await ctx.db
      .query("pages")
      .withIndex("by_notebook", (q) => q.eq("notebookId", notebookId))
      .take(MAX_PAGES_PER_NOTEBOOK);
  },
});

export const get = query({
  args: {
    id: v.id("pages"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { id, sessionToken }) => {
    const { page } = await requirePageOwner(ctx, id, sessionToken);
    return page;
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
    aiGenerated: v.optional(v.boolean()),
    createdAt: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { notebookId, title, paperType, aesthetic, themeColor, aiGenerated, createdAt, sessionToken },
  ) => {
    await requireNotebookOwner(ctx, notebookId, sessionToken);

    // O(1) next-sortOrder via descending compound index + take(1).
    // Previously this did a full .collect() of every sibling page.
    const top = await ctx.db
      .query("pages")
      .withIndex("by_notebook", (q) => q.eq("notebookId", notebookId))
      .order("desc")
      .take(1);
    const sortOrder = top.length === 0 ? 0 : top[0].sortOrder + 1;

    return await ctx.db.insert("pages", {
      notebookId,
      title,
      paperType,
      aesthetic,
      themeColor,
      aiGenerated,
      createdAt,
      sortOrder,
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
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { id, sessionToken, ...fields }) => {
    await requirePageOwner(ctx, id, sessionToken);

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
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { pageIds, sessionToken }) => {
    if (pageIds.length === 0) return;
    // Verify every page being reordered belongs to the same owner.
    // We check the first page, capture its notebook, and assert that
    // every other page resolves to a page owned by the same user via
    // the same notebook.
    const { user, notebook } = await requirePageOwner(ctx, pageIds[0], sessionToken);
    for (let i = 1; i < pageIds.length; i++) {
      const p = await ctx.db.get(pageIds[i]);
      if (!p) throw new Error("Page not found");
      if (p.notebookId !== notebook._id) throw new Error("Forbidden: cross-notebook reorder");
    }
    void user; // used via the ownership check above
    // Parallelize patches — Convex runs them in parallel within one mutation.
    await Promise.all(
      pageIds.map((pid, i) => ctx.db.patch(pid, { sortOrder: i })),
    );
  },
});

export const remove = mutation({
  args: {
    id: v.id("pages"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { id, sessionToken }) => {
    const { notebook } = await requirePageOwner(ctx, id, sessionToken);

    // Cascade delete: remove all blocks on this page.
    // Parallelized for speed — Convex handles transactional atomicity.
    const blocks = await ctx.db
      .query("blocks")
      .withIndex("by_page", (q) => q.eq("pageId", id))
      .collect();
    await Promise.all(blocks.map((b) => ctx.db.delete(b._id)));

    // Remove page from notebook bookmark list if present.
    if (notebook.bookmarks.includes(id)) {
      await ctx.db.patch(notebook._id, {
        bookmarks: notebook.bookmarks.filter((b) => b !== id),
      });
    }

    await ctx.db.delete(id);
  },
});
