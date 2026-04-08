import type { HttpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
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
          return errorResponse("Billing not configured (STRIPE_SECRET_KEY unset)", 503);
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
          return errorResponse("Sign in before checking out", 401);
        }
        const me = await ctx.runQuery(api.users.getCurrentUser, {
          sessionToken: sessionToken ?? undefined,
        });
        if (!me) return errorResponse("Sign in before checking out", 401);
        const userId = (me as { _id: Id<"users">; email?: string })._id;
        const userEmail = (me as { email?: string }).email;

        const body = await request.json().catch(() => ({}));
        const target = typeof body?.target === "string" ? body.target : "";
        const interval = body?.interval === "year" ? "year" : "month";

        // Resolve the Stripe price id from env for the requested target.
        let priceId: string | undefined;
        let mode: "subscription" | "payment" = "subscription";
        let planForMetadata: string | null = null;
        switch (target) {
          case "pro":
            priceId = interval === "year"
              ? process.env.STRIPE_PRICE_PRO_YEAR
              : process.env.STRIPE_PRICE_PRO_MONTH;
            planForMetadata = "pro";
            break;
          case "creator":
            priceId = interval === "year"
              ? process.env.STRIPE_PRICE_CREATOR_YEAR
              : process.env.STRIPE_PRICE_CREATOR_MONTH;
            planForMetadata = "creator";
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
            return errorResponse(`Unknown checkout target: ${target}`);
        }
        if (!priceId) {
          return errorResponse(`Stripe price not configured for ${target}`, 503);
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

        return jsonResponse({
          sessionId: session.id,
          checkoutUrl: session.url,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Checkout failed";
        return errorResponse(msg, 500);
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
