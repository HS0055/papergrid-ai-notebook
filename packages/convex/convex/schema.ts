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
    // Tombstone for background cascade cleanup — when set, the notebook
    // has been deleted by the user and only orphan children remain to
    // be swept. listByUser/get filter these out so the UX is identical
    // to a hard delete.
    deletedAt: v.optional(v.string()),
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
    // Compound index (notebookId, sortOrder) enables O(1) lookup of
    // the current max sortOrder via `.order("desc").take(1)` instead
    // of scanning every sibling page on each create.
  }).index("by_notebook", ["notebookId", "sortOrder"]),

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
    // Compound index: supports both legacy queries that filter only
    // by pageId AND O(1) next-sortOrder lookup via
    // `.order("desc").take(1)`. Eliminates the full-sibling scan on
    // every block create.
  }).index("by_page", ["pageId", "sortOrder"]),

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
      v.literal("refund"),
      v.literal("reward"),
      v.literal("admin_grant"),
      v.literal("admin_deduct"),
    ),
    amount: v.number(),
    balance: v.number(),
    action: v.optional(v.string()),
    description: v.optional(v.string()),
    // Idempotency key — used to reverse a spend without double-refund on
    // retries (e.g., AI HTTP failure path calls refund with the original
    // spend's transaction id).
    idempotencyKey: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_type", ["type"])
    .index("by_idempotency", ["idempotencyKey"]),

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

  // Rate-limit buckets. Keyed by "<scope>:<subject>:<action>" where
  // scope is ip|user|email|global. Fixed-window counters; cheap single
  // doc read+write per check. Prevents credential stuffing, AI abuse,
  // signup spam. See rateLimit.ts for the enforcement helper.
  rateLimits: defineTable({
    key: v.string(),
    count: v.number(),
    windowStart: v.number(),          // epoch ms
    windowMs: v.number(),              // window length
    limit: v.number(),                 // enforced ceiling
    lastHitAt: v.number(),
  }).index("by_key", ["key"]),

  // Audit log for sensitive admin actions. Append-only.
  adminAuditLog: defineTable({
    actorUserId: v.id("users"),
    actorEmail: v.string(),
    action: v.string(),
    targetUserId: v.optional(v.id("users")),
    targetEmail: v.optional(v.string()),
    details: v.optional(v.any()),
    ip: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_actor", ["actorUserId"])
    .index("by_target", ["targetUserId"]),

  // Denormalized counters (replaces unbounded .collect() calls used
  // just for counting). `waitlist_total` lives here; more keys as needed.
  counters: defineTable({
    key: v.string(),
    value: v.number(),
    updatedAt: v.string(),
  }).index("by_key", ["key"]),

  // ============================================================
  // AFFILIATE PROGRAM
  // ============================================================
  affiliates: defineTable({
    userId: v.id("users"),
    code: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("banned"),
    ),
    commissionRate: v.number(),
    cookieWindowDays: v.number(),
    applicationNote: v.optional(v.string()),
    audience: v.optional(v.string()),
    promotionChannels: v.optional(v.array(v.string())),
    websiteUrl: v.optional(v.string()),
    socialHandles: v.optional(v.array(v.string())),
    payoutMethod: v.optional(v.union(
      v.literal("paypal"),
      v.literal("stripe"),
      v.literal("bank"),
    )),
    payoutEmail: v.optional(v.string()),
    payoutCountry: v.optional(v.string()),
    totalClicks: v.number(),
    totalConversions: v.number(),
    totalEarnedCents: v.number(),
    totalPaidCents: v.number(),
    appliedAt: v.string(),
    approvedAt: v.optional(v.string()),
    approvedBy: v.optional(v.id("users")),
    rejectedAt: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
    bannedAt: v.optional(v.string()),
    banReason: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_code", ["code"])
    .index("by_status", ["status"]),

  affiliateClicks: defineTable({
    affiliateId: v.id("affiliates"),
    code: v.string(),
    visitorId: v.string(),
    landingPath: v.optional(v.string()),
    referrer: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    ip: v.optional(v.string()),
    country: v.optional(v.string()),
    convertedToUserId: v.optional(v.id("users")),
    convertedAt: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_affiliate", ["affiliateId"])
    .index("by_visitor", ["visitorId"])
    .index("by_code", ["code"]),

  affiliateConversions: defineTable({
    affiliateId: v.id("affiliates"),
    referredUserId: v.id("users"),
    type: v.union(
      v.literal("signup"),
      v.literal("subscription"),
      v.literal("renewal"),
      v.literal("ink_purchase"),
    ),
    grossAmountCents: v.number(),
    commissionCents: v.number(),
    commissionRate: v.number(),
    currency: v.string(),
    stripePaymentIntentId: v.optional(v.string()),
    stripeInvoiceId: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("paid"),
      v.literal("voided"),
    ),
    payoutId: v.optional(v.id("affiliatePayouts")),
    createdAt: v.string(),
    approvedAt: v.optional(v.string()),
    paidAt: v.optional(v.string()),
  })
    .index("by_affiliate", ["affiliateId"])
    .index("by_user", ["referredUserId"])
    .index("by_status", ["status"])
    .index("by_payout", ["payoutId"]),

  affiliatePayouts: defineTable({
    affiliateId: v.id("affiliates"),
    amountCents: v.number(),
    currency: v.string(),
    method: v.union(
      v.literal("paypal"),
      v.literal("stripe"),
      v.literal("bank"),
      v.literal("manual"),
    ),
    status: v.union(
      v.literal("requested"),
      v.literal("processing"),
      v.literal("paid"),
      v.literal("failed"),
    ),
    reference: v.optional(v.string()),
    note: v.optional(v.string()),
    requestedAt: v.string(),
    paidAt: v.optional(v.string()),
    paidBy: v.optional(v.id("users")),
  })
    .index("by_affiliate", ["affiliateId"])
    .index("by_status", ["status"]),

  userReferrals: defineTable({
    userId: v.id("users"),
    affiliateId: v.id("affiliates"),
    code: v.string(),
    cookieSetAt: v.string(),
    expiresAt: v.string(),
    firstSeenLandingPath: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_affiliate", ["affiliateId"]),

  // ============================================================
  // COMMUNITY
  // ============================================================
  communityPosts: defineTable({
    authorId: v.id("users"),
    title: v.string(),
    body: v.string(),
    notebookId: v.optional(v.id("notebooks")),
    coverImageUrl: v.optional(v.string()),
    tags: v.array(v.string()),
    likeCount: v.number(),
    commentCount: v.number(),
    viewCount: v.number(),
    status: v.union(
      v.literal("published"),
      v.literal("hidden"),
      v.literal("removed"),
      v.literal("draft"),
    ),
    // Post kind — what the post is FOR. Drives the tabs on the
    // community page and governs which admin actions apply.
    //   feedback:        general suggestion / free-form feedback
    //   feature_request: new feature proposal — voteable + has roadmap state
    //   bug:             bug report
    //   announcement:    admin-only product update / changelog entry
    //   discussion:      generic community thread (default for back-compat)
    kind: v.optional(v.union(
      v.literal("feedback"),
      v.literal("feature_request"),
      v.literal("bug"),
      v.literal("announcement"),
      v.literal("discussion"),
    )),
    // Roadmap lifecycle state for feature requests. Admins move posts
    // through this as the idea advances from raw community vote to
    // shipped feature. Unused for other kinds.
    roadmapStatus: v.optional(v.union(
      v.literal("open"),
      v.literal("planned"),
      v.literal("in_progress"),
      v.literal("shipped"),
      v.literal("declined"),
    )),
    pinnedAt: v.optional(v.string()),
    featuredAt: v.optional(v.string()),
    hiddenReason: v.optional(v.string()),
    hiddenBy: v.optional(v.id("users")),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_author", ["authorId"])
    .index("by_status_created", ["status", "createdAt"])
    .index("by_status_likes", ["status", "likeCount"])
    // Category-filtered feeds: "newest feature requests", "most-voted
    // bugs", etc. The compound index keeps each tab a cheap index scan.
    .index("by_kind_created", ["kind", "status", "createdAt"])
    .index("by_kind_likes", ["kind", "status", "likeCount"])
    // Admin roadmap view grouped by lifecycle state.
    .index("by_roadmap", ["roadmapStatus", "status", "createdAt"]),

  communityComments: defineTable({
    postId: v.id("communityPosts"),
    authorId: v.id("users"),
    body: v.string(),
    parentCommentId: v.optional(v.id("communityComments")),
    likeCount: v.number(),
    status: v.union(
      v.literal("published"),
      v.literal("hidden"),
      v.literal("removed"),
    ),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_post", ["postId", "createdAt"])
    .index("by_author", ["authorId"])
    .index("by_parent", ["parentCommentId"]),

  communityLikes: defineTable({
    userId: v.id("users"),
    targetType: v.union(v.literal("post"), v.literal("comment")),
    targetId: v.string(),
    createdAt: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_target", ["targetType", "targetId"])
    .index("by_user_target", ["userId", "targetType", "targetId"]),

  communityFollows: defineTable({
    followerId: v.id("users"),
    followeeId: v.id("users"),
    createdAt: v.string(),
  })
    .index("by_follower", ["followerId"])
    .index("by_followee", ["followeeId"])
    .index("by_pair", ["followerId", "followeeId"]),

  communityReports: defineTable({
    reporterId: v.id("users"),
    targetType: v.union(v.literal("post"), v.literal("comment"), v.literal("user")),
    targetId: v.string(),
    reason: v.union(
      v.literal("spam"),
      v.literal("harassment"),
      v.literal("nsfw"),
      v.literal("copyright"),
      v.literal("other"),
    ),
    note: v.optional(v.string()),
    status: v.union(
      v.literal("open"),
      v.literal("resolved"),
      v.literal("dismissed"),
    ),
    resolution: v.optional(v.string()),
    handledBy: v.optional(v.id("users")),
    handledAt: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_status_created", ["status", "createdAt"])
    .index("by_target", ["targetType", "targetId"]),

  communityProfiles: defineTable({
    userId: v.id("users"),
    handle: v.string(),
    displayName: v.optional(v.string()),
    bio: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    bannerUrl: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    location: v.optional(v.string()),
    followerCount: v.number(),
    followingCount: v.number(),
    postCount: v.number(),
    isBanned: v.boolean(),
    bannedAt: v.optional(v.string()),
    banReason: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_handle", ["handle"]),

  // ============================================================
  // REFERRAL PROGRAM (user → user growth loop)
  //
  // Separate from the affiliate program above. Affiliates are paid
  // revenue-share partners. Referrals are the built-in viral loop —
  // EVERY user gets a code on signup, both parties get bonus Ink when
  // the referred user joins and completes a qualifying action.
  // ============================================================
  referralCodes: defineTable({
    userId: v.id("users"),
    code: v.string(), // lowercased slug, unique, collision-checked
    totalClicks: v.number(),   // landing visits
    totalSignups: v.number(),  // people who signed up with this code
    totalQualified: v.number(), // signups that triggered the reward
    totalRewardInk: v.number(), // lifetime Ink this referrer earned
    createdAt: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_code", ["code"])
    // Leaderboard index — admin view "top referrers by qualified
    // signups this period".
    .index("by_qualified", ["totalQualified"]),

  // One row per successful referral. Status machine:
  //   pending     — user signed up with a ref cookie, no reward yet
  //   qualified   — they met the reward threshold (e.g. created a
  //                 notebook, verified email, purchased) — both
  //                 sides receive Ink at this point
  //   voided      — referred user was banned / refunded / marked
  //                 fraud → reward is rolled back
  referralRedemptions: defineTable({
    referrerId: v.id("users"),     // the person who shared the link
    referredUserId: v.id("users"), // the new signup
    code: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("qualified"),
      v.literal("voided"),
    ),
    // Ink awarded to each side on qualification. Stored per row so
    // admins can change the global bonus without affecting historical
    // numbers in payouts.
    referrerInkReward: v.optional(v.number()),
    referredInkReward: v.optional(v.number()),
    qualifiedAt: v.optional(v.string()),
    voidedAt: v.optional(v.string()),
    voidReason: v.optional(v.string()),
    // Attribution source for admin diagnostics.
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_referrer", ["referrerId"])
    .index("by_referred", ["referredUserId"])
    .index("by_code", ["code"])
    .index("by_status_created", ["status", "createdAt"]),
});
