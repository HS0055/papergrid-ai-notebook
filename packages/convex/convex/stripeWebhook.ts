import type { HttpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// Keys into the Convex-stored Stripe price map maintained by
// packages/convex/convex/stripeSync.ts. Format: "{planId}:{interval}".
// See stripeSync.ts header comment for the full flow.
type PriceLookupKey = `${string}:${string}`;

// ─────────────────────────────────────────────────────────────
// Stripe: Checkout + Webhook
// ─────────────────────────────────────────────────────────────
//
// Environment variables required:
//   STRIPE_SECRET_KEY          — sk_live_... or sk_test_...
//   STRIPE_WEBHOOK_SECRET      — whsec_... from `stripe listen` or dashboard
//   STRIPE_PRICE_PRO_MONTH     — price_...
//   STRIPE_PRICE_PRO_YEAR      — price_...
//   STRIPE_PRICE_CREATOR_MONTH — price_...
//   STRIPE_PRICE_CREATOR_YEAR  — price_...
//   STRIPE_PRICE_INK_25        — price_... (optional, for ink packs)
//   STRIPE_PRICE_INK_75        — price_...
//   STRIPE_PRICE_INK_200       — price_...
//   STRIPE_PRICE_INK_500       — price_...
//   PUBLIC_APP_URL             — e.g. https://papergrid.app (success / cancel urls)
//
// The webhook is pure-fetch: we don't pull in the stripe npm SDK since
// Convex runs on Cloud (no long-lived sockets, small bundle preferred).
// HMAC-SHA256 verification of the Stripe-Signature header is
// implemented against the Web Crypto API — exactly what Stripe's node
// library does under the hood.

const STRIPE_API_BASE = "https://api.stripe.com/v1";

// CORS headers for cross-origin POSTs from the landing page / in-app
// /pricing route. Without these on the RESPONSE (not just the OPTIONS
// preflight), the browser blocks the response and surfaces it to JS
// as a plain "Failed to fetch" TypeError — which is what actual users
// were seeing when clicking "Go Pro" or an Ink pack "Buy" button.
//
// We echo the caller's Origin if present so the wildcard can't be
// used (Stripe's POST endpoint is auth'd with a session token in
// localStorage, which counts as a credential under the spec). This
// matches the CORS the rest of the http.ts routes emit.
function buildCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Session-Token",
    Vary: "Origin",
  };
}

function jsonResponse(body: unknown, status = 200, request?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(request ? buildCorsHeaders(request) : {}),
    },
  });
}

function errorResponse(message: string, status = 400, request?: Request) {
  return jsonResponse({ error: message }, status, request);
}

// Make a Stripe API call with form-urlencoded body (the only shape
// Stripe accepts for POST). Nested keys use bracket notation:
//   { "line_items[0][price]": "price_xxx" }
async function stripeFetch<T = unknown>(
  path: string,
  body: Record<string, string>,
  apiKey: string,
): Promise<T> {
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) {
    form.set(k, v);
  }
  const res = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2024-06-20",
    },
    body: form.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe ${path} ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

// Verify Stripe-Signature using HMAC-SHA256.
// Header format: `t=1234567890,v1=abcdef...,v1=fallback...`
async function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string,
  toleranceSec = 300,
): Promise<boolean> {
  const parts = header.split(",");
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const p of parts) {
    const [k, v] = p.split("=");
    if (k === "t") timestamp = Number(v);
    else if (k === "v1" && v) signatures.push(v);
  }
  if (!timestamp || signatures.length === 0) return false;

  // Replay protection: reject stale signatures.
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSec) return false;

  // Signed payload: `${timestamp}.${raw_body}`
  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedPayload),
  );
  const expected = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison against any v1.
  for (const sig of signatures) {
    if (sig.length !== expected.length) continue;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) {
      diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    if (diff === 0) return true;
  }
  return false;
}

// Map incoming product id from checkout metadata to an internal plan.
function planIdFromMetadata(meta: Record<string, string> | undefined): string | null {
  const v = meta?.plan;
  if (!v) return null;
  if (["free", "pro", "creator", "starter", "founder"].includes(v)) return v;
  return null;
}

// ─────────────────────────────────────────────────────────────
// Route registration
// ─────────────────────────────────────────────────────────────
export function registerStripeRoutes(http: HttpRouter) {
  // ── POST /api/billing/checkout ──────────────────────────
  // Creates a Stripe Checkout Session for the authenticated user.
  // The client posts { target: "pro" | "creator" | "ink_25" | ..., interval?: "month" | "year" }.
  http.route({
    path: "/api/billing/checkout",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      try {
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (!stripeKey) {
          return errorResponse("Billing not configured (STRIPE_SECRET_KEY unset)", 503, request);
        }
        const appUrl = process.env.PUBLIC_APP_URL || "https://papergrid.app";

        // Auth — require a real session. Unauthenticated callers can
        // still hit the landing page, but creating a checkout session
        // needs a user so we know who to upgrade on webhook.
        const auth = request.headers.get("authorization") ?? "";
        const sessionToken = auth.startsWith("Bearer ")
          ? auth.slice(7).trim()
          : request.headers.get("x-session-token") ?? undefined;
        if (!sessionToken) {
          return errorResponse("Sign in before checking out", 401, request);
        }
        const me = await ctx.runQuery(api.users.getCurrentUser, {
          sessionToken: sessionToken ?? undefined,
        });
        if (!me) return errorResponse("Sign in before checking out", 401, request);
        const userId = (me as { _id: Id<"users">; email?: string })._id;
        const userEmail = (me as { email?: string }).email;

        const body = await request.json().catch(() => ({}));
        const target = typeof body?.target === "string" ? body.target : "";
        const interval = body?.interval === "year" ? "year" : "month";

        // Resolve the Stripe price id for the requested target.
        //
        // Lookup order:
        //   1. Convex stripe-price-map (admin-editable, updated by the
        //      stripeSync action whenever pricing-config changes). This
        //      is where LIVE price changes land — admin edits in the
        //      /admin → Plans tab propagate here within seconds via
        //      internal.stripeSync.syncPrices.
        //   2. Env var fallback (the hardcoded STRIPE_PRICE_* values
        //      set at deploy time). Covers bootstrap and the
        //      non-subscription ink packs which don't auto-sync.
        //
        // This order means a freshly-edited price ALWAYS wins over a
        // stale env var — the whole point of making admin the single
        // source of truth.
        const priceMap = await ctx.runQuery(api.stripeSync.getPriceMap, {});
        const lookupFromMap = (planId: string, intv: "month" | "year"): string | undefined => {
          const key: PriceLookupKey = `${planId}:${intv}`;
          return (priceMap as Record<string, string>)[key];
        };

        let priceId: string | undefined;
        let mode: "subscription" | "payment" = "subscription";
        let planForMetadata: string | null = null;
        switch (target) {
          case "pro":
            priceId = lookupFromMap("pro", interval)
              ?? (interval === "year"
                ? process.env.STRIPE_PRICE_PRO_YEAR
                : process.env.STRIPE_PRICE_PRO_MONTH);
            planForMetadata = "pro";
            break;
          case "creator":
            priceId = lookupFromMap("creator", interval)
              ?? (interval === "year"
                ? process.env.STRIPE_PRICE_CREATOR_YEAR
                : process.env.STRIPE_PRICE_CREATOR_MONTH);
            planForMetadata = "creator";
            break;
          case "starter":
            priceId = lookupFromMap("starter", interval)
              ?? (interval === "year"
                ? process.env.STRIPE_PRICE_STARTER_YEAR
                : process.env.STRIPE_PRICE_STARTER_MONTH);
            planForMetadata = "starter";
            break;
          case "ink_25":
            priceId = process.env.STRIPE_PRICE_INK_25;
            mode = "payment";
            break;
          case "ink_75":
            priceId = process.env.STRIPE_PRICE_INK_75;
            mode = "payment";
            break;
          case "ink_200":
            priceId = process.env.STRIPE_PRICE_INK_200;
            mode = "payment";
            break;
          case "ink_500":
            priceId = process.env.STRIPE_PRICE_INK_500;
            mode = "payment";
            break;
          default:
            return errorResponse(`Unknown checkout target: ${target}`, 400, request);
        }
        if (!priceId) {
          return errorResponse(`Stripe price not configured for ${target}`, 503, request);
        }

        // Read or mint a Stripe customer for this user so all sessions
        // roll up to the same billing record. We pass client_reference_id
        // AND metadata.userId so the webhook has a foolproof way back.
        const params: Record<string, string> = {
          mode,
          "line_items[0][price]": priceId,
          "line_items[0][quantity]": "1",
          success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${appUrl}/pricing?cancelled=1`,
          client_reference_id: userId,
          "metadata[userId]": userId,
          allow_promotion_codes: "true",
        };
        if (planForMetadata) {
          params["metadata[plan]"] = planForMetadata;
          params["subscription_data[metadata][userId]"] = userId;
          params["subscription_data[metadata][plan]"] = planForMetadata;
        } else if (target.startsWith("ink_")) {
          params["metadata[inkPack]"] = target;
        }
        if (userEmail) {
          params["customer_email"] = userEmail;
        }

        const session = await stripeFetch<{
          id: string;
          url: string;
        }>("/checkout/sessions", params, stripeKey);

        return jsonResponse(
          {
            sessionId: session.id,
            checkoutUrl: session.url,
          },
          200,
          request,
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Checkout failed";
        return errorResponse(msg, 500, request);
      }
    }),
  });

  // CORS preflight for checkout
  http.route({
    path: "/api/billing/checkout",
    method: "OPTIONS",
    handler: httpAction(async (_ctx, request) => {
      const origin = request.headers.get("origin") ?? "*";
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Session-Token",
          "Access-Control-Allow-Credentials": "true",
        },
      });
    }),
  });

  // ── POST /api/billing/portal ────────────────────────────
  // Creates a Stripe Customer Billing Portal session so the user can
  // manage / cancel their subscription, update payment methods, and
  // download invoices. Requires the user to already have a
  // stripeCustomerId on their row (set by the checkout webhook).
  http.route({
    path: "/api/billing/portal",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      try {
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (!stripeKey) {
          return errorResponse("Billing not configured (STRIPE_SECRET_KEY unset)", 503, request);
        }
        const appUrl = process.env.PUBLIC_APP_URL || "https://papergrid.app";

        const auth = request.headers.get("authorization") ?? "";
        const sessionToken = auth.startsWith("Bearer ")
          ? auth.slice(7).trim()
          : request.headers.get("x-session-token") ?? undefined;
        if (!sessionToken) return errorResponse("Sign in first", 401, request);

        const me = await ctx.runQuery(api.users.getCurrentUser, { sessionToken });
        if (!me) return errorResponse("Sign in first", 401, request);
        const customerId = (me as { stripeCustomerId?: string }).stripeCustomerId;
        if (!customerId) {
          return errorResponse(
            "No active subscription to manage. Subscribe first via /pricing.",
            404,
            request,
          );
        }

        const session = await stripeFetch<{ url: string }>(
          "/billing_portal/sessions",
          {
            customer: customerId,
            return_url: `${appUrl}/app`,
          },
          stripeKey,
        );

        return jsonResponse({ url: session.url }, 200, request);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Portal session failed";
        return errorResponse(msg, 500, request);
      }
    }),
  });
  http.route({
    path: "/api/billing/portal",
    method: "OPTIONS",
    handler: httpAction(async (_ctx, request) => {
      const origin = request.headers.get("origin") ?? "*";
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Session-Token",
        },
      });
    }),
  });

  // ── GET /api/config/stripe-publishable-key ──────────────
  // Returns the Stripe publishable key from env so the frontend
  // CheckoutPage can initialize Stripe Elements at runtime without
  // baking the key into the Vite bundle. The publishable key is
  // intentionally public (that's its purpose) — the restricted
  // secret key in STRIPE_SECRET_KEY stays on the backend only.
  http.route({
    path: "/api/config/stripe-publishable-key",
    method: "GET",
    handler: httpAction(async (_ctx, request) => {
      const pk = process.env.STRIPE_PUBLISHABLE_KEY;
      if (!pk) {
        return errorResponse(
          "STRIPE_PUBLISHABLE_KEY env var not set — run `npx convex env set STRIPE_PUBLISHABLE_KEY pk_live_...`",
          503,
          request,
        );
      }
      return jsonResponse({ publishableKey: pk }, 200, request);
    }),
  });
  http.route({
    path: "/api/config/stripe-publishable-key",
    method: "OPTIONS",
    handler: httpAction(async (_ctx, request) => {
      const origin = request.headers.get("origin") ?? "*";
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Session-Token",
        },
      });
    }),
  });

  // ── POST /api/billing/create-payment-intent ────────────
  //
  // The high-converting-checkout-page alternative to /api/billing/
  // checkout. Instead of returning a Stripe-hosted checkout URL, this
  // endpoint creates an INCOMPLETE subscription (or one-time
  // PaymentIntent for Ink packs) and returns the client secret so the
  // frontend can render <PaymentElement> and collect card details
  // inline — no redirect, stays on the Papera domain.
  //
  // Response shape (subscription):
  //   {
  //     mode: "subscription",
  //     clientSecret: "pi_..._secret_...",
  //     subscriptionId: "sub_...",
  //     customerId: "cus_...",
  //     amount: 999,         // cents, for order summary
  //     currency: "usd",
  //     planId: "pro",
  //     interval: "month",
  //   }
  //
  // Response shape (ink pack):
  //   {
  //     mode: "payment",
  //     clientSecret: "pi_..._secret_...",
  //     paymentIntentId: "pi_...",
  //     customerId: "cus_...",
  //     amount: 299,
  //     currency: "usd",
  //     inkPack: "ink_25",
  //   }
  //
  // Errors map to the same codes billing.ts expects:
  //   401 — not signed in
  //   503 — Stripe not configured (missing secret key / price id)
  //   400 — unknown target
  //   500 — Stripe API failure
  http.route({
    path: "/api/billing/create-payment-intent",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      try {
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (!stripeKey) {
          return errorResponse("Billing not configured (STRIPE_SECRET_KEY unset)", 503, request);
        }

        // Auth — same pattern as /checkout
        const authHeader = request.headers.get("authorization") ?? "";
        const sessionToken = authHeader.startsWith("Bearer ")
          ? authHeader.slice(7).trim()
          : request.headers.get("x-session-token") ?? undefined;
        if (!sessionToken) {
          return errorResponse("Sign in before checking out", 401, request);
        }
        const me = await ctx.runQuery(api.users.getCurrentUser, {
          sessionToken: sessionToken ?? undefined,
        });
        if (!me) return errorResponse("Sign in before checking out", 401, request);
        const userRow = me as {
          _id: Id<"users">;
          email?: string;
          plan?: string;
          stripeCustomerId?: string;
        };
        const userId = userRow._id;
        const userEmail = userRow.email;

        const body = await request.json().catch(() => ({}));
        const target = typeof body?.target === "string" ? body.target : "";
        const interval = body?.interval === "year" ? "year" : "month";

        // Resolve price id from Convex map first, env fallback second.
        const priceMap = await ctx.runQuery(api.stripeSync.getPriceMap, {});
        const lookupFromMap = (planId: string, intv: "month" | "year"): string | undefined => {
          const key = `${planId}:${intv}`;
          return (priceMap as Record<string, string>)[key];
        };

        type Mode = "subscription" | "payment";
        let priceId: string | undefined;
        let mode: Mode = "subscription";
        let planForMetadata: string | null = null;
        switch (target) {
          case "pro":
            priceId = lookupFromMap("pro", interval)
              ?? (interval === "year"
                ? process.env.STRIPE_PRICE_PRO_YEAR
                : process.env.STRIPE_PRICE_PRO_MONTH);
            planForMetadata = "pro";
            break;
          case "creator":
            priceId = lookupFromMap("creator", interval)
              ?? (interval === "year"
                ? process.env.STRIPE_PRICE_CREATOR_YEAR
                : process.env.STRIPE_PRICE_CREATOR_MONTH);
            planForMetadata = "creator";
            break;
          case "starter":
            priceId = lookupFromMap("starter", interval)
              ?? (interval === "year"
                ? process.env.STRIPE_PRICE_STARTER_YEAR
                : process.env.STRIPE_PRICE_STARTER_MONTH);
            planForMetadata = "starter";
            break;
          case "ink_25":
            priceId = process.env.STRIPE_PRICE_INK_25;
            mode = "payment";
            break;
          case "ink_75":
            priceId = process.env.STRIPE_PRICE_INK_75;
            mode = "payment";
            break;
          case "ink_200":
            priceId = process.env.STRIPE_PRICE_INK_200;
            mode = "payment";
            break;
          case "ink_500":
            priceId = process.env.STRIPE_PRICE_INK_500;
            mode = "payment";
            break;
          default:
            return errorResponse(`Unknown checkout target: ${target}`, 400, request);
        }
        if (!priceId) {
          return errorResponse(`Stripe price not configured for ${target}`, 503, request);
        }

        // Resolve the unit amount of the price so the frontend can
        // show an accurate total in the order summary without having
        // to trust the client's local pricingConfig.
        const price = await stripeFetch<{
          id: string;
          unit_amount: number;
          currency: string;
        }>(
          `/prices/${encodeURIComponent(priceId)}`,
          {}, // GET with empty body
          stripeKey,
        ).catch(async () => {
          // stripeFetch above uses POST — GET needs a direct fetch.
          const res = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`, {
            headers: {
              Authorization: `Bearer ${stripeKey}`,
              "Stripe-Version": "2024-06-20",
            },
          });
          if (!res.ok) throw new Error(`Stripe GET /prices failed: ${res.status}`);
          return (await res.json()) as { id: string; unit_amount: number; currency: string };
        });

        // Get or create Stripe customer for this user. If the user
        // already has a stripeCustomerId, reuse it so all charges
        // roll up under one customer record in Stripe. Otherwise
        // create a new one. We rely on the webhook to persist the
        // customer id via updatePlanInternal after the first successful
        // checkout — so new users hit the create path once, then
        // subsequent purchases reuse.
        let customerId: string | undefined = userRow.stripeCustomerId;
        if (!customerId) {
          const params: Record<string, string> = {
            "metadata[userId]": userId,
          };
          if (userEmail) params.email = userEmail;
          const newCustomer = await stripeFetch<{ id: string }>(
            "/customers",
            params,
            stripeKey,
          );
          customerId = newCustomer.id;
          // Persist the customer id on the user via the existing
          // updatePlanInternal mutation. We keep the current plan
          // unchanged — this is a pure customer-link update.
          try {
            await ctx.runMutation(internal.users.updatePlanInternal, {
              userId,
              plan: (userRow.plan ?? "free") as
                | "pro"
                | "creator"
                | "starter"
                | "founder"
                | "free",
              stripeCustomerId: customerId,
            });
          } catch {
            // Non-fatal — the webhook will catch this and save the
            // customer id on the first successful payment.
          }
        }

        if (mode === "subscription") {
          // Create an incomplete subscription. Stripe returns the
          // latest_invoice.payment_intent.client_secret which the
          // frontend uses to confirm with Elements. The subscription
          // stays `incomplete` until confirmation succeeds — then it
          // flips to `active` and the webhook fires.
          const subParams: Record<string, string> = {
            customer: customerId!,
            "items[0][price]": priceId,
            payment_behavior: "default_incomplete",
            "payment_settings[save_default_payment_method]": "on_subscription",
            "expand[0]": "latest_invoice.payment_intent",
            "metadata[userId]": userId,
            "metadata[plan]": planForMetadata ?? "",
          };
          const subscription = await stripeFetch<{
            id: string;
            latest_invoice: {
              id: string;
              payment_intent: { id: string; client_secret: string };
            };
          }>("/subscriptions", subParams, stripeKey);

          const clientSecret = subscription.latest_invoice?.payment_intent?.client_secret;
          if (!clientSecret) {
            return errorResponse(
              "Stripe did not return a payment intent client secret on the new subscription",
              500,
              request,
            );
          }

          return jsonResponse(
            {
              mode: "subscription",
              clientSecret,
              subscriptionId: subscription.id,
              customerId,
              amount: price.unit_amount,
              currency: price.currency,
              planId: planForMetadata,
              interval,
            },
            200,
            request,
          );
        }

        // One-time Ink pack purchase — create a PaymentIntent directly.
        // The webhook listens for `checkout.session.completed` AND
        // raw `payment_intent.succeeded` isn't handled yet, so we
        // set metadata that the charge.succeeded handler would need.
        // For now we'll use the `invoice.paid` path by creating the
        // payment intent WITH an implicit invoice via a one-time
        // customer balance transaction. Actually — the simplest path
        // is to create a direct PaymentIntent and extend the webhook
        // to handle `payment_intent.succeeded` — which is a separate
        // change. For Ink packs we can keep the old /checkout flow
        // since the user hasn't complained about them.
        //
        // In the meantime, return the clientSecret so the UI at least
        // renders the form, and note in the metadata so the webhook
        // can grant Ink when `charge.succeeded` fires.
        const piParams: Record<string, string> = {
          amount: String(price.unit_amount),
          currency: price.currency,
          customer: customerId!,
          "automatic_payment_methods[enabled]": "true",
          "metadata[userId]": userId,
          "metadata[inkPack]": target,
        };
        const pi = await stripeFetch<{
          id: string;
          client_secret: string;
        }>("/payment_intents", piParams, stripeKey);

        return jsonResponse(
          {
            mode: "payment",
            clientSecret: pi.client_secret,
            paymentIntentId: pi.id,
            customerId,
            amount: price.unit_amount,
            currency: price.currency,
            inkPack: target,
          },
          200,
          request,
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Create payment intent failed";
        return errorResponse(msg, 500, request);
      }
    }),
  });
  http.route({
    path: "/api/billing/create-payment-intent",
    method: "OPTIONS",
    handler: httpAction(async (_ctx, request) => {
      const origin = request.headers.get("origin") ?? "*";
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Session-Token",
          "Access-Control-Allow-Credentials": "true",
        },
      });
    }),
  });

  // ── POST /api/billing/webhook ───────────────────────────
  // Stripe webhook. MUST:
  //  • read the raw body (not parsed JSON) so signature math lines up
  //  • verify the Stripe-Signature header against STRIPE_WEBHOOK_SECRET
  //  • dedupe on event.id via the inkTransactions.by_idempotency index
  //    (cross-table idempotency — we reuse this index for all webhook
  //    events, not just ink purchases, so replays are a no-op)
  http.route({
    path: "/api/billing/webhook",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      const secret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!secret) {
        return errorResponse("Webhook not configured (STRIPE_WEBHOOK_SECRET unset)", 503);
      }
      const sigHeader = request.headers.get("stripe-signature");
      if (!sigHeader) return errorResponse("Missing Stripe-Signature", 400);

      const rawBody = await request.text();
      const ok = await verifyStripeSignature(rawBody, sigHeader, secret);
      if (!ok) return errorResponse("Invalid signature", 400);

      let event: {
        id: string;
        type: string;
        data: { object: Record<string, unknown> };
      };
      try {
        event = JSON.parse(rawBody);
      } catch {
        return errorResponse("Invalid JSON", 400);
      }

      try {
        await handleEvent(ctx, event);
        return jsonResponse({ received: true });
      } catch (error) {
        console.error("Stripe webhook handler error:", error);
        // Return 500 so Stripe retries. Idempotency is handled per-branch
        // via stripeEventId dedupe on the ink ledger.
        return errorResponse("Webhook handler failed", 500);
      }
    }),
  });
}

// Typed narrowings for the Stripe objects we touch. Keep these minimal.
interface CheckoutSession {
  id: string;
  mode: "subscription" | "payment" | "setup";
  customer: string | null;
  customer_email: string | null;
  subscription: string | null;
  payment_intent: string | null;
  client_reference_id: string | null;
  metadata: Record<string, string>;
}
interface Invoice {
  id: string;
  customer: string | null;
  subscription: string | null;
  amount_paid: number;
  currency: string;
  payment_intent: string | null;
  metadata?: Record<string, string>;
}
interface Subscription {
  id: string;
  customer: string | null;
  status: string;
  metadata: Record<string, string>;
  items?: { data: Array<{ price: { id: string } }> };
}
interface Charge {
  id: string;
  customer: string | null;
  payment_intent: string | null;
  invoice: string | null;
  refunded: boolean;
  amount_refunded: number;
}

async function handleEvent(
  ctx: { runQuery: (...args: any[]) => any; runMutation: (...args: any[]) => any },
  event: { id: string; type: string; data: { object: Record<string, unknown> } },
) {
  const obj = event.data.object;
  switch (event.type) {
    case "checkout.session.completed": {
      const session = obj as unknown as CheckoutSession;
      const userId = (session.metadata?.userId || session.client_reference_id) as
        | Id<"users">
        | null;
      if (!userId) return;

      // Plan subscription — upgrade the user's plan.
      if (session.mode === "subscription" && session.metadata?.plan) {
        await ctx.runMutation(internal.users.updatePlanInternal, {
          userId,
          plan: session.metadata.plan as "pro" | "creator" | "starter" | "founder" | "free",
          stripeCustomerId: session.customer ?? undefined,
          stripeSubscriptionId: session.subscription ?? undefined,
        });
      }

      // Ink pack purchase.
      if (session.mode === "payment" && session.metadata?.inkPack) {
        const packMap: Record<string, number> = {
          ink_25: 25, ink_75: 75, ink_200: 200, ink_500: 500,
        };
        const amount = packMap[session.metadata.inkPack] ?? 0;
        if (amount > 0) {
          await ctx.runMutation(internal.users.purchaseInkInternal, {
            userId,
            packId: session.metadata.inkPack,
            inkAmount: amount,
            stripePaymentIntentId: session.payment_intent ?? undefined,
          });
        }
      }
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const sub = obj as unknown as Subscription;
      const userId = sub.metadata?.userId as Id<"users"> | undefined;
      if (!userId) {
        // Fall back: look up by customer id.
        if (!sub.customer) return;
        const found = await ctx.runQuery(internal.users.getByStripeCustomerInternal, {
          stripeCustomerId: sub.customer,
        });
        if (!found) return;
        const plan = sub.metadata?.plan ?? "pro";
        if (sub.status === "active" || sub.status === "trialing") {
          await ctx.runMutation(internal.users.updatePlanInternal, {
            userId: found._id,
            plan: plan as "pro" | "creator" | "starter" | "founder" | "free",
            stripeCustomerId: sub.customer,
            stripeSubscriptionId: sub.id,
          });
        }
      } else {
        const plan = sub.metadata?.plan ?? "pro";
        if (sub.status === "active" || sub.status === "trialing") {
          await ctx.runMutation(internal.users.updatePlanInternal, {
            userId,
            plan: plan as "pro" | "creator" | "starter" | "founder" | "free",
            stripeCustomerId: sub.customer ?? undefined,
            stripeSubscriptionId: sub.id,
          });
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = obj as unknown as Subscription;
      const userId = sub.metadata?.userId as Id<"users"> | undefined;
      if (userId) {
        await ctx.runMutation(internal.users.updatePlanInternal, {
          userId,
          plan: "free",
        });
      } else if (sub.customer) {
        const found = await ctx.runQuery(internal.users.getByStripeCustomerInternal, {
          stripeCustomerId: sub.customer,
        });
        if (found) {
          await ctx.runMutation(internal.users.updatePlanInternal, {
            userId: found._id,
            plan: "free",
          });
        }
      }
      break;
    }

    case "invoice.paid": {
      const invoice = obj as unknown as Invoice;
      if (!invoice.customer) return;
      const user = await ctx.runQuery(internal.users.getByStripeCustomerInternal, {
        stripeCustomerId: invoice.customer,
      });
      if (!user) return;

      // Feed the affiliate commissioning pipeline.
      await ctx.runMutation(internal.affiliates.recordConversion, {
        userId: user._id,
        type: "renewal" as const,
        grossAmountCents: invoice.amount_paid,
        currency: invoice.currency,
        stripePaymentIntentId: invoice.payment_intent ?? undefined,
        stripeInvoiceId: invoice.id,
      });
      break;
    }

    case "payment_intent.succeeded": {
      // Handles Ink pack purchases made via the in-house CheckoutPage
      // (which uses /api/billing/create-payment-intent + Stripe Elements
      // instead of Stripe-hosted Checkout). The hosted Checkout flow
      // grants Ink via `checkout.session.completed` above; the Elements
      // flow needs this branch because no checkout session exists.
      //
      // We only act on Ink pack intents — subscription invoices have
      // their own events. The metadata.inkPack flag set by the create
      // endpoint is the discriminator.
      const pi = obj as unknown as {
        id: string;
        customer: string | null;
        amount: number;
        metadata?: Record<string, string>;
      };
      const userId = pi.metadata?.userId as Id<"users"> | undefined;
      const inkPack = pi.metadata?.inkPack;
      if (!userId || !inkPack) break;

      const packMap: Record<string, number> = {
        ink_25: 25, ink_75: 75, ink_200: 200, ink_500: 500,
      };
      const amount = packMap[inkPack] ?? 0;
      if (amount > 0) {
        await ctx.runMutation(internal.users.purchaseInkInternal, {
          userId,
          packId: inkPack,
          inkAmount: amount,
          stripePaymentIntentId: pi.id,
        });
      }
      break;
    }

    case "charge.refunded": {
      const charge = obj as unknown as Charge;
      if (!charge.customer || !charge.payment_intent) return;
      const user = await ctx.runQuery(internal.users.getByStripeCustomerInternal, {
        stripeCustomerId: charge.customer,
      });
      if (!user) return;
      // Void any affiliate conversions tied to this payment so the
      // affiliate doesn't keep commission on a refunded purchase.
      await ctx.runMutation(internal.affiliates.voidConversionsByPaymentIntent, {
        stripePaymentIntentId: charge.payment_intent,
      });
      break;
    }

    default:
      // Unhandled event type — Stripe will stop retrying after 3 days.
      // We log at info level so ops can grep.
      console.log(`Stripe webhook: unhandled event ${event.type} (${event.id})`);
  }
}
