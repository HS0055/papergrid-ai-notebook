import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requirePageOwner, requireBlockOwner } from "./authHelpers";

// Safety cap: one page should never realistically hold more than a few
// hundred blocks. This is a guard rail against pathological pages or
// malicious payloads DoSing the query via a single .collect()-style read.
const MAX_BLOCKS_PER_PAGE = 500;

// --- Queries ---

export const listByPage = query({
  args: {
    pageId: v.id("pages"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { pageId, sessionToken }) => {
    await requirePageOwner(ctx, pageId, sessionToken);
    // Compound index ("pageId", "sortOrder") returns rows already
    // ordered by sortOrder ascending — no in-memory sort required.
    return await ctx.db
      .query("blocks")
      .withIndex("by_page", (q) => q.eq("pageId", pageId))
      .take(MAX_BLOCKS_PER_PAGE);
  },
});

// O(1) max sortOrder via descending compound index + take(1). Replaces
// the previous pattern that loaded every sibling block on each create —
// a full O(n) read on every write.
async function nextBlockSortOrder(
  ctx: { db: { query: (name: "blocks") => any } },
  pageId: Id<"pages">,
): Promise<number> {
  const top = await ctx.db
    .query("blocks")
    .withIndex("by_page", (q: any) => q.eq("pageId", pageId))
    .order("desc")
    .take(1);
  return top.length === 0 ? 0 : (top[0] as { sortOrder: number }).sortOrder + 1;
}

export const get = query({
  args: {
    id: v.id("blocks"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { id, sessionToken }) => {
    const { block } = await requireBlockOwner(ctx, id, sessionToken);
    return block;
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
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { pageId, sessionToken, ...fields }) => {
    await requirePageOwner(ctx, pageId, sessionToken);
    const sortOrder = await nextBlockSortOrder(ctx, pageId);
    return await ctx.db.insert("blocks", {
      pageId,
      sortOrder,
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
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { id, sessionToken, ...fields }) => {
    await requireBlockOwner(ctx, id, sessionToken);

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
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { blockIds, sessionToken }) => {
    if (blockIds.length === 0) return;
    // First block pins the owning page; every subsequent block must
    // live on the same page (clients can't reorder across pages here).
    const { page } = await requireBlockOwner(ctx, blockIds[0], sessionToken);
    for (let i = 1; i < blockIds.length; i++) {
      const b = await ctx.db.get(blockIds[i]);
      if (!b) throw new Error("Block not found");
      if (b.pageId !== page._id) throw new Error("Forbidden: cross-page reorder");
    }
    await Promise.all(
      blockIds.map((bid, i) => ctx.db.patch(bid, { sortOrder: i })),
    );
  },
});

export const moveBetweenPages = mutation({
  args: {
    blockId: v.id("blocks"),
    targetPageId: v.id("pages"),
    sortOrder: v.number(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { blockId, targetPageId, sortOrder, sessionToken }) => {
    // Caller must own BOTH the source block and the target page.
    await requireBlockOwner(ctx, blockId, sessionToken);
    await requirePageOwner(ctx, targetPageId, sessionToken);

    await ctx.db.patch(blockId, {
      pageId: targetPageId,
      sortOrder,
    });
  },
});

export const remove = mutation({
  args: {
    id: v.id("blocks"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { id, sessionToken }) => {
    await requireBlockOwner(ctx, id, sessionToken);
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
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { pageId, blocks, sessionToken }) => {
    await requirePageOwner(ctx, pageId, sessionToken);

    // O(1) next-sortOrder via the same helper as `create`.
    let nextSort = await nextBlockSortOrder(ctx, pageId);

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
