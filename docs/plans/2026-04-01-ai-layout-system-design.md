# PaperGrid AI Layout System — Design Document

**Date:** 2026-04-01
**Status:** Draft — pending approval
**Goal:** AI generates professional planner DESIGNS (like Etsy/KDP templates), not just block lists

---

## Problem Statement

Current AI output looks like "someone threw blocks together." Real Etsy/KDP planners are **designed** — they have visual hierarchy, complementary section pairings, domain-specific structures, and professional layouts across 100+ distinct page types.

PaperGrid currently has 11 reference layouts across ~4 domains. Competing products offer 400+ templates across 8+ domains. The AI lacks domain knowledge to create a "social media audit page" or "debt snowball tracker" or "Level 10 Life Wheel" — it just generates generic blocks.

---

## Design: Three Layers

### Layer 1: New Block Types (5 new types)

These are blocks that CANNOT be composed from existing types — they need distinct visual rendering.

| Block Type | What It Is | Why GRID Can't Do It |
|-----------|-----------|---------------------|
| `PROGRESS_BAR` | Horizontal bar 0-100% with label | Visual progress indicator, not tabular data |
| `RATING` | Star/circle rating scale (1-5 or 1-10) | Interactive rating UI, not a text cell |
| `WATER_TRACKER` | 8 circles/glasses to fill | Visual hydration tracker, iconic in wellness planners |
| `SECTION_NAV` | Clickable section index with icons | Navigation element, not content — links between pages |
| `KANBAN` | 3-4 column card board (To Do / In Progress / Done) | Cards in columns, fundamentally different from grid rows |

**Data schemas:**

```typescript
// PROGRESS_BAR
progressData: {
  label: string;       // "Savings Goal"
  current: number;     // 0-100
  target: string;      // "$5,000"
  color: string;       // theme color
}

// RATING
ratingData: {
  label: string;       // "Rate this month"
  max: number;         // 5 or 10
  value: number;       // current rating
  style: 'star' | 'circle' | 'heart';
}

// WATER_TRACKER
waterData: {
  goal: number;        // glasses per day (default 8)
  filled: number;      // how many filled
}

// SECTION_NAV
sectionNavData: {
  sections: Array<{ label: string; icon?: string; pageIndex?: number }>;
}

// KANBAN
kanbanData: {
  columns: Array<{
    title: string;
    color: string;
    cards: Array<{ text: string; checked?: boolean }>;
  }>;
}
```

**Not adding** (expressible with existing types):
- Life Wheel → GRID with 8 rows (area + score) + CALLOUT explanation. Full radar chart is a rendering feature, not a block type.
- Yearly Calendar → 12x CALENDAR blocks or a GRID with month columns. Add later if demand proves it.
- Savings Challenge → HABIT_TRACKER with 52 days and 1 habit ("Save"). Already supported.
- Meal Planner → GRID with Meal/B/L/D/S columns. Already works.
- Finance Table → GRID with Income/Expected/Actual columns. Already works.

### Layer 2: Reference Layout Library (11 → 65+ layouts)

This is the **highest-impact change**. The AI uses few-shot matching — more references = better designs for more prompts. Each reference is a complete, professionally designed page with realistic content.

**New domains and layouts to add:**

#### Finance (8 layouts)
1. `monthly-budget-dashboard` — Income, expenses, savings summary with PROGRESS_BAR
2. `expense-tracker` — Daily expense log GRID + category breakdown
3. `savings-goal-tracker` — Goals with PROGRESS_BAR blocks, 52-week challenge via HABIT_TRACKER
4. `debt-snowball-planner` — Debts GRID sorted by balance, payment schedule
5. `subscription-tracker` — GRID: service/cost/renewal/cancel-date
6. `income-tracker` — Multiple income sources GRID + monthly totals
7. `bill-payment-calendar` — CALENDAR with bills as events + CHECKBOX checklist
8. `financial-reflection` — Monthly net worth, RATING for financial health, goals

#### Wellness (7 layouts)
9. `daily-wellness-check` — WATER_TRACKER, MOOD_TRACKER, sleep hours, RATING for energy
10. `self-care-menu` — Categorized self-care activities (body/mind/soul) with CHECKBOX
11. `gratitude-journal` — 3 gratitudes + highlight of day + MOOD_TRACKER
12. `sleep-tracker` — GRID: date/bedtime/wake/hours/quality-RATING
13. `meditation-log` — GRID: date/duration/type + reflection TEXT
14. `weekly-wellness-review` — RATING scales for 7 life areas + notes
15. `manifestation-journal` — Vision TEXT + affirmations CALLOUT + action CHECKBOX

#### Health & Fitness (7 layouts)
16. `workout-split-planner` — Push/Pull/Legs GRID with sets/reps/weight
17. `weekly-meal-prep` — 7-day GRID (B/L/D/S) + grocery CHECKBOX list
18. `monthly-meal-calendar` — CALENDAR view + GRID meal rotation
19. `weight-progress-tracker` — GRID: week/weight/change + PROGRESS_BAR to goal
20. `medication-log` — GRID: medication/dose/time/taken(checkbox)
21. `body-measurement-tracker` — GRID: metric/date1/date2/change
22. `recipe-card` — HEADING + ingredients CHECKBOX + steps TEXT + notes CALLOUT

#### Lifestyle (8 layouts)
23. `meeting-notes` — Date/attendees HEADING + agenda CHECKBOX + notes TEXT + action items
24. `travel-itinerary-day` — TIME_BLOCK schedule + packing CHECKBOX + budget GRID
25. `cleaning-schedule` — WEEKLY_VIEW with room assignments + CHECKBOX deep-clean tasks
26. `reading-journal` — Book info GRID + RATING + quotes QUOTE + reflection TEXT
27. `movie-tv-tracker` — GRID: title/genre/rating/date + RATING + notes
28. `brain-dump` — Large TEXT area + "Pick 3" CHECKBOX + PRIORITY_MATRIX
29. `password-manager` — GRID: service/username/email/notes (no actual passwords)
30. `contacts-directory` — GRID: name/phone/email/birthday/notes

#### Business (8 layouts)
31. `sales-tracker` — GRID: date/client/product/amount/status + monthly total
32. `client-information` — GRID: client/contact/project/status/notes
33. `order-tracker` — GRID: order#/date/customer/items/status/shipped
34. `project-dashboard` — KANBAN (To Do/In Progress/Done) + GOAL_SECTION milestones
35. `invoice-log` — GRID: invoice#/client/amount/sent/paid/date
36. `product-launch-checklist` — Phased CHECKBOX lists + timeline GRID
37. `business-finances-monthly` — Income GRID + Expenses GRID + PROGRESS_BAR profit margin
38. `time-tracking-log` — GRID: date/project/task/hours + weekly total

#### Marketing & Social Media (7 layouts)
39. `social-media-accounts` — Per-platform GRID: username/password/bio
40. `social-media-audit` — GRID: platform/followers/engagement + RATING satisfaction
41. `content-calendar-weekly` — WEEKLY_VIEW with post types per day
42. `brand-voice-worksheet` — Tone attributes CHECKBOX + language style TEXT + purpose TEXT
43. `posting-schedule` — GRID: day/platform/content-type/time/status
44. `hashtag-research` — Topic-grouped GRID: hashtag/reach/relevance-RATING
45. `campaign-planner` — GOAL_SECTION objectives + GRID timeline + CHECKBOX deliverables

#### Academic (6 layouts)
46. `semester-overview` — GRID: course/professor/time/room + key dates CALENDAR
47. `cornell-notes` — Cue column TEXT + notes TEXT + summary CALLOUT (using side layout)
48. `smart-goals-worksheet` — 5 sections (S/M/A/R/T) with TEXT + CHECKBOX action items
49. `exam-prep-planner` — GRID: subject/exam-date/study-hours + CHECKBOX study tasks
50. `research-notes` — Source HEADING + key findings TEXT + quotes QUOTE + bibliography GRID
51. `group-project-tracker` — GRID: task/assigned-to/deadline/status + meeting notes TEXT

#### Time Planning — Advanced (14 layouts)
52. `yearly-at-a-glance` — 12x CALENDAR blocks (Jan-Dec) compact view
53. `year-goals-dashboard` — GOAL_SECTION for 4 life areas + PROGRESS_BAR each
54. `year-reset-journal` — Reflection TEXT + lessons CALLOUT + vision TEXT + RATING
55. `monthly-calendar-spread` — CALENDAR full month + CHECKBOX focus items + TEXT notes
56. `monthly-dashboard` — Focus TEXT + GOAL_SECTION + CHECKBOX to-do + HABIT_TRACKER
57. `monthly-reflection` — RATING for month + highlights TEXT + challenges TEXT + "start/stop/continue" sections
58. `monthly-finances` — Income/Bills/Expenses GRIDs + savings PROGRESS_BAR
59. `weekly-horizontal` — Mon-Sun horizontal rows + priorities CHECKBOX + HABIT_TRACKER
60. `weekly-vertical` — Mon-Sun vertical columns + to-do sidebar + mini CALENDAR
61. `weekly-review` — RATING for week + wins TEXT + lessons TEXT + next week CHECKBOX
62. `daily-focus` — Top 3 priorities + TIME_BLOCK schedule + notes TEXT
63. `daily-intentions` — Intention TEXT + schedule TIME_BLOCK + MOOD_TRACKER + meals GRID
64. `daily-productivity` — PRIORITY_MATRIX + TIME_BLOCK + CHECKBOX tasks + energy RATING
65. `daily-journal` — Morning TEXT + MOOD_TRACKER + gratitude TEXT + evening reflection TEXT

### Layer 3: Prompt Rewrite — "Design Mode"

The current prompt says "you are designing pages." The new prompt must make the AI think like a **planner product designer**, not a content generator.

**Key changes:**

1. **Domain detection** — Before calling Gemini, classify the prompt into a domain (finance, wellness, academic, etc.) using keyword matching. This selects the most relevant references AND adds domain-specific design rules.

2. **Design principles in prompt** — Replace generic "mix blocks" instructions with:
   ```
   DESIGN PRINCIPLES:
   - Every page needs a VISUAL ANCHOR — one dominant block that catches the eye
     (a large GRID, CALENDAR, TIME_BLOCK, or KANBAN)
   - Support the anchor with COMPLEMENTARY BLOCKS — if the anchor is a schedule,
     add priorities + mood + notes alongside it
   - Create VISUAL RHYTHM — alternate between dense blocks (GRID, TIME_BLOCK) and
     breathing room (DIVIDER, CALLOUT, QUOTE)
   - Use PROGRESSIVE DISCLOSURE across pages — overview first, then detail pages
   - Each page should be USEFUL STANDALONE but BETTER TOGETHER as a set
   ```

3. **Domain-specific design rules** — Injected based on detected domain:
   ```
   [FINANCE domain]:
   - Always include a summary/totals row in financial GRIDs
   - Pair expense tracking with a PROGRESS_BAR for budget remaining
   - Use emerald for income, rose for expenses, amber for savings

   [WELLNESS domain]:
   - Lead with a MOOD_TRACKER or RATING — feelings first, then structure
   - Include at least one reflection TEXT block — journals need writing space
   - Use WATER_TRACKER when daily wellness is mentioned

   [PLANNING domain]:
   - Follow time hierarchy: yearly → monthly → weekly → daily
   - Weekly pages need a mini CALENDAR for context
   - Daily pages need TIME_BLOCK + priorities CHECKBOX + at least one reflection element
   ```

4. **Anti-generic rules**:
   ```
   ANTI-PATTERNS (never do these):
   - Don't generate pages that are just lists of CHECKBOXes — that's a to-do app, not a planner
   - Don't use generic titles like "Notes" or "Page 1" — use specific: "January Savings Dashboard"
   - Don't repeat the same block layout on every page — vary the visual structure
   - Don't leave GRID blocks with empty placeholder text — fill with realistic example data
   - Don't make every page look the same — a finance tracker should LOOK different from a wellness journal
   ```

### Layer 4: MVP Template Gallery

A lightweight "Start from Template" option in the notebook creation flow.

**Implementation:**
- A curated list of 15-20 pre-defined template bundles (stored as JSON in the codebase, not in the DB)
- Each bundle defines: name, description, category, page count, and the actual prompt to send to the AI
- User picks a template → we send the pre-written prompt to the existing generate-layout endpoint
- No new backend endpoints needed — it's a frontend-only feature that wraps the existing AI generation

**Template bundles (MVP — 15):**

| Category | Template | Pages |
|----------|----------|-------|
| Planning | 2026 Weekly Planner | 4 (month overview + 3 weekly spreads) |
| Planning | Daily Focus Planner | 5 (Mon-Fri daily pages) |
| Planning | Monthly Dashboard | 3 (calendar + dashboard + reflection) |
| Finance | Budget Tracker | 3 (income + expenses + savings goals) |
| Finance | Debt Payoff Planner | 2 (debt list + payment schedule) |
| Wellness | Daily Wellness Journal | 3 (morning check-in + tracker + reflection) |
| Wellness | Self-Care Planner | 2 (self-care menu + weekly wellness review) |
| Health | Meal Prep Planner | 3 (weekly meals + grocery list + recipes) |
| Health | Fitness Tracker | 2 (workout log + body measurements) |
| Student | Study Planner | 3 (semester overview + weekly study + exam prep) |
| Student | Cornell Notes | 1 (single cornell-style note page) |
| Business | Project Tracker | 2 (kanban board + meeting notes) |
| Business | Client Management | 2 (client directory + order tracker) |
| Marketing | Social Media Planner | 3 (accounts + content calendar + posting schedule) |
| Lifestyle | Reading Journal | 1 (book tracker + quotes + rating) |

**UI:** A grid of template cards in the "New Notebook" or "Generate" modal. Each card shows: icon, name, category badge, page count. Clicking one fills in the AI prompt and triggers generation.

---

## Implementation Plan

### Phase 1: Reference Library + Prompt Rewrite (highest impact, no schema changes)
1. Add 54 new reference layouts to `http.ts` REFERENCE_LAYOUTS array
2. Add domain detection function (keyword → category mapping)
3. Rewrite Gemini prompt with design principles + domain rules + anti-patterns
4. Expand tag matching to weight domain matches higher
5. Test across 20+ diverse prompts

### Phase 2: New Block Types (5 types)
1. Add schemas to `@papergrid/core/schemas.ts` (PROGRESS_BAR, RATING, WATER_TRACKER, SECTION_NAV, KANBAN)
2. Add TypeScript interfaces to core types
3. Build React renderer components for each new block type
4. Add to Gemini response schema so AI can use them
5. Update reference layouts to use new block types where appropriate

### Phase 3: MVP Template Gallery (frontend only)
1. Create template bundle JSON data file
2. Build TemplateGallery component (grid of cards)
3. Integrate into notebook creation / generation flow
4. Wire template selection → pre-fill prompt → trigger generation

---

## What This Does NOT Include (Future)

- Hyperlinked navigation between pages (complex rendering feature)
- Stickers/widgets overlay system (separate feature)
- Dark mode variants (theme system, not AI)
- Marketplace for user-created templates (Phase 2 product feature)
- Radar/spider chart rendering for Life Wheel (can add in block type Phase 2)

---

## Success Criteria

1. Generate "social media planner" → get 3 pages that look like the Marketing Planners reference (accounts, content calendar, posting schedule) — not generic checkboxes
2. Generate "monthly budget" → get a finance dashboard with income/expense GRIDs, progress bars, and savings goals — not a plain list
3. Generate "daily wellness" → get a page with water tracker, mood tracker, gratitude section, and sleep log — not just text fields
4. Template gallery lets users create a complete 3-5 page planner with one click
5. Each generated page has a clear visual anchor, complementary blocks, and domain-appropriate styling
