# Phase 2: New Block Types + Ink Monetization + AI Date Fix

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 5 interactive block types (PROGRESS_BAR, RATING, WATER_TRACKER, SECTION_NAV, KANBAN), replace the generation-count system with an Ink virtual currency, make all pricing admin-customizable, and fix AI multi-page date bug.

**Architecture:** Extend core types + Zod schemas + Gemini response schema with 5 new block data interfaces. Add `inkBalance`/`inkPurchased` fields to users table + new `appSettings` table for admin-controlled pricing. Replace `incrementAiUsage` with `spendInk` mutation. Add cost preview before generation.

**Tech Stack:** TypeScript, React 19, Zod, Convex.dev, Tailwind CSS, Google Gemini API

---

## Task 1: Add 5 New Block Types to Core Types

**Files:**
- Modify: `packages/core/src/types.ts:1-137`

**Step 1: Add enum values**

Add to `BlockType` enum after `DAILY_SECTION`:

```typescript
PROGRESS_BAR = 'PROGRESS_BAR',
RATING = 'RATING',
WATER_TRACKER = 'WATER_TRACKER',
SECTION_NAV = 'SECTION_NAV',
KANBAN = 'KANBAN',
```

**Step 2: Add data interfaces**

Add after `DailySectionData` interface (line ~108):

```typescript
export interface ProgressBarData {
  label: string;
  current: number;       // 0-100
  target: string;        // e.g. "$5,000"
  color: string;         // theme color
}

export interface RatingData {
  label: string;
  max: number;           // 5 or 10
  value: number;         // current rating
  style: 'star' | 'circle' | 'heart';
}

export interface WaterTrackerData {
  goal: number;          // glasses per day (default 8)
  filled: number;        // how many filled
}

export interface SectionNavData {
  sections: Array<{ label: string; icon?: string; pageIndex?: number }>;
}

export interface KanbanCard {
  id: string;
  text: string;
  checked?: boolean;
}

export interface KanbanColumn {
  title: string;
  color: string;
  cards: KanbanCard[];
}

export interface KanbanData {
  columns: KanbanColumn[];
}
```

**Step 3: Add fields to Block interface**

Add to `Block` interface after `dailySectionData`:

```typescript
progressBarData?: ProgressBarData;
ratingData?: RatingData;
waterTrackerData?: WaterTrackerData;
sectionNavData?: SectionNavData;
kanbanData?: KanbanData;
```

**Step 4: Commit**

```bash
git add packages/core/src/types.ts
git commit -m "feat: add 5 new block type interfaces (PROGRESS_BAR, RATING, WATER_TRACKER, SECTION_NAV, KANBAN)"
```

---

## Task 2: Add Zod Schemas for New Block Types

**Files:**
- Modify: `packages/core/src/schemas.ts:1-273`

**Step 1: Add data schemas**

After `DailySectionDataSchema` (line ~137), add:

```typescript
// ProgressBarData
export const ProgressBarDataSchema = z.object({
  label: z.string(),
  current: z.number().min(0).max(100),
  target: z.string(),
  color: z.string(),
});

// RatingData
export const RatingDataSchema = z.object({
  label: z.string(),
  max: z.union([z.literal(5), z.literal(10)]),
  value: z.number().min(0),
  style: z.enum(['star', 'circle', 'heart']),
});

// WaterTrackerData
export const WaterTrackerDataSchema = z.object({
  goal: z.number().min(1).max(20).default(8),
  filled: z.number().min(0),
});

// SectionNavData
export const SectionNavDataSchema = z.object({
  sections: z.array(z.object({
    label: z.string(),
    icon: z.string().optional(),
    pageIndex: z.number().optional(),
  })),
});

// KanbanData
export const KanbanCardSchema = z.object({
  id: z.string(),
  text: z.string(),
  checked: z.boolean().optional(),
});

export const KanbanColumnSchema = z.object({
  title: z.string(),
  color: z.string(),
  cards: z.array(KanbanCardSchema),
});

export const KanbanDataSchema = z.object({
  columns: z.array(KanbanColumnSchema),
});
```

**Step 2: Update BlockTypeSchema enum**

Add to the enum array:

```typescript
'PROGRESS_BAR', 'RATING', 'WATER_TRACKER', 'SECTION_NAV', 'KANBAN',
```

**Step 3: Update BlockSchema**

Add after `dailySectionData` field:

```typescript
progressBarData: ProgressBarDataSchema.optional(),
ratingData: RatingDataSchema.optional(),
waterTrackerData: WaterTrackerDataSchema.optional(),
sectionNavData: SectionNavDataSchema.optional(),
kanbanData: KanbanDataSchema.optional(),
```

**Step 4: Update AILayoutResponseSchema blocks**

Add to the block object schema inside `AILayoutResponseSchema`:

```typescript
progressBarData: ProgressBarDataSchema.optional().nullable(),
ratingData: RatingDataSchema.optional().nullable(),
waterTrackerData: WaterTrackerDataSchema.optional().nullable(),
sectionNavData: SectionNavDataSchema.optional().nullable(),
kanbanData: KanbanDataSchema.optional().nullable(),
```

**Step 5: Add inferred types at bottom**

```typescript
export type ProgressBarDataZ = z.infer<typeof ProgressBarDataSchema>;
export type RatingDataZ = z.infer<typeof RatingDataSchema>;
export type WaterTrackerDataZ = z.infer<typeof WaterTrackerDataSchema>;
export type SectionNavDataZ = z.infer<typeof SectionNavDataSchema>;
export type KanbanCardZ = z.infer<typeof KanbanCardSchema>;
export type KanbanColumnZ = z.infer<typeof KanbanColumnSchema>;
export type KanbanDataZ = z.infer<typeof KanbanDataSchema>;
```

**Step 6: Commit**

```bash
git add packages/core/src/schemas.ts
git commit -m "feat: add Zod validation schemas for 5 new block types"
```

---

## Task 3: Build 5 Interactive React Components

**Files:**
- Create: `packages/web/src/components/planner/ProgressBarBlock.tsx`
- Create: `packages/web/src/components/planner/RatingBlock.tsx`
- Create: `packages/web/src/components/planner/WaterTrackerBlock.tsx`
- Create: `packages/web/src/components/planner/SectionNavBlock.tsx`
- Create: `packages/web/src/components/planner/KanbanBlock.tsx`

All 5 components follow the same pattern as existing planner blocks (e.g., `WeeklyViewBlock.tsx`):

```typescript
interface XxxBlockProps {
  block: Block;
  onChange: (id: string, updatedBlock: Partial<Block>) => void;
  colorClasses: { text: string; bg: string; border: string; highlight: string; focusBg: string; hoverHighlight: string; };
}
```

### 3a: ProgressBarBlock

Interactive horizontal bar. User clicks/drags to set percentage.

```typescript
// Key interactions:
// - Click on bar to set current percentage
// - Editable label and target text
// - Color from block.color, animated fill width
```

### 3b: RatingBlock

Star/circle/heart rating. User clicks to rate.

```typescript
// Key interactions:
// - Click star/circle/heart to set value
// - Support max=5 or max=10
// - Style variants: star (★), circle (●), heart (♥)
// - Editable label
```

### 3c: WaterTrackerBlock

8 glass/droplet icons. User clicks to fill/unfill.

```typescript
// Key interactions:
// - Click glass to toggle filled state
// - Goal configurable (default 8)
// - Visual: filled = colored, empty = outline
// - Show "X/Y" counter
```

### 3d: SectionNavBlock

Clickable navigation index with icons.

```typescript
// Key interactions:
// - Click section to navigate (onNavigate callback)
// - Editable labels
// - Optional emoji/icon per section
// - Add/remove sections
```

### 3e: KanbanBlock

3-4 column card board with drag-and-drop.

```typescript
// Key interactions:
// - Add cards to columns via input
// - Delete cards
// - Toggle card checked state
// - Editable column titles
// - Simple move: click card → pick target column (no complex DnD library needed for MVP)
```

**Step: Commit**

```bash
git add packages/web/src/components/planner/ProgressBarBlock.tsx \
       packages/web/src/components/planner/RatingBlock.tsx \
       packages/web/src/components/planner/WaterTrackerBlock.tsx \
       packages/web/src/components/planner/SectionNavBlock.tsx \
       packages/web/src/components/planner/KanbanBlock.tsx
git commit -m "feat: add 5 interactive planner block components"
```

---

## Task 4: Wire New Blocks into BlockComponent

**Files:**
- Modify: `packages/web/src/components/BlockComponent.tsx:1-400`

**Step 1: Add imports**

```typescript
import { ProgressBarBlock } from './planner/ProgressBarBlock';
import { RatingBlock } from './planner/RatingBlock';
import { WaterTrackerBlock } from './planner/WaterTrackerBlock';
import { SectionNavBlock } from './planner/SectionNavBlock';
import { KanbanBlock } from './planner/KanbanBlock';
```

**Step 2: Add switch cases**

After the `DAILY_SECTION` case (line ~396), add:

```typescript
{block.type === BlockType.PROGRESS_BAR && (
  <ProgressBarBlock block={block} onChange={onChange} colorClasses={colorClasses} />
)}

{block.type === BlockType.RATING && (
  <RatingBlock block={block} onChange={onChange} colorClasses={colorClasses} />
)}

{block.type === BlockType.WATER_TRACKER && (
  <WaterTrackerBlock block={block} onChange={onChange} colorClasses={colorClasses} />
)}

{block.type === BlockType.SECTION_NAV && (
  <SectionNavBlock block={block} onChange={onChange} colorClasses={colorClasses} allPages={allPages} onNavigate={onNavigate} />
)}

{block.type === BlockType.KANBAN && (
  <KanbanBlock block={block} onChange={onChange} colorClasses={colorClasses} />
)}
```

**Step 3: Commit**

```bash
git add packages/web/src/components/BlockComponent.tsx
git commit -m "feat: wire 5 new block types into BlockComponent renderer"
```

---

## Task 5: Update Gemini Response Schema + Prompt

**Files:**
- Modify: `packages/convex/convex/http.ts:604-730` (blockSchema + prompt)

**Step 1: Add new types to blockSchema enum**

Update line 610 to include:

```typescript
enum: ["TEXT", "HEADING", "GRID", "CHECKBOX", "CALLOUT", "QUOTE", "DIVIDER",
       "MOOD_TRACKER", "PRIORITY_MATRIX", "INDEX", "MUSIC_STAFF", "CALENDAR",
       "WEEKLY_VIEW", "HABIT_TRACKER", "GOAL_SECTION", "TIME_BLOCK", "DAILY_SECTION",
       "PROGRESS_BAR", "RATING", "WATER_TRACKER", "SECTION_NAV", "KANBAN"],
```

**Step 2: Add data schemas to blockSchema properties**

```typescript
progressBarData: {
  type: "OBJECT" as const,
  properties: {
    label: { type: "STRING" as const },
    current: { type: "NUMBER" as const },
    target: { type: "STRING" as const },
    color: { type: "STRING" as const },
  },
  nullable: true,
},
ratingData: {
  type: "OBJECT" as const,
  properties: {
    label: { type: "STRING" as const },
    max: { type: "NUMBER" as const },
    value: { type: "NUMBER" as const },
    style: { type: "STRING" as const, enum: ["star", "circle", "heart"] },
  },
  nullable: true,
},
waterTrackerData: {
  type: "OBJECT" as const,
  properties: {
    goal: { type: "NUMBER" as const },
    filled: { type: "NUMBER" as const },
  },
  nullable: true,
},
sectionNavData: {
  type: "OBJECT" as const,
  properties: {
    sections: { type: "ARRAY" as const, items: { type: "OBJECT" as const, properties: {
      label: { type: "STRING" as const },
      icon: { type: "STRING" as const },
      pageIndex: { type: "NUMBER" as const },
    } } },
  },
  nullable: true,
},
kanbanData: {
  type: "OBJECT" as const,
  properties: {
    columns: { type: "ARRAY" as const, items: { type: "OBJECT" as const, properties: {
      title: { type: "STRING" as const },
      color: { type: "STRING" as const },
      cards: { type: "ARRAY" as const, items: { type: "OBJECT" as const, properties: {
        text: { type: "STRING" as const },
        checked: { type: "BOOLEAN" as const },
      } } },
    } } },
  },
  nullable: true,
},
```

**Step 3: Update prompt block usage section**

Add to the `=== BLOCK USAGE ===` section:

```
10. PROGRESS_BAR: Use for savings goals, budget remaining, project completion. Set current (0-100), target label, and color.
11. RATING: Use for satisfaction, quality, mood ratings. Use star style for reviews, heart for wellness, circle for neutral. Set max=5 for quick ratings, max=10 for detailed.
12. WATER_TRACKER: Use for daily wellness pages. Default goal=8. Set filled=0 for fresh trackers.
13. SECTION_NAV: Use on index/overview pages to link to other pages. Include descriptive labels and optional emoji icons.
14. KANBAN: Use for project management, task boards, workflows. Create 3-4 columns (e.g., "To Do", "In Progress", "Done"). Pre-populate with realistic cards.
```

**Step 4: Commit**

```bash
git add packages/convex/convex/http.ts
git commit -m "feat: add 5 new block types to Gemini response schema + prompt instructions"
```

---

## Task 6: Update Convex Block Schema

**Files:**
- Modify: `packages/convex/convex/schema.ts:69-89`

**Step 1: Add new data fields to blocks table**

After `dailySectionData` (line 88):

```typescript
progressBarData: v.optional(v.any()),
ratingData: v.optional(v.any()),
waterTrackerData: v.optional(v.any()),
sectionNavData: v.optional(v.any()),
kanbanData: v.optional(v.any()),
```

**Step 2: Commit**

```bash
git add packages/convex/convex/schema.ts
git commit -m "feat: add 5 new block data fields to Convex blocks table"
```

---

## Task 7: Fix AI Multi-Page Date Bug

**Files:**
- Modify: `packages/convex/convex/http.ts` (prompt section ~line 566-600)

**Problem:** When generating "weekly planner", AI creates 3 pages all showing "April 5" because the prompt only says `Current Date: ${currentDate}` without explicit multi-page date instructions.

**Step 1: Add explicit date sequencing to PAGE PLANNING section**

Replace the `=== PAGE PLANNING ===` section with stronger date instructions:

```
=== PAGE PLANNING ===
YOU decide how many pages this request needs (1 to 5 pages max per generation).

CRITICAL DATE RULES:
- Current date is ${currentDate}.
- When generating multi-page planners, EACH PAGE must cover a DIFFERENT time period:
  * "weekly planner" → Page 1: "Week of April 6-12", Page 2: "Week of April 13-19", Page 3: "Week of April 20-26"
  * "daily planner" → Page 1: "Monday, April 6", Page 2: "Tuesday, April 7", Page 3: "Wednesday, April 8"
  * "monthly planner" → Page 1: "April 2026 Overview", Page 2: "Week of April 6-12", etc.
- NEVER repeat the same date or date range across multiple pages.
- Calculate the next Monday from ${currentDate} and use that as the start of the first week.
- Use actual calendar math: April has 30 days, days of the week must be correct.
- Fill WEEKLY_VIEW blocks with the correct day labels for that specific week.
- Fill CALENDAR blocks with the correct month/year.

PAGE COUNT GUIDELINES:
- "meeting notes" or "grocery list" → 1 page
- "weekly planner" → 2-3 pages (different weeks or overview + weekly spread)
- "monthly planner" → 4-5 pages (month overview + weekly spreads + reflection)
- "daily planner for the week" → 5 pages (Mon-Fri with correct sequential dates)
- "travel itinerary 3 days" → 3-4 pages (each with correct date)
- "budget tracker" → 3 pages (income + expenses + savings goals/reflection)
```

**Step 2: Commit**

```bash
git add packages/convex/convex/http.ts
git commit -m "fix: AI multi-page date sequencing — each page covers different time period"
```

---

## Task 8: Add Ink System to Convex Schema

**Files:**
- Modify: `packages/convex/convex/schema.ts`

**Step 1: Update users table — replace generation fields with Ink fields**

Replace `aiGenerationsUsed` and `aiGenerationsResetAt` with:

```typescript
// Ink system
inkBalance: v.optional(v.number()),         // total available ink (subscription + purchased)
inkSubscription: v.optional(v.number()),    // monthly ink from plan (resets monthly)
inkPurchased: v.optional(v.number()),       // separately purchased ink (never expires unless 12mo inactive)
inkResetAt: v.optional(v.string()),         // when subscription ink last reset
inkLastActivity: v.optional(v.string()),    // last time user spent ink (for 12mo expiry)
```

**Step 2: Update plan field to new tiers**

```typescript
plan: v.union(v.literal("free"), v.literal("pro"), v.literal("creator")),
```

**Step 3: Add appSettings table for admin-controlled pricing**

```typescript
appSettings: defineTable({
  key: v.string(),    // e.g. "plans", "inkCosts", "inkPacks"
  value: v.any(),     // JSON config
  updatedAt: v.string(),
  updatedBy: v.optional(v.id("users")),
}).index("by_key", ["key"]),
```

**Step 4: Add inkTransactions table for audit trail**

```typescript
inkTransactions: defineTable({
  userId: v.id("users"),
  type: v.union(
    v.literal("subscription_refill"),
    v.literal("purchase"),
    v.literal("spend"),
    v.literal("reward"),
    v.literal("admin_grant"),
    v.literal("admin_deduct"),
  ),
  amount: v.number(),           // positive = credit, negative = debit
  balance: v.number(),          // balance after transaction
  action: v.optional(v.string()), // "layout", "cover", "advanced_layout" etc.
  description: v.optional(v.string()),
  createdAt: v.string(),
}).index("by_user", ["userId"]).index("by_type", ["type"]),
```

**Step 5: Commit**

```bash
git add packages/convex/convex/schema.ts
git commit -m "feat: add Ink wallet system to Convex schema — users, appSettings, inkTransactions"
```

---

## Task 9: Implement Ink Backend Mutations

**Files:**
- Modify: `packages/convex/convex/users.ts`

**Step 1: Replace PLAN_LIMITS with default Ink config**

```typescript
export const DEFAULT_INK_CONFIG = {
  plans: {
    free:    { inkPerMonth: 12,  notebooks: 1,   rolloverMax: 0   },
    pro:     { inkPerMonth: 120, notebooks: 999, rolloverMax: 60  },
    creator: { inkPerMonth: 350, notebooks: 999, rolloverMax: 150 },
  },
  costs: {
    layout: 1,
    advanced_layout: 2,
    cover: 4,
    premium_cover: 6,
  },
  packs: [
    { id: 'pack_25',  ink: 25,  price: 399  },  // cents
    { id: 'pack_75',  ink: 75,  price: 899  },
    { id: 'pack_200', ink: 200, price: 1999 },
    { id: 'pack_500', ink: 500, price: 4499 },
  ],
} as const;
```

**Step 2: Add `getInkConfig` query**

Reads from `appSettings` table, falls back to `DEFAULT_INK_CONFIG`.

**Step 3: Add `spendInk` mutation**

Replaces `incrementAiUsage`. Takes `action` param (e.g. "layout"). Checks balance, deducts, logs transaction.

**Step 4: Add `refillSubscriptionInk` mutation**

Called on login or monthly cron. Resets subscription ink with rollover logic.

**Step 5: Add `purchaseInk` mutation**

Adds purchased ink to balance. Logs transaction.

**Step 6: Add `getInkBalance` query**

Returns `{ subscription, purchased, total, plan }`.

**Step 7: Add admin mutations**

- `adminUpdateInkConfig` — save to appSettings table
- `adminGrantInk` — manually add ink to a user
- `adminDeductInk` — manually remove ink

**Step 8: Commit**

```bash
git add packages/convex/convex/users.ts
git commit -m "feat: implement Ink wallet mutations — spend, refill, purchase, admin controls"
```

---

## Task 10: Update Generate-Layout Endpoint for Ink

**Files:**
- Modify: `packages/convex/convex/http.ts` (lines 430-460)

**Step 1: Replace `incrementAiUsage` with `spendInk`**

```typescript
// Before generation, check ink
const inkConfig = await ctx.runQuery(api.users.getInkConfig, {});
const cost = inkConfig.costs.layout; // or advanced_layout based on request
const spendResult = await ctx.runMutation(api.users.spendInk, {
  sessionToken,
  action: "layout",
  amount: cost,
});
if (!spendResult.allowed) {
  return new Response(
    JSON.stringify({
      error: "Not enough Ink",
      inkRequired: cost,
      inkBalance: spendResult.balance,
    }),
    { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

**Step 2: Add cost preview endpoint**

New route `POST /api/ink/preview`:
```typescript
// Takes { action: "layout" | "cover" | ... }
// Returns { cost: number, balance: number, canAfford: boolean }
```

**Step 3: Commit**

```bash
git add packages/convex/convex/http.ts
git commit -m "feat: replace generation counter with Ink spending in layout endpoint"
```

---

## Task 11: Build Ink Wallet UI Component

**Files:**
- Create: `packages/web/src/components/InkWallet.tsx`

**Implementation:**
- Displays ink balance (droplet icon + number)
- Shows breakdown: subscription ink / purchased ink
- "Buy Ink" button opens pack selection
- Used in Dashboard header

**Step: Commit**

```bash
git add packages/web/src/components/InkWallet.tsx
git commit -m "feat: add InkWallet UI component with balance display"
```

---

## Task 12: Add Cost Confirmation to LayoutGenerator

**Files:**
- Modify: `packages/web/src/components/LayoutGenerator.tsx`
- Modify: `packages/web/src/services/geminiService.ts`

**Step 1: Add ink preview call before generation**

In `geminiService.ts`, add `previewInkCost(action)` function that calls `/api/ink/preview`.

**Step 2: Show cost in LayoutGenerator modal**

Before the "Generate" button, show:
```
This will use 1 Ink. You have 47 Ink remaining.
[Generate] [Cancel]
```

If not enough ink:
```
This requires 1 Ink but you have 0. [Buy Ink] [Cancel]
```

**Step 3: Commit**

```bash
git add packages/web/src/components/LayoutGenerator.tsx packages/web/src/services/geminiService.ts
git commit -m "feat: show Ink cost preview before AI generation"
```

---

## Task 13: Update Admin Panel with Ink Controls

**Files:**
- Modify: `packages/web/src/components/AdminPanel.tsx`

**Step 1: Add "Ink Economy" tab/section**

Admin can edit:
- Plan ink amounts (free: 12, pro: 120, creator: 350)
- Action costs (layout: 1, cover: 4, etc.)
- Pack prices (25 ink = $3.99, etc.)
- All saved via `adminUpdateInkConfig` mutation

**Step 2: Update user table**

- Show ink balance instead of "AI Usage"
- Show plan as free/pro/creator (not old starter/founder)
- "Grant Ink" and "Deduct Ink" actions per user

**Step 3: Commit**

```bash
git add packages/web/src/components/AdminPanel.tsx
git commit -m "feat: add Ink economy controls to admin panel"
```

---

## Task 14: Update PricingPage for New Plans

**Files:**
- Modify: `packages/web/src/components/PricingPage.tsx`

**Step 1: Replace old plans with new Ink-based tiers**

- Free: $0, 12 Ink/month, 1 notebook, watermark on exports
- Pro: $9.99/month, 120 Ink/month, unlimited notebooks, full export
- Creator: $19.99/month, 350 Ink/month, marketplace publishing, priority queue

**Step 2: Add Ink pack cards below plans**

Show 4 packs: 25/$3.99, 75/$8.99, 200/$19.99, 500/$44.99

**Step 3: Commit**

```bash
git add packages/web/src/components/PricingPage.tsx
git commit -m "feat: update pricing page with Ink-based plans and top-up packs"
```

---

## Task 15: Add Admin HTTP Endpoints for Ink

**Files:**
- Modify: `packages/convex/convex/http.ts`

**New routes:**
- `GET /api/ink/config` — get current Ink pricing config
- `POST /api/ink/preview` — preview cost before action
- `POST /api/admin/ink-config` — update Ink config (admin only)
- `POST /api/admin/grant-ink` — add ink to user (admin only)

**Step: Commit**

```bash
git add packages/convex/convex/http.ts
git commit -m "feat: add Ink API endpoints — config, preview, admin grant"
```

---

## Task 16: Data Migration — Old Plans to New

**Files:**
- Modify: `packages/convex/convex/users.ts`

**Step 1: Add migration mutation**

```typescript
export const migrateToInkSystem = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    for (const u of users) {
      const planMap: Record<string, string> = {
        starter: "pro",
        founder: "creator",
      };
      const newPlan = planMap[u.plan] || u.plan;
      const inkConfig = DEFAULT_INK_CONFIG.plans[newPlan as keyof typeof DEFAULT_INK_CONFIG.plans];
      await ctx.db.patch(u._id, {
        plan: newPlan as any,
        inkBalance: inkConfig?.inkPerMonth ?? 12,
        inkSubscription: inkConfig?.inkPerMonth ?? 12,
        inkPurchased: 0,
        inkResetAt: new Date().toISOString(),
        inkLastActivity: new Date().toISOString(),
      });
    }
  },
});
```

**Step 2: Seed appSettings with default Ink config**

```typescript
export const seedInkConfig = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("appSettings")
      .withIndex("by_key", q => q.eq("key", "inkConfig"))
      .first();
    if (!existing) {
      await ctx.db.insert("appSettings", {
        key: "inkConfig",
        value: DEFAULT_INK_CONFIG,
        updatedAt: new Date().toISOString(),
      });
    }
  },
});
```

**Step 3: Commit**

```bash
git add packages/convex/convex/users.ts
git commit -m "feat: add migration mutations for old plan system to Ink system"
```

---

## Execution Order Summary

| # | Task | Type | Dependencies |
|---|------|------|-------------|
| 1 | Core types — 5 block interfaces | Schema | None |
| 2 | Zod schemas — 5 block validators | Schema | Task 1 |
| 3 | 5 React components | Frontend | Task 1 |
| 4 | Wire into BlockComponent | Frontend | Task 3 |
| 5 | Gemini schema + prompt | Backend | Task 1 |
| 6 | Convex blocks table | Backend | Task 1 |
| 7 | Fix AI date bug | Backend | None |
| 8 | Ink schema (users + appSettings + transactions) | Schema | None |
| 9 | Ink backend mutations | Backend | Task 8 |
| 10 | Update generate-layout for Ink | Backend | Task 9 |
| 11 | InkWallet UI | Frontend | Task 9 |
| 12 | Cost confirmation in LayoutGenerator | Frontend | Task 10, 11 |
| 13 | Admin panel Ink controls | Frontend | Task 9 |
| 14 | PricingPage update | Frontend | Task 8 |
| 15 | Ink API endpoints | Backend | Task 9 |
| 16 | Data migration | Backend | Task 8, 9 |

**Parallelizable groups:**
- Tasks 1-2 (schemas) → then 3-6 in parallel (components + Gemini + Convex)
- Task 7 (date fix) — independent, can run anytime
- Tasks 8-9 (Ink foundation) → then 10-16 branch out
