import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("aiGenerations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const get = query({
  args: { id: v.id("aiGenerations") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    prompt: v.string(),
    industry: v.optional(v.string()),
    aesthetic: v.optional(v.string()),
    referenceIds: v.array(v.id("referenceLayouts")),
    generatedBlocks: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("aiGenerations", args);
  },
});

export const addUserEdits = mutation({
  args: {
    id: v.id("aiGenerations"),
    userEdits: v.array(v.any()),
    editDistance: v.number(),
  },
  handler: async (ctx, { id, userEdits, editDistance }) => {
    await ctx.db.patch(id, { userEdits, editDistance });
  },
});

export const rate = mutation({
  args: {
    id: v.id("aiGenerations"),
    rating: v.number(),
  },
  handler: async (ctx, { id, rating }) => {
    await ctx.db.patch(id, { rating });
  },
});
