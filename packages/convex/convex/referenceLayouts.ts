import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByNiche = query({
  args: { niche: v.string() },
  handler: async (ctx, { niche }) => {
    return await ctx.db
      .query("referenceLayouts")
      .withIndex("by_niche", (q) => q.eq("niche", niche))
      .collect();
  },
});

export const listByStyle = query({
  args: { style: v.string() },
  handler: async (ctx, { style }) => {
    return await ctx.db
      .query("referenceLayouts")
      .withIndex("by_style", (q) => q.eq("style", style))
      .collect();
  },
});

export const get = query({
  args: { id: v.id("referenceLayouts") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const create = mutation({
  args: {
    source: v.string(),
    sourceUrl: v.optional(v.string()),
    niche: v.string(),
    style: v.string(),
    tags: v.array(v.string()),
    paperType: v.string(),
    blocks: v.array(v.any()),
    popularity: v.number(),
    imageStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("referenceLayouts", args);
  },
});

export const update = mutation({
  args: {
    id: v.id("referenceLayouts"),
    popularity: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { id, ...fields }) => {
    const updates: Record<string, unknown> = {};
    if (fields.popularity !== undefined) updates.popularity = fields.popularity;
    if (fields.tags !== undefined) updates.tags = fields.tags;
    await ctx.db.patch(id, updates);
  },
});
