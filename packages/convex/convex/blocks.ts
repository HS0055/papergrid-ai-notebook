import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// --- Queries ---

export const listByPage = query({
  args: { pageId: v.id("pages") },
  handler: async (ctx, { pageId }) => {
    const blocks = await ctx.db
      .query("blocks")
      .withIndex("by_page", (q) => q.eq("pageId", pageId))
      .collect();
    return blocks.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

export const get = query({
  args: { id: v.id("blocks") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

// --- Mutations ---

export const create = mutation({
  args: {
    pageId: v.id("pages"),
    type: v.string(),
    content: v.string(),
    side: v.union(v.literal("left"), v.literal("right")),
    checked: v.optional(v.boolean()),
    alignment: v.optional(v.string()),
    emphasis: v.optional(v.string()),
    color: v.optional(v.string()),
    gridData: v.optional(v.any()),
    matrixData: v.optional(v.any()),
    moodValue: v.optional(v.number()),
    musicData: v.optional(v.any()),
    calendarData: v.optional(v.any()),
    weeklyViewData: v.optional(v.any()),
    habitTrackerData: v.optional(v.any()),
    goalSectionData: v.optional(v.any()),
    timeBlockData: v.optional(v.any()),
    dailySectionData: v.optional(v.any()),
  },
  handler: async (ctx, { pageId, ...fields }) => {
    // Determine next sortOrder
    const existingBlocks = await ctx.db
      .query("blocks")
      .withIndex("by_page", (q) => q.eq("pageId", pageId))
      .collect();
    const maxSort = existingBlocks.reduce(
      (max, b) => Math.max(max, b.sortOrder),
      -1
    );

    return await ctx.db.insert("blocks", {
      pageId,
      sortOrder: maxSort + 1,
      ...fields,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("blocks"),
    type: v.optional(v.string()),
    content: v.optional(v.string()),
    side: v.optional(v.union(v.literal("left"), v.literal("right"))),
    checked: v.optional(v.boolean()),
    alignment: v.optional(v.string()),
    emphasis: v.optional(v.string()),
    color: v.optional(v.string()),
    gridData: v.optional(v.any()),
    matrixData: v.optional(v.any()),
    moodValue: v.optional(v.number()),
    musicData: v.optional(v.any()),
    calendarData: v.optional(v.any()),
    weeklyViewData: v.optional(v.any()),
    habitTrackerData: v.optional(v.any()),
    goalSectionData: v.optional(v.any()),
    timeBlockData: v.optional(v.any()),
    dailySectionData: v.optional(v.any()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Block not found");

    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) updates[key] = value;
    }

    await ctx.db.patch(id, updates);
  },
});

export const reorder = mutation({
  args: {
    blockIds: v.array(v.id("blocks")),
  },
  handler: async (ctx, { blockIds }) => {
    for (let i = 0; i < blockIds.length; i++) {
      await ctx.db.patch(blockIds[i], { sortOrder: i });
    }
  },
});

export const moveBetweenPages = mutation({
  args: {
    blockId: v.id("blocks"),
    targetPageId: v.id("pages"),
    sortOrder: v.number(),
  },
  handler: async (ctx, { blockId, targetPageId, sortOrder }) => {
    const block = await ctx.db.get(blockId);
    if (!block) throw new Error("Block not found");

    await ctx.db.patch(blockId, {
      pageId: targetPageId,
      sortOrder,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("blocks") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

// --- Batch operations ---

export const createBatch = mutation({
  args: {
    pageId: v.id("pages"),
    blocks: v.array(
      v.object({
        type: v.string(),
        content: v.string(),
        side: v.union(v.literal("left"), v.literal("right")),
        checked: v.optional(v.boolean()),
        alignment: v.optional(v.string()),
        emphasis: v.optional(v.string()),
        color: v.optional(v.string()),
        gridData: v.optional(v.any()),
        matrixData: v.optional(v.any()),
        moodValue: v.optional(v.number()),
        musicData: v.optional(v.any()),
        calendarData: v.optional(v.any()),
        weeklyViewData: v.optional(v.any()),
        habitTrackerData: v.optional(v.any()),
        goalSectionData: v.optional(v.any()),
        timeBlockData: v.optional(v.any()),
        dailySectionData: v.optional(v.any()),
      })
    ),
  },
  handler: async (ctx, { pageId, blocks }) => {
    const existingBlocks = await ctx.db
      .query("blocks")
      .withIndex("by_page", (q) => q.eq("pageId", pageId))
      .collect();
    let nextSort = existingBlocks.reduce(
      (max, b) => Math.max(max, b.sortOrder),
      -1
    ) + 1;

    const insertedIds = [];
    for (const block of blocks) {
      const id = await ctx.db.insert("blocks", {
        pageId,
        sortOrder: nextSort++,
        ...block,
      });
      insertedIds.push(id);
    }
    return insertedIds;
  },
});
