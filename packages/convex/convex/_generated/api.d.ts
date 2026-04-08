/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as affiliateHttp from "../affiliateHttp.js";
import type * as affiliates from "../affiliates.js";
import type * as aiGenerations from "../aiGenerations.js";
import type * as authHelpers from "../authHelpers.js";
import type * as blocks from "../blocks.js";
import type * as community from "../community.js";
import type * as domainDetection from "../domainDetection.js";
import type * as http from "../http.js";
import type * as notebooks from "../notebooks.js";
import type * as pages from "../pages.js";
import type * as planLimits from "../planLimits.js";
import type * as rateLimit from "../rateLimit.js";
import type * as referenceLayouts from "../referenceLayouts.js";
import type * as siteConfig from "../siteConfig.js";
import type * as stripeWebhook from "../stripeWebhook.js";
import type * as users from "../users.js";
import type * as waitlist from "../waitlist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  affiliateHttp: typeof affiliateHttp;
  affiliates: typeof affiliates;
  aiGenerations: typeof aiGenerations;
  authHelpers: typeof authHelpers;
  blocks: typeof blocks;
  community: typeof community;
  domainDetection: typeof domainDetection;
  http: typeof http;
  notebooks: typeof notebooks;
  pages: typeof pages;
  planLimits: typeof planLimits;
  rateLimit: typeof rateLimit;
  referenceLayouts: typeof referenceLayouts;
  siteConfig: typeof siteConfig;
  stripeWebhook: typeof stripeWebhook;
  users: typeof users;
  waitlist: typeof waitlist;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
