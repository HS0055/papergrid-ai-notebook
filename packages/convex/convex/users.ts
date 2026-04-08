import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getPlanLimitFor, type PlanId } from "./planLimits";

// Waitlist bonus (promised on the iOS launch landing page —
// "Join the waitlist to get early access, a bonus 25 Ink on launch day…").
const WAITLIST_BONUS_INK = 25;

// Legacy plan limits (kept for backward compatibility during migration)
export const PLAN_LIMITS = {
  free: { notebooks: 3, pagesPerNotebook: 10, aiGenerationsPerMonth: 25 },
  starter: { notebooks: 999, pagesPerNotebook: 50, aiGenerationsPerMonth: 50 },
  pro: { notebooks: 999, pagesPerNotebook: 999, aiGenerationsPerMonth: 500 },
  founder: { notebooks: 999, pagesPerNotebook: 999, aiGenerationsPerMonth: 500 },
  creator: { notebooks: 999, pagesPerNotebook: 999, aiGenerationsPerMonth: 500 },
} as const;

// Default Ink configuration (admin can override via appSettings)
// Layout/cover costs are PER PAGE generated (not per request)
export const DEFAULT_INK_CONFIG = {
  plans: {
    free:    { inkPerMonth: 12,  notebooks: 1,   rolloverMax: 0,   pagesPerNotebook: 10 },
    pro:     { inkPerMonth: 120, notebooks: 999, rolloverMax: 60,  pagesPerNotebook: 999 },
    creator: { inkPerMonth: 350, notebooks: 999, rolloverMax: 150, pagesPerNotebook: 999 },
    // Legacy plans map to new ones
    starter: { inkPerMonth: 120, notebooks: 999, rolloverMax: 60,  pagesPerNotebook: 50 },
    founder: { inkPerMonth: 350, notebooks: 999, rolloverMax: 150, pagesPerNotebook: 999 },
  },
  costs: {
    layout: 1,
    advanced_layout: 2,
    cover: 4,
    premium_cover: 6,
  },
  packs: [
    { id: "pack_25",  ink: 25,  priceCents: 399  },
    { id: "pack_75",  ink: 75,  priceCents: 899  },
    { id: "pack_200", ink: 200, priceCents: 1999 },
    { id: "pack_500", ink: 500, priceCents: 4499 },
  ],
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

// Strip sensitive fields before returning user data to clients
function sanitizeUser(user: Record<string, unknown>) {
  const { passwordHash, ...safe } = user;
  return safe;
}

// Get current authenticated user (for components)
export const getCurrentUser = query({
  args: {
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { sessionToken }) => {
    const identityUser = await getUserFromIdentity(ctx);
    if (identityUser) return sanitizeUser(identityUser);
    const sessionUser = await getUserFromSessionToken(ctx, sessionToken);
    if (sessionUser) return sanitizeUser(sessionUser);
    return null;
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

    // Grant initial Ink from the current plan-limits setting. Previously
    // this field was left undefined → getInkBalance returned 0 → new
    // users looked broken until they manually called /api/ink/refill.
    const freePlanLimit = await getPlanLimitFor(ctx, "free");
    const initialInk = freePlanLimit.monthlyInk;
    const nowIso = new Date().toISOString();

    if (!user) {
      const userId = await ctx.db.insert("users", {
        tokenIdentifier: `local:${normalizedEmail}`,
        name: name?.trim() || normalizedEmail.split("@")[0] || "User",
        email: normalizedEmail,
        passwordHash,
        plan: "free",
        aiGenerationsUsed: 0,
        aiGenerationsResetAt: nowIso,
        inkSubscription: initialInk,
        inkPurchased: 0,
        inkResetAt: nowIso,
        inkLastActivity: nowIso,
        preferences: {
          defaultAesthetic: "modern-planner",
          defaultPaperType: "lined",
        },
      });
      user = await ctx.db.get(userId);
      if (user) {
        await ctx.db.insert("inkTransactions", {
          userId: user._id,
          type: "subscription_refill",
          amount: initialInk,
          balance: initialInk,
          description: "Welcome grant (free plan)",
          createdAt: nowIso,
        });
      }
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
      // Backfill ink on an upgrade-from-stub user (e.g. email existed but
      // had no passwordHash yet).
      if (user.inkSubscription === undefined || user.inkSubscription === null) {
        patch.inkSubscription = initialInk;
        patch.inkPurchased = user.inkPurchased ?? 0;
        patch.inkResetAt = nowIso;
        patch.inkLastActivity = nowIso;
      }
      await ctx.db.patch(user._id, patch);
      user = await ctx.db.get(user._id);
    }

    if (!user) throw new Error("Failed to resolve user");

    // ── Waitlist bonus match ──────────────────────────────
    // If this email was on the iOS launch waitlist, honor the promised
    // 25 Ink bonus (stored under `inkPurchased` so it survives monthly
    // refills) and mark the row as redeemed so we don't double-grant.
    try {
      const waitlistRow = await ctx.db
        .query("waitlist")
        .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
        .first();
      if (waitlistRow && !waitlistRow.redeemedAt) {
        const bonus = WAITLIST_BONUS_INK;
        await ctx.db.patch(user._id, {
          inkPurchased: (user.inkPurchased ?? 0) + bonus,
          inkLastActivity: nowIso,
        });
        await ctx.db.patch(waitlistRow._id, {
          redeemedAt: nowIso,
          convertedUserId: user._id,
        });
        await ctx.db.insert("inkTransactions", {
          userId: user._id,
          type: "reward",
          amount: bonus,
          balance: (user.inkSubscription ?? 0) + (user.inkPurchased ?? 0) + bonus,
          description: "Waitlist launch bonus",
          createdAt: nowIso,
        });
        user = await ctx.db.get(user._id);
        if (!user) throw new Error("Failed to resolve user after bonus grant");
      }
    } catch (e) {
      // Non-fatal: if the waitlist lookup / patch fails, we still let the
      // user in with their base grant. The admin can manually backfill.
      console.error("Waitlist bonus grant failed:", e);
    }

    // Re-narrow: the try/catch block may have reassigned `user` through
    // ctx.db.get which returns `| null`.
    if (!user) throw new Error("Failed to resolve user after signup");
    const sessionToken = await createSession(ctx, user._id);

    return { sessionToken, user: sanitizeUser(user) };
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

    // Find all users with this email and prefer the one with a passwordHash
    // (handles duplicate user records from multiple signup paths)
    const candidates = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .collect();
    if (candidates.length === 0 && email.trim() !== normalizedEmail) {
      const fallback = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email.trim()))
        .collect();
      candidates.push(...fallback);
    }
    // Prefer user with passwordHash; among those, prefer one with admin role
    let user =
      candidates.find((u) => u.passwordHash && u.role === "admin") ??
      candidates.find((u) => u.passwordHash) ??
      candidates[0] ??
      null;
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

    // Auto-refill subscription ink on login. This handles two cases at once:
    //   1. Legacy users created before the initial-grant fix — their
    //      inkSubscription is undefined, so they'd otherwise see 0 ink.
    //   2. Returning users crossing a calendar month — they get their
    //      monthly grant without having to hit a separate endpoint.
    // Both cases go through the same `refillSubscriptionInk` mutation's
    // idempotent check, so logging in repeatedly in the same month is free.
    try {
      const planLimit = await getPlanLimitFor(ctx, (user.plan ?? "free") as PlanId);
      const resetAt = user.inkResetAt ? new Date(user.inkResetAt) : null;
      const now = new Date();
      const isFreshMonth = !resetAt || resetAt.getMonth() !== now.getMonth() || resetAt.getFullYear() !== now.getFullYear();
      if (isFreshMonth) {
        const currentSub = user.inkSubscription ?? 0;
        const rollover = Math.min(currentSub, planLimit.inkRolloverCap);
        const newSub = planLimit.monthlyInk + rollover;
        await ctx.db.patch(user._id, {
          inkSubscription: newSub,
          inkPurchased: user.inkPurchased ?? 0,
          inkResetAt: now.toISOString(),
          inkLastActivity: now.toISOString(),
        });
        await ctx.db.insert("inkTransactions", {
          userId: user._id,
          type: "subscription_refill",
          amount: planLimit.monthlyInk,
          balance: newSub + (user.inkPurchased ?? 0),
          description: `Monthly refill (${user.plan} plan)${rollover > 0 ? ` + ${rollover} rollover` : ""}`,
          createdAt: now.toISOString(),
        });
        user = (await ctx.db.get(user._id))!;
      }
    } catch (e) {
      console.error("Login ink refill failed:", e);
    }

    const sessionToken = await createSession(ctx, user._id);
    return { sessionToken, user: sanitizeUser(user) };
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
    const user = await ctx.db.get(id);
    return user ? sanitizeUser(user) : null;
  },
});

// Get user by email
export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalizedEmail = normalizeEmail(email);
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();
    return user ? sanitizeUser(user) : null;
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

// ── Admin helpers ──────────────────────────────────────────

async function requireAdmin(ctx: MutationCtx | QueryCtx, sessionToken?: string) {
  const user = (await getUserFromIdentity(ctx as AuthCtx)) ?? (await getUserFromSessionToken(ctx as AuthCtx, sessionToken));
  if (!user) throw new Error("Not authenticated");
  if ((user as any).role !== "admin") throw new Error("Forbidden: admin only");
  return user;
}

// Admin: list all users with usage stats
export const adminListUsers = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    await requireAdmin(ctx, sessionToken);
    const users = await ctx.db.query("users").collect();
    return users.map((u) => {
      const { passwordHash, ...safe } = u as Record<string, unknown>;
      return safe;
    });
  },
});

// Admin: update any user's plan
export const adminSetPlan = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    targetUserId: v.id("users"),
    plan: v.union(v.literal("free"), v.literal("starter"), v.literal("pro"), v.literal("founder"), v.literal("creator")),
  },
  handler: async (ctx, { sessionToken, targetUserId, plan }) => {
    await requireAdmin(ctx, sessionToken);
    await ctx.db.patch(targetUserId, { plan });
    return { success: true };
  },
});

// Admin: update any user's role
export const adminSetRole = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    targetUserId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("admin")),
  },
  handler: async (ctx, { sessionToken, targetUserId, role }) => {
    await requireAdmin(ctx, sessionToken);
    await ctx.db.patch(targetUserId, { role });
    return { success: true };
  },
});

// Bootstrap: promote the first admin when no admins exist yet
// This is a one-time operation — once an admin exists, it becomes a no-op
export const bootstrapAdmin = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    // Check if any admin already exists
    const existingAdmin = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "admin"))
      .first();
    if (existingAdmin) {
      throw new Error("Forbidden: an admin already exists. Use adminSetRole instead.");
    }
    // Authenticate the caller
    const user =
      (await getUserFromIdentity(ctx as AuthCtx)) ??
      (await getUserFromSessionToken(ctx as AuthCtx, sessionToken));
    if (!user) throw new Error("Not authenticated");
    // Promote caller to admin
    await ctx.db.patch(user._id, { role: "admin" as const });
    return { success: true, userId: user._id };
  },
});

// CLI-only: promote all user records with a given email to admin
// Run via: npx convex run users:promoteByEmail '{"email":"you@example.com"}'
export const promoteByEmail = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalizedEmail = normalizeEmail(email);
    const users = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .collect();
    if (users.length === 0) throw new Error(`No user found with email: ${normalizedEmail}`);
    const promoted: string[] = [];
    for (const u of users) {
      await ctx.db.patch(u._id, { role: "admin" as const });
      promoted.push(u._id);
    }
    return { promoted, count: promoted.length };
  },
});

// CLI-only: debug session — show which user a session resolves to
export const debugSession = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const session = await ctx.db
      .query("authSessions")
      .withIndex("by_token", (q) => q.eq("token", sessionToken))
      .first();
    if (!session) return { error: "Session not found" };
    if (new Date(session.expiresAt).getTime() <= Date.now()) return { error: "Session expired", expiresAt: session.expiresAt };
    const user = await ctx.db.get(session.userId);
    if (!user) return { error: "User not found", userId: session.userId };
    return {
      sessionUserId: session.userId,
      email: user.email,
      role: user.role ?? "unset",
      tokenIdentifier: user.tokenIdentifier,
      createdAt: user._creationTime,
    };
  },
});

// Admin: reset AI usage counter for a user
export const adminResetUsage = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    targetUserId: v.id("users"),
  },
  handler: async (ctx, { sessionToken, targetUserId }) => {
    await requireAdmin(ctx, sessionToken);
    await ctx.db.patch(targetUserId, {
      aiGenerationsUsed: 0,
      aiGenerationsResetAt: new Date().toISOString(),
    });
    return { success: true };
  },
});

// Dev helper: reset AI usage for all users (no auth required)
export const devResetAllAiUsage = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    for (const u of users) {
      await ctx.db.patch(u._id, { aiGenerationsUsed: 0, aiGenerationsResetAt: new Date().toISOString() });
    }
    return { reset: users.length };
  },
});

// ── Ink System ────────────────────────────────────────────

// Get Ink config (from appSettings or default)
export const getInkConfig = query({
  args: {},
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "inkConfig"))
      .first();
    if (setting?.value) return setting.value as typeof DEFAULT_INK_CONFIG;
    return DEFAULT_INK_CONFIG;
  },
});

// Get user's Ink balance
export const getInkBalance = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    const user = (await getUserFromIdentity(ctx)) ?? (await getUserFromSessionToken(ctx, sessionToken));
    if (!user) return null;
    const subscription = user.inkSubscription ?? 0;
    const purchased = user.inkPurchased ?? 0;
    const total = subscription + purchased;
    return {
      subscription,
      purchased,
      total,
      plan: user.plan,
      resetAt: user.inkResetAt ?? null,
    };
  },
});

// Preview Ink cost before an action
export const previewInkCost = query({
  args: {
    sessionToken: v.optional(v.string()),
    action: v.string(),
  },
  handler: async (ctx, { sessionToken, action }) => {
    const user = (await getUserFromIdentity(ctx)) ?? (await getUserFromSessionToken(ctx, sessionToken));
    if (!user) return { cost: 0, balance: 0, canAfford: false };

    const setting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "inkConfig"))
      .first();
    const config = (setting?.value ?? DEFAULT_INK_CONFIG) as typeof DEFAULT_INK_CONFIG;
    const cost = config.costs[action as keyof typeof config.costs] ?? 1;
    const balance = (user.inkSubscription ?? 0) + (user.inkPurchased ?? 0);

    return { cost, balance, canAfford: balance >= cost };
  },
});

// Spend Ink (called before AI generation)
export const spendInk = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    action: v.string(),
    amount: v.optional(v.number()),
  },
  handler: async (ctx, { sessionToken, action, amount }) => {
    const user = (await getUserFromIdentity(ctx)) ?? (await getUserFromSessionToken(ctx, sessionToken));
    if (!user) throw new Error("Not authenticated");

    // Get config for cost lookup
    const setting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "inkConfig"))
      .first();
    const config = (setting?.value ?? DEFAULT_INK_CONFIG) as typeof DEFAULT_INK_CONFIG;
    const cost = amount ?? config.costs[action as keyof typeof config.costs] ?? 1;

    const subscription = user.inkSubscription ?? 0;
    const purchased = user.inkPurchased ?? 0;
    const total = subscription + purchased;

    if (total < cost) {
      return { allowed: false, balance: total, cost };
    }

    // Spend subscription ink first, then purchased
    const subDeduct = Math.min(subscription, cost);
    const purchDeduct = cost - subDeduct;

    const newSub = subscription - subDeduct;
    const newPurch = purchased - purchDeduct;
    const newBalance = newSub + newPurch;

    await ctx.db.patch(user._id, {
      inkSubscription: newSub,
      inkPurchased: newPurch,
      inkLastActivity: new Date().toISOString(),
    });

    // Log transaction
    await ctx.db.insert("inkTransactions", {
      userId: user._id,
      type: "spend",
      amount: -cost,
      balance: newBalance,
      action,
      description: `${action} generation`,
      createdAt: new Date().toISOString(),
    });

    return { allowed: true, balance: newBalance, cost };
  },
});

// Refill subscription Ink (called on login or monthly reset).
//
// SOURCE OF TRUTH: this reads from `plan-limits` (the appSettings key the
// admin edits via /admin → Plans tab). The legacy `inkConfig` key is only
// used for per-action Ink *costs* now (InkCostsEditor). Keeping two
// sources of truth was the root cause of "admin set free=10 ink but
// users still see 0".
export const refillSubscriptionInk = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    const user = (await getUserFromIdentity(ctx)) ?? (await getUserFromSessionToken(ctx, sessionToken));
    if (!user) throw new Error("Not authenticated");

    const now = new Date();
    const resetAt = user.inkResetAt ? new Date(user.inkResetAt) : null;

    // Only refill if the month has changed AND we've already initialized
    // at least once. First-time users (resetAt === null) always refill.
    if (resetAt && resetAt.getMonth() === now.getMonth() && resetAt.getFullYear() === now.getFullYear()) {
      return { refilled: false, balance: (user.inkSubscription ?? 0) + (user.inkPurchased ?? 0) };
    }

    const planLimit = await getPlanLimitFor(ctx, (user.plan ?? "free") as PlanId);
    const monthlyInk = planLimit.monthlyInk;
    const rolloverCap = planLimit.inkRolloverCap;

    // Calculate rollover — unused subscription ink carries forward up to
    // the plan's cap. First-time users have nothing to roll over.
    const currentSub = user.inkSubscription ?? 0;
    const rollover = Math.min(currentSub, rolloverCap);
    const newSub = monthlyInk + rollover;
    const purchased = user.inkPurchased ?? 0;

    await ctx.db.patch(user._id, {
      inkSubscription: newSub,
      inkResetAt: now.toISOString(),
    });

    // Log transaction
    await ctx.db.insert("inkTransactions", {
      userId: user._id,
      type: "subscription_refill",
      amount: monthlyInk,
      balance: newSub + purchased,
      description: `Monthly refill (${user.plan} plan)${rollover > 0 ? ` + ${rollover} rollover` : ""}`,
      createdAt: now.toISOString(),
    });

    return { refilled: true, balance: newSub + purchased, rollover };
  },
});

// Purchase Ink (after Stripe payment confirmation)
export const purchaseInk = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    packId: v.string(),
    inkAmount: v.number(),
  },
  handler: async (ctx, { sessionToken, packId, inkAmount }) => {
    const user = (await getUserFromIdentity(ctx)) ?? (await getUserFromSessionToken(ctx, sessionToken));
    if (!user) throw new Error("Not authenticated");

    const newPurchased = (user.inkPurchased ?? 0) + inkAmount;
    const newBalance = (user.inkSubscription ?? 0) + newPurchased;

    await ctx.db.patch(user._id, {
      inkPurchased: newPurchased,
      inkLastActivity: new Date().toISOString(),
    });

    await ctx.db.insert("inkTransactions", {
      userId: user._id,
      type: "purchase",
      amount: inkAmount,
      balance: newBalance,
      description: `Purchased ${packId} (${inkAmount} Ink)`,
      createdAt: new Date().toISOString(),
    });

    return { balance: newBalance };
  },
});

// Admin: update Ink config
export const adminUpdateInkConfig = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    config: v.any(),
  },
  handler: async (ctx, { sessionToken, config }) => {
    const admin = await requireAdmin(ctx, sessionToken);
    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "inkConfig"))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: config,
        updatedAt: new Date().toISOString(),
        updatedBy: admin._id,
      });
    } else {
      await ctx.db.insert("appSettings", {
        key: "inkConfig",
        value: config,
        updatedAt: new Date().toISOString(),
        updatedBy: admin._id,
      });
    }
    return { success: true };
  },
});

// Admin: grant Ink to a user
export const adminGrantInk = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    targetUserId: v.id("users"),
    amount: v.number(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, { sessionToken, targetUserId, amount, description }) => {
    await requireAdmin(ctx, sessionToken);
    const target = await ctx.db.get(targetUserId);
    if (!target) throw new Error("User not found");

    const newPurchased = (target.inkPurchased ?? 0) + amount;
    const newBalance = (target.inkSubscription ?? 0) + newPurchased;

    await ctx.db.patch(targetUserId, { inkPurchased: newPurchased });

    await ctx.db.insert("inkTransactions", {
      userId: targetUserId,
      type: "admin_grant",
      amount,
      balance: newBalance,
      description: description ?? `Admin granted ${amount} Ink`,
      createdAt: new Date().toISOString(),
    });

    return { balance: newBalance };
  },
});

// Admin: deduct Ink from a user
export const adminDeductInk = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    targetUserId: v.id("users"),
    amount: v.number(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, { sessionToken, targetUserId, amount, description }) => {
    await requireAdmin(ctx, sessionToken);
    const target = await ctx.db.get(targetUserId);
    if (!target) throw new Error("User not found");

    // Deduct from purchased first, then subscription
    const purchased = target.inkPurchased ?? 0;
    const subscription = target.inkSubscription ?? 0;

    const purchDeduct = Math.min(purchased, amount);
    const subDeduct = Math.min(subscription, amount - purchDeduct);

    const newPurch = purchased - purchDeduct;
    const newSub = subscription - subDeduct;
    const newBalance = newSub + newPurch;

    await ctx.db.patch(targetUserId, {
      inkPurchased: newPurch,
      inkSubscription: newSub,
    });

    await ctx.db.insert("inkTransactions", {
      userId: targetUserId,
      type: "admin_deduct",
      amount: -amount,
      balance: newBalance,
      description: description ?? `Admin deducted ${amount} Ink`,
      createdAt: new Date().toISOString(),
    });

    return { balance: newBalance };
  },
});

// Migration: convert old generation system to Ink
export const migrateToInkSystem = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const setting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "inkConfig"))
      .first();
    const config = (setting?.value ?? DEFAULT_INK_CONFIG) as typeof DEFAULT_INK_CONFIG;

    let migrated = 0;
    for (const u of users) {
      // Skip if already migrated
      if (u.inkBalance !== undefined && u.inkBalance !== null) continue;

      const planKey = u.plan as keyof typeof config.plans;
      const planConfig = config.plans[planKey] ?? config.plans.free;

      await ctx.db.patch(u._id, {
        inkSubscription: planConfig.inkPerMonth,
        inkPurchased: 0,
        inkResetAt: new Date().toISOString(),
        inkLastActivity: new Date().toISOString(),
      });
      migrated++;
    }
    return { migrated, total: users.length };
  },
});

// Admin: backfill Ink balances for legacy users whose inkSubscription was
// never initialized (created before the signup fix). Idempotent —
// skips users who already have a defined balance.
export const backfillInitialInk = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const session = await ctx.db
      .query("authSessions")
      .withIndex("by_token", (q) => q.eq("token", sessionToken))
      .first();
    if (!session || new Date(session.expiresAt).getTime() <= Date.now()) {
      throw new Error("Not authenticated");
    }
    const admin = await ctx.db.get(session.userId);
    if (!admin || admin.role !== "admin") throw new Error("Admin only");

    const users = await ctx.db.query("users").collect();
    const nowIso = new Date().toISOString();
    let updated = 0;
    for (const u of users) {
      if (u.inkSubscription !== undefined && u.inkSubscription !== null) continue;
      const planLimit = await getPlanLimitFor(ctx, (u.plan ?? "free") as PlanId);
      await ctx.db.patch(u._id, {
        inkSubscription: planLimit.monthlyInk,
        inkPurchased: u.inkPurchased ?? 0,
        inkResetAt: nowIso,
        inkLastActivity: nowIso,
      });
      await ctx.db.insert("inkTransactions", {
        userId: u._id,
        type: "subscription_refill",
        amount: planLimit.monthlyInk,
        balance: planLimit.monthlyInk + (u.inkPurchased ?? 0),
        description: `Backfill (${u.plan} plan)`,
        createdAt: nowIso,
      });
      updated++;
    }
    return { updated, total: users.length };
  },
});

// Seed default Ink config into appSettings
export const seedInkConfig = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "inkConfig"))
      .first();
    if (!existing) {
      await ctx.db.insert("appSettings", {
        key: "inkConfig",
        value: DEFAULT_INK_CONFIG,
        updatedAt: new Date().toISOString(),
      });
      return { seeded: true };
    }
    return { seeded: false, existing: true };
  },
});

// ── Password Reset (user-facing) ─────────────────────────

const RESET_CODE_TTL_MS = 1000 * 60 * 15; // 15 minutes

export const requestPasswordReset = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) throw new Error("Email is required");

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();
    // Always return success to avoid email enumeration
    if (!user || !user.passwordHash) return { success: true };

    // Invalidate any existing codes for this email
    const existing = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .collect();
    for (const token of existing) {
      await ctx.db.delete(token._id);
    }

    // Generate a 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MS).toISOString();

    await ctx.db.insert("passwordResetTokens", {
      email: normalizedEmail,
      code,
      expiresAt,
      used: false,
    });

    // Code is sent via email in the HTTP action layer
    return { success: true, code };
  },
});

export const confirmPasswordReset = mutation({
  args: {
    email: v.string(),
    code: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, { email, code, newPassword }) => {
    const normalizedEmail = normalizeEmail(email);
    assertPassword(newPassword);

    const token = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();

    if (!token || token.code !== code || token.used) {
      throw new Error("Invalid or expired reset code");
    }
    if (new Date(token.expiresAt).getTime() <= Date.now()) {
      await ctx.db.delete(token._id);
      throw new Error("Reset code has expired. Please request a new one.");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();
    if (!user) throw new Error("User not found");

    const passwordHash = await hashPassword(newPassword);
    await ctx.db.patch(user._id, { passwordHash });
    await ctx.db.patch(token._id, { used: true });

    // Create a session so user is logged in after reset
    const sessionToken = await createSession(ctx, user._id);
    return { sessionToken, user: sanitizeUser(user) };
  },
});
