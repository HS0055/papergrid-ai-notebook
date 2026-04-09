import type { HttpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// ─────────────────────────────────────────────────────────────
// HTTP surface for the community module.
//
// Minimal REST-ish wrappers around the Convex query/mutation layer so
// the frontend (which uses fetch, not a Convex React client) can read
// and write posts, comments, likes, follows, and profiles.
//
// Every route forwards the session token from the Authorization header
// so the Convex-side auth helpers resolve the caller the same way as
// /api/auth/me.
// ─────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "capacitor://localhost",
  "ionic://localhost",
  "https://papergrid.app",
  "https://www.papergrid.app",
  "https://papergrid-five.vercel.app",
];

function isAllowedVercelPreview(origin: string): boolean {
  if (!origin.startsWith("https://")) return false;
  const host = origin.slice("https://".length);
  return host.startsWith("papergrid-") && host.endsWith(".vercel.app");
}

function corsOrigin(request: Request): string {
  const origin = request.headers.get("origin") ?? "";
  if (!origin) return ALLOWED_ORIGINS[0];
  if (ALLOWED_ORIGINS.includes(origin) || isAllowedVercelPreview(origin)) return origin;
  return ALLOWED_ORIGINS[0];
}

function corsHeaders(request: Request) {
  return {
    "Access-Control-Allow-Origin": corsOrigin(request),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Session-Token",
  };
}

function getSessionToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }
  return request.headers.get("X-Session-Token");
}

function json(body: unknown, status: number, request: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(request) },
  });
}

function errMsg(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message.replace(/^Uncaught Error:\s*/i, "").split("\n")[0].trim() || fallback;
  }
  return fallback;
}

function statusFromMessage(msg: string): number {
  if (/not authenticated/i.test(msg)) return 401;
  if (/forbidden/i.test(msg)) return 403;
  if (/not found/i.test(msg)) return 404;
  if (/rate limit/i.test(msg)) return 429;
  if (/too long|invalid|required/i.test(msg)) return 400;
  return 500;
}

// Install one OPTIONS preflight handler per path.
function installPreflight(http: HttpRouter, path: string) {
  http.route({
    path,
    method: "OPTIONS",
    handler: httpAction(async (_ctx, request) => {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }),
  });
}

export function registerCommunityRoutes(http: HttpRouter) {
  // ── GET /api/community/feed?sort=&kind=&tag=&cursor=&limit= ──
  http.route({
    path: "/api/community/feed",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      try {
        const url = new URL(request.url);
        const sort = url.searchParams.get("sort") as
          | "recent" | "trending" | "featured" | null;
        const kindParam = url.searchParams.get("kind");
        const kind =
          kindParam === "feedback" ||
          kindParam === "feature_request" ||
          kindParam === "bug" ||
          kindParam === "announcement" ||
          kindParam === "discussion"
            ? kindParam
            : undefined;
        const tag = url.searchParams.get("tag") ?? undefined;
        const cursor = url.searchParams.get("cursor") ?? undefined;
        const limitRaw = url.searchParams.get("limit");
        const limit = limitRaw ? Math.min(Math.max(Number(limitRaw) || 30, 1), 60) : undefined;

        const result = await ctx.runQuery(api.community.listFeed, {
          sessionToken: getSessionToken(request) ?? undefined,
          sort: sort ?? undefined,
          kind,
          tag,
          cursor,
          limit,
        });
        return json(result, 200, request);
      } catch (error) {
        const msg = errMsg(error, "Failed to load feed");
        return json({ error: msg }, statusFromMessage(msg), request);
      }
    }),
  });
  installPreflight(http, "/api/community/feed");

  // ── POST /api/community/admin/announce ──────────────────
  http.route({
    path: "/api/community/admin/announce",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      try {
        const body = await request.json().catch(() => ({}));
        const postId = await ctx.runMutation(api.community.adminPostAnnouncement, {
          sessionToken: getSessionToken(request) ?? undefined,
          title: String(body.title ?? ""),
          body: String(body.body ?? ""),
          tags: Array.isArray(body.tags)
            ? body.tags.filter((t: unknown) => typeof t === "string")
            : undefined,
          pinned: typeof body.pinned === "boolean" ? body.pinned : false,
        });
        return json({ postId }, 200, request);
      } catch (error) {
        const msg = errMsg(error, "Failed to post announcement");
        return json({ error: msg }, statusFromMessage(msg), request);
      }
    }),
  });
  installPreflight(http, "/api/community/admin/announce");

  // ── POST /api/community/admin/delete-post ───────────────
  http.route({
    path: "/api/community/admin/delete-post",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      try {
        const body = await request.json().catch(() => ({}));
        if (!body.postId) {
          return json({ error: "postId required" }, 400, request);
        }
        await ctx.runMutation(api.community.adminRemovePost, {
          sessionToken: getSessionToken(request) ?? undefined,
          postId: body.postId,
        });
        return json({ success: true }, 200, request);
      } catch (error) {
        const msg = errMsg(error, "Failed to remove post");
        return json({ error: msg }, statusFromMessage(msg), request);
      }
    }),
  });
  installPreflight(http, "/api/community/admin/delete-post");

  // ── POST /api/community/admin/roadmap-status ────────────
  http.route({
    path: "/api/community/admin/roadmap-status",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      try {
        const body = await request.json().catch(() => ({}));
        if (!body.postId || !body.roadmapStatus) {
          return json({ error: "postId and roadmapStatus required" }, 400, request);
        }
        await ctx.runMutation(api.community.adminSetRoadmapStatus, {
          sessionToken: getSessionToken(request) ?? undefined,
          postId: body.postId,
          roadmapStatus: body.roadmapStatus,
        });
        return json({ success: true }, 200, request);
      } catch (error) {
        const msg = errMsg(error, "Failed to update roadmap status");
        return json({ error: msg }, statusFromMessage(msg), request);
      }
    }),
  });
  installPreflight(http, "/api/community/admin/roadmap-status");

  // ── GET /api/community/following-feed?limit= ──
  http.route({
    path: "/api/community/following-feed",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      try {
        const url = new URL(request.url);
        const limitRaw = url.searchParams.get("limit");
        const limit = limitRaw ? Math.min(Math.max(Number(limitRaw) || 30, 1), 60) : undefined;
        const posts = await ctx.runQuery(api.community.listFollowingFeed, {
          sessionToken: getSessionToken(request) ?? undefined,
          limit,
        });
        return json({ posts }, 200, request);
      } catch (error) {
        const msg = errMsg(error, "Failed to load feed");
        return json({ error: msg }, statusFromMessage(msg), request);
      }
    }),
  });
  installPreflight(http, "/api/community/following-feed");

  // ── GET /api/community/post?id=... ──
  http.route({
    path: "/api/community/post",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      try {
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (!id) return json({ error: "id required" }, 400, request);
        const post = await ctx.runQuery(api.community.getPost, {
          sessionToken: getSessionToken(request) ?? undefined,
          postId: id as Id<"communityPosts">,
        });
        return json({ post }, 200, request);
      } catch (error) {
        const msg = errMsg(error, "Failed to load post");
        return json({ error: msg }, statusFromMessage(msg), request);
      }
    }),
  });
  installPreflight(http, "/api/community/post");

  // ── GET /api/community/comments?postId= ──
  http.route({
    path: "/api/community/comments",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      try {
        const url = new URL(request.url);
        const postId = url.searchParams.get("postId");
        if (!postId) return json({ error: "postId required" }, 400, request);
        const comments = await ctx.runQuery(api.community.listComments, {
          sessionToken: getSessionToken(request) ?? undefined,
          postId: postId as Id<"communityPosts">,
        });
        return json({ comments }, 200, request);
      } catch (error) {
        const msg = errMsg(error, "Failed to load comments");
        return json({ error: msg }, statusFromMessage(msg), request);
      }
    }),
  });
  installPreflight(http, "/api/community/comments");

  // ── GET /api/community/profile?handle= ──
  http.route({
    path: "/api/community/profile",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      try {
        const url = new URL(request.url);
        const handle = url.searchParams.get("handle");
        if (!handle) return json({ error: "handle required" }, 400, request);
        const result = await ctx.runQuery(api.community.getProfileByHandle, {
          sessionToken: getSessionToken(request) ?? undefined,
          handle,
        });
        return json(result ?? { profile: null }, 200, request);
      } catch (error) {
        const msg = errMsg(error, "Failed to load profile");
        return json({ error: msg }, statusFromMessage(msg), request);
      }
    }),
  });
  installPreflight(http, "/api/community/profile");

  // ── GET /api/community/my-profile ──
  http.route({
    path: "/api/community/my-profile",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      try {
        const profile = await ctx.runQuery(api.community.getMyProfile, {
          sessionToken: getSessionToken(request) ?? undefined,
        });
        return json({ profile }, 200, request);
      } catch (error) {
        const msg = errMsg(error, "Failed to load profile");
        return json({ error: msg }, statusFromMessage(msg), request);
      }
    }),
  });
  installPreflight(http, "/api/community/my-profile");

  // ── POST /api/community/posts (create) ──
  http.route({
    path: "/api/community/posts",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      try {
        const body = await request.json().catch(() => ({}));
        const kind =
          body.kind === "feedback" ||
          body.kind === "feature_request" ||
          body.kind === "bug" ||
          body.kind === "discussion"
            ? body.kind
            : undefined;
        const postId = await ctx.runMutation(api.community.createPost, {
          sessionToken: getSessionToken(request) ?? undefined,
          title: String(body.title ?? ""),
          body: String(body.body ?? ""),
          tags: Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === "string") : undefined,
          coverImageUrl: typeof body.coverImageUrl === "string" ? body.coverImageUrl : undefined,
          notebookId: typeof body.notebookId === "string"
            ? (body.notebookId as Id<"notebooks">)
            : undefined,
          kind,
        });
        return json({ postId }, 200, request);
      } catch (error) {
        const msg = errMsg(error, "Failed to create post");
        return json({ error: msg }, statusFromMessage(msg), request);
      }
    }),
  });
  installPreflight(http, "/api/community/posts");

  // ── POST /api/community/comments (add comment) ──
  http.route({
    path: "/api/community/comments",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      try {
        const body = await request.json().catch(() => ({}));
        if (!body.postId) return json({ error: "postId required" }, 400, request);
        if (!body.body) return json({ error: "body required" }, 400, request);
        const commentId = await ctx.runMutation(api.community.addComment, {
          sessionToken: getSessionToken(request) ?? undefined,
          postId: body.postId as Id<"communityPosts">,
          body: String(body.body),
          parentCommentId: typeof body.parentCommentId === "string"
            ? (body.parentCommentId as Id<"communityComments">)
            : undefined,
        });
        return json({ commentId }, 200, request);
      } catch (error) {
        const msg = errMsg(error, "Failed to add comment");
        return json({ error: msg }, statusFromMessage(msg), request);
      }
    }),
  });

  // ── POST /api/community/like-post ──
  http.route({
    path: "/api/community/like-post",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      try {
        const body = await request.json().catch(() => ({}));
        if (!body.postId) return json({ error: "postId required" }, 400, request);
        const result = await ctx.runMutation(api.community.togglePostLike, {
          sessionToken: getSessionToken(request) ?? undefined,
          postId: body.postId as Id<"communityPosts">,
        });
        return json(result, 200, request);
      } catch (error) {
        const msg = errMsg(error, "Failed to like post");
        return json({ error: msg }, statusFromMessage(msg), request);
      }
    }),
  });
  installPreflight(http, "/api/community/like-post");

  // ── POST /api/community/follow ──
  http.route({
    path: "/api/community/follow",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      try {
        const body = await request.json().catch(() => ({}));
        if (!body.followeeId) return json({ error: "followeeId required" }, 400, request);
        const result = await ctx.runMutation(api.community.toggleFollow, {
          sessionToken: getSessionToken(request) ?? undefined,
          followeeId: body.followeeId as Id<"users">,
        });
        return json(result, 200, request);
      } catch (error) {
        const msg = errMsg(error, "Failed to toggle follow");
        return json({ error: msg }, statusFromMessage(msg), request);
      }
    }),
  });
  installPreflight(http, "/api/community/follow");

  // ── POST /api/community/profile (update) ──
  http.route({
    path: "/api/community/profile",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      try {
        const body = await request.json().catch(() => ({}));
        await ctx.runMutation(api.community.updateMyProfile, {
          sessionToken: getSessionToken(request) ?? undefined,
          handle: typeof body.handle === "string" ? body.handle : undefined,
          displayName: typeof body.displayName === "string" ? body.displayName : undefined,
          bio: typeof body.bio === "string" ? body.bio : undefined,
          avatarUrl: typeof body.avatarUrl === "string" ? body.avatarUrl : undefined,
          bannerUrl: typeof body.bannerUrl === "string" ? body.bannerUrl : undefined,
          websiteUrl: typeof body.websiteUrl === "string" ? body.websiteUrl : undefined,
          location: typeof body.location === "string" ? body.location : undefined,
        });
        return json({ success: true }, 200, request);
      } catch (error) {
        const msg = errMsg(error, "Failed to update profile");
        return json({ error: msg }, statusFromMessage(msg), request);
      }
    }),
  });
}
