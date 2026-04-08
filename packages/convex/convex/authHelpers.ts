// Shared auth helpers used across mutations/queries that accept a session
// token. Centralised here so every notebook/page/block/community/affiliate
// mutation resolves the authenticated user through the same code path.
//
// Previously `pages.ts` and `blocks.ts` had *no* auth — every mutation
// accepted raw ids and acted, which was a cross-tenant IDOR. These helpers
// fix that: callers pass `sessionToken`, we resolve the user, the caller
// then checks ownership against the resolved doc.

import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";

export type AuthCtx = QueryCtx | MutationCtx;

/**
 * Resolve the authenticated user from either a Convex identity JWT
 * or a legacy session token, or return null if neither is valid.
 */
export async function getAuthUser(
  ctx: AuthCtx,
  sessionToken?: string,
): Promise<Doc<"users"> | null> {
  // 1) JWT identity (preferred)
  const identity = await ctx.auth.getUserIdentity();
  if (identity) {
    const u = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (u) return u;
  }
  // 2) Legacy session token
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
  return null;
}

/**
 * Resolve the authenticated user or throw "Not authenticated".
 */
export async function requireAuthUser(
  ctx: AuthCtx,
  sessionToken?: string,
): Promise<Doc<"users">> {
  const user = await getAuthUser(ctx, sessionToken);
  if (!user) throw new Error("Not authenticated");
  return user;
}

/**
 * Resolve the authenticated user and verify admin role, or throw.
 */
export async function requireAdminUser(
  ctx: AuthCtx,
  sessionToken?: string,
): Promise<Doc<"users">> {
  const user = await requireAuthUser(ctx, sessionToken);
  if (user.role !== "admin") throw new Error("Forbidden: admin only");
  return user;
}

/**
 * Verify the caller owns the given notebook.
 * Returns the notebook doc on success, throws Forbidden/NotFound otherwise.
 */
export async function requireNotebookOwner(
  ctx: AuthCtx,
  notebookId: Id<"notebooks">,
  sessionToken?: string,
): Promise<{ user: Doc<"users">; notebook: Doc<"notebooks"> }> {
  const user = await requireAuthUser(ctx, sessionToken);
  const notebook = await ctx.db.get(notebookId);
  if (!notebook) throw new Error("Notebook not found");
  if (notebook.userId !== user._id) throw new Error("Forbidden");
  return { user, notebook };
}

/**
 * Verify the caller owns the page (by resolving page → notebook → userId).
 */
export async function requirePageOwner(
  ctx: AuthCtx,
  pageId: Id<"pages">,
  sessionToken?: string,
): Promise<{ user: Doc<"users">; page: Doc<"pages">; notebook: Doc<"notebooks"> }> {
  const user = await requireAuthUser(ctx, sessionToken);
  const page = await ctx.db.get(pageId);
  if (!page) throw new Error("Page not found");
  const notebook = await ctx.db.get(page.notebookId);
  if (!notebook) throw new Error("Notebook not found");
  if (notebook.userId !== user._id) throw new Error("Forbidden");
  return { user, page, notebook };
}

/**
 * Verify the caller owns the block (block → page → notebook → userId).
 */
export async function requireBlockOwner(
  ctx: AuthCtx,
  blockId: Id<"blocks">,
  sessionToken?: string,
): Promise<{
  user: Doc<"users">;
  block: Doc<"blocks">;
  page: Doc<"pages">;
  notebook: Doc<"notebooks">;
}> {
  const user = await requireAuthUser(ctx, sessionToken);
  const block = await ctx.db.get(blockId);
  if (!block) throw new Error("Block not found");
  const page = await ctx.db.get(block.pageId);
  if (!page) throw new Error("Page not found");
  const notebook = await ctx.db.get(page.notebookId);
  if (!notebook) throw new Error("Notebook not found");
  if (notebook.userId !== user._id) throw new Error("Forbidden");
  return { user, block, page, notebook };
}
