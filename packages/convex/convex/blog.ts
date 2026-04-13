import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAdminUser } from "./authHelpers";

const MAX_ADMIN_LIST = 200;
const MAX_PUBLIC_LIST = 60;
const MAX_TITLE = 160;
const MAX_EXCERPT = 360;
const MAX_BODY = 50000;
const MAX_TAGS = 10;

const statusValidator = v.union(
  v.literal("draft"),
  v.literal("published"),
  v.literal("archived"),
);

const upsertPostValidator = v.object({
  title: v.string(),
  slug: v.optional(v.string()),
  excerpt: v.string(),
  body: v.string(),
  status: statusValidator,
  category: v.string(),
  mentalState: v.string(),
  tags: v.optional(v.array(v.string())),
  featuredImageUrl: v.optional(v.string()),
  interactivePrompt: v.string(),
  interactivePlaceholder: v.string(),
  interactiveOutputTitle: v.string(),
  productCtaLabel: v.string(),
  productCtaUrl: v.string(),
  seoTitle: v.optional(v.string()),
  seoDescription: v.optional(v.string()),
  authorName: v.optional(v.string()),
  readingTimeMinutes: v.optional(v.number()),
});

const slugify = (value: string): string => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
  return slug || "untitled";
};

const cleanOptional = (value?: string): string | undefined => {
  const next = value?.trim();
  return next ? next : undefined;
};

const cleanTags = (tags?: string[]): string[] =>
  Array.from(
    new Set(
      (tags ?? [])
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, MAX_TAGS),
    ),
  );

const readingMinutes = (body: string): number => {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
};

const assertPostInput = (post: {
  title: string;
  excerpt: string;
  body: string;
  category: string;
  mentalState: string;
  interactivePrompt: string;
  interactivePlaceholder: string;
  interactiveOutputTitle: string;
  productCtaLabel: string;
  productCtaUrl: string;
}) => {
  if (!post.title.trim()) throw new Error("Title is required");
  if (post.title.length > MAX_TITLE) throw new Error("Title is too long");
  if (!post.excerpt.trim()) throw new Error("Excerpt is required");
  if (post.excerpt.length > MAX_EXCERPT) throw new Error("Excerpt is too long");
  if (!post.body.trim()) throw new Error("Body is required");
  if (post.body.length > MAX_BODY) throw new Error("Body is too long");
  if (!post.category.trim()) throw new Error("Category is required");
  if (!post.mentalState.trim()) throw new Error("Mental state is required");
  if (!post.interactivePrompt.trim()) throw new Error("Interactive prompt is required");
  if (!post.interactivePlaceholder.trim()) throw new Error("Interactive placeholder is required");
  if (!post.interactiveOutputTitle.trim()) throw new Error("Output title is required");
  if (!post.productCtaLabel.trim()) throw new Error("CTA label is required");
  if (!post.productCtaUrl.trim()) throw new Error("CTA URL is required");
};

const publicPost = (post: Doc<"blogPosts">) => ({
  _id: post._id,
  title: post.title,
  slug: post.slug,
  excerpt: post.excerpt,
  body: post.body,
  category: post.category,
  mentalState: post.mentalState,
  tags: post.tags,
  featuredImageUrl: post.featuredImageUrl,
  interactivePrompt: post.interactivePrompt,
  interactivePlaceholder: post.interactivePlaceholder,
  interactiveOutputTitle: post.interactiveOutputTitle,
  productCtaLabel: post.productCtaLabel,
  productCtaUrl: post.productCtaUrl,
  seoTitle: post.seoTitle,
  seoDescription: post.seoDescription,
  authorName: post.authorName,
  readingTimeMinutes: post.readingTimeMinutes,
  publishedAt: post.publishedAt,
  updatedAt: post.updatedAt,
});

const publicSummary = (post: Doc<"blogPosts">) => {
  const { body: _body, ...summary } = publicPost(post);
  return summary;
};

export const listPublished = query({
  args: {
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { category, limit }) => {
    const cap = Math.min(Math.max(limit ?? 24, 1), MAX_PUBLIC_LIST);
    const normalizedCategory = category?.trim();
    const posts = normalizedCategory
      ? await ctx.db
        .query("blogPosts")
        .withIndex("by_category_status", (q) =>
          q.eq("category", normalizedCategory).eq("status", "published"),
        )
        .order("desc")
        .take(cap)
      : await ctx.db
        .query("blogPosts")
        .withIndex("by_status_published", (q) => q.eq("status", "published"))
        .order("desc")
        .take(cap);
    return posts.map(publicSummary);
  },
});

export const getPublishedBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const post = await ctx.db
      .query("blogPosts")
      .withIndex("by_slug", (q) => q.eq("slug", slugify(slug)))
      .first();
    if (!post || post.status !== "published") return null;
    return publicPost(post);
  },
});

export const adminList = query({
  args: {
    sessionToken: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { sessionToken, limit }) => {
    await requireAdminUser(ctx, sessionToken);
    const cap = Math.min(Math.max(limit ?? 100, 1), MAX_ADMIN_LIST);
    return await ctx.db.query("blogPosts").order("desc").take(cap);
  },
});

export const adminUpsert = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    postId: v.optional(v.id("blogPosts")),
    post: upsertPostValidator,
  },
  handler: async (ctx, { sessionToken, postId, post }) => {
    const admin = await requireAdminUser(ctx, sessionToken);
    assertPostInput(post);

    const now = new Date().toISOString();
    const slug = slugify(post.slug || post.title);
    const existingWithSlug = await ctx.db
      .query("blogPosts")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existingWithSlug && existingWithSlug._id !== postId) {
      throw new Error("Slug is already in use");
    }

    const existing = postId ? await ctx.db.get(postId) : null;
    if (postId && !existing) throw new Error("Blog post not found");

    const publishedAt =
      post.status === "published"
        ? existing?.publishedAt ?? now
        : undefined;
    const payload = {
      title: post.title.trim(),
      slug,
      excerpt: post.excerpt.trim(),
      body: post.body.trim(),
      status: post.status,
      category: post.category.trim(),
      mentalState: post.mentalState.trim(),
      tags: cleanTags(post.tags),
      featuredImageUrl: cleanOptional(post.featuredImageUrl),
      interactivePrompt: post.interactivePrompt.trim(),
      interactivePlaceholder: post.interactivePlaceholder.trim(),
      interactiveOutputTitle: post.interactiveOutputTitle.trim(),
      productCtaLabel: post.productCtaLabel.trim(),
      productCtaUrl: post.productCtaUrl.trim(),
      seoTitle: cleanOptional(post.seoTitle),
      seoDescription: cleanOptional(post.seoDescription),
      authorName: cleanOptional(post.authorName),
      readingTimeMinutes:
        post.readingTimeMinutes && post.readingTimeMinutes > 0
          ? Math.round(post.readingTimeMinutes)
          : readingMinutes(post.body),
      updatedAt: now,
      publishedAt,
      updatedBy: admin._id,
    };

    const id = existing
      ? (await ctx.db.patch(existing._id, payload), existing._id)
      : await ctx.db.insert("blogPosts", {
        ...payload,
        viewCount: 0,
        createdAt: now,
      });

    await ctx.db.insert("adminAuditLog", {
      actorUserId: admin._id,
      actorEmail: admin.email,
      action: existing ? "blog.update" : "blog.create",
      details: { postId: id, slug, status: post.status },
      createdAt: now,
    });

    return await ctx.db.get(id);
  },
});

export const adminDelete = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    postId: v.id("blogPosts"),
  },
  handler: async (ctx, { sessionToken, postId }) => {
    const admin = await requireAdminUser(ctx, sessionToken);
    const post = await ctx.db.get(postId);
    if (!post) throw new Error("Blog post not found");
    await ctx.db.delete(postId);
    await ctx.db.insert("adminAuditLog", {
      actorUserId: admin._id,
      actorEmail: admin.email,
      action: "blog.delete",
      details: { postId, slug: post.slug, status: post.status },
      createdAt: new Date().toISOString(),
    });
    return { success: true };
  },
});

export const seedPost = internalMutation({
  args: { post: upsertPostValidator },
  handler: async (ctx, { post }) => {
    const now = new Date().toISOString();
    const slug = slugify(post.slug || post.title);
    const existing = await ctx.db
      .query("blogPosts")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existing) return { skipped: true, id: existing._id, slug };
    const id = await ctx.db.insert("blogPosts", {
      title: post.title.trim(),
      slug,
      excerpt: post.excerpt.trim(),
      body: post.body.trim(),
      status: post.status,
      category: post.category.trim(),
      mentalState: post.mentalState.trim(),
      tags: cleanTags(post.tags),
      featuredImageUrl: cleanOptional(post.featuredImageUrl),
      interactivePrompt: post.interactivePrompt.trim(),
      interactivePlaceholder: post.interactivePlaceholder.trim(),
      interactiveOutputTitle: post.interactiveOutputTitle.trim(),
      productCtaLabel: post.productCtaLabel.trim(),
      productCtaUrl: post.productCtaUrl.trim(),
      seoTitle: cleanOptional(post.seoTitle),
      seoDescription: cleanOptional(post.seoDescription),
      authorName: cleanOptional(post.authorName) ?? "Papera",
      readingTimeMinutes: post.readingTimeMinutes ?? readingMinutes(post.body),
      viewCount: 0,
      createdAt: now,
      updatedAt: now,
      publishedAt: post.status === "published" ? now : undefined,
    });
    return { seeded: true, id, slug };
  },
});
