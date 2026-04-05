import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    // Auth identity link
    tokenIdentifier: v.optional(v.string()),
    name: v.string(),
    email: v.string(),
    passwordHash: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    plan: v.union(v.literal("free"), v.literal("starter"), v.literal("pro"), v.literal("founder")),
    role: v.optional(v.union(v.literal("user"), v.literal("admin"))),
    // Stripe
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    // Usage tracking
    aiGenerationsUsed: v.optional(v.number()),
    aiGenerationsResetAt: v.optional(v.string()),
    // Preferences
    preferences: v.object({
      defaultAesthetic: v.string(),
      defaultPaperType: v.string(),
    }),
  })
    .index("by_email", ["email"])
    .index("by_token", ["tokenIdentifier"])
    .index("by_stripe_customer", ["stripeCustomerId"]),

  authSessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    createdAt: v.string(),
    expiresAt: v.string(),
  })
    .index("by_token", ["token"])
    .index("by_user", ["userId"]),

  passwordResetTokens: defineTable({
    email: v.string(),
    code: v.string(),
    expiresAt: v.string(),
    used: v.boolean(),
  })
    .index("by_email", ["email"])
    .index("by_code", ["code"]),

  notebooks: defineTable({
    userId: v.id("users"),
    title: v.string(),
    coverColor: v.string(),
    coverImageUrl: v.optional(v.string()),
    bookmarks: v.array(v.string()),
    isShared: v.boolean(),
    createdAt: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  pages: defineTable({
    notebookId: v.id("notebooks"),
    title: v.string(),
    paperType: v.string(),
    aesthetic: v.optional(v.string()),
    themeColor: v.optional(v.string()),
    sortOrder: v.number(),
    aiGenerated: v.optional(v.boolean()),
    createdAt: v.optional(v.string()),
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
    musicData: v.optional(v.any()),
    calendarData: v.optional(v.any()),
    weeklyViewData: v.optional(v.any()),
    habitTrackerData: v.optional(v.any()),
    goalSectionData: v.optional(v.any()),
    timeBlockData: v.optional(v.any()),
    dailySectionData: v.optional(v.any()),
    progressBarData: v.optional(v.any()),
    ratingData: v.optional(v.any()),
    waterTrackerData: v.optional(v.any()),
    sectionNavData: v.optional(v.any()),
    kanbanData: v.optional(v.any()),
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
