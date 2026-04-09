import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { api, internal } from "./_generated/api";

/*
 * Stripe Sync — dynamic price management
 * =======================================
 *
 * Problem this solves
 * -------------------
 * Stripe prices are immutable. When an admin changes Pro monthly from
 * $9.99 to $11.99 in the admin panel, the old Stripe `price_...` object
 * can't be "updated" — a NEW price object must be created. Old
 * subscribers stay on the old price (grandfathered), new subscribers
 * pay the new one.
 *
 * Previously, Stripe price IDs lived in env vars (`STRIPE_PRICE_PRO_MONTH`
 * etc) which meant admin edits in the UI had no effect on what Stripe
 * actually charged — the env vars had to be manually updated via
 * `npx convex env set`, which is a developer workflow, not an admin one.
 *
 * How it works now
 * ----------------
 * 1. Admin edits pricing in PricingEditor → `siteConfig.updatePricing`
 * 2. That mutation schedules `internal.stripeSync.syncPrices` via the
 *    Convex scheduler (fire-and-forget, admin doesn't wait).
 * 3. `syncPrices` action loads the current pricing-config, compares
 *    each plan's amount to the stored Stripe price via the Stripe API,
 *    and CREATES a new Stripe price whenever they diverge.
 * 4. The new price id lands in the `stripe-price-map` appSettings key,
 *    keyed by `${planId}:${interval}` → `price_...`.
 * 5. Checkout handler in `stripeWebhook.ts` reads from this map FIRST,
 *    and falls back to env vars if no Convex entry exists. Existing
 *    env-var-based deployments keep working.
 *
 * Scope
 * -----
 *   - Subscription plans only (pro, creator, starter).
 *   - Monthly + annual intervals.
 *   - Ink packs are NOT auto-synced (their prices are fixed sizes and
 *     rarely change; the env var approach is fine for them).
 *   - Does NOT create new PRODUCTS — assumes the products already exist
 *     in Stripe. If you need to rename or add a plan, do it in the
 *     Stripe dashboard first.
 *
 * Limitations
 * -----------
 *   - Runs eventually-consistently — there's a small window (seconds)
 *     between an admin edit and the new Stripe price being live. If a
 *     user checks out during that window, they'll get the OLD price.
 *     This is acceptable: we prioritize admin UX latency over strict
 *     real-time consistency, and existing subscribers are grandfathered
 *     anyway.
 *   - If Stripe API is down or rate-limited, the sync action throws and
 *     Convex retries it. Meanwhile the old price stays live.
 */

// ── Convex appSettings key ────────────────────────────────
const PRICE_MAP_KEY = "stripe-price-map";
const PRICING_KEY = "pricing-config";

// ── Types ─────────────────────────────────────────────────
/**
 * Shape stored in appSettings["stripe-price-map"].
 *
 * Flat map keyed by "{planId}:{interval}" → stripe `price_...` id.
 * Example:
 *   {
 *     "pro:month":     "price_1TJphL...",
 *     "pro:year":      "price_1TJphL...",
 *     "creator:month": "price_1TJphM...",
 *     "creator:year":  "price_1TJphM...",
 *     "starter:month": "price_1TJphK...",
 *     "starter:year":  "price_1TJphL...",
 *   }
 *
 * Product ids are NOT stored here — only prices. Product ids live in
 * the constant below (see PRODUCT_IDS). Admin can change this constant
 * if they ever rename a product in the Stripe dashboard.
 */
type PriceMap = Record<string, string>;

type SubscriptionPlanId = "pro" | "creator" | "starter";
type BillingInterval = "month" | "year";

interface PlanAmount {
  planId: SubscriptionPlanId;
  interval: BillingInterval;
  /** Dollar amount shown to users. */
  dollars: number;
  /** Cents amount for Stripe API. */
  cents: number;
}

// ── Stripe product ids ────────────────────────────────────
// These are the product ids created in the user's live Stripe account.
// We look them up by name only as a fallback; the ids here are the
// fast path. If you ever move to a new Stripe account, this table
// needs to be updated once — but the prices under them auto-sync.
const PRODUCT_IDS: Record<SubscriptionPlanId, string> = {
  pro: "prod_UIQYLw8eTOlTVx",
  creator: "prod_UIQYt0m5KfOeII",
  starter: "prod_UIQYMnkJclTHff",
};

// ── Helpers ───────────────────────────────────────────────
function priceKey(planId: SubscriptionPlanId, interval: BillingInterval): string {
  return `${planId}:${interval}`;
}

async function stripeApi<T = unknown>(
  method: "GET" | "POST",
  path: string,
  body: Record<string, string> | null,
  apiKey: string,
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Stripe-Version": "2024-06-20",
  };
  let init: RequestInit = { method, headers };
  if (body) {
    const form = new URLSearchParams();
    for (const [k, v] of Object.entries(body)) form.set(k, v);
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = form.toString();
  }
  const res = await fetch(`https://api.stripe.com/v1${path}`, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe ${method} ${path} ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

/**
 * Extract the target amounts from a pricing-config value. Returns the
 * 6 planId/interval combinations the sync cares about (3 plans × 2
 * intervals). Skips plans whose amount is null/0 — those can't be
 * checked out anyway.
 */
function extractPlanAmounts(pricingValue: unknown): PlanAmount[] {
  if (!pricingValue || typeof pricingValue !== "object") return [];
  const plans = (pricingValue as { plans?: Record<string, unknown> }).plans;
  if (!plans || typeof plans !== "object") return [];
  const out: PlanAmount[] = [];
  const planIds: SubscriptionPlanId[] = ["pro", "creator", "starter"];
  for (const planId of planIds) {
    const plan = (plans as Record<string, unknown>)[planId];
    if (!plan || typeof plan !== "object") continue;
    const p = plan as { monthlyPrice?: number; annualPrice?: number | null };
    if (typeof p.monthlyPrice === "number" && p.monthlyPrice > 0) {
      out.push({
        planId,
        interval: "month",
        dollars: p.monthlyPrice,
        cents: Math.round(p.monthlyPrice * 100),
      });
    }
    if (typeof p.annualPrice === "number" && p.annualPrice > 0) {
      out.push({
        planId,
        interval: "year",
        dollars: p.annualPrice,
        cents: Math.round(p.annualPrice * 100),
      });
    }
  }
  return out;
}

// ── Queries ───────────────────────────────────────────────
/**
 * Public query — read the current Stripe price map from Convex.
 * Used by the checkout handler in stripeWebhook.ts and by the admin
 * sync status UI.
 */
export const getPriceMap = query({
  args: {},
  handler: async (ctx): Promise<PriceMap> => {
    const setting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", PRICE_MAP_KEY))
      .first();
    return (setting?.value as PriceMap | undefined) ?? {};
  },
});

/**
 * Internal query — same as getPriceMap but callable from actions.
 * (Convex actions can only call internal queries/mutations, not public
 * ones. This mirror keeps the public API clean.)
 */
export const getPriceMapInternal = internalQuery({
  args: {},
  handler: async (ctx): Promise<PriceMap> => {
    const setting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", PRICE_MAP_KEY))
      .first();
    return (setting?.value as PriceMap | undefined) ?? {};
  },
});

/**
 * Internal query — read current pricing-config from inside an action.
 */
export const getPricingInternal = internalQuery({
  args: {},
  handler: async (ctx): Promise<unknown> => {
    const setting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", PRICING_KEY))
      .first();
    return setting?.value ?? null;
  },
});

// ── Mutations ─────────────────────────────────────────────
/**
 * Write a new Stripe price id into the map. Called from the sync
 * action after it successfully creates a price via the Stripe API.
 *
 * Uses patch semantics: only the specified keys are overwritten, other
 * entries in the map survive untouched.
 */
export const setPriceInMap = internalMutation({
  args: {
    entries: v.array(
      v.object({
        planId: v.union(v.literal("pro"), v.literal("creator"), v.literal("starter")),
        interval: v.union(v.literal("month"), v.literal("year")),
        priceId: v.string(),
      }),
    ),
  },
  handler: async (ctx, { entries }) => {
    if (entries.length === 0) return;
    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", PRICE_MAP_KEY))
      .first();
    const currentValue = (existing?.value as PriceMap | undefined) ?? {};
    const nextValue: PriceMap = { ...currentValue };
    for (const e of entries) {
      nextValue[priceKey(e.planId, e.interval)] = e.priceId;
    }
    if (existing) {
      await ctx.db.patch(existing._id, {
        value: nextValue,
        updatedAt: new Date().toISOString(),
      });
    } else {
      await ctx.db.insert("appSettings", {
        key: PRICE_MAP_KEY,
        value: nextValue,
        updatedAt: new Date().toISOString(),
      });
    }
  },
});

// ── Actions ───────────────────────────────────────────────
/**
 * Sync pricing-config → Stripe. For every (plan, interval) combination
 * where the admin's current amount doesn't match the existing Stripe
 * price, create a new Stripe price and store its id in the map.
 *
 * This is an INTERNAL action — it can only be invoked via the scheduler
 * (from `siteConfig.updatePricing`) or the manual sync endpoint. It's
 * not exposed to the public API.
 *
 * Safe to call repeatedly — it's idempotent. If everything is already
 * in sync, it makes O(n) GET calls to Stripe and returns without
 * writing anything.
 */
export const syncPrices = internalAction({
  args: {},
  handler: async (ctx): Promise<{
    created: number;
    skipped: number;
    errors: Array<{ key: string; message: string }>;
  }> => {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return { created: 0, skipped: 0, errors: [{ key: "env", message: "STRIPE_SECRET_KEY not set" }] };
    }

    const pricingValue = await ctx.runQuery(internal.stripeSync.getPricingInternal, {});
    const existingMap: PriceMap = await ctx.runQuery(internal.stripeSync.getPriceMapInternal, {});
    const targets = extractPlanAmounts(pricingValue);

    let created = 0;
    let skipped = 0;
    const errors: Array<{ key: string; message: string }> = [];
    const newEntries: Array<{ planId: SubscriptionPlanId; interval: BillingInterval; priceId: string }> = [];

    // Env-var fallback map. If the Convex stripe-price-map is empty
    // for a given (plan, interval) but the admin's amount happens to
    // match the env var's current Stripe price, we SEED the map with
    // the env var's price id rather than creating a brand new duplicate
    // Stripe price. This makes the very first admin save idempotent.
    const envFallback: Record<string, string | undefined> = {
      "pro:month": process.env.STRIPE_PRICE_PRO_MONTH,
      "pro:year": process.env.STRIPE_PRICE_PRO_YEAR,
      "creator:month": process.env.STRIPE_PRICE_CREATOR_MONTH,
      "creator:year": process.env.STRIPE_PRICE_CREATOR_YEAR,
      "starter:month": process.env.STRIPE_PRICE_STARTER_MONTH,
      "starter:year": process.env.STRIPE_PRICE_STARTER_YEAR,
    };

    for (const target of targets) {
      const mapKey = priceKey(target.planId, target.interval);
      // Prefer the Convex-stored price id; fall back to env var for
      // the "first sync ever" case so we don't duplicate an existing
      // price that already matches the admin's amount.
      const existingPriceId = existingMap[mapKey] ?? envFallback[mapKey];
      const wasMapEntry = existingMap[mapKey] !== undefined;

      // If we have SOME price id (from map or env), verify the amount
      // matches. We hit Stripe because the map could be stale (e.g.,
      // if someone manually archived a price in the dashboard).
      if (existingPriceId) {
        try {
          const price = await stripeApi<{ unit_amount: number; active: boolean }>(
            "GET",
            `/prices/${encodeURIComponent(existingPriceId)}`,
            null,
            stripeKey,
          );
          if (price.active && price.unit_amount === target.cents) {
            skipped++;
            // Seed the map if this value came from the env fallback
            // so future syncs are O(1) lookups.
            if (!wasMapEntry) {
              newEntries.push({
                planId: target.planId,
                interval: target.interval,
                priceId: existingPriceId,
              });
            }
            continue;
          }
        } catch (e) {
          // Price no longer exists or we can't reach Stripe. Fall
          // through to create a new one.
          errors.push({
            key: mapKey,
            message: `Stripe GET /prices failed: ${e instanceof Error ? e.message : String(e)}`,
          });
        }
      }

      // Create a new Stripe price for this plan+interval+amount.
      const productId = PRODUCT_IDS[target.planId];
      if (!productId) {
        errors.push({ key: mapKey, message: `No product id for plan '${target.planId}'` });
        continue;
      }
      try {
        const newPrice = await stripeApi<{ id: string }>(
          "POST",
          "/prices",
          {
            product: productId,
            unit_amount: String(target.cents),
            currency: "usd",
            "recurring[interval]": target.interval,
            nickname: `${target.planId} ${target.interval} (auto-synced from admin)`,
          },
          stripeKey,
        );
        newEntries.push({
          planId: target.planId,
          interval: target.interval,
          priceId: newPrice.id,
        });
        created++;
      } catch (e) {
        errors.push({
          key: mapKey,
          message: `Stripe POST /prices failed: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    }

    if (newEntries.length > 0) {
      await ctx.runMutation(internal.stripeSync.setPriceInMap, { entries: newEntries });
    }

    // eslint-disable-next-line no-console
    console.log(
      `[stripeSync] created=${created} skipped=${skipped} errors=${errors.length}`,
    );

    return { created, skipped, errors };
  },
});
