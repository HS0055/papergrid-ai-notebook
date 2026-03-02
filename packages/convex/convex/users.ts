import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// Plan limits for gating features
export const PLAN_LIMITS = {
  free: { notebooks: 3, pagesPerNotebook: 10, aiGenerationsPerMonth: 5 },
  starter: { notebooks: 999, pagesPerNotebook: 50, aiGenerationsPerMonth: 50 },
  pro: { notebooks: 999, pagesPerNotebook: 999, aiGenerationsPerMonth: 500 },
  founder: { notebooks: 999, pagesPerNotebook: 999, aiGenerationsPerMonth: 500 },
} as const;

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_HASH_VERSION = "pbkdf2_sha256";
const PASSWORD_HASH_ITERATIONS = 120_000;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

type AuthCtx = QueryCtx | MutationCtx;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("Invalid hex");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function assertPassword(password: string): void {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }
}

async function derivePasswordHash(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hashHex = await derivePasswordHash(password, salt, PASSWORD_HASH_ITERATIONS);
  return `${PASSWORD_HASH_VERSION}$${PASSWORD_HASH_ITERATIONS}$${bytesToHex(salt)}$${hashHex}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [version, iterationsRaw, saltHex, expectedHashHex] = storedHash.split("$");
  if (!version || !iterationsRaw || !saltHex || !expectedHashHex) return false;
  if (version !== PASSWORD_HASH_VERSION) return false;
  const iterations = Number(iterationsRaw);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  try {
    const computedHashHex = await derivePasswordHash(password, hexToBytes(saltHex), iterations);
    return constantTimeEquals(computedHashHex, expectedHashHex);
  } catch {
    return false;
  }
}

async function createSession(ctx: MutationCtx, userId: Id<"users">) {
  const sessionToken = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
  await ctx.db.insert("authSessions", {
    userId,
    token: sessionToken,
    createdAt: now.toISOString(),
    expiresAt,
  });
  return sessionToken;
}

async function getUserFromSessionToken(ctx: AuthCtx, sessionToken?: string) {
  if (!sessionToken) return null;
  const session = await ctx.db
    .query("authSessions")
    .withIndex("by_token", (q) => q.eq("token", sessionToken))
    .first();
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() <= Date.now()) return null;
  return await ctx.db.get(session.userId);
}

// Helper: get the authenticated user or null
async function getUserFromIdentity(ctx: AuthCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .first();
}

// Get current authenticated user (for components)
export const getCurrentUser = query({
  args: {
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { sessionToken }) => {
    const identityUser = await getUserFromIdentity(ctx);
    if (identityUser) return identityUser;
    return await getUserFromSessionToken(ctx, sessionToken);
  },
});

// Auto-provision user on first login (called from auth callback or app init)
export const getOrCreate = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Check if user already exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (existing) return existing._id;

    // Create new user from identity
    return await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      name: identity.name ?? identity.email ?? "User",
      email: identity.email ?? "",
      avatarUrl: identity.pictureUrl,
      plan: "free",
      aiGenerationsUsed: 0,
      preferences: {
        defaultAesthetic: "modern-planner",
        defaultPaperType: "lined",
      },
    });
  },
});

// Email/password signup.
export const signupWithEmailPassword = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, { email, password, name }) => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) throw new Error("Email is required");
    assertPassword(password);

    let user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();
    if (!user && email.trim() !== normalizedEmail) {
      user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email.trim()))
        .first();
    }

    if (user?.passwordHash) {
      throw new Error("Email already in use");
    }

    const passwordHash = await hashPassword(password);

    if (!user) {
      const userId = await ctx.db.insert("users", {
        tokenIdentifier: `local:${normalizedEmail}`,
        name: name?.trim() || normalizedEmail.split("@")[0] || "User",
        email: normalizedEmail,
        passwordHash,
        plan: "free",
        aiGenerationsUsed: 0,
        aiGenerationsResetAt: new Date().toISOString(),
        preferences: {
          defaultAesthetic: "modern-planner",
          defaultPaperType: "lined",
        },
      });
      user = await ctx.db.get(userId);
    } else {
      const nextName = name?.trim();
      const patch: Record<string, unknown> = {
        email: normalizedEmail,
        passwordHash,
      };
      if (nextName && nextName !== user.name) {
        patch.name = nextName;
      }
      if (!user.tokenIdentifier) {
        patch.tokenIdentifier = `local:${normalizedEmail}`;
      }
      await ctx.db.patch(user._id, patch);
      user = await ctx.db.get(user._id);
    }

    if (!user) throw new Error("Failed to resolve user");

    const sessionToken = await createSession(ctx, user._id);

    return { sessionToken, user };
  },
});

// Email/password login.
export const loginWithEmailPassword = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, { email, password }) => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) throw new Error("Email is required");

    let user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();
    if (!user && email.trim() !== normalizedEmail) {
      user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email.trim()))
        .first();
    }
    if (!user) {
      throw new Error("Invalid email or password");
    }
    if (!user.passwordHash) {
      throw new Error("Account has no password yet. Use Sign Up to set one.");
    }
    const passwordOk = await verifyPassword(password, user.passwordHash);
    if (!passwordOk) {
      throw new Error("Invalid email or password");
    }

    if (user.email !== normalizedEmail) {
      await ctx.db.patch(user._id, { email: normalizedEmail });
      user = { ...user, email: normalizedEmail };
    }

    const sessionToken = await createSession(ctx, user._id);
    return { sessionToken, user };
  },
});

export const logoutWithSession = mutation({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, { sessionToken }) => {
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("by_token", (q) => q.eq("token", sessionToken))
      .collect();
    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }
    return { success: true };
  },
});

// Get user by ID
export const get = query({
  args: { id: v.id("users") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

// Get user by email
export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalizedEmail = normalizeEmail(email);
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();
  },
});

// Update user preferences
export const updatePreferences = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    preferences: v.object({
      defaultAesthetic: v.string(),
      defaultPaperType: v.string(),
    }),
  },
  handler: async (ctx, { sessionToken, preferences }) => {
    const user = (await getUserFromIdentity(ctx)) ?? (await getUserFromSessionToken(ctx, sessionToken));
    if (!user) throw new Error("Not authenticated");
    await ctx.db.patch(user._id, { preferences });
  },
});

// Update user plan (called from Stripe webhook)
export const updatePlan = mutation({
  args: {
    userId: v.optional(v.id("users")),
    sessionToken: v.optional(v.string()),
    plan: v.union(v.literal("free"), v.literal("starter"), v.literal("pro"), v.literal("founder")),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
  },
  handler: async (ctx, { userId, sessionToken, plan, stripeCustomerId, stripeSubscriptionId }) => {
    const actingUser = (await getUserFromIdentity(ctx)) ?? (await getUserFromSessionToken(ctx, sessionToken));
    if (!actingUser) throw new Error("Not authenticated");
    const targetUserId = userId ?? actingUser._id;
    if (targetUserId !== actingUser._id) {
      throw new Error("Forbidden");
    }

    const patch: Record<string, unknown> = { plan };
    if (stripeCustomerId) patch.stripeCustomerId = stripeCustomerId;
    if (stripeSubscriptionId) patch.stripeSubscriptionId = stripeSubscriptionId;
    await ctx.db.patch(targetUserId, patch);
  },
});

// Increment AI generation counter (called before each generation)
export const incrementAiUsage = mutation({
  args: {
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { sessionToken }) => {
    const user = (await getUserFromIdentity(ctx)) ?? (await getUserFromSessionToken(ctx, sessionToken));
    if (!user) throw new Error("Not authenticated");

    // Reset counter if month has rolled over
    const now = new Date();
    const resetAt = user.aiGenerationsResetAt ? new Date(user.aiGenerationsResetAt) : null;
    if (!resetAt || resetAt.getMonth() !== now.getMonth() || resetAt.getFullYear() !== now.getFullYear()) {
      await ctx.db.patch(user._id, {
        aiGenerationsUsed: 1,
        aiGenerationsResetAt: now.toISOString(),
      });
      return { allowed: true, used: 1 };
    }

    const used = user.aiGenerationsUsed ?? 0;
    const limit = PLAN_LIMITS[user.plan].aiGenerationsPerMonth;
    if (used >= limit) {
      return { allowed: false, used };
    }

    await ctx.db.patch(user._id, {
      aiGenerationsUsed: used + 1,
    });
    return { allowed: true, used: used + 1 };
  },
});
