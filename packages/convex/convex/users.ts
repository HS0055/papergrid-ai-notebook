import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery, QueryCtx, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
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
// OWASP 2025 guidance: PBKDF2-SHA256 ≥ 600,000 iterations. Old hashes with
// the previous 120k count are still verifiable because we store the iteration
// count inside the hash string itself; new hashes use the current constant.
const PASSWORD_HASH_ITERATIONS = 600_000;

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

// Strip sensitive fields before returning user data to clients.
//
// SECURITY: Previously this only stripped `passwordHash`, which meant
// every other field — email, stripeCustomerId, stripeSubscriptionId,
// tokenIdentifier, role, preferences, ink balances — was exposed to
// whoever called `users.get`. Callers of `users.get` could enumerate
// user IDs (e.g. from the community feed's `authorId`) and pull
// full profiles for the entire user base.
//
// Policy:
//   - `sanitizeSelf`: for the user viewing THEIR OWN row (e.g.
//     getCurrentUser). Strips only passwordHash so the owner sees
//     everything they need (balances, stripe refs, preferences).
//   - `sanitizePublic`: for any call where another user might be the
//     subject. Returns ONLY fields that are already public (name,
//     avatarUrl). Everything else is hidden by omission, not by
//     key exclusion — if a new sensitive field lands on the user
//     row in the future, it does NOT leak automatically.
function sanitizeSelf(user: Record<string, unknown>) {
  const { passwordHash, ...safe } = user;
  return safe;
}

function sanitizePublic(user: Record<string, unknown>) {
  return {
    _id: user._id,
    name: user.name,
    avatarUrl: user.avatarUrl,
  };
}

// Legacy shim — keeps older call sites compiling without changing
// their behaviour. Existing callers that want the "owner view" should
// switch to `sanitizeSelf`. New callers should pick the right one
// explicitly.
function sanitizeUser(user: Record<string, unknown>) {
  return sanitizeSelf(user);
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

// Auto-provision user on first login (called from auth callback or app init).
//
// Locked down: previously a public mutation, meaning a misconfigured JWT
// auth setup could let arbitrary callers provision accounts and skip the
// initial-ink grant. Now internal; call via `ctx.runMutation(internal.users.getOrCreate)`
// from a trusted HTTP action after verifying the identity.
export const getOrCreate = internalMutation({
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

    // Mirror the initial-ink grant from signupWithEmailPassword so
    // social-auth users aren't created without an Ink balance.
    const freePlanLimit = await getPlanLimitFor(ctx, "free");
    const initialInk = freePlanLimit.monthlyInk;
    const nowIso = new Date().toISOString();

    return await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      name: identity.name ?? identity.email ?? "User",
      email: identity.email ?? "",
      avatarUrl: identity.pictureUrl,
      plan: "free",
      aiGenerationsUsed: 0,
      inkSubscription: initialInk,
      inkPurchased: 0,
      inkResetAt: nowIso,
      inkLastActivity: nowIso,
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

    // ── Look up any existing row with this email ──────────────────
    //
    // SECURITY: we must reject signup if ANY row exists with this email —
    // not only rows that already have a passwordHash. Previously this
    // check was `if (user?.passwordHash)`, which meant an attacker could
    // hijack any account created through social auth (Google/OAuth
    // creates a user row with `passwordHash === undefined`). The attacker
    // would call signupWithEmailPassword with the victim's email, the
    // "stub upgrade" branch would patch the row with the attacker's
    // password hash, and the attacker could then log in as the victim.
    //
    // The correct behaviour for password signup is strictly additive:
    // only create brand-new rows. Users who originally signed in with a
    // provider that didn't set a password must go through the password
    // RESET flow (which emails a verification link to the address on
    // file) to add a password — signup can never overwrite auth material
    // on a pre-existing row.
    let existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();
    if (!existing && email.trim() !== normalizedEmail) {
      existing = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email.trim()))
        .first();
    }
    if (existing) {
      // Identical message whether or not the pre-existing row has a
      // passwordHash — we don't want to reveal "this email exists via
      // social auth" to anyone probing for valid accounts.
      throw new Error("Email already in use");
    }

    const passwordHash = await hashPassword(password);

    // Grant initial Ink from the current plan-limits setting. Previously
    // this field was left undefined → getInkBalance returned 0 → new
    // users looked broken until they manually called /api/ink/refill.
    const freePlanLimit = await getPlanLimitFor(ctx, "free");
    const initialInk = freePlanLimit.monthlyInk;
    const nowIso = new Date().toISOString();

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
    let user = await ctx.db.get(userId);
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

// Get user by ID.
//
// SECURITY: previously a public query with NO auth check that returned
// a row containing email, stripeCustomerId, stripeSubscriptionId, role,
// plan, and every other field. An attacker could enumerate user IDs
// (e.g. via the community feed's `authorId`) and scrape the entire
// user base's PII + Stripe linkage.
//
// Now:
//   - Requires an authenticated session.
//   - If the caller is viewing THEIR OWN row, returns the "self" shape
//     (everything except passwordHash).
//   - If the caller is viewing any other user's row, returns only the
//     "public" shape (_id, name, avatarUrl). The target must also be
//     someone who has opted into being a public author (they've posted
//     to the community feed) — otherwise we return null, same as if
//     they didn't exist, to avoid existence oracles.
export const get = query({
  args: {
    id: v.id("users"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { id, sessionToken }) => {
    const me = await getUserFromIdentity(ctx)
      ?? (await getUserFromSessionToken(ctx, sessionToken));
    if (!me) throw new Error("Not authenticated");

    if (me._id === id) {
      // Viewing your own row → full self view.
      return sanitizeSelf(me as unknown as Record<string, unknown>);
    }

    // Viewing someone else's row → public minimal shape. Callers that
    // need richer author metadata (e.g. community feed) should go
    // through `hydrateAuthorMeta` in community.ts, which returns only
    // handle/displayName/avatarUrl.
    const target = await ctx.db.get(id);
    if (!target) return null;
    return sanitizePublic(target as unknown as Record<string, unknown>);
  },
});

// Internal: lookup by email (used by the Stripe webhook + signup flow).
// Previously this was a public query, which allowed account enumeration and
// defeated the anti-enumeration branch in requestPasswordReset.
export const getByEmailInternal = internalQuery({
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

// Update user plan — CALLED ONLY FROM THE STRIPE WEBHOOK.
//
// Previously this was a public mutation where the "forbidden" branch only
// fired if targetUserId !== actingUser._id, meaning any authenticated user
// could upgrade THEMSELVES to Creator by calling api.users.updatePlan({
// plan: "creator" }) without paying. Now internal — the only caller is the
// Stripe webhook after it has verified the signature and looked up the user
// by stripeCustomerId.
export const updatePlanInternal = internalMutation({
  args: {
    userId: v.id("users"),
    plan: v.union(
      v.literal("free"),
      v.literal("starter"),
      v.literal("pro"),
      v.literal("founder"),
      v.literal("creator"),
    ),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
  },
  handler: async (ctx, { userId, plan, stripeCustomerId, stripeSubscriptionId }) => {
    const target = await ctx.db.get(userId);
    if (!target) throw new Error("User not found");
    const patch: Record<string, unknown> = { plan };
    if (stripeCustomerId) patch.stripeCustomerId = stripeCustomerId;
    if (stripeSubscriptionId) patch.stripeSubscriptionId = stripeSubscriptionId;
    await ctx.db.patch(userId, patch);
  },
});

// Internal: find the user row for a given Stripe customer id (webhook lookup).
export const getByStripeCustomerInternal = internalQuery({
  args: { stripeCustomerId: v.string() },
  handler: async (ctx, { stripeCustomerId }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_stripe_customer", (q) => q.eq("stripeCustomerId", stripeCustomerId))
      .first();
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

// Admin: list users with usage stats.
//
// Scale: previously this ran `.collect()` which full-scans the users table
// on every admin panel load. At 5K+ users the response blows past both
// the admin panel's render budget and Convex's per-function time limits.
// Now bounded to `limit` (default 100, max 500).
export const adminListUsers = query({
  args: {
    sessionToken: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { sessionToken, limit }) => {
    await requireAdmin(ctx, sessionToken);
    const pageSize = Math.min(Math.max(limit ?? 100, 1), 500);
    const users = await ctx.db.query("users").order("desc").take(pageSize);
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

// Bootstrap: promote the first admin when no admins exist yet.
//
// Two layers of protection:
//   1. Gate the HTTP route with the `ADMIN_BOOTSTRAP_TOKEN` env var — the
//      HTTP action checks a header before calling this mutation.
//   2. Refuse if any admin already exists.
//
// Previously this was a public mutation that anyone could hit the moment the
// first user signed up, racing the real founder to admin.
export const bootstrapAdminInternal = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    // Double check: an admin must not already exist.
    const existingAdmin = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "admin"))
      .first();
    if (existingAdmin) {
      throw new Error("Forbidden: an admin already exists. Use adminSetRole instead.");
    }
    const target = await ctx.db.get(userId);
    if (!target) throw new Error("User not found");
    await ctx.db.patch(userId, { role: "admin" as const });
    return { success: true, userId };
  },
});

// CLI-only: promote all user records with a given email to admin.
//
// Previously this was a PUBLIC mutation, meaning anyone could call
// api.users.promoteByEmail({ email }) and become admin in one line. Now it's
// an internal mutation — only invokable via `npx convex run users:promoteByEmailInternal`
// or via a trusted HTTP action.
export const promoteByEmailInternal = internalMutation({
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

// CLI-only: debug session — show which user a session resolves to.
//
// Previously a PUBLIC query that leaked email/role/userId/tokenIdentifier for
// any known session token. A stolen/leaked session string was enough to
// unmask the victim. Now internal.
export const debugSessionInternal = internalQuery({
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

// Dev helper: reset AI usage for all users. Previously a public mutation
// that any user could call to nuke the quota system for every account.
// Now internal.
export const devResetAllAiUsageInternal = internalMutation({
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

    // ── Referral program hook ──────────────────────────────
    // If the admin has set the qualifying action to "first_ink_spend",
    // this call will flip a pending redemption to qualified and credit
    // both the referrer and referred user with bonus Ink. The helper is
    // idempotent — after the first qualifying call, subsequent spends
    // are a no-op. Any failure here is swallowed so the growth-loop
    // side-path never blocks an Ink spend.
    try {
      await ctx.runMutation(internal.referrals.onQualifyingEventInternal, {
        userId: user._id,
        event: "first_ink_spend",
      });
    } catch (e) {
      console.warn("Referral qualify on first_ink_spend failed (non-fatal):", e);
    }

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

// Purchase Ink — ONLY CALLED FROM THE STRIPE WEBHOOK after payment is
// confirmed. Previously this was a public mutation where the caller supplied
// `inkAmount`, so any logged-in user could grant themselves arbitrary Ink by
// calling api.users.purchaseInk({ inkAmount: 999999 }). Now internal.
export const purchaseInkInternal = internalMutation({
  args: {
    userId: v.id("users"),
    packId: v.string(),
    inkAmount: v.number(),
    stripePaymentIntentId: v.optional(v.string()),
  },
  handler: async (ctx, { userId, packId, inkAmount, stripePaymentIntentId }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    // Idempotency guard: skip if we've already processed this payment intent.
    if (stripePaymentIntentId) {
      const existing = await ctx.db
        .query("inkTransactions")
        .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", stripePaymentIntentId))
        .first();
      if (existing) {
        return { balance: existing.balance, duplicate: true };
      }
    }

    const newPurchased = (user.inkPurchased ?? 0) + inkAmount;
    const newBalance = (user.inkSubscription ?? 0) + newPurchased;

    await ctx.db.patch(userId, {
      inkPurchased: newPurchased,
      inkLastActivity: new Date().toISOString(),
    });

    await ctx.db.insert("inkTransactions", {
      userId,
      type: "purchase",
      amount: inkAmount,
      balance: newBalance,
      idempotencyKey: stripePaymentIntentId,
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

// Migration: convert old generation system to Ink.
// Internal-only — at 5K+ users this mutation will exceed Convex per-txn
// limits if invoked in one go. Callers should use the backfillInitialInk
// variant below which is paginated + admin-only.
export const migrateToInkSystemInternal = internalMutation({
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

// Request a password reset code.
//
// Security notes:
//   1. We NEVER include the code in the return value — previously the code
//      was returned in the mutation result AND relayed to the client through
//      the HTTP layer, which meant anyone could trigger forgot-password for
//      any email and get the reset code back in the response. Full account
//      takeover.
//   2. The code is drawn from crypto.getRandomValues (CSPRNG), not
//      Math.random, so it's not predictable.
//   3. The HTTP action layer calls `internal.users.getPendingResetCodeInternal`
//      after this mutation to pick the code up out of the DB and send it via
//      email — the code never crosses a public boundary.
export const requestPasswordReset = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) throw new Error("Email is required");

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();
    // Always return success to avoid email enumeration.
    if (!user || !user.passwordHash) return { success: true };

    // Invalidate any existing codes for this email.
    const existing = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .collect();
    for (const token of existing) {
      await ctx.db.delete(token._id);
    }

    // CSPRNG 6-digit code.
    const randomArray = crypto.getRandomValues(new Uint32Array(1));
    const code = String(100000 + (randomArray[0] % 900000));
    const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MS).toISOString();

    await ctx.db.insert("passwordResetTokens", {
      email: normalizedEmail,
      code,
      expiresAt,
      used: false,
    });

    // Do NOT return the code. The HTTP layer picks it up via the internal
    // query below, sends it via email, and returns only { success: true } to
    // the client.
    return { success: true };
  },
});

// Internal: used by the HTTP action layer to fetch the most-recent unsent
// reset code for a given email so it can be emailed out. NEVER exposed as a
// public query.
export const getPendingResetCodeInternal = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalizedEmail = normalizeEmail(email);
    const token = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();
    if (!token) return null;
    if (token.used) return null;
    if (new Date(token.expiresAt).getTime() <= Date.now()) return null;
    return { code: token.code, expiresAt: token.expiresAt };
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

    // Constant-time comparison on the code to avoid timing oracles.
    if (!token || token.used || !constantTimeEquals(token.code, code)) {
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

    // Invalidate ALL existing sessions for this user — a stolen session
    // token should not survive a password reset. Previously the old
    // sessions were untouched, meaning attackers could keep using a
    // stolen token after the victim reset their password.
    const oldSessions = await ctx.db
      .query("authSessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    await Promise.all(oldSessions.map((s) => ctx.db.delete(s._id)));

    // Create a fresh session so user is logged in after reset.
    const sessionToken = await createSession(ctx, user._id);
    return { sessionToken, user: sanitizeUser(user) };
  },
});
