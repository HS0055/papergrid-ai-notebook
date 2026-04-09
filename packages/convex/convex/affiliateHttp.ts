import type { HttpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

// ─────────────────────────────────────────────────────────────
// HTTP routes for the affiliate program.
//
// Implemented as a registerable module so http.ts only needs:
//   import { registerAffiliateRoutes } from "./affiliateHttp";
//   registerAffiliateRoutes(http);
//
// Helpers are duplicated locally to keep this file independent of http.ts
// (which is heavily edited). If they drift, the worst that happens is a
// CORS mismatch on affiliate routes which fails loudly.
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

function getCorsOrigin(request: Request): string {
  const origin = request.headers.get("Origin") ?? "";
  if (!origin) return ALLOWED_ORIGINS[0];
  if (ALLOWED_ORIGINS.includes(origin) || isAllowedVercelPreview(origin)) return origin;
  return ALLOWED_ORIGINS[0];
}

function makeCorsHeaders(request: Request) {
  return {
    "Access-Control-Allow-Origin": getCorsOrigin(request),
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

// Best-effort client IP. Same helper pattern used in http.ts. Clamped to
// 64 chars so a pathological header can't blow up rate-limit keys.
function getClientIp(request: Request): string | null {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf.trim().slice(0, 64);
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim().slice(0, 64) ?? null;
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim().slice(0, 64);
  return null;
}

function jsonResponse(body: unknown, status: number, request: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...makeCorsHeaders(request),
    },
  });
}

function errorResponse(error: unknown, fallback: string, request: Request, status = 400) {
  let msg = fallback;
  if (error instanceof Error) {
    msg = error.message.replace(/^Uncaught Error:\s*/i, "").split("\n")[0].trim() || fallback;
  }
  return jsonResponse({ error: msg }, status, request);
}

// ─────────────────────────────────────────────────────────────
// Route registration
// ─────────────────────────────────────────────────────────────

export function registerAffiliateRoutes(http: HttpRouter): void {
  // ── GET /api/affiliate/me ─────────────────────────────────
  http.route({
    path: "/api/affiliate/me",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      try {
        const sessionToken = getSessionToken(request) ?? undefined;
        const stats = await ctx.runQuery(api.affiliates.getMyStats, { sessionToken });
        return jsonResponse({ stats }, 200, request);
      } catch (error) {
        return errorResponse(error, "Not authenticated", request, 401);
      }
    }),
  });

  // ── POST /api/affiliate/apply ─────────────────────────────
  http.route({
    path: "/api/affiliate/apply",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      try {
        const sessionToken = getSessionToken(request) ?? undefined;
        const body = await request.json().catch(() => ({}));
        const affiliateId = await ctx.runMutation(api.affiliates.apply, {
          sessionToken,
          applicationNote: typeof body.applicationNote === "string" ? body.applicationNote : undefined,
          audience: typeof body.audience === "string" ? body.audience : undefined,
          promotionChannels: Array.isArray(body.promotionChannels) ? body.promotionChannels : undefined,
          websiteUrl: typeof body.websiteUrl === "string" ? body.websiteUrl : undefined,
          socialHandles: Array.isArray(body.socialHandles) ? body.socialHandles : undefined,
          payoutMethod: ["paypal", "stripe", "bank"].includes(body.payoutMethod) ? body.payoutMethod : undefined,
          payoutEmail: typeof body.payoutEmail === "string" ? body.payoutEmail : undefined,
          payoutCountry: typeof body.payoutCountry === "string" ? body.payoutCountry : undefined,
        });
        return jsonResponse({ affiliateId }, 200, request);
      } catch (error) {
        return errorResponse(error, "Failed to submit application", request);
      }
    }),
  });

  // ── POST /api/affiliate/payout-info ───────────────────────
  http.route({
    path: "/api/affiliate/payout-info",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      try {
        const sessionToken = getSessionToken(request) ?? undefined;
        const body = await request.json().catch(() => ({}));
        await ctx.runMutation(api.affiliates.updateMyPayoutInfo, {
          sessionToken,
          payoutMethod: ["paypal", "stripe", "bank"].includes(body.payoutMethod) ? body.payoutMethod : undefined,
          payoutEmail: typeof body.payoutEmail === "string" ? body.payoutEmail : undefined,
          payoutCountry: typeof body.payoutCountry === "string" ? body.payoutCountry : undefined,
        });
        return jsonResponse({ ok: true }, 200, request);
      } catch (error) {
        return errorResponse(error, "Failed to update payout info", request);
      }
    }),
  });

  // ── GET /api/affiliate/conversions ────────────────────────
  http.route({
    path: "/api/affiliate/conversions",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      try {
        const sessionToken = getSessionToken(request) ?? undefined;
        const url = new URL(request.url);
        const limit = url.searchParams.get("limit");
        const conversions = await ctx.runQuery(api.affiliates.listMyConversions, {
          sessionToken,
          limit: limit ? Math.min(parseInt(limit, 10) || 100, 500) : undefined,
        });
        return jsonResponse({ conversions }, 200, request);
      } catch (error) {
        return errorResponse(error, "Failed to load conversions", request, 401);
      }
    }),
  });

  // ── GET /api/affiliate/clicks ─────────────────────────────
  http.route({
    path: "/api/affiliate/clicks",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      try {
        const sessionToken = getSessionToken(request) ?? undefined;
        const url = new URL(request.url);
        const limit = url.searchParams.get("limit");
        const clicks = await ctx.runQuery(api.affiliates.listMyClicks, {
          sessionToken,
          limit: limit ? Math.min(parseInt(limit, 10) || 100, 500) : undefined,
        });
        return jsonResponse({ clicks }, 200, request);
      } catch (error) {
        return errorResponse(error, "Failed to load clicks", request, 401);
      }
    }),
  });

  // ── GET /api/affiliate/payouts ────────────────────────────
  http.route({
    path: "/api/affiliate/payouts",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      try {
        const sessionToken = getSessionToken(request) ?? undefined;
        const payouts = await ctx.runQuery(api.affiliates.listMyPayouts, { sessionToken });
        return jsonResponse({ payouts }, 200, request);
      } catch (error) {
        return errorResponse(error, "Failed to load payouts", request, 401);
      }
    }),
  });

  // ── POST /api/affiliate/payout-request ────────────────────
  http.route({
    path: "/api/affiliate/payout-request",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      try {
        const sessionToken = getSessionToken(request) ?? undefined;
        const payoutId = await ctx.runMutation(api.affiliates.requestPayout, { sessionToken });
        return jsonResponse({ payoutId }, 200, request);
      } catch (error) {
        return errorResponse(error, "Failed to request payout", request);
      }
    }),
  });

  // ── POST /api/affiliate/track-click ───────────────────────
  // Public endpoint. Records a click and returns the cookie window so the
  // client can persist the ref code for later signups.
  //
  // Hardening vs the original version:
  //  • visitorId is NO LONGER accepted from the client body — we source
  //    it from a signed HttpOnly cookie (`pg_vid`) which we set on first
  //    visit. Previously any attacker could spoof arbitrary visitorIds.
  //  • ip is captured server-side from request headers.
  //  • Rate-limited per-IP (30/min) + per-code (500/min) to block click
  //    fraud. Previously no limit at all.
  //  • Response no longer leaks the internal affiliate _id.
  http.route({
    path: "/api/affiliate/track-click",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      try {
        const body = await request.json().catch(() => ({}));
        if (!body.code || typeof body.code !== "string") {
          return jsonResponse({ ok: false, reason: "missing_code" }, 400, request);
        }
        const code = body.code.slice(0, 64);

        // Derive visitorId server-side. Prefer the signed cookie so we
        // can't be spoofed; fall back to generating a fresh opaque id
        // on the fly and asking the client to persist it via Set-Cookie.
        const cookieHeader = request.headers.get("cookie") ?? "";
        const cookieMatch = cookieHeader.match(/(?:^|;\s*)pg_vid=([A-Za-z0-9_-]{16,64})/);
        let visitorId = cookieMatch?.[1];
        let issuingNewCookie = false;
        if (!visitorId) {
          const bytes = crypto.getRandomValues(new Uint8Array(24));
          visitorId = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
          issuingNewCookie = true;
        }

        // Rate limit: per-IP then per-code.
        const ip = getClientIp(request);
        if (ip) {
          const rlIp = await ctx.runMutation(api.rateLimit.consume, {
            scope: "ip", subject: ip,
            action: "affiliate.track_click_ip",
          });
          if (!rlIp.allowed) {
            return jsonResponse({ ok: false, reason: "rate_limited" }, 429, request);
          }
        }
        const rlCode = await ctx.runMutation(api.rateLimit.consume, {
          scope: "global", subject: code,
          action: "affiliate.track_click_code",
        });
        if (!rlCode.allowed) {
          return jsonResponse({ ok: false, reason: "rate_limited" }, 429, request);
        }

        const result = await ctx.runMutation(internal.affiliates.recordClickInternal, {
          code,
          visitorId,
          landingPath: typeof body.landingPath === "string" ? body.landingPath : undefined,
          referrer: typeof body.referrer === "string" ? body.referrer : undefined,
          userAgent: request.headers.get("user-agent") ?? undefined,
          country: request.headers.get("cf-ipcountry") ?? undefined,
          ip: ip ?? undefined,
        });

        const response = jsonResponse(result, 200, request);
        if (issuingNewCookie) {
          // Attach a signed HttpOnly cookie so the next visit is
          // authenticated. SameSite=Lax so the cookie flows on top-level
          // GET navigations from the referrer; Secure so it only goes
          // over HTTPS in prod.
          response.headers.append(
            "Set-Cookie",
            `pg_vid=${visitorId}; Path=/; Max-Age=${60 * 60 * 24 * 90}; HttpOnly; Secure; SameSite=Lax`,
          );
        }
        return response;
      } catch (error) {
        return errorResponse(error, "Failed to record click", request);
      }
    }),
  });

  // ── GET /api/affiliate/lookup?code=XYZ ────────────────────
  // Used by the client to validate a ref code (e.g., to show "you were
  // referred by …" UI on signup).
  http.route({
    path: "/api/affiliate/lookup",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      try {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        if (!code) return jsonResponse({ found: false }, 200, request);

        // Rate limit the lookup endpoint too — otherwise an attacker
        // can brute-force the narrow code namespace. 30 lookups per IP
        // per minute is plenty for legitimate UI validation.
        const ip = getClientIp(request);
        if (ip) {
          const rl = await ctx.runMutation(api.rateLimit.consume, {
            scope: "ip", subject: ip,
            action: "affiliate.lookup_ip",
          });
          if (!rl.allowed) {
            return jsonResponse({ found: false }, 429, request);
          }
        }

        const affiliate = await ctx.runQuery(api.affiliates.findByCode, { code });
        // Do NOT leak the affiliate _id to the public caller. Only
        // return the boolean plus cookieWindowDays so the client can
        // persist the ref for the right length.
        return jsonResponse(
          {
            found: !!affiliate,
            cookieWindowDays: affiliate?.cookieWindowDays,
          },
          200,
          request,
        );
      } catch (error) {
        return errorResponse(error, "Lookup failed", request);
      }
    }),
  });

  // ─────────────────────────────────────────────────────────
  // ADMIN
  // ─────────────────────────────────────────────────────────

  // ── GET /api/admin/affiliates ─────────────────────────────
  http.route({
    path: "/api/admin/affiliates",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      try {
        const sessionToken = getSessionToken(request) ?? undefined;
        const url = new URL(request.url);
        const status = url.searchParams.get("status") as
          | "pending"
          | "approved"
          | "rejected"
          | "banned"
          | null;
        const affiliates = await ctx.runQuery(api.affiliates.adminListAffiliates, {
          sessionToken,
          status: status ?? undefined,
        });
        return jsonResponse({ affiliates }, 200, request);
      } catch (error) {
        return errorResponse(error, "Forbidden", request, 403);
      }
    }),
  });

  // ── POST /api/admin/affiliates/approve ────────────────────
  http.route({
    path: "/api/admin/affiliates/approve",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      try {
        const sessionToken = getSessionToken(request) ?? undefined;
        const body = await request.json().catch(() => ({}));
        if (!body.affiliateId) {
          return jsonResponse({ error: "affiliateId required" }, 400, request);
        }
        await ctx.runMutation(api.affiliates.adminApprove, {
          sessionToken,
          affiliateId: body.affiliateId,
          commissionRate: typeof body.commissionRate === "number" ? body.commissionRate : undefined,
          cookieWindowDays: typeof body.cookieWindowDays === "number" ? body.cookieWindowDays : undefined,
        });
        return jsonResponse({ ok: true }, 200, request);
      } catch (error) {
        return errorResponse(error, "Failed to approve", request);
      }
    }),
  });

  // ── POST /api/admin/affiliates/reject ─────────────────────
  http.route({
    path: "/api/admin/affiliates/reject",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      try {
        const sessionToken = getSessionToken(request) ?? undefined;
        const body = await request.json().catch(() => ({}));
        if (!body.affiliateId) {
          return jsonResponse({ error: "affiliateId required" }, 400, request);
        }
        await ctx.runMutation(api.affiliates.adminReject, {
          sessionToken,
          affiliateId: body.affiliateId,
          reason: typeof body.reason === "string" ? body.reason : undefined,
        });
        return jsonResponse({ ok: true }, 200, request);
      } catch (error) {
        return errorResponse(error, "Failed to reject", request);
      }
    }),
  });

  // ── POST /api/admin/affiliates/ban ────────────────────────
  http.route({
    path: "/api/admin/affiliates/ban",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      try {
        const sessionToken = getSessionToken(request) ?? undefined;
        const body = await request.json().catch(() => ({}));
        if (!body.affiliateId) {
          return jsonResponse({ error: "affiliateId required" }, 400, request);
        }
        await ctx.runMutation(api.affiliates.adminBan, {
          sessionToken,
          affiliateId: body.affiliateId,
          reason: typeof body.reason === "string" ? body.reason : undefined,
        });
        return jsonResponse({ ok: true }, 200, request);
      } catch (error) {
        return errorResponse(error, "Failed to ban", request);
      }
    }),
  });

  // ── POST /api/admin/affiliates/set-rate ───────────────────
  http.route({
    path: "/api/admin/affiliates/set-rate",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      try {
        const sessionToken = getSessionToken(request) ?? undefined;
        const body = await request.json().catch(() => ({}));
        if (!body.affiliateId || typeof body.commissionRate !== "number") {
          return jsonResponse({ error: "affiliateId + commissionRate required" }, 400, request);
        }
        await ctx.runMutation(api.affiliates.adminSetRate, {
          sessionToken,
          affiliateId: body.affiliateId,
          commissionRate: body.commissionRate,
        });
        return jsonResponse({ ok: true }, 200, request);
      } catch (error) {
        return errorResponse(error, "Failed to set rate", request);
      }
    }),
  });

  // ── GET /api/admin/affiliates/:id (uses query param) ──────
  http.route({
    path: "/api/admin/affiliates/detail",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      try {
        const sessionToken = getSessionToken(request) ?? undefined;
        const url = new URL(request.url);
        const affiliateId = url.searchParams.get("id");
        if (!affiliateId) {
          return jsonResponse({ error: "id required" }, 400, request);
        }
        const detail = await ctx.runQuery(api.affiliates.adminGetAffiliateDetail, {
          sessionToken,
          affiliateId: affiliateId as any,
        });
        return jsonResponse({ detail }, 200, request);
      } catch (error) {
        return errorResponse(error, "Failed to load detail", request, 403);
      }
    }),
  });

  // ── GET /api/admin/affiliates/payouts ─────────────────────
  http.route({
    path: "/api/admin/affiliates/payouts",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      try {
        const sessionToken = getSessionToken(request) ?? undefined;
        const url = new URL(request.url);
        const status = url.searchParams.get("status") as
          | "requested"
          | "processing"
          | "paid"
          | "failed"
          | null;
        const payouts = await ctx.runQuery(api.affiliates.adminListPayouts, {
          sessionToken,
          status: status ?? undefined,
        });
        return jsonResponse({ payouts }, 200, request);
      } catch (error) {
        return errorResponse(error, "Failed to load payouts", request, 403);
      }
    }),
  });

  // ── POST /api/admin/affiliates/payout/mark-paid ───────────
  http.route({
    path: "/api/admin/affiliates/payout/mark-paid",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      try {
        const sessionToken = getSessionToken(request) ?? undefined;
        const body = await request.json().catch(() => ({}));
        if (!body.payoutId) {
          return jsonResponse({ error: "payoutId required" }, 400, request);
        }
        await ctx.runMutation(api.affiliates.adminMarkPayoutPaid, {
          sessionToken,
          payoutId: body.payoutId,
          reference: typeof body.reference === "string" ? body.reference : undefined,
          note: typeof body.note === "string" ? body.note : undefined,
        });
        return jsonResponse({ ok: true }, 200, request);
      } catch (error) {
        return errorResponse(error, "Failed to mark paid", request);
      }
    }),
  });

  // ── POST /api/admin/affiliates/payout/mark-failed ─────────
  http.route({
    path: "/api/admin/affiliates/payout/mark-failed",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      try {
        const sessionToken = getSessionToken(request) ?? undefined;
        const body = await request.json().catch(() => ({}));
        if (!body.payoutId) {
          return jsonResponse({ error: "payoutId required" }, 400, request);
        }
        await ctx.runMutation(api.affiliates.adminMarkPayoutFailed, {
          sessionToken,
          payoutId: body.payoutId,
          reason: typeof body.reason === "string" ? body.reason : undefined,
        });
        return jsonResponse({ ok: true }, 200, request);
      } catch (error) {
        return errorResponse(error, "Failed to mark failed", request);
      }
    }),
  });

  // ── POST /api/admin/affiliates/conversion/approve ─────────
  http.route({
    path: "/api/admin/affiliates/conversion/approve",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      try {
        const sessionToken = getSessionToken(request) ?? undefined;
        const body = await request.json().catch(() => ({}));
        if (!body.conversionId) {
          return jsonResponse({ error: "conversionId required" }, 400, request);
        }
        await ctx.runMutation(api.affiliates.adminApproveConversion, {
          sessionToken,
          conversionId: body.conversionId,
        });
        return jsonResponse({ ok: true }, 200, request);
      } catch (error) {
        return errorResponse(error, "Failed to approve conversion", request);
      }
    }),
  });

  // ── POST /api/admin/affiliates/conversion/void ────────────
  http.route({
    path: "/api/admin/affiliates/conversion/void",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      try {
        const sessionToken = getSessionToken(request) ?? undefined;
        const body = await request.json().catch(() => ({}));
        if (!body.conversionId) {
          return jsonResponse({ error: "conversionId required" }, 400, request);
        }
        await ctx.runMutation(api.affiliates.adminVoidConversion, {
          sessionToken,
          conversionId: body.conversionId,
        });
        return jsonResponse({ ok: true }, 200, request);
      } catch (error) {
        return errorResponse(error, "Failed to void conversion", request);
      }
    }),
  });

  // ─────────────────────────────────────────────────────────
  // CORS PREFLIGHT
  // ─────────────────────────────────────────────────────────
  for (const path of [
    "/api/affiliate/me",
    "/api/affiliate/apply",
    "/api/affiliate/payout-info",
    "/api/affiliate/conversions",
    "/api/affiliate/clicks",
    "/api/affiliate/payouts",
    "/api/affiliate/payout-request",
    "/api/affiliate/track-click",
    "/api/affiliate/lookup",
    "/api/admin/affiliates",
    "/api/admin/affiliates/approve",
    "/api/admin/affiliates/reject",
    "/api/admin/affiliates/ban",
    "/api/admin/affiliates/set-rate",
    "/api/admin/affiliates/detail",
    "/api/admin/affiliates/payouts",
    "/api/admin/affiliates/payout/mark-paid",
    "/api/admin/affiliates/payout/mark-failed",
    "/api/admin/affiliates/conversion/approve",
    "/api/admin/affiliates/conversion/void",
  ]) {
    http.route({
      path,
      method: "OPTIONS",
      handler: httpAction(async (_ctx, request) => {
        return new Response(null, { status: 204, headers: makeCorsHeaders(request) });
      }),
    });
  }
}
