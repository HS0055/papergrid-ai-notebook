import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    avatarUrl: v.optional(v.string()),
    plan: v.union(v.literal("free"), v.literal("pro")),
    preferences: v.object({
      defaultAesthetic: v.string(),
      defaultPaperType: v.string(),
    }),
  }).index("by_email", ["email"]),

  notebooks: defineTable({
    userId: v.id("users"),
    title: v.string(),
    coverColor: v.string(),
    bookmarks: v.array(v.id("pages")),
    isShared: v.boolean(),
  }).index("by_user", ["userId"]),

  pages: defineTable({
    notebookId: v.id("notebooks"),
    title: v.string(),
    paperType: v.string(),
    aesthetic: v.optional(v.string()),
    themeColor: v.optional(v.string()),
    sortOrder: v.number(),
  }).index("by_notebook", ["notebookId"]),

  blocks: defineTable({
    pageId: v.id("pages"),
    type: v.string(),
    content: v.string(),
    side: v.union(v.literal("left"), v.literal("right")),
    sortOrder: v.number(),
    checked: v.optional(v.boolean()),
    alignment: v.optional(v.string()),
    emphasis: v.optional(v.string()),
    color: v.optional(v.string()),
    gridData: v.optional(v.any()),
    matrixData: v.optional(v.any()),
    moodValue: v.optional(v.number()),
  }).index("by_page", ["pageId"]),

  referenceLayouts: defineTable({
    source: v.string(),
    sourceUrl: v.optional(v.string()),
    niche: v.string(),
    style: v.string(),
    tags: v.array(v.string()),
    paperType: v.string(),
    blocks: v.array(v.any()),
    popularity: v.number(),
    imageStorageId: v.optional(v.id("_storage")),
  })
    .index("by_niche", ["niche"])
    .index("by_style", ["style"]),

  aiGenerations: defineTable({
    userId: v.id("users"),
    prompt: v.string(),
    industry: v.optional(v.string()),
    aesthetic: v.optional(v.string()),
    referenceIds: v.array(v.id("referenceLayouts")),
    generatedBlocks: v.array(v.any()),
    userEdits: v.optional(v.array(v.any())),
    rating: v.optional(v.number()),
    editDistance: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_aesthetic", ["aesthetic"]),
});
