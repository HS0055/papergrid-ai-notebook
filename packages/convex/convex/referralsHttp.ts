import type { HttpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// ─────────────────────────────────────────────────────────────
// HTTP routes for the user-referral program.
//
// User-facing:
//   POST /api/referral/ensure-code     → create/fetch your code
//   GET  /api/referral/me              → stats
//   GET  /api/referral/lookup?code=X   → public validate
//   POST /api/referral/track-click     → increment click counter
//                                         (rate-limited per IP)
//
// Admin:
//   GET  /api/admin/referrals/summary  → aggregate tiles
//   GET  /api/admin/referrals/top      → leaderboard
//   GET  /api/admin/referrals/redemptions?status=pending|qualified|voided
//   POST /api/admin/referrals/config   → bonus/rule knobs
//   POST /api/admin/referrals/void     → fraud rollback
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

function getClientIp(request: Request): string | null {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf.trim().slice(0, 64);
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim().slice(0, 64) ?? null;
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim().slice(0, 64);
  return null;
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
  if (/forbidden|admin only/i.test(msg)) return 403;
  if (/not found/i.test(msg)) return 404;
  if (/rate limit/i.test(msg)) return 429;
  if (/invalid|required|range/i.test(msg)) return 400;
  return 500;
}

function installPreflight(http: HttpRouter, path: string) {
  http.route({
    path,
    method: "OPTIONS",
    handler: httpAction(async (_ctx, request) => {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }),
  });
}

export function registerReferralRoutes(http: HttpRouter) {
  // ── POST /api/referral/ensure-code ────────────────────────
  http.route({
    path: "/api/referral/ensure-code",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      try {
        const row = await ctx.runMutation(api.referrals.ensureMyCode, {
          sessionToken: getSessionToken(request) ?? undefined,
        });
        return json({ referral: row }, 200, request);
      } catch (error) {
        const msg = errMsg(error, "Failed to create referral code");
        return json({ error: msg }, statusFromMessage(msg), request);
      }
    }),
  });
  installPreflight(http, "/api/referral/ensure-code");

  // ── GET /api/referral/me ──────────────────────────────────
  http.route({
    path: "/api/referral/me",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      try {
        const stats = await ctx.runQuery(api.referrals.getMyStats, {
          sessionToken: getSessionToken(request) ?? undefined,
        });
        return json({ stats }, 200, request);
      } catch (error) {
        const msg = errMsg(error, "Failed to load referral stats");
        return json({ error: msg }, statusFromMessage(msg), request);
      }
    }),
  });
  installPreflight(http, "/api/referral/me");

  // ── GET /api/referral/lookup?code=X ───────────────────────
  http.route({
    path: "/api/referral/lookup",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      try {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        if (!code) return json({ valid: false, reason: "missing" }, 400, request);
        // Rate limit lookups — prevents brute-forcing the narrow
        // referral code namespace.
        const ip = getClientIp(request);
        if (ip) {
          const rl = await ctx.runMutation(api.rateLimit.consume, {
            scope: "ip", subject: ip,
            action: "referral.lookup_ip", limit: 30, windowMs: 60_000,
          });
          if (!rl.allowed) return json({ valid: false, reason: "rate_limited" }, 429, request);
        }
        const result = await ctx.runQuery(api.referrals.lookupCode, { code });
        return json(result, 200, request);
      } catch (error) {
        const msg = errMsg(error, "Lookup failed");
        return json({ error: msg }, statusFromMessage(msg), request);
      }
    }),
  });
  installPreflight(http, "/api/referral/lookup");

  // ── POST /api/referral/track-click ────────────────────────
  http.route({
    path: "/api/referral/track-click",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      try {
        const body = await request.json().catch(() => ({}));
        if (!body.code || typeof body.code !== "string") {
          return json({ ok: false, reason: "missing_code" }, 400, request);
        }
        const ip = getClientIp(request);
        if (ip) {
          const rl = await ctx.runMutation(api.rateLimit.consume, {
            scope: "ip", subject: ip,
            action: "referral.track_click_ip", limit: 30, windowMs: 60_000,
          });
          if (!rl.allowed) return json({ ok: false, reason: "rate_limited" }, 429, request);
        }
        const result = await ctx.runMutation(internal.referrals.recordClickInternal, {
          code: body.code,
        });
        return json(result, 200, request);
      } catch (error) {
        const msg = errMsg(error, "Failed to track click");
        return json({ error: msg }, statusFromMessage(msg), request);
      }
    }),
  });
  installPreflight(http, "/api/referral/track-click");

  // ── GET /api/admin/referrals/summary ──────────────────────
  http.route({
    path: "/api/admin/referrals/summary",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      try {
        const summary = await ctx.runQuery(api.referrals.adminGetSummary, {
          sessionToken: getSessionToken(request) ?? undefined,
        });
        return json({ summary }, 200, request);
      } catch (error) {
        const msg = errMsg(error, "Failed to load referral summary");
        return json({ error: msg }, statusFromMessage(msg), request);
      }
    }),
  });
  installPreflight(http, "/api/admin/referrals/summary");

  // ── GET /api/admin/referrals/top?limit=N ──────────────────
  http.route({
    path: "/api/admin/referrals/top",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      try {
        const url = new URL(request.url);
        const limitRaw = url.searchParams.get("limit");
        const limit = limitRaw ? Math.min(Math.max(Number(limitRaw) || 50, 1), 100) : undefined;
        const rows = await ctx.runQuery(api.referrals.adminListTopReferrers, {
          sessionToken: getSessionToken(request) ?? undefined,
          limit,
        });
        return json({ rows }, 200, request);
      } catch (error) {
        const msg = errMsg(error, "Failed to load top referrers");
        return json({ error: msg }, statusFromMessage(msg), request);
      }
    }),
  });
  installPreflight(http, "/api/admin/referrals/top");

  // ── GET /api/admin/referrals/redemptions?status=&limit= ───
  http.route({
    path: "/api/admin/referrals/redemptions",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      try {
        const url = new URL(request.url);
        const statusParam = url.searchParams.get("status");
        const status =
          statusParam === "pending" || statusParam === "qualified" || statusParam === "voided"
            ? statusParam
            : undefined;
        const limitRaw = url.searchParams.get("limit");
        const limit = limitRaw ? Math.min(Math.max(Number(limitRaw) || 100, 1), 100) : undefined;
        const rows = await ctx.runQuery(api.referrals.adminListRedemptions, {
          sessionToken: getSessionToken(request) ?? undefined,
          status,
          limit,
        });
        return json({ rows }, 200, request);
      } catch (error) {
        const msg = errMsg(error, "Failed to load redemptions");
        return json({ error: msg }, statusFromMessage(msg), request);
      }
    }),
  });
  installPreflight(http, "/api/admin/referrals/redemptions");

  // ── POST /api/admin/referrals/config ──────────────────────
  http.route({
    path: "/api/admin/referrals/config",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      try {
        const body = await request.json().catch(() => ({}));
        const next = await ctx.runMutation(api.referrals.adminUpdateConfig, {
          sessionToken: getSessionToken(request) ?? undefined,
          referrerReward: typeof body.referrerReward === "number" ? body.referrerReward : undefined,
          referredReward: typeof body.referredReward === "number" ? body.referredReward : undefined,
          enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
          qualifyingAction:
            body.qualifyingAction === "signup" ||
            body.qualifyingAction === "first_notebook" ||
            body.qualifyingAction === "first_ink_spend"
              ? body.qualifyingAction
              : undefined,
        });
        return json({ config: next }, 200, request);
      } catch (error) {
        const msg = errMsg(error, "Failed to update config");
        return json({ error: msg }, statusFromMessage(msg), request);
      }
    }),
  });
  installPreflight(http, "/api/admin/referrals/config");

  // ── POST /api/admin/referrals/void ────────────────────────
  http.route({
    path: "/api/admin/referrals/void",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      try {
        const body = await request.json().catch(() => ({}));
        if (!body.redemptionId) {
          return json({ error: "redemptionId required" }, 400, request);
        }
        await ctx.runMutation(api.referrals.adminVoidRedemption, {
          sessionToken: getSessionToken(request) ?? undefined,
          redemptionId: body.redemptionId as Id<"referralRedemptions">,
          reason: typeof body.reason === "string" ? body.reason : undefined,
        });
        return json({ success: true }, 200, request);
      } catch (error) {
        const msg = errMsg(error, "Failed to void redemption");
        return json({ error: msg }, statusFromMessage(msg), request);
      }
    }),
  });
  installPreflight(http, "/api/admin/referrals/void");
}
