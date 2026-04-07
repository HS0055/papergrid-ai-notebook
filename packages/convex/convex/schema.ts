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
    plan: v.union(v.literal("free"), v.literal("starter"), v.literal("pro"), v.literal("founder"), v.literal("creator")),
    role: v.optional(v.union(v.literal("user"), v.literal("admin"))),
    // Stripe
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    // Legacy usage tracking (kept for migration)
    aiGenerationsUsed: v.optional(v.number()),
    aiGenerationsResetAt: v.optional(v.string()),
    // Ink system
    inkBalance: v.optional(v.number()),
    inkSubscription: v.optional(v.number()),
    inkPurchased: v.optional(v.number()),
    inkResetAt: v.optional(v.string()),
    inkLastActivity: v.optional(v.string()),
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

  // iOS launch waitlist — emails collected from the landing page
  // IOSWaitlistSection. Submitter gets a confirmation email + 25-ink bonus on
  // launch day + 20% lifetime Pro discount.
  waitlist: defineTable({
    email: v.string(),
    source: v.optional(v.string()),
    referrer: v.optional(v.string()),
    notifiedAt: v.optional(v.string()),
    redeemedAt: v.optional(v.string()),
    convertedUserId: v.optional(v.id("users")),
    createdAt: v.string(),
  })
    .index("by_email", ["email"])
    .index("by_source", ["source"]),

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
    // Visual styling
    containerStyle: v.optional(v.string()),
    icon: v.optional(v.string()),
    groupId: v.optional(v.string()),
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

  appSettings: defineTable({
    key: v.string(),
    value: v.any(),
    updatedAt: v.string(),
    updatedBy: v.optional(v.id("users")),
  }).index("by_key", ["key"]),

  inkTransactions: defineTable({
    userId: v.id("users"),
    type: v.union(
      v.literal("subscription_refill"),
      v.literal("purchase"),
      v.literal("spend"),
      v.literal("reward"),
      v.literal("admin_grant"),
      v.literal("admin_deduct"),
    ),
    amount: v.number(),
    balance: v.number(),
    action: v.optional(v.string()),
    description: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_type", ["type"]),

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
