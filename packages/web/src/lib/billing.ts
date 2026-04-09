/**
 * billing.ts — client-side helpers that talk to the Convex Stripe routes.
 *
 * The backend lives in `packages/convex/convex/stripeWebhook.ts`:
 *
 *   POST /api/billing/checkout
 *     Headers: Authorization: Bearer <session_token>
 *     Body:    { target: "pro" | "creator" | "ink_25" | "ink_75"
 *                      | "ink_200" | "ink_500",
 *                interval?: "month" | "year" }
 *     200 →    { sessionId, checkoutUrl }
 *     401 →    { error } — user not signed in
 *     400 →    { error } — unknown target
 *     503 →    { error } — billing env vars unset on the server
 *
 *   POST /api/billing/webhook
 *     Stripe → Convex. Verified via HMAC-SHA256. Handles checkout.session
 *     .completed, subscription.{created,updated,deleted}, invoice.paid,
 *     charge.refunded.
 *
 * iOS note: on native Papera builds, all payments MUST go through Apple
 * IAP per App Store Guideline 3.1.1. Do not call this helper from iOS —
 * use the StoreKit flow in PricingPage.tsx instead.
 */

const API_BASE = import.meta.env.VITE_API_URL || '';
const SESSION_KEY = 'papergrid_session';

export type CheckoutTarget =
  | 'pro'
  | 'creator'
  | 'starter'
  | 'ink_25'
  | 'ink_75'
  | 'ink_200'
  | 'ink_500';

export type BillingInterval = 'month' | 'year';

export type CheckoutResult =
  | { ok: true; sessionId: string; checkoutUrl: string }
  | { ok: false; code: 'unauthenticated' | 'not_configured' | 'unknown_target' | 'network' | 'server'; message: string };

/**
 * Read the auth session token from localStorage.
 *
 * useAuth.tsx stores it as a raw string (not JSON). An earlier version
 * of this helper did `JSON.parse` on it, which threw on every real JWT
 * and silently returned null — users got "Failed to fetch" on every
 * Stripe checkout attempt because the Authorization header was always
 * empty. Keep this as a raw read.
 */
function getSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

/**
 * Create a Stripe Checkout session and return the URL to redirect to.
 *
 * Usage:
 *   const res = await createCheckoutSession('pro', 'year');
 *   if (res.ok) window.location.assign(res.checkoutUrl);
 *   else showToast(res.message);
 *
 * Callers should handle the 'not_configured' case by falling back to
 * their normal onLaunch / signup flow so users aren't hard-blocked when
 * the server env vars aren't set yet.
 */
export async function createCheckoutSession(
  target: CheckoutTarget,
  interval: BillingInterval = 'month',
): Promise<CheckoutResult> {
  if (!API_BASE) {
    return {
      ok: false,
      code: 'not_configured',
      message: 'API not configured. Set VITE_API_URL and reload.',
    };
  }

  const token = getSessionToken();
  if (!token) {
    return {
      ok: false,
      code: 'unauthenticated',
      message: 'Sign in to continue to checkout.',
    };
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/billing/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Session-Token': token,
      },
      body: JSON.stringify({ target, interval }),
    });
  } catch {
    return {
      ok: false,
      code: 'network',
      message: 'Network error. Check your connection and try again.',
    };
  }

  const data = (await res.json().catch(() => null)) as
    | { sessionId?: string; checkoutUrl?: string; error?: string }
    | null;

  if (res.ok && data?.checkoutUrl && data?.sessionId) {
    return {
      ok: true,
      sessionId: data.sessionId,
      checkoutUrl: data.checkoutUrl,
    };
  }

  if (res.status === 401) {
    return {
      ok: false,
      code: 'unauthenticated',
      message: data?.error || 'Sign in to continue to checkout.',
    };
  }

  if (res.status === 503) {
    return {
      ok: false,
      code: 'not_configured',
      message:
        data?.error ||
        'Billing is not yet configured on the server. Please try again later.',
    };
  }

  if (res.status === 400) {
    return {
      ok: false,
      code: 'unknown_target',
      message: data?.error || `Unknown checkout target: ${target}`,
    };
  }

  return {
    ok: false,
    code: 'server',
    message: data?.error || `Checkout failed (${res.status}).`,
  };
}

/**
 * Redirect the browser to a checkout session. Convenience wrapper that
 * handles the redirect for callers that don't need the raw session id.
 *
 * Returns the CheckoutResult so the caller can branch on !ok and show
 * a toast. On ok it triggers the redirect and the promise resolves
 * immediately (the navigation happens async).
 */
export async function redirectToCheckout(
  target: CheckoutTarget,
  interval: BillingInterval = 'month',
): Promise<CheckoutResult> {
  const result = await createCheckoutSession(target, interval);
  if (result.ok) {
    window.location.assign(result.checkoutUrl);
  }
  return result;
}
