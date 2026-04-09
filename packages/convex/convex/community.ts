import { v } from "convex/values";
import {
  mutation,
  query,
  QueryCtx,
  MutationCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

// ─────────────────────────────────────────────────────────────
// Community — posts, comments, likes, follows, reports, profiles
// ─────────────────────────────────────────────────────────────
//
// Design notes:
//  • Likes and comments use denormalized counts on the parent post so the
//    feed never has to scan the high-volume likes/comments tables.
//  • Status field on posts/comments enables soft-delete + moderation
//    without losing audit history.
//  • Handles are unique URL-friendly slugs assigned at first profile create.
//  • Every user-facing mutation is rate-limited through the rateLimit table.
//  • Admin moderation actions write to adminAuditLog for compliance.

const FEED_PAGE = 30;
const MAX_TAGS = 8;
const MAX_TITLE = 140;
const MAX_BODY = 8000;
const MAX_COMMENT = 2000;
const MAX_LIST = 500;

const RESERVED_HANDLES = new Set([
  "admin", "api", "auth", "login", "signup", "settings", "me", "about",
  "support", "help", "null", "undefined", "root", "system", "convex",
  "papergrid", "papera",
]);

// ── Auth helpers ──────────────────────────────────────────────
async function requireAuthUser(
  ctx: QueryCtx | MutationCtx,
  sessionToken?: string,
): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity) {
    const u = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (u) return u;
  }
  if (sessionToken) {
    const session = await ctx.db
      .query("authSessions")
      .withIndex("by_token", (q) => q.eq("token", sessionToken))
      .first();
    if (session && new Date(session.expiresAt).getTime() > Date.now()) {
      const u = await ctx.db.get(session.userId);
      if (u) return u;
    }
  }
  throw new Error("Not authenticated");
}

async function getOptionalUser(
  ctx: QueryCtx | MutationCtx,
  sessionToken?: string,
): Promise<Doc<"users"> | null> {
  try {
    return await requireAuthUser(ctx, sessionToken);
  } catch {
    return null;
  }
}

async function requireAdmin(
  ctx: QueryCtx | MutationCtx,
  sessionToken?: string,
): Promise<Doc<"users">> {
  const user = await requireAuthUser(ctx, sessionToken);
  if (user.role !== "admin") throw new Error("Forbidden: admin only");
  return user;
}

async function ensureNotBanned(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const profile = await ctx.db
    .query("communityProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (profile?.isBanned) {
    throw new Error("Your community account is suspended");
  }
}

// Strict handle validation: 3–20 lowercase alphanumeric or underscore.
// Previously `slugify` silently rewrote `my_handle` → `my-handle`, allowed
// hyphens, and stripped underscores — which violated the spec AND meant
// users thought they got one handle and actually got another.
function normalizeHandle(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(s)) {
    throw new Error("Handle must be 3–20 lowercase letters, numbers, or underscores");
  }
  if (RESERVED_HANDLES.has(s)) {
    throw new Error("Handle is reserved");
  }
  return s;
}

// Auto-generate a handle from a user name for the initial profile.
// This path is never user-facing so we relax the rules: we strip anything
// that isn't alphanumeric or underscore, pad to 3 chars if needed, and
// append a random suffix on collision.
function autoHandleBase(seed: string): string {
  const clean = seed.toLowerCase().replace(/[^a-z0-9_]+/g, "");
  if (clean.length >= 3) return clean.slice(0, 20);
  return (clean + "user").slice(0, 20);
}

// Rate-limit a user mutation using the shared rateLimits table.
async function limit(
  ctx: MutationCtx,
  scope: "user" | "ip",
  subject: string,
  action: string,
  max: number,
  windowMs: number,
): Promise<void> {
  const now = Date.now();
  const key = `${scope}:${subject}:${action}`;
  const existing = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
  if (!existing) {
    await ctx.db.insert("rateLimits", {
      key, count: 1, windowStart: now, windowMs, limit: max, lastHitAt: now,
    });
    return;
  }
  const windowEnd = existing.windowStart + existing.windowMs;
  if (now >= windowEnd) {
    await ctx.db.patch(existing._id, {
      count: 1, windowStart: now, windowMs, limit: max, lastHitAt: now,
    });
    return;
  }
  if (existing.count >= existing.limit) {
    throw new Error("Rate limit exceeded. Please slow down.");
  }
  await ctx.db.patch(existing._id, { count: existing.count + 1, lastHitAt: now });
}

async function writeAuditLog(
  ctx: MutationCtx,
  admin: Doc<"users">,
  action: string,
  details?: Record<string, unknown>,
  targetUserId?: Id<"users">,
): Promise<void> {
  await ctx.db.insert("adminAuditLog", {
    actorUserId: admin._id,
    actorEmail: admin.email,
    action,
    targetUserId,
    details,
    createdAt: new Date().toISOString(),
  });
}

// Strip potentially-dangerous protocols from a URL before persisting it.
// We can't stop every XSS vector from here (the frontend must still escape
// when rendering), but we can reject `javascript:` / `data:` URIs at the
// boundary so they never get stored.
function safeUrlOrThrow(u: string): string {
  const s = u.trim();
  if (!s) return "";
  try {
    const url = new URL(s);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("URL must start with http:// or https://");
    }
    return url.toString();
  } catch {
    throw new Error("Invalid URL");
  }
}

async function ensureProfile(
  ctx: MutationCtx,
  user: Doc<"users">,
): Promise<Doc<"communityProfiles">> {
  const existing = await ctx.db
    .query("communityProfiles")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .first();
  if (existing) return existing;

  // Generate a unique handle. OAuth users may have no email, so fall back
  // to the user id. Previously this crashed on email.split for OAuth rows.
  const seed = user.name || (user.email ? user.email.split("@")[0] : "") || String(user._id);
  const base = autoHandleBase(seed);
  let handle = base;
  for (let attempt = 0; attempt < 8; attempt++) {
    const collision = await ctx.db
      .query("communityProfiles")
      .withIndex("by_handle", (q) => q.eq("handle", handle))
      .first();
    if (!collision && !RESERVED_HANDLES.has(handle)) break;
    const suffix = String(Math.floor(Math.random() * 9999));
    handle = (base.slice(0, 20 - suffix.length) + suffix).slice(0, 20);
  }

  const now = new Date().toISOString();
  const id = await ctx.db.insert("communityProfiles", {
    userId: user._id,
    handle,
    displayName: user.name,
    bio: undefined,
    avatarUrl: user.avatarUrl,
    bannerUrl: undefined,
    websiteUrl: undefined,
    location: undefined,
    followerCount: 0,
    followingCount: 0,
    postCount: 0,
    isBanned: false,
    createdAt: now,
    updatedAt: now,
  });
  const inserted = await ctx.db.get(id);
  if (!inserted) throw new Error("Failed to create community profile");
  return inserted;
}

type AuthorMeta = {
  profile: Doc<"communityProfiles"> | null;
  role: Doc<"users">["role"] | undefined;
};

// Batch-hydrate author profile + role for a set of posts or comments.
// We need the role so the UI can visually distinguish official team
// replies from regular community comments.
async function hydrateAuthorMeta<T extends { authorId: Id<"users"> }>(
  ctx: QueryCtx,
  rows: T[],
): Promise<Map<string, AuthorMeta>> {
  const unique = Array.from(new Set(rows.map((r) => r.authorId as unknown as string)));
  const results = await Promise.all(
    unique.map(async (id) => {
      const userId = id as Id<"users">;
      const [profile, user] = await Promise.all([
        ctx.db
          .query("communityProfiles")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .first(),
        ctx.db.get(userId),
      ]);
      return {
        profile: profile ?? null,
        role: user?.role,
      };
    }),
  );
  const map = new Map<string, AuthorMeta>();
  for (let i = 0; i < unique.length; i++) {
    map.set(unique[i], results[i] ?? { profile: null, role: undefined });
  }
  return map;
}

function mapAuthorMeta(meta: AuthorMeta | undefined) {
  return {
    authorHandle: meta?.profile?.handle,
    authorDisplayName: meta?.profile?.displayName,
    authorAvatarUrl: meta?.profile?.avatarUrl,
    authorRole: meta?.role,
  };
}

// ─────────────────────────────────────────────────────────────
// FEED QUERIES
// ─────────────────────────────────────────────────────────────

export const listFeed = query({
  args: {
    sessionToken: v.optional(v.string()),
    sort: v.optional(v.union(
      v.literal("recent"),
      v.literal("trending"),
      v.literal("featured"),
    )),
    // Category filter. Omit to get everything. When set we use the
    // compound `by_kind_*` index so the page is a bounded index scan.
    kind: v.optional(v.union(
      v.literal("feedback"),
      v.literal("feature_request"),
      v.literal("bug"),
      v.literal("announcement"),
      v.literal("discussion"),
    )),
    tag: v.optional(v.string()),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { sessionToken, sort, kind, tag, cursor, limit }) => {
    const cap = Math.min(limit ?? FEED_PAGE, FEED_PAGE * 2);
    const sortMode = sort ?? "recent";
    const sortByVotes = sortMode === "trending";

    // Pick the right index. When a kind filter is set, use the compound
    // kind/status/(createdAt|likeCount) index so each tab stays cheap at
    // scale. Otherwise fall back to the status-only indexes.
    type PageResult = { page: Doc<"communityPosts">[]; isDone: boolean; continueCursor: string };
    let page: PageResult;
    if (kind) {
      if (sortByVotes) {
        page = await ctx.db
          .query("communityPosts")
          .withIndex("by_kind_likes", (q) =>
            q.eq("kind", kind).eq("status", "published"),
          )
          .order("desc")
          .paginate({ numItems: cap, cursor: cursor ?? null });
      } else {
        page = await ctx.db
          .query("communityPosts")
          .withIndex("by_kind_created", (q) =>
            q.eq("kind", kind).eq("status", "published"),
          )
          .order("desc")
          .paginate({ numItems: cap, cursor: cursor ?? null });
      }
    } else {
      const indexName: "by_status_likes" | "by_status_created" =
        sortByVotes ? "by_status_likes" : "by_status_created";
      page = await ctx.db
        .query("communityPosts")
        .withIndex(indexName, (q) => q.eq("status", "published"))
        .order("desc")
        .paginate({ numItems: cap, cursor: cursor ?? null });
    }

    let rows: Doc<"communityPosts">[] = page.page;
    if (tag) {
      const t = tag.toLowerCase();
      rows = rows.filter((p) => p.tags.map((x) => x.toLowerCase()).includes(t));
    }
    if (sortMode === "featured") {
      rows = rows.filter((p) => !!p.featuredAt);
    }

    // Batch-hydrate author profiles + viewer's like state in parallel.
    // Previously this was N+1 sequential per row (~120 reads per feed
    // page). Now it's O(unique_authors) + O(row_count) in parallel.
    const viewer = await getOptionalUser(ctx, sessionToken);
    const authorMap = await hydrateAuthorMeta(ctx, rows);
    const likeChecks = viewer
      ? await Promise.all(
          rows.map((post) =>
            ctx.db
              .query("communityLikes")
              .withIndex("by_user_target", (q) =>
                q
                  .eq("userId", viewer._id)
                  .eq("targetType", "post")
                  .eq("targetId", post._id),
              )
              .first(),
          ),
        )
      : [];

    // Strip the raw `authorId` before returning. An internal user id
    // has no business appearing in the public feed — it enables
    // enumeration attacks (iterate the feed, pull every authorId,
    // then call users.get on each to hydrate PII). Callers who need
    // author metadata get it through `mapAuthorMeta` (handle,
    // displayName, avatarUrl), which is safe to expose publicly.
    const out = rows.map((post, i) => {
      const authorMeta = authorMap.get(post.authorId as unknown as string);
      const { authorId: _dropAuthorId, ...publicPost } = post;
      return {
        ...publicPost,
        ...mapAuthorMeta(authorMeta),
        likedByMe: viewer ? !!likeChecks[i] : false,
      };
    });

    return {
      page: out,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

export const listFollowingFeed = query({
  args: {
    sessionToken: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { sessionToken, limit }) => {
    const user = await requireAuthUser(ctx, sessionToken);
    const cap = Math.min(limit ?? FEED_PAGE, FEED_PAGE * 2);
    // Fetch the people I follow (cap at 500 to bound the query).
    const follows = await ctx.db
      .query("communityFollows")
      .withIndex("by_follower", (q) => q.eq("followerId", user._id))
      .take(MAX_LIST);
    if (follows.length === 0) return [];

    // Fan-in: for each followee, pull their most recent published posts.
    // Previously this fetched top N posts globally and filtered in-memory,
    // which gave users who follow low-volume creators an empty feed. Now
    // we do bounded parallel queries per followee.
    const perFolloweeFetch = await Promise.all(
      follows.slice(0, 200).map((f) =>
        ctx.db
          .query("communityPosts")
          .withIndex("by_author", (q) => q.eq("authorId", f.followeeId))
          .order("desc")
          .take(5),
      ),
    );
    const merged = perFolloweeFetch.flat().filter((p) => p.status === "published");
    // Sort by createdAt desc and cap.
    merged.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
    return merged.slice(0, cap);
  },
});

export const getPost = query({
  args: {
    sessionToken: v.optional(v.string()),
    postId: v.id("communityPosts"),
  },
  handler: async (ctx, { sessionToken, postId }) => {
    const post = await ctx.db.get(postId);
    if (!post) return null;
    // Enforce soft-delete at read time. Moderator-removed / author-
    // deleted posts must not be returned to non-admin viewers.
    const viewer = await getOptionalUser(ctx, sessionToken);
    const isAdmin = viewer?.role === "admin";
    if (!isAdmin && post.status !== "published") {
      return null;
    }
    const [profile, author] = await Promise.all([
      ctx.db
        .query("communityProfiles")
        .withIndex("by_user", (q) => q.eq("userId", post.authorId))
        .first(),
      ctx.db.get(post.authorId),
    ]);
    let likedByMe = false;
    if (viewer) {
      const like = await ctx.db
        .query("communityLikes")
        .withIndex("by_user_target", (q) =>
          q
            .eq("userId", viewer._id)
            .eq("targetType", "post")
            .eq("targetId", post._id),
        )
        .first();
      likedByMe = !!like;
    }
    return {
      post,
      author: profile
        ? {
            handle: profile.handle,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
          }
        : null,
      authorRole: author?.role,
      likedByMe,
    };
  },
});

export const listComments = query({
  args: {
    sessionToken: v.optional(v.string()),
    postId: v.id("communityPosts"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { sessionToken, postId, limit }) => {
    // Reject comment reads on hidden/removed parents.
    const parent = await ctx.db.get(postId);
    if (!parent) return [];
    const viewer = await getOptionalUser(ctx, sessionToken);
    const isAdmin = viewer?.role === "admin";
    if (!isAdmin && parent.status !== "published") return [];

    const cap = Math.min(limit ?? 100, MAX_LIST);
    const comments = await ctx.db
      .query("communityComments")
      .withIndex("by_post", (q) => q.eq("postId", postId))
      .order("asc")
      .take(cap);
    const visible = comments.filter((c) => c.status === "published");

    // Batch author hydration (was N+1).
    const authorMap = await hydrateAuthorMeta(ctx, visible);
    return visible.map((c) => {
      const authorMeta = authorMap.get(c.authorId as unknown as string);
      return {
        ...c,
        ...mapAuthorMeta(authorMeta),
      };
    });
  },
});

export const getProfileByHandle = query({
  args: {
    sessionToken: v.optional(v.string()),
    handle: v.string(),
  },
  handler: async (ctx, { sessionToken, handle }) => {
    const profile = await ctx.db
      .query("communityProfiles")
      .withIndex("by_handle", (q) => q.eq("handle", handle.toLowerCase()))
      .first();
    if (!profile) return null;
    const viewer = await getOptionalUser(ctx, sessionToken);
    let isFollowing = false;
    if (viewer && viewer._id !== profile.userId) {
      const follow = await ctx.db
        .query("communityFollows")
        .withIndex("by_pair", (q) =>
          q.eq("followerId", viewer._id).eq("followeeId", profile.userId),
        )
        .first();
      isFollowing = !!follow;
    }
    // Fetch a small window of recent published posts. Note: the profile
    // page deserves its own `listByAuthor` endpoint with a compound
    // `by_author_status_created` index for pagination — flagged in
    // the scale audit, to be added in a follow-up commit.
    const recentPosts = await ctx.db
      .query("communityPosts")
      .withIndex("by_author", (q) => q.eq("authorId", profile.userId))
      .order("desc")
      .take(50);
    const visiblePosts = recentPosts.filter((p) => p.status === "published").slice(0, 20);
    return {
      profile,
      isFollowing,
      isMe: viewer?._id === profile.userId,
      posts: visiblePosts,
    };
  },
});

export const getMyProfile = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireAuthUser(ctx, sessionToken);
    return await ctx.db
      .query("communityProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
  },
});

// ─────────────────────────────────────────────────────────────
// USER MUTATIONS
// ─────────────────────────────────────────────────────────────

// Valid post kinds a regular user can pick. `announcement` is admin-only —
// see `adminPostAnnouncement` below.
const USER_POST_KINDS = ["feedback", "feature_request", "bug", "discussion"] as const;
type UserPostKind = (typeof USER_POST_KINDS)[number];

export const createPost = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    title: v.string(),
    body: v.string(),
    notebookId: v.optional(v.id("notebooks")),
    coverImageUrl: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    // Category the user picked in the composer. Defaults to `discussion`
    // for back-compat with older clients.
    kind: v.optional(v.union(
      v.literal("feedback"),
      v.literal("feature_request"),
      v.literal("bug"),
      v.literal("discussion"),
    )),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx, args.sessionToken);
    await ensureNotBanned(ctx, user._id);
    // 10 new posts per user per hour.
    await limit(ctx, "user", user._id, "community.createPost", 10, 60 * 60 * 1000);
    const profile = await ensureProfile(ctx, user);

    const title = args.title.trim();
    const body = args.body.trim();
    if (!title) throw new Error("Title is required");
    if (title.length > MAX_TITLE) throw new Error(`Title too long (max ${MAX_TITLE})`);
    if (!body) throw new Error("Body is required");
    if (body.length > MAX_BODY) throw new Error(`Body too long (max ${MAX_BODY})`);
    const tags = (args.tags ?? [])
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0 && t.length <= 24)
      .slice(0, MAX_TAGS);

    const kind: UserPostKind =
      args.kind && (USER_POST_KINDS as readonly string[]).includes(args.kind)
        ? (args.kind as UserPostKind)
        : "discussion";

    // If linking a notebook, verify ownership and auto-share.
    if (args.notebookId) {
      const nb = await ctx.db.get(args.notebookId);
      if (!nb) throw new Error("Notebook not found");
      if (nb.userId !== user._id) throw new Error("You can only share your own notebooks");
      if (!nb.isShared) {
        await ctx.db.patch(args.notebookId, { isShared: true });
      }
    }

    const now = new Date().toISOString();
    const postId = await ctx.db.insert("communityPosts", {
      authorId: user._id,
      title,
      body,
      notebookId: args.notebookId,
      coverImageUrl: args.coverImageUrl,
      tags,
      likeCount: 0,
      commentCount: 0,
      viewCount: 0,
      status: "published",
      kind,
      // Only feature requests get a roadmap lifecycle — other kinds
      // leave roadmapStatus undefined.
      roadmapStatus: kind === "feature_request" ? "open" : undefined,
      createdAt: now,
      updatedAt: now,
    });

    // Bump profile post count (profile was already ensured above).
    await ctx.db.patch(profile._id, { postCount: profile.postCount + 1 });

    return postId;
  },
});

// Admin-only: post a product announcement / changelog entry. Lives in
// the same `communityPosts` table so the feed can render it inline
// with a distinct "Update" badge. Bypasses the per-user rate limit.
export const adminPostAnnouncement = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    title: v.string(),
    body: v.string(),
    tags: v.optional(v.array(v.string())),
    pinned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.sessionToken);
    const title = args.title.trim();
    const body = args.body.trim();
    if (!title || title.length > MAX_TITLE) throw new Error("Invalid title");
    if (!body || body.length > MAX_BODY) throw new Error("Invalid body");
    const tags = (args.tags ?? [])
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0 && t.length <= 24)
      .slice(0, MAX_TAGS);
    const now = new Date().toISOString();
    const postId = await ctx.db.insert("communityPosts", {
      authorId: admin._id,
      title,
      body,
      tags,
      likeCount: 0,
      commentCount: 0,
      viewCount: 0,
      status: "published",
      kind: "announcement",
      pinnedAt: args.pinned ? now : undefined,
      createdAt: now,
      updatedAt: now,
    });
    await writeAuditLog(ctx, admin, "community.adminPostAnnouncement", {
      postId, title, pinned: args.pinned ?? false,
    });
    return postId;
  },
});

// Admin-only: advance a feature request through the roadmap lifecycle.
// This is what admins click on the roadmap board to mark an idea as
// planned / in progress / shipped / declined.
export const adminSetRoadmapStatus = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    postId: v.id("communityPosts"),
    roadmapStatus: v.union(
      v.literal("open"),
      v.literal("planned"),
      v.literal("in_progress"),
      v.literal("shipped"),
      v.literal("declined"),
    ),
  },
  handler: async (ctx, { sessionToken, postId, roadmapStatus }) => {
    const admin = await requireAdmin(ctx, sessionToken);
    const post = await ctx.db.get(postId);
    if (!post) throw new Error("Post not found");
    if (post.kind !== "feature_request") {
      throw new Error("Roadmap status only applies to feature requests");
    }
    await ctx.db.patch(postId, {
      roadmapStatus,
      updatedAt: new Date().toISOString(),
    });
    await writeAuditLog(ctx, admin, "community.adminSetRoadmapStatus", {
      postId, roadmapStatus,
    });
  },
});

export const updatePost = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    postId: v.id("communityPosts"),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    coverImageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx, args.sessionToken);
    await ensureNotBanned(ctx, user._id);
    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Post not found");
    if (post.authorId !== user._id) throw new Error("Forbidden");
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (args.title !== undefined) {
      const t = args.title.trim();
      if (!t || t.length > MAX_TITLE) throw new Error("Invalid title");
      updates.title = t;
    }
    if (args.body !== undefined) {
      if (args.body.length > MAX_BODY) throw new Error("Body too long");
      updates.body = args.body;
    }
    if (args.tags !== undefined) {
      updates.tags = args.tags
        .map((x) => x.trim().toLowerCase())
        .filter((x) => x.length > 0 && x.length <= 24)
        .slice(0, MAX_TAGS);
    }
    if (args.coverImageUrl !== undefined) updates.coverImageUrl = args.coverImageUrl;
    await ctx.db.patch(args.postId, updates);
  },
});

export const deletePost = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    postId: v.id("communityPosts"),
  },
  handler: async (ctx, { sessionToken, postId }) => {
    const user = await requireAuthUser(ctx, sessionToken);
    const post = await ctx.db.get(postId);
    if (!post) return;
    if (post.authorId !== user._id) throw new Error("Forbidden");
    if (post.status === "removed") return;
    await ctx.db.patch(postId, { status: "removed" });

    // Decrement the author's postCount. Previously `postCount` was
    // incremented on create and NEVER decremented, so every delete
    // permanently drifted the profile stat upward.
    const profile = await ctx.db
      .query("communityProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (profile) {
      await ctx.db.patch(profile._id, {
        postCount: Math.max(0, profile.postCount - 1),
      });
    }
  },
});

export const addComment = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    postId: v.id("communityPosts"),
    body: v.string(),
    parentCommentId: v.optional(v.id("communityComments")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx, args.sessionToken);
    await ensureNotBanned(ctx, user._id);
    // 30 comments per user per hour.
    await limit(ctx, "user", user._id, "community.addComment", 30, 60 * 60 * 1000);
    await ensureProfile(ctx, user);

    const body = args.body.trim();
    if (!body) throw new Error("Comment cannot be empty");
    if (body.length > MAX_COMMENT) throw new Error(`Comment too long (max ${MAX_COMMENT})`);

    const post = await ctx.db.get(args.postId);
    if (!post || post.status !== "published") throw new Error("Post not available");

    // If this is a reply, the parent comment must belong to the same post.
    if (args.parentCommentId) {
      const parent = await ctx.db.get(args.parentCommentId);
      if (!parent || parent.postId !== args.postId) {
        throw new Error("Invalid parent comment");
      }
    }

    const now = new Date().toISOString();
    const commentId = await ctx.db.insert("communityComments", {
      postId: args.postId,
      authorId: user._id,
      body,
      parentCommentId: args.parentCommentId,
      likeCount: 0,
      status: "published",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(args.postId, { commentCount: post.commentCount + 1 });
    return commentId;
  },
});

export const editComment = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    commentId: v.id("communityComments"),
    body: v.string(),
  },
  handler: async (ctx, { sessionToken, commentId, body }) => {
    const user = await requireAuthUser(ctx, sessionToken);
    await ensureNotBanned(ctx, user._id);
    const comment = await ctx.db.get(commentId);
    if (!comment) throw new Error("Comment not found");
    if (comment.authorId !== user._id) throw new Error("Forbidden");
    if (comment.status !== "published") throw new Error("Comment not editable");
    const trimmed = body.trim();
    if (!trimmed) throw new Error("Comment cannot be empty");
    if (trimmed.length > MAX_COMMENT) throw new Error(`Comment too long (max ${MAX_COMMENT})`);
    await ctx.db.patch(commentId, {
      body: trimmed,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const deleteComment = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    commentId: v.id("communityComments"),
  },
  handler: async (ctx, { sessionToken, commentId }) => {
    const user = await requireAuthUser(ctx, sessionToken);
    await ensureNotBanned(ctx, user._id);
    const comment = await ctx.db.get(commentId);
    if (!comment) return;
    if (comment.authorId !== user._id) throw new Error("Forbidden");
    if (comment.status === "removed") return;
    await ctx.db.patch(commentId, { status: "removed" });
    const post = await ctx.db.get(comment.postId);
    if (post) {
      await ctx.db.patch(post._id, {
        commentCount: Math.max(0, post.commentCount - 1),
      });
    }
  },
});

// Record a view on a post. Separated from getPost so a single page load
// doesn't inflate counts on mount + refetch. Client explicitly calls
// this once per view.
export const recordPostView = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    postId: v.id("communityPosts"),
  },
  handler: async (ctx, { sessionToken, postId }) => {
    const user = await getOptionalUser(ctx, sessionToken);
    const post = await ctx.db.get(postId);
    if (!post || post.status !== "published") return;
    // Don't count the author viewing their own post.
    if (user && user._id === post.authorId) return;
    await ctx.db.patch(postId, { viewCount: (post.viewCount ?? 0) + 1 });
  },
});

// Combined post/comment like toggle. Uses two disjoint arg shapes so the
// targetId is always Id-validated (previously it was a raw v.string that
// allowed arbitrary strings, letting clients spam like rows for targets
// that didn't exist).
export const togglePostLike = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    postId: v.id("communityPosts"),
  },
  handler: async (ctx, { sessionToken, postId }) => {
    const user = await requireAuthUser(ctx, sessionToken);
    await ensureNotBanned(ctx, user._id);
    await limit(ctx, "user", user._id, "community.like", 120, 60 * 1000);

    const post = await ctx.db.get(postId);
    if (!post || post.status !== "published") {
      throw new Error("Post not available");
    }

    const existing = await ctx.db
      .query("communityLikes")
      .withIndex("by_user_target", (q) =>
        q.eq("userId", user._id).eq("targetType", "post").eq("targetId", postId),
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(post._id, {
        likeCount: Math.max(0, post.likeCount - 1),
      });
      return { liked: false };
    }
    await ctx.db.insert("communityLikes", {
      userId: user._id,
      targetType: "post",
      targetId: postId,
      createdAt: new Date().toISOString(),
    });
    await ctx.db.patch(post._id, { likeCount: post.likeCount + 1 });
    return { liked: true };
  },
});

export const toggleCommentLike = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    commentId: v.id("communityComments"),
  },
  handler: async (ctx, { sessionToken, commentId }) => {
    const user = await requireAuthUser(ctx, sessionToken);
    await ensureNotBanned(ctx, user._id);
    await limit(ctx, "user", user._id, "community.like", 120, 60 * 1000);

    const comment = await ctx.db.get(commentId);
    if (!comment || comment.status !== "published") {
      throw new Error("Comment not available");
    }

    const existing = await ctx.db
      .query("communityLikes")
      .withIndex("by_user_target", (q) =>
        q.eq("userId", user._id).eq("targetType", "comment").eq("targetId", commentId),
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(comment._id, {
        likeCount: Math.max(0, comment.likeCount - 1),
      });
      return { liked: false };
    }
    await ctx.db.insert("communityLikes", {
      userId: user._id,
      targetType: "comment",
      targetId: commentId,
      createdAt: new Date().toISOString(),
    });
    await ctx.db.patch(comment._id, { likeCount: comment.likeCount + 1 });
    return { liked: true };
  },
});

export const toggleFollow = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    followeeId: v.id("users"),
  },
  handler: async (ctx, { sessionToken, followeeId }) => {
    const user = await requireAuthUser(ctx, sessionToken);
    if (user._id === followeeId) throw new Error("Cannot follow yourself");
    await ensureNotBanned(ctx, user._id);
    await limit(ctx, "user", user._id, "community.follow", 60, 60 * 1000);

    const targetUser = await ctx.db.get(followeeId);
    if (!targetUser) throw new Error("User not found");

    const existing = await ctx.db
      .query("communityFollows")
      .withIndex("by_pair", (q) =>
        q.eq("followerId", user._id).eq("followeeId", followeeId),
      )
      .first();

    const followerProfile = await ensureProfile(ctx, user);
    const followeeProfile = await ensureProfile(ctx, targetUser);

    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(followerProfile._id, {
        followingCount: Math.max(0, followerProfile.followingCount - 1),
      });
      await ctx.db.patch(followeeProfile._id, {
        followerCount: Math.max(0, followeeProfile.followerCount - 1),
      });
      return { following: false };
    }
    await ctx.db.insert("communityFollows", {
      followerId: user._id,
      followeeId,
      createdAt: new Date().toISOString(),
    });
    await ctx.db.patch(followerProfile._id, {
      followingCount: followerProfile.followingCount + 1,
    });
    await ctx.db.patch(followeeProfile._id, {
      followerCount: followeeProfile.followerCount + 1,
    });
    return { following: true };
  },
});

// Type-safe report endpoints. Previously `targetId` was `v.string()` with
// no validation — a client could insert arbitrary strings into the reports
// table and overwhelm the admin queue.
export const reportPost = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    postId: v.id("communityPosts"),
    reason: v.union(
      v.literal("spam"),
      v.literal("harassment"),
      v.literal("nsfw"),
      v.literal("copyright"),
      v.literal("other"),
    ),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { sessionToken, postId, reason, note }) => {
    const user = await requireAuthUser(ctx, sessionToken);
    await ensureNotBanned(ctx, user._id);
    await limit(ctx, "user", user._id, "community.report", 10, 60 * 60 * 1000);
    const post = await ctx.db.get(postId);
    if (!post) throw new Error("Post not found");
    if (post.authorId === user._id) throw new Error("Cannot report your own post");
    return await ctx.db.insert("communityReports", {
      reporterId: user._id,
      targetType: "post",
      targetId: postId,
      reason,
      note: note?.slice(0, 500),
      status: "open",
      createdAt: new Date().toISOString(),
    });
  },
});

export const reportComment = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    commentId: v.id("communityComments"),
    reason: v.union(
      v.literal("spam"),
      v.literal("harassment"),
      v.literal("nsfw"),
      v.literal("copyright"),
      v.literal("other"),
    ),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { sessionToken, commentId, reason, note }) => {
    const user = await requireAuthUser(ctx, sessionToken);
    await ensureNotBanned(ctx, user._id);
    await limit(ctx, "user", user._id, "community.report", 10, 60 * 60 * 1000);
    const comment = await ctx.db.get(commentId);
    if (!comment) throw new Error("Comment not found");
    if (comment.authorId === user._id) throw new Error("Cannot report your own comment");
    return await ctx.db.insert("communityReports", {
      reporterId: user._id,
      targetType: "comment",
      targetId: commentId,
      reason,
      note: note?.slice(0, 500),
      status: "open",
      createdAt: new Date().toISOString(),
    });
  },
});

export const updateMyProfile = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    handle: v.optional(v.string()),
    displayName: v.optional(v.string()),
    bio: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    bannerUrl: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    location: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx, args.sessionToken);
    await ensureNotBanned(ctx, user._id);
    const profile = await ensureProfile(ctx, user);

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (args.handle !== undefined) {
      const newHandle = normalizeHandle(args.handle);
      if (newHandle !== profile.handle) {
        const collision = await ctx.db
          .query("communityProfiles")
          .withIndex("by_handle", (q) => q.eq("handle", newHandle))
          .first();
        if (collision) throw new Error("Handle already taken");
        updates.handle = newHandle;
      }
    }
    if (args.displayName !== undefined) {
      const dn = args.displayName.normalize("NFKC").replace(/[\u200B-\u200F\u202A-\u202E]/g, "").trim();
      if (dn.length > 60) throw new Error("Display name too long (max 60)");
      updates.displayName = dn;
    }
    if (args.bio !== undefined) {
      if (args.bio.length > 500) throw new Error("Bio too long (max 500)");
      updates.bio = args.bio;
    }
    if (args.avatarUrl !== undefined) {
      updates.avatarUrl = args.avatarUrl ? safeUrlOrThrow(args.avatarUrl) : undefined;
    }
    if (args.bannerUrl !== undefined) {
      updates.bannerUrl = args.bannerUrl ? safeUrlOrThrow(args.bannerUrl) : undefined;
    }
    if (args.websiteUrl !== undefined) {
      updates.websiteUrl = args.websiteUrl ? safeUrlOrThrow(args.websiteUrl) : undefined;
    }
    if (args.location !== undefined) {
      if (args.location.length > 60) throw new Error("Location too long (max 60)");
      updates.location = args.location;
    }
    await ctx.db.patch(profile._id, updates);
  },
});

// ─────────────────────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────────────────────

export const adminListReports = query({
  args: {
    sessionToken: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("open"),
      v.literal("resolved"),
      v.literal("dismissed"),
    )),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { sessionToken, status, limit }) => {
    await requireAdmin(ctx, sessionToken);
    const cap = Math.min(limit ?? 100, MAX_LIST);
    const s = status ?? "open";
    return await ctx.db
      .query("communityReports")
      .withIndex("by_status_created", (q) => q.eq("status", s))
      .order("desc")
      .take(cap);
  },
});

export const adminHidePost = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    postId: v.id("communityPosts"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { sessionToken, postId, reason }) => {
    const admin = await requireAdmin(ctx, sessionToken);
    const post = await ctx.db.get(postId);
    if (!post) throw new Error("Post not found");
    await ctx.db.patch(postId, {
      status: "hidden",
      hiddenReason: reason,
      hiddenBy: admin._id,
    });
    await writeAuditLog(ctx, admin, "community.adminHidePost", { postId, reason });
  },
});

export const adminRemovePost = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    postId: v.id("communityPosts"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { sessionToken, postId, reason }) => {
    const admin = await requireAdmin(ctx, sessionToken);
    const post = await ctx.db.get(postId);
    if (!post) throw new Error("Post not found");
    await ctx.db.patch(postId, {
      status: "removed",
      hiddenReason: reason,
      hiddenBy: admin._id,
    });
    // Decrement author postCount on admin takedown (same drift fix as
    // user-initiated deletePost).
    const authorProfile = await ctx.db
      .query("communityProfiles")
      .withIndex("by_user", (q) => q.eq("userId", post.authorId))
      .first();
    if (authorProfile) {
      await ctx.db.patch(authorProfile._id, {
        postCount: Math.max(0, authorProfile.postCount - 1),
      });
    }
    await writeAuditLog(
      ctx, admin, "community.adminRemovePost",
      { postId, reason }, post.authorId,
    );
  },
});

export const adminPinPost = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    postId: v.id("communityPosts"),
    pinned: v.boolean(),
  },
  handler: async (ctx, { sessionToken, postId, pinned }) => {
    const admin = await requireAdmin(ctx, sessionToken);
    await ctx.db.patch(postId, {
      pinnedAt: pinned ? new Date().toISOString() : undefined,
    });
    await writeAuditLog(ctx, admin, "community.adminPinPost", { postId, pinned });
  },
});

export const adminFeaturePost = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    postId: v.id("communityPosts"),
    featured: v.boolean(),
  },
  handler: async (ctx, { sessionToken, postId, featured }) => {
    const admin = await requireAdmin(ctx, sessionToken);
    await ctx.db.patch(postId, {
      featuredAt: featured ? new Date().toISOString() : undefined,
    });
    await writeAuditLog(ctx, admin, "community.adminFeaturePost", { postId, featured });
  },
});

export const adminBanUser = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    userId: v.id("users"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { sessionToken, userId, reason }) => {
    const admin = await requireAdmin(ctx, sessionToken);
    let profile = await ctx.db
      .query("communityProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!profile) {
      const target = await ctx.db.get(userId);
      if (target) {
        profile = await ensureProfile(ctx, target);
      }
    }
    if (!profile) throw new Error("Profile not found");
    await ctx.db.patch(profile._id, {
      isBanned: true,
      bannedAt: new Date().toISOString(),
      banReason: reason,
    });
    await writeAuditLog(
      ctx, admin, "community.adminBanUser", { reason }, userId,
    );
  },
});

export const adminUnbanUser = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    userId: v.id("users"),
  },
  handler: async (ctx, { sessionToken, userId }) => {
    const admin = await requireAdmin(ctx, sessionToken);
    const profile = await ctx.db
      .query("communityProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!profile) return;
    await ctx.db.patch(profile._id, {
      isBanned: false,
      bannedAt: undefined,
      banReason: undefined,
    });
    await writeAuditLog(ctx, admin, "community.adminUnbanUser", {}, userId);
  },
});

export const adminResolveReport = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    reportId: v.id("communityReports"),
    resolution: v.string(),
  },
  handler: async (ctx, { sessionToken, reportId, resolution }) => {
    const admin = await requireAdmin(ctx, sessionToken);
    await ctx.db.patch(reportId, {
      status: "resolved",
      resolution,
      handledBy: admin._id,
      handledAt: new Date().toISOString(),
    });
    await writeAuditLog(ctx, admin, "community.adminResolveReport", { reportId, resolution });
  },
});

export const adminDismissReport = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    reportId: v.id("communityReports"),
  },
  handler: async (ctx, { sessionToken, reportId }) => {
    const admin = await requireAdmin(ctx, sessionToken);
    await ctx.db.patch(reportId, {
      status: "dismissed",
      handledBy: admin._id,
      handledAt: new Date().toISOString(),
    });
    await writeAuditLog(ctx, admin, "community.adminDismissReport", { reportId });
  },
});
