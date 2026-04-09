import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUser } from "./authHelpers";

// ─────────────────────────────────────────────────────────────
// AI generation history
//
// SECURITY: every exported function here requires an authenticated
// session and verifies that the row it touches belongs to that user.
// Previously every function was public with caller-supplied IDs and
// no ownership check — a complete cross-tenant IDOR. Anyone could
// read another user's prompts / outputs / ratings, patch their
// edits, or create rows under another user's account.
//
// Design rules enforced below:
//   1. `listByUser` derives the target user from the auth session.
//      It no longer takes a `userId` argument — you can only list
//      YOUR OWN generations.
//   2. `get` requires auth AND verifies the row's userId matches the
//      caller before returning anything.
//   3. `create` derives `userId` from the auth session. Callers can
//      never set it. This prevents impersonation (attacker calling
//      with victim's userId).
//   4. `addUserEdits` and `rate` verify ownership of the target row.
// ─────────────────────────────────────────────────────────────

export const listByUser = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireAuthUser(ctx, sessionToken);
    return await ctx.db
      .query("aiGenerations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const get = query({
  args: {
    id: v.id("aiGenerations"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { id, sessionToken }) => {
    const user = await requireAuthUser(ctx, sessionToken);
    const generation = await ctx.db.get(id);
    if (!generation) throw new Error("Generation not found");
    if (generation.userId !== user._id) {
      // Opaque error — do not reveal whether the row exists.
      throw new Error("Generation not found");
    }
    return generation;
  },
});

export const create = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    prompt: v.string(),
    industry: v.optional(v.string()),
    aesthetic: v.optional(v.string()),
    referenceIds: v.array(v.id("referenceLayouts")),
    generatedBlocks: v.array(v.any()),
  },
  handler: async (ctx, { sessionToken, ...rest }) => {
    const user = await requireAuthUser(ctx, sessionToken);
    // Enforce ownership server-side. `userId` is NEVER a caller-
    // supplied argument — always the authenticated user.
    return await ctx.db.insert("aiGenerations", {
      userId: user._id,
      ...rest,
    });
  },
});

export const addUserEdits = mutation({
  args: {
    id: v.id("aiGenerations"),
    userEdits: v.array(v.any()),
    editDistance: v.number(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { id, userEdits, editDistance, sessionToken }) => {
    const user = await requireAuthUser(ctx, sessionToken);
    const generation = await ctx.db.get(id);
    if (!generation) throw new Error("Generation not found");
    if (generation.userId !== user._id) {
      throw new Error("Generation not found");
    }
    await ctx.db.patch(id, { userEdits, editDistance });
  },
});

export const rate = mutation({
  args: {
    id: v.id("aiGenerations"),
    rating: v.number(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { id, rating, sessionToken }) => {
    const user = await requireAuthUser(ctx, sessionToken);
    const generation = await ctx.db.get(id);
    if (!generation) throw new Error("Generation not found");
    if (generation.userId !== user._id) {
      throw new Error("Generation not found");
    }
    // Clamp ratings to a sane range so a caller can't poison the row
    // with NaN/Infinity/huge values that break downstream analytics.
    if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
      throw new Error("Rating must be a number between 0 and 5");
    }
    await ctx.db.patch(id, { rating });
  },
});
