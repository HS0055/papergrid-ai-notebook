# Product Spec: Smart Multi-Page Generation

**Author:** Product Manager Agent
**Date:** 2026-04-05
**Status:** Draft
**Scope:** AI Page Designer -- multi-page estimation, batched generation, Ink cost model

---

## Problem Statement

The current AI Page Designer lets users pick "1 page", "2-3 pages", or "4-5 pages" and charges a flat 1 Ink regardless. This model breaks down for the most valuable use case: planners.

**Evidence from the codebase:**

- `LayoutGenerator.tsx:52` -- pageCount is a literal union `'1' | '2-3' | '4-5'` with no dynamic estimation
- `http.ts:574` -- the Gemini prompt hardcodes the three page count options into prose instructions
- `http.ts:443-465` -- Ink is spent as a flat `layout: 1` cost before generation starts, regardless of page count
- `users.ts:24-25` -- `DEFAULT_INK_CONFIG.costs.layout = 1` -- no per-page or per-batch scaling
- There is no batching logic anywhere -- a single Gemini API call must produce all pages

**User expectations vs reality:**

| Prompt | User expects | System delivers | Gap |
|--------|-------------|----------------|-----|
| "monthly planner for April" | 30 daily + 1 overview = 31 pages | 4-5 pages max | 26 pages missing |
| "yearly planner 2026" | 52 weekly or 12 monthly pages | 4-5 pages max | 47+ pages missing |
| "daily planner for this week" | 7 pages (Mon-Sun) | 4-5 pages max | 2 pages missing |
| "meeting notes template" | 1 page | 1 page | No gap |

**Technical constraint:** Gemini 3.1 Pro outputs max 65K tokens (default 8K), which practically allows 5-7 richly-detailed pages per API call. Generating 30 pages requires multiple sequential calls with continuation context.

**Business constraint:** Free users get 12 Ink/month. If a 30-page planner costs 1 Ink, the AI cost per Ink becomes unsustainable (30x the Gemini API cost of a 1-page generation for the same price). If it costs 30 Ink, free users can never build a monthly planner. The cost model must be fair and transparent.

---

## Proposed Solution

### Two-Phase Generation Flow

Replace the static page count picker with a **smart estimation step** that runs before generation. The user describes what they want, the system tells them how many pages it will produce and what it will cost, and the user confirms or adjusts before any Ink is spent.

**What this is:**
- A pre-generation estimation endpoint (lightweight, no Ink cost)
- A batched generation system that produces pages in groups of 5
- A transparent cost preview: Ink = number of batches
- A progress UI for multi-batch generation

**What this is NOT:**
- A template marketplace (that is a separate feature)
- A page-by-page editor where users design individual pages
- An "unlimited generation" system -- users still pay Ink

---

## User Stories

### Persona: Maya (Daily Planner User, Pro plan, 120 Ink/month)

**Story 1: Smart estimation before generation**
As Maya, I want to type "weekly planner for April" and see that Papera will generate 5 weekly spreads (overview + 4 weeks) costing 1 Ink, so I can decide before spending anything.

**Story 2: Adjusting page count**
As Maya, I want to reduce the estimated 31 pages for "April daily planner" down to 15 pages (just weekdays) to save Ink, so I stay within my monthly budget.

**Story 3: Batch progress visibility**
As Maya, I want to see "Generating batch 2 of 4... pages 6-10" while a large planner is being built, so I know it is working and how long it will take.

### Persona: Alex (Free plan, 12 Ink/month)

**Story 4: Affordable large planners**
As Alex, I want to generate a 7-page weekly planner for 2 Ink (2 batches), not 7 Ink, so that my 12 monthly Ink can cover real planner use cases.

**Story 5: No surprise costs**
As Alex, I want to see the exact Ink cost before confirming generation, so I never accidentally spend more than I intended.

---

## The Flow (Step by Step)

### Step 1: User enters prompt (unchanged)

The user types their prompt, picks aesthetic and industry. The "Pages to Generate" picker is **removed** -- replaced by the estimation step.

### Step 2: User clicks "Estimate" (new)

Instead of "Generate Pages", the primary CTA becomes **"Plan My Pages"**. This triggers a lightweight API call:

**Request:** `POST /api/estimate-pages`
```json
{
  "prompt": "daily planner for April 2026",
  "industry": "personal",
  "aesthetic": "pastel"
}
```

**Response:**
```json
{
  "estimatedPages": 31,
  "pageBreakdown": [
    { "label": "April Overview", "count": 1 },
    { "label": "Daily Pages (Apr 1-30)", "count": 30 }
  ],
  "batches": 7,
  "inkCost": 7,
  "estimatedTimeSeconds": 105,
  "suggestedAlternatives": [
    { "label": "Weekdays only (22 pages)", "pages": 22, "batches": 5, "ink": 5 },
    { "label": "Weekly spreads (5 pages)", "pages": 5, "batches": 1, "ink": 1 }
  ]
}
```

**How estimation works (server-side):** This is NOT an AI call. It is a deterministic rules engine based on prompt keyword matching:

| Pattern detected | Estimated pages | Logic |
|-----------------|----------------|-------|
| "daily" + month name | days in that month + 1 overview | Calendar math |
| "daily" + "week" | 7 + 1 overview | Fixed |
| "weekly" + month name | ceil(days / 7) + 1 overview | Calendar math |
| "weekly" + year | 52 + 1 overview | Fixed |
| "monthly" + year | 12 + 1 overview | Fixed |
| "meal planner" + "week" | 7 + 1 shopping list | Fixed |
| No temporal pattern | 1 (single page) | Default fallback |
| Explicit number in prompt ("5 pages") | That number | Regex extraction |

This is cheap (no AI call), fast (<50ms), and deterministic. The estimation can be wrong -- that is fine, because the user can adjust it.

### Step 3: Estimation review screen (new)

The modal transitions to show the estimation result. The UI displays:

```
+------------------------------------------+
|  AI Page Designer                    [X]  |
|                                           |
|  "Daily planner for April 2026"           |
|                                           |
|  PLAN SUMMARY                             |
|  ---------------------------------------- |
|  31 pages in 7 batches                    |
|                                           |
|  [=] April Overview           1 page      |
|  [=] Daily Pages (Apr 1-30)  30 pages     |
|                                           |
|  INK COST: 7 Ink                          |
|  Your balance: 120 Ink                    |
|  Estimated time: ~2 minutes               |
|                                           |
|  QUICK ALTERNATIVES                       |
|  [Weekdays only - 5 Ink] [Weekly - 1 Ink] |
|                                           |
|  PAGE COUNT              [-] 31 [+]       |
|                                           |
|  [Back]              [Generate 31 Pages]  |
+------------------------------------------+
```

**Key UI elements:**
- **Page breakdown** -- shows what types of pages will be generated
- **Ink cost** -- prominent, shows cost and current balance
- **Time estimate** -- sets expectations for batch generation (~15s per batch)
- **Quick alternatives** -- pre-computed cheaper options
- **Manual page count adjuster** -- stepper with +/- buttons, min 1, max from estimate
- **Back button** -- returns to prompt editing, no cost
- **Generate button** -- disabled if insufficient Ink, shows exact page count

### Step 4: User confirms, generation starts

When the user clicks "Generate 31 Pages":

1. **Ink is charged upfront** for the full cost (7 Ink for 7 batches)
2. **Batch 1** fires immediately: generates pages 1-5
3. **Pages are inserted into the notebook as each batch completes** -- the user sees pages appearing progressively
4. **Batch 2-7** fire sequentially, each receiving the previous pages as continuation context

### Step 5: Batch generation progress (new)

The modal stays open during generation, showing real-time progress:

```
+------------------------------------------+
|  Generating your planner...          [X]  |
|                                           |
|  [=======>                    ]  29%      |
|  Batch 2 of 7 - Pages 6-10               |
|                                           |
|  PAGES COMPLETED                          |
|  [v] April Overview                       |
|  [v] April 1 - Tuesday                   |
|  [v] April 2 - Wednesday                 |
|  [v] April 3 - Thursday                  |
|  [v] April 4 - Friday                    |
|  [ ] April 5 - Saturday        generating |
|  [ ] April 6 - Sunday                    |
|  [ ] ...26 more pages                    |
|                                           |
|  Pages appear in your notebook as they    |
|  are completed. You can close this and    |
|  browse finished pages.                   |
|                                           |
|  [Close & Browse]     [Stop After Batch]  |
+------------------------------------------+
```

**Key UX decisions:**
- Pages are added to the notebook **as each batch completes**, not all at the end
- User can close the progress modal and browse already-generated pages
- "Stop After Batch" lets the user halt generation after the current batch finishes (no Ink refund for completed batches -- but remaining batches are refunded)
- If a batch fails, the system retries once, then stops and refunds Ink for ungenerated batches

### Step 6: Generation complete

Toast notification: "31 pages generated! Your April planner is ready."

The notebook navigates to the first generated page. The modal closes automatically.

---

## Ink Cost Model Decision

### The Question

Should a 30-page monthly planner cost 1 Ink (current) or 30 Ink (per page)?

### The Answer: Ink per batch (1 Ink = 1 batch of up to 5 pages)

| Model considered | Pros | Cons | Verdict |
|-----------------|------|------|---------|
| **1 Ink flat** (current) | Simple, generous | Unsustainable -- a 30-page request costs 6x the API cost but same price. Incentivizes gaming. | Reject |
| **1 Ink per page** | Fair to cost structure | Punishing -- a weekly planner costs 7 Ink, eating 58% of a free user's monthly budget for one planner | Reject |
| **1 Ink per batch of 5** | Proportional to actual API cost. A 5-page planner = 1 Ink (same as today). A 30-page planner = 6 Ink. | Slightly more complex to explain | **Adopt** |
| **Tiered: 1/2/4 Ink** | Simple tiers | Arbitrary boundaries, becomes wrong for 31-page requests | Reject |

**Rationale:**

- **Maps to real cost:** Each batch is one Gemini API call. 1 Ink = 1 API call = 1-5 pages. This is honest.
- **Preserves current pricing:** All existing users generating 1-5 pages still pay 1 Ink. Zero disruption.
- **Scales linearly:** Users can mentally compute cost: pages / 5, rounded up. "31 pages = 7 Ink."
- **Free plan viability:** 12 Ink/month = up to 60 pages across multiple planners. A weekly planner (8 pages) costs 2 Ink. A free user can generate 6 weekly planners per month. Reasonable.
- **Admin control:** The batch size (5) and Ink-per-batch (1) remain admin-configurable in `appSettings.inkConfig`, no code changes needed to adjust pricing.

**Updated cost table for user-facing display:**

| Action | Ink Cost | Pages included |
|--------|----------|----------------|
| Page generation (per batch) | 1 Ink | Up to 5 pages |
| Advanced layout (per batch) | 2 Ink | Up to 5 pages |
| Cover generation | 4 Ink | 1 cover |

---

## Requirements

### Functional Requirements

**FR-01: Page estimation endpoint**
Add `POST /api/estimate-pages` that accepts a prompt and returns estimated page count, batch count, Ink cost, time estimate, and alternative suggestions. Must respond in <200ms. No AI call -- pure keyword matching and calendar math.

**FR-02: Estimation rules engine**
Implement deterministic rules for temporal pattern matching:
- Parse month names, year numbers, "daily/weekly/monthly" keywords
- Handle edge cases: "next week", "this month", "Q2 2026"
- Extract explicit page counts from prompts ("create 10 pages")
- Default to 1 page when no temporal/quantity pattern is detected
- Return structured breakdown (section labels + counts)

**FR-03: Estimation review UI**
Replace the static page count picker in `LayoutGenerator.tsx` with a two-step flow:
- Step 1: Prompt input (current, minus the 1/2-3/4-5 picker)
- Step 2: Estimation review with breakdown, cost, alternatives, and adjustable page count

**FR-04: Batched generation on server**
Modify the `/api/generate-layout` endpoint in `http.ts` to:
- Accept `totalPages: number` and `batchIndex: number` parameters
- Generate 5 pages per call (configurable via `inkConfig.batchSize`)
- Accept `previousPages` context (titles + paper types of already-generated pages in this job) for continuation
- Charge Ink per batch, not per request

**FR-05: Client-side batch orchestration**
Add batch orchestration logic in `geminiService.ts`:
- Calculate number of batches: `ceil(totalPages / batchSize)`
- Fire batches sequentially (not parallel -- continuation context needed)
- After each batch completes, insert pages into the notebook immediately
- Pass accumulated page summaries as continuation context to next batch
- Handle partial failure: if batch N fails after retry, stop and report

**FR-06: Progress UI**
Add a generation progress component showing:
- Progress bar (batches completed / total batches)
- Current batch number and page range
- Checklist of completed pages
- "Close & Browse" button (closes modal, generation continues in background)
- "Stop After Batch" button (cancels remaining batches, refunds unspent Ink)

**FR-07: Ink refund for cancelled/failed batches**
Add `POST /api/ink/refund` endpoint that refunds Ink for batches that were paid for but not generated (cancellation or failure). Creates an `inkTransaction` with type `"refund"` (new type).

**FR-08: Updated Ink cost display**
Update `PricingPage.tsx` cost table to show "Layout generation (per batch of 5 pages)" instead of just "Layout generation".

### Non-Functional Requirements

**NFR-01: Estimation latency** -- `/api/estimate-pages` must respond in <200ms (no AI call).

**NFR-02: Batch generation reliability** -- Each batch gets 1 automatic retry on failure. After 2 consecutive failed batches, the entire job stops.

**NFR-03: Concurrent generation limit** -- Max 1 active generation job per user (prevent abuse). Return 429 if a job is already running.

**NFR-04: Memory safety** -- The client must not accumulate all pages in memory during generation. Insert each batch into the notebook state immediately and pass only summaries (not full block data) as continuation context.

### Out of Scope

- **Template marketplace integration** -- generated planners are personal, not for sale. Marketplace is a separate feature.
- **Page-level editing in the estimation step** -- users cannot rearrange or customize individual pages before generation. They adjust the count, not the content.
- **Parallel batch generation** -- batches must be sequential for continuation context. Parallel would produce disconnected pages.
- **Gemini streaming** -- streaming individual tokens during generation. The structured JSON response schema requires complete output.
- **Per-page Ink pricing** -- rejected in the cost model analysis above.
- **Generation queue system** -- no background queue infrastructure. Batches are orchestrated client-side with sequential API calls. A proper server-side queue is a later optimization if needed.

---

## Technical Considerations

### Estimation rules engine placement

The rules engine lives server-side in `http.ts` as a pure function (no DB calls, no AI). It is a `switch`/regex matcher, not a Convex action. This keeps it fast and testable.

Alternatively, it could be a Convex query if admin wants to configure estimation rules via `appSettings`. For v1, hardcode the rules.

### Continuation context size

Each batch receives summaries of previously generated pages to maintain coherence. The summary per page is: `{ title, paperType, themeColor }` -- roughly 50 tokens per page. For a 30-page planner at batch 7, the continuation context is ~150 previous page summaries = ~1,500 tokens. This is well within Gemini's 1M input context.

Do NOT pass full block data as continuation context. Only pass titles and types.

### Gemini maxOutputTokens

The current code does not set `maxOutputTokens` in the Gemini payload (`http.ts:762`). The default is 8,192 tokens, which limits output to roughly 3-4 detailed pages. To reliably generate 5 pages per batch:

- Set `maxOutputTokens: 16384` in `generationConfig` (2x headroom over estimated 5-page output)
- This is well within Gemini 3.1 Pro's 65K max

### Schema changes

Add to `inkTransactions.type` union in `schema.ts`:
```
v.literal("refund")
```

Add to `appSettings` inkConfig:
```json
{
  "batchSize": 5,
  "maxPagesPerGeneration": 60
}
```

### Backward compatibility

- Existing 1-5 page generations still work identically (1 batch = 1 Ink)
- The estimation step can be skipped if the user just wants a quick single page (add "Quick Generate - 1 page, 1 Ink" shortcut)
- No migration needed for existing Ink balances or transactions

---

## Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Estimation is wrong (e.g., "monthly planner" means 4 weekly spreads, not 30 daily pages) | High | Low | User can adjust page count. Alternatives offered. Estimation is a suggestion, not a commitment. |
| Batch N fails after batch N-1 succeeded, leaving an incomplete planner | Medium | Medium | Auto-retry once. Refund Ink for failed batches. Show partial results with "Resume" option. |
| User starts 30-page generation and closes the browser tab | Medium | Medium | Pages already inserted survive. Remaining batches are lost. No refund (Ink already spent server-side). Document this in tooltip. |
| Free users feel 7 Ink for a monthly planner is too expensive | Medium | Low | Offer cheaper alternatives in estimation (weekly spreads for 1 Ink). 12 Ink/month was never meant for unlimited large planners. |
| Gemini rate limits on sequential batch calls (RPM limits) | Low | High | Add 2-second delay between batches. Gemini 3.1 Pro allows 10 RPM on free tier, 1000 RPM on paid. Our paid API key should handle it. |

---

## Implementation Phases

### Phase 1: Estimation + Cost Preview (3-4 days)

| Task | Effort | Files |
|------|--------|-------|
| Build estimation rules engine (deterministic, server-side) | 1 day | `http.ts` (new route) |
| Update `LayoutGenerator.tsx` to two-step flow: prompt -> estimate review | 1.5 days | `LayoutGenerator.tsx` |
| Update `geminiService.ts` with `estimatePages()` client function | 0.5 days | `geminiService.ts` |
| Remove static page count picker, add page count adjuster | 0.5 days | `LayoutGenerator.tsx` |

**Ship this first.** Even without batching, users see the correct page estimate and cost. Generations over 5 pages are capped at 5 with a note: "Generating first 5 of 31 pages. Batch generation coming soon."

### Phase 2: Batched Generation (3-4 days)

| Task | Effort | Files |
|------|--------|-------|
| Modify `/api/generate-layout` to accept `totalPages`, `batchIndex`, `previousPages` | 1 day | `http.ts` |
| Build client-side batch orchestrator | 1 day | `geminiService.ts` |
| Update `Dashboard.tsx` to insert pages incrementally per batch | 0.5 days | `Dashboard.tsx` |
| Set `maxOutputTokens: 16384` in Gemini config | 0.5 hours | `http.ts` |
| Update Ink spending to charge per batch | 0.5 days | `users.ts`, `http.ts` |
| Add "refund" transaction type to schema | 0.5 days | `schema.ts`, `users.ts` |

### Phase 3: Progress UX + Polish (2-3 days)

| Task | Effort | Files |
|------|--------|-------|
| Build progress modal component | 1 day | New: `GenerationProgress.tsx` |
| Implement "Stop After Batch" with Ink refund | 0.5 days | `geminiService.ts`, `users.ts` |
| Implement "Close & Browse" (background generation) | 0.5 days | `Dashboard.tsx` |
| Update PricingPage cost table | 0.5 hours | `PricingPage.tsx` |
| Update AdminPanel Ink controls (add batchSize config) | 0.5 days | `AdminPanel.tsx` |
| Edge case testing (browser close, failures, partial results) | 0.5 days | -- |

**Total estimated effort: 8-11 days for one developer.**

---

## Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Avg pages per generation | ~2.3 | ~8 | `inkTransactions` log analysis |
| Planner prompt success rate | Unknown (many fail for >5 pages) | >90% prompts produce expected page count | Estimation accuracy tracking |
| Ink spend per user per month (Pro) | ~15 Ink | ~40 Ink | More generations, more value, more engagement |
| Generation abandonment rate | Unknown | <15% at estimation step | Track "Back" clicks vs "Generate" clicks |
| User complaints about surprise costs | Occasional | Zero | Support ticket tracking |

---

## Open Questions

- [ ] Should the "Quick Generate" shortcut (skip estimation, always 1 page, 1 Ink) be the default for prompts with no temporal pattern? Recommendation: yes, to preserve the fast single-page flow.
- [ ] Should we cap max pages per generation at 60 (12 batches = 12 Ink) to prevent abuse? Recommendation: yes, with an admin-configurable limit.
- [ ] When a user closes the browser mid-generation, should we attempt to refund ungenerated batches? Recommendation: no for v1 -- Ink was already deducted. Add server-side tracking later if this becomes a pain point.
- [ ] Should the estimation endpoint use a lightweight Gemini call (Gemini Flash) for better accuracy instead of keyword matching? Recommendation: not for v1. Keyword matching is free, fast, and good enough. Re-evaluate after seeing estimation accuracy data.

---

## What NOT to Build (YAGNI)

- **Server-side generation queue** -- Client-side orchestration is sufficient at startup scale. A proper job queue (Bull, Inngest) adds infrastructure complexity with no user-facing benefit until we hit concurrency issues.
- **Real-time WebSocket progress** -- Polling or client-side state is fine. The client fires each batch and knows when it completes. No need for server push.
- **AI-powered estimation** -- A Gemini Flash call to estimate pages would be more accurate but adds latency, cost, and a failure point. Keyword matching + user adjustment covers 90% of cases.
- **Page-level customization before generation** -- "Generate pages 1-15 as daily, pages 16-20 as weekly" is a power user feature. Not for v1.
- **Generation history / regenerate** -- Users can see what they generated (it is in their notebook). A dedicated "generation history" UI is unnecessary.
- **Batch parallelism** -- Tempting for speed, but breaks continuation context. Sequential is correct.
