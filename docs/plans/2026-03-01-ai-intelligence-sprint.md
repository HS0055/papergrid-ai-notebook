# AI Intelligence Sprint: Reference Vault + Planner Blocks + Smart Generation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform PaperGrid's AI from a generic layout generator (Grade D+) into an intelligence-first system that produces Etsy-quality planner layouts using scraped reference data, 6 new planner block types, and few-shot prompting — with a fine-tuning data pipeline.

**Architecture:** Hybrid A+C approach. Phase 0 delivers immediate wow (manual references + prompt upgrade in 1-2 days). Phases 1-5 build the full intelligence pipeline: new block types, Firecrawl scraping, Gemini Vision ingestion, reference-matched generation, and fine-tuning data collection.

**Tech Stack:** TypeScript, React 19, Tailwind v4, Zod, Convex, Gemini 2.5 Pro (current) / 3.1 Pro (target), Firecrawl MCP, Gemini Vision API

---

## Current State (What Exists)

| Component | File | Status |
|---|---|---|
| 11 block types | `packages/core/src/types.ts` | TEXT, HEADING, GRID, CHECKBOX, CALLOUT, QUOTE, DIVIDER, MOOD_TRACKER, PRIORITY_MATRIX, INDEX, MUSIC_STAFF |
| Block renderers | `packages/web/src/components/BlockComponent.tsx` (370 lines) | All 11 types rendered |
| Zod schemas | `packages/core/src/schemas.ts` (137 lines) | Full AILayoutResponseSchema with validation |
| Validation util | `packages/core/src/utils.ts` (10 lines) | `validateAIOutput()` using safeParse |
| Gemini proxy | `packages/convex/convex/http.ts` (253 lines) | Server-side API key, Gemini 2.5 Pro, static prompt |
| Client service | `packages/web/src/services/geminiService.ts` (72 lines) | Calls Convex proxy, uses Zod validation |
| Layout generator UI | `packages/web/src/components/LayoutGenerator.tsx` (239 lines) | 4 aesthetics, prompt input, live preview |
| Reference layouts table | `packages/convex/convex/referenceLayouts.ts` | CRUD ready, 0 rows |
| AI generations table | `packages/convex/convex/aiGenerations.ts` | Schema ready, unused |
| Convex schema | `packages/convex/convex/schema.ts` (75 lines) | All tables defined |

## Key Findings from Code Review

- **Model**: Using `gemini-2.5-pro` (http.ts:144), NOT 2.5 Flash as audit stated
- **Prompt**: Static 8-rule mega-prompt in http.ts:63-79, no few-shot examples
- **Schema gap**: Gemini prompt schema (http.ts:86-132) lists only 10 block types, missing MUSIC_STAFF
- **No references**: referenceLayouts table exists but has 0 entries
- **No tracking**: aiGenerations table exists but is never written to
- **ID generation**: http.ts:178 still uses `Math.random()` (should use `crypto.randomUUID()`)
- **No Zod on server**: http.ts does raw `JSON.parse()` then manual hydration (doesn't use core's validateAIOutput)

---

## Phase 0: Quick Win — Manual References + Prompt Upgrade (Days 1-2)

### Task 1: Create Reference Layouts Data File

**Files:**
- Create: `packages/core/src/referenceLayouts.ts`

**Step 1: Create 10 hand-crafted reference layouts**

These are based on the Amazon Labterry planner image, Etsy listing patterns, and market research. Each layout uses ONLY the current 11 block types (new types come in Phase 1).

```typescript
// packages/core/src/referenceLayouts.ts

import { BlockType } from './types';

export interface ReferenceLayout {
  id: string;
  source: string;
  sourceUrl?: string;
  niche: string;
  style: string;
  aesthetic: 'pastel' | 'minimalist' | 'rainbow' | 'modern-planner' | 'e-ink' | 'bujo' | 'cornell';
  tags: string[];
  paperType: string;
  themeColor: string;
  title: string;
  blocks: Array<{
    type: string;
    content: string;
    side: 'left' | 'right';
    alignment?: 'left' | 'center' | 'right';
    emphasis?: 'bold' | 'italic' | 'highlight' | 'none';
    color?: string;
    gridData?: { columns: string[]; rows: string[][] };
    matrixData?: { q1: string; q2: string; q3: string; q4: string };
    moodValue?: number;
    checked?: boolean;
  }>;
}

export const REFERENCE_LAYOUTS: ReferenceLayout[] = [
  // 1. Weekly Planner (from Amazon Labterry 2026-2027 image)
  {
    id: 'ref-001',
    source: 'amazon-labterry',
    niche: 'weekly-planner',
    style: 'clean-professional',
    aesthetic: 'modern-planner',
    tags: ['weekly', 'planner', 'dates', 'schedule', 'professional'],
    paperType: 'lined',
    themeColor: 'indigo',
    title: 'Weekly Planner',
    blocks: [
      { type: 'HEADING', content: 'This Week\'s Focus', side: 'left', emphasis: 'highlight', color: 'indigo' },
      { type: 'CHECKBOX', content: 'Top priority for the week', side: 'left', color: 'indigo' },
      { type: 'CHECKBOX', content: 'Important deadline', side: 'left', color: 'indigo' },
      { type: 'CHECKBOX', content: 'Follow up items', side: 'left', color: 'indigo' },
      { type: 'DIVIDER', content: '', side: 'left', emphasis: 'bold', color: 'indigo' },
      { type: 'GRID', content: 'Schedule', side: 'left', color: 'indigo',
        gridData: { columns: ['Time', 'Monday', 'Tuesday', 'Wednesday'],
          rows: [['Morning', '', '', ''], ['Afternoon', '', '', ''], ['Evening', '', '', '']] } },
      { type: 'HEADING', content: 'Notes & Reminders', side: 'right', emphasis: 'highlight', color: 'indigo' },
      { type: 'GRID', content: 'Schedule', side: 'right', color: 'indigo',
        gridData: { columns: ['Time', 'Thursday', 'Friday', 'Weekend'],
          rows: [['Morning', '', '', ''], ['Afternoon', '', '', ''], ['Evening', '', '', '']] } },
      { type: 'CALLOUT', content: 'Remember: Review weekly goals every Sunday evening', side: 'right', color: 'indigo' },
      { type: 'TEXT', content: '', side: 'right', color: 'indigo' },
    ]
  },

  // 2. Daily Planner with Time Blocks
  {
    id: 'ref-002',
    source: 'etsy-inspired',
    niche: 'daily-planner',
    style: 'pastel-soft',
    aesthetic: 'pastel',
    tags: ['daily', 'planner', 'time-blocking', 'schedule', 'productivity'],
    paperType: 'dotted',
    themeColor: 'rose',
    title: 'Daily Planner',
    blocks: [
      { type: 'HEADING', content: 'Today\'s Intention', side: 'left', emphasis: 'highlight', color: 'rose' },
      { type: 'TEXT', content: '', side: 'left', color: 'rose' },
      { type: 'DIVIDER', content: '', side: 'left', color: 'rose' },
      { type: 'GRID', content: 'Time Blocks', side: 'left', color: 'rose',
        gridData: { columns: ['Time', 'Task', 'Status'],
          rows: [['8:00 AM', '', ''], ['9:00 AM', '', ''], ['10:00 AM', '', ''],
                 ['11:00 AM', '', ''], ['12:00 PM', 'Lunch', ''], ['1:00 PM', '', ''],
                 ['2:00 PM', '', ''], ['3:00 PM', '', ''], ['4:00 PM', '', ''],
                 ['5:00 PM', '', '']] } },
      { type: 'HEADING', content: 'Top 3 Priorities', side: 'right', emphasis: 'bold', color: 'rose' },
      { type: 'CHECKBOX', content: 'Most important task', side: 'right', color: 'rose' },
      { type: 'CHECKBOX', content: 'Second priority', side: 'right', color: 'rose' },
      { type: 'CHECKBOX', content: 'Third priority', side: 'right', color: 'rose' },
      { type: 'DIVIDER', content: '', side: 'right', color: 'rose' },
      { type: 'CALLOUT', content: 'Gratitude: What are you thankful for today?', side: 'right', color: 'rose' },
      { type: 'MOOD_TRACKER', content: '', side: 'right', color: 'rose' },
      { type: 'QUOTE', content: 'The secret of getting ahead is getting started.', side: 'right', color: 'rose' },
    ]
  },

  // 3. Student Study Planner (Etsy pink notebook inspired)
  {
    id: 'ref-003',
    source: 'etsy-pink-student',
    sourceUrl: 'https://www.etsy.com/listing/1788811402',
    niche: 'student',
    style: 'pastel-soft',
    aesthetic: 'pastel',
    tags: ['student', 'study', 'school', 'assignments', 'exams', 'pastel'],
    paperType: 'grid',
    themeColor: 'rose',
    title: 'Study Planner',
    blocks: [
      { type: 'HEADING', content: 'Study Plan', side: 'left', emphasis: 'highlight', color: 'rose' },
      { type: 'GRID', content: 'Assignments', side: 'left', color: 'rose',
        gridData: { columns: ['Subject', 'Assignment', 'Due Date', 'Done?'],
          rows: [['Math', '', '', ''], ['Science', '', '', ''], ['English', '', '', ''], ['History', '', '', '']] } },
      { type: 'CALLOUT', content: 'Study tip: Use the Pomodoro technique - 25 min focus, 5 min break', side: 'left', color: 'rose' },
      { type: 'HEADING', content: 'Class Schedule', side: 'right', emphasis: 'highlight', color: 'rose' },
      { type: 'GRID', content: 'Classes', side: 'right', color: 'rose',
        gridData: { columns: ['Period', 'Class', 'Room', 'Notes'],
          rows: [['1st', '', '', ''], ['2nd', '', '', ''], ['3rd', '', '', ''],
                 ['4th', '', '', ''], ['5th', '', '', '']] } },
      { type: 'CHECKBOX', content: 'Review yesterday\'s notes', side: 'right', color: 'rose' },
      { type: 'CHECKBOX', content: 'Complete homework', side: 'right', color: 'rose' },
      { type: 'CHECKBOX', content: 'Prepare for tomorrow', side: 'right', color: 'rose' },
    ]
  },

  // 4. ADHD-Friendly Planner (Etsy rainbow inspired)
  {
    id: 'ref-004',
    source: 'etsy-adhd-rainbow',
    sourceUrl: 'https://www.etsy.com/listing/1248582352',
    niche: 'adhd',
    style: 'rainbow-bold',
    aesthetic: 'rainbow',
    tags: ['adhd', 'rainbow', 'colorful', 'brain-dump', 'focus', 'executive-function'],
    paperType: 'dotted',
    themeColor: 'amber',
    title: 'ADHD Daily Focus',
    blocks: [
      { type: 'HEADING', content: 'Brain Dump Zone', side: 'left', emphasis: 'highlight', color: 'amber' },
      { type: 'TEXT', content: 'Write everything in your head here. No filters, no judgment.', side: 'left', color: 'amber' },
      { type: 'TEXT', content: '', side: 'left', color: 'amber' },
      { type: 'DIVIDER', content: '', side: 'left', emphasis: 'bold', color: 'amber' },
      { type: 'HEADING', content: 'Pick Just 3 Things', side: 'left', emphasis: 'bold', color: 'emerald' },
      { type: 'CHECKBOX', content: 'THE one thing I must do', side: 'left', color: 'emerald' },
      { type: 'CHECKBOX', content: 'Would be nice to finish', side: 'left', color: 'sky' },
      { type: 'CHECKBOX', content: 'Bonus task if I\'m on fire', side: 'left', color: 'rose' },
      { type: 'HEADING', content: 'Energy & Focus', side: 'right', emphasis: 'highlight', color: 'sky' },
      { type: 'MOOD_TRACKER', content: '', side: 'right', color: 'sky' },
      { type: 'CALLOUT', content: 'Set a timer! 25 minutes of focus, then reward yourself.', side: 'right', color: 'amber' },
      { type: 'PRIORITY_MATRIX', content: '', side: 'right', color: 'indigo',
        matrixData: { q1: 'Do NOW', q2: 'Schedule it', q3: 'Delegate', q4: 'Drop it' } },
    ]
  },

  // 5. Habit Tracker
  {
    id: 'ref-005',
    source: 'etsy-inspired',
    niche: 'habit-tracker',
    style: 'minimalist',
    aesthetic: 'minimalist',
    tags: ['habits', 'tracker', 'daily', 'streaks', 'wellness', 'routine'],
    paperType: 'grid',
    themeColor: 'emerald',
    title: 'Monthly Habit Tracker',
    blocks: [
      { type: 'HEADING', content: 'Habits This Month', side: 'left', emphasis: 'highlight', color: 'emerald' },
      { type: 'GRID', content: 'Habit Tracker', side: 'left', color: 'emerald',
        gridData: { columns: ['Habit', 'Week 1', 'Week 2', 'Week 3', 'Week 4'],
          rows: [['Exercise 30 min', '', '', '', ''], ['Read 20 pages', '', '', '', ''],
                 ['Meditate', '', '', '', ''], ['Drink 8 glasses water', '', '', '', ''],
                 ['No screens before bed', '', '', '', ''], ['Journal', '', '', '', '']] } },
      { type: 'CALLOUT', content: 'Tip: Don\'t break the chain! Mark each day you complete a habit.', side: 'left', color: 'emerald' },
      { type: 'HEADING', content: 'Monthly Reflection', side: 'right', emphasis: 'highlight', color: 'emerald' },
      { type: 'TEXT', content: 'What habit was easiest to maintain?', side: 'right', emphasis: 'italic', color: 'emerald' },
      { type: 'TEXT', content: '', side: 'right', color: 'emerald' },
      { type: 'TEXT', content: 'What habit needs a new approach?', side: 'right', emphasis: 'italic', color: 'emerald' },
      { type: 'TEXT', content: '', side: 'right', color: 'emerald' },
      { type: 'MOOD_TRACKER', content: '', side: 'right', color: 'emerald' },
      { type: 'QUOTE', content: 'We are what we repeatedly do. Excellence is not an act, but a habit.', side: 'right', color: 'emerald' },
    ]
  },

  // 6. Monthly Overview
  {
    id: 'ref-006',
    source: 'etsy-inspired',
    niche: 'monthly-planner',
    style: 'modern-planner',
    aesthetic: 'modern-planner',
    tags: ['monthly', 'overview', 'goals', 'calendar', 'planning'],
    paperType: 'blank',
    themeColor: 'indigo',
    title: 'Monthly Overview',
    blocks: [
      { type: 'HEADING', content: 'Monthly Goals', side: 'left', emphasis: 'highlight', color: 'indigo' },
      { type: 'CHECKBOX', content: 'Goal 1: ', side: 'left', color: 'indigo' },
      { type: 'CHECKBOX', content: 'Goal 2: ', side: 'left', color: 'indigo' },
      { type: 'CHECKBOX', content: 'Goal 3: ', side: 'left', color: 'indigo' },
      { type: 'DIVIDER', content: '', side: 'left', color: 'indigo' },
      { type: 'GRID', content: 'Key Dates', side: 'left', color: 'indigo',
        gridData: { columns: ['Date', 'Event', 'Priority'],
          rows: [['', '', ''], ['', '', ''], ['', '', ''], ['', '', ''], ['', '', '']] } },
      { type: 'HEADING', content: 'Budget Snapshot', side: 'right', emphasis: 'highlight', color: 'indigo' },
      { type: 'GRID', content: 'Finances', side: 'right', color: 'indigo',
        gridData: { columns: ['Category', 'Budget', 'Actual'],
          rows: [['Income', '', ''], ['Rent/Mortgage', '', ''], ['Groceries', '', ''],
                 ['Transport', '', ''], ['Savings', '', ''], ['Other', '', '']] } },
      { type: 'CALLOUT', content: 'Review last month\'s wins before planning this month', side: 'right', color: 'indigo' },
    ]
  },

  // 7. Meal Planner
  {
    id: 'ref-007',
    source: 'etsy-inspired',
    niche: 'meal-planner',
    style: 'pastel-soft',
    aesthetic: 'pastel',
    tags: ['meal', 'food', 'grocery', 'cooking', 'nutrition', 'weekly'],
    paperType: 'lined',
    themeColor: 'emerald',
    title: 'Weekly Meal Planner',
    blocks: [
      { type: 'HEADING', content: 'Meal Plan', side: 'left', emphasis: 'highlight', color: 'emerald' },
      { type: 'GRID', content: 'Meals', side: 'left', color: 'emerald',
        gridData: { columns: ['Day', 'Breakfast', 'Lunch', 'Dinner'],
          rows: [['Monday', '', '', ''], ['Tuesday', '', '', ''], ['Wednesday', '', '', ''],
                 ['Thursday', '', '', ''], ['Friday', '', '', ''],
                 ['Saturday', '', '', ''], ['Sunday', '', '', '']] } },
      { type: 'HEADING', content: 'Grocery List', side: 'right', emphasis: 'highlight', color: 'emerald' },
      { type: 'CHECKBOX', content: 'Produce: ', side: 'right', color: 'emerald' },
      { type: 'CHECKBOX', content: 'Protein: ', side: 'right', color: 'emerald' },
      { type: 'CHECKBOX', content: 'Dairy: ', side: 'right', color: 'emerald' },
      { type: 'CHECKBOX', content: 'Grains: ', side: 'right', color: 'emerald' },
      { type: 'CHECKBOX', content: 'Snacks: ', side: 'right', color: 'emerald' },
      { type: 'DIVIDER', content: '', side: 'right', color: 'emerald' },
      { type: 'CALLOUT', content: 'Meal prep Sunday: Cook proteins and chop veggies for the week', side: 'right', color: 'emerald' },
    ]
  },

  // 8. Fitness Tracker
  {
    id: 'ref-008',
    source: 'etsy-inspired',
    niche: 'fitness',
    style: 'modern-planner',
    aesthetic: 'modern-planner',
    tags: ['fitness', 'workout', 'exercise', 'gym', 'health', 'tracker'],
    paperType: 'grid',
    themeColor: 'sky',
    title: 'Workout Log',
    blocks: [
      { type: 'HEADING', content: 'Workout Plan', side: 'left', emphasis: 'highlight', color: 'sky' },
      { type: 'GRID', content: 'Exercises', side: 'left', color: 'sky',
        gridData: { columns: ['Exercise', 'Sets', 'Reps', 'Weight'],
          rows: [['', '', '', ''], ['', '', '', ''], ['', '', '', ''],
                 ['', '', '', ''], ['', '', '', ''], ['', '', '', '']] } },
      { type: 'CALLOUT', content: 'Warm up 5-10 minutes before starting. Cool down and stretch after.', side: 'left', color: 'sky' },
      { type: 'HEADING', content: 'Progress', side: 'right', emphasis: 'highlight', color: 'sky' },
      { type: 'GRID', content: 'Body Stats', side: 'right', color: 'sky',
        gridData: { columns: ['Metric', 'This Week', 'Last Week', 'Goal'],
          rows: [['Weight', '', '', ''], ['Body Fat %', '', '', ''],
                 ['Steps/Day', '', '', ''], ['Sleep Hours', '', '', '']] } },
      { type: 'MOOD_TRACKER', content: '', side: 'right', color: 'sky' },
      { type: 'TEXT', content: 'How does your body feel today?', side: 'right', emphasis: 'italic', color: 'sky' },
      { type: 'TEXT', content: '', side: 'right', color: 'sky' },
    ]
  },

  // 9. Budget Tracker
  {
    id: 'ref-009',
    source: 'etsy-inspired',
    niche: 'finance',
    style: 'minimalist',
    aesthetic: 'minimalist',
    tags: ['budget', 'finance', 'money', 'savings', 'expenses', 'income'],
    paperType: 'grid',
    themeColor: 'slate',
    title: 'Monthly Budget',
    blocks: [
      { type: 'HEADING', content: 'Income', side: 'left', emphasis: 'highlight', color: 'emerald' },
      { type: 'GRID', content: 'Income Sources', side: 'left', color: 'emerald',
        gridData: { columns: ['Source', 'Expected', 'Actual'],
          rows: [['Salary', '', ''], ['Side Income', '', ''], ['Other', '', ''], ['Total', '', '']] } },
      { type: 'DIVIDER', content: '', side: 'left', emphasis: 'bold', color: 'slate' },
      { type: 'HEADING', content: 'Expenses', side: 'left', emphasis: 'highlight', color: 'rose' },
      { type: 'GRID', content: 'Fixed Expenses', side: 'left', color: 'rose',
        gridData: { columns: ['Category', 'Budget', 'Actual', 'Diff'],
          rows: [['Rent', '', '', ''], ['Utilities', '', '', ''], ['Insurance', '', '', ''],
                 ['Subscriptions', '', '', ''], ['Transport', '', '', '']] } },
      { type: 'HEADING', content: 'Savings Goals', side: 'right', emphasis: 'highlight', color: 'indigo' },
      { type: 'GRID', content: 'Goals', side: 'right', color: 'indigo',
        gridData: { columns: ['Goal', 'Target', 'Saved', 'Progress'],
          rows: [['Emergency Fund', '', '', ''], ['Vacation', '', '', ''],
                 ['Investment', '', '', '']] } },
      { type: 'CALLOUT', content: 'Pay yourself first: Move savings before spending on wants', side: 'right', color: 'indigo' },
      { type: 'QUOTE', content: 'A budget is telling your money where to go instead of wondering where it went.', side: 'right', color: 'slate' },
    ]
  },

  // 10. Bullet Journal Daily Log
  {
    id: 'ref-010',
    source: 'etsy-inspired',
    niche: 'bullet-journal',
    style: 'bujo-creative',
    aesthetic: 'bujo',
    tags: ['bujo', 'bullet-journal', 'daily', 'rapid-logging', 'creative'],
    paperType: 'dotted',
    themeColor: 'amber',
    title: 'Daily Log',
    blocks: [
      { type: 'HEADING', content: 'Daily Log', side: 'left', emphasis: 'bold', color: 'amber' },
      { type: 'CHECKBOX', content: '', side: 'left', color: 'amber' },
      { type: 'CHECKBOX', content: '', side: 'left', color: 'amber' },
      { type: 'CHECKBOX', content: '', side: 'left', color: 'amber' },
      { type: 'CHECKBOX', content: '', side: 'left', color: 'amber' },
      { type: 'CHECKBOX', content: '', side: 'left', color: 'amber' },
      { type: 'DIVIDER', content: '', side: 'left', emphasis: 'italic', color: 'amber' },
      { type: 'TEXT', content: 'Notes:', side: 'left', emphasis: 'bold', color: 'amber' },
      { type: 'TEXT', content: '', side: 'left', color: 'amber' },
      { type: 'HEADING', content: 'Gratitude', side: 'right', emphasis: 'highlight', color: 'amber' },
      { type: 'TEXT', content: '1. ', side: 'right', color: 'amber' },
      { type: 'TEXT', content: '2. ', side: 'right', color: 'amber' },
      { type: 'TEXT', content: '3. ', side: 'right', color: 'amber' },
      { type: 'DIVIDER', content: '', side: 'right', color: 'amber' },
      { type: 'MOOD_TRACKER', content: '', side: 'right', color: 'amber' },
      { type: 'QUOTE', content: '', side: 'right', color: 'amber' },
    ]
  },
];

// Match references by niche/tags/aesthetic
export function matchReferences(
  prompt: string,
  aesthetic?: string,
  maxResults = 3
): ReferenceLayout[] {
  const promptLower = prompt.toLowerCase();
  const scores: Array<{ layout: ReferenceLayout; score: number }> = [];

  for (const layout of REFERENCE_LAYOUTS) {
    let score = 0;

    // Tag matches (strongest signal)
    for (const tag of layout.tags) {
      if (promptLower.includes(tag)) score += 3;
    }

    // Niche match
    if (promptLower.includes(layout.niche.replace('-', ' '))) score += 5;

    // Aesthetic match
    if (aesthetic && layout.aesthetic === aesthetic) score += 2;

    // Style keywords
    if (promptLower.includes(layout.style.replace('-', ' '))) score += 2;

    if (score > 0) scores.push({ layout, score });
  }

  return scores
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(s => s.layout);
}
```

**Step 2: Export from barrel file**

Modify: `packages/core/src/index.ts`

```typescript
export * from './types';
export * from './schemas';
export * from './utils';
export * from './referenceLayouts';
```

**Step 3: Verify TypeScript compiles**

Run: `cd packages/core && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add packages/core/src/referenceLayouts.ts packages/core/src/index.ts
git commit -m "feat: add 10 hand-crafted reference layouts with matching engine"
```

---

### Task 2: Upgrade Convex AI Prompt with Few-Shot References

**Files:**
- Modify: `packages/convex/convex/http.ts:55-141`

**Step 1: Add reference matching to the Convex HTTP action**

Replace the entire `http.route` handler for `/api/generate-layout` in `packages/convex/convex/http.ts`. Key changes:

1. Import and use reference layouts for few-shot examples
2. Upgrade prompt with niche-aware context
3. Add date awareness (current date in prompts)
4. Add pastel-first aesthetic defaults
5. Fix `Math.random()` → `crypto.randomUUID()`
6. Add `moodValue`, `matrixData`, `checked` to Gemini schema

The new prompt structure:

```
SYSTEM: You are an expert planner and notebook designer...

FEW-SHOT EXAMPLES (from matched references):
Example 1: [Weekly Planner JSON]
Example 2: [Daily Planner JSON]

USER REQUEST:
- Prompt: "..."
- Industry: "..."
- Aesthetic: "..." (default: pastel)
- Current date: March 1, 2026

DESIGN RULES:
[Enhanced rules with aesthetic-specific guidance]

OUTPUT SCHEMA:
[Full schema with moodValue, matrixData, checked]
```

**Step 2: Update the Gemini response schema to include missing fields**

Add to the `responseSchema.blocks.items.properties`:
```json
{
  "moodValue": { "type": "NUMBER" },
  "matrixData": {
    "type": "OBJECT",
    "properties": {
      "q1": { "type": "STRING" },
      "q2": { "type": "STRING" },
      "q3": { "type": "STRING" },
      "q4": { "type": "STRING" }
    }
  },
  "checked": { "type": "BOOLEAN" }
}
```

**Step 3: Verify by testing a generation**

Run: `curl -X POST http://localhost:3001/api/generate-layout -H 'Content-Type: application/json' -d '{"prompt":"weekly planner for student","aesthetic":"pastel"}'`

Expected: JSON response with blocks matching pastel student planner references

**Step 4: Commit**

```bash
git add packages/convex/convex/http.ts
git commit -m "feat: upgrade AI prompt with few-shot references, date awareness, and pastel defaults"
```

---

### Task 3: Add 5 New Aesthetic Presets to LayoutGenerator UI

**Files:**
- Modify: `packages/web/src/components/LayoutGenerator.tsx:10-15`

**Step 1: Expand AESTHETICS array**

Add pastel, rainbow, and Remarkable-style presets alongside existing ones:

```typescript
const AESTHETICS = [
  { id: 'pastel', label: 'Pastel & Soft', icon: '🌸', font: 'font-hand', blocks: ['HEADING', 'CHECKBOX', 'CHECKBOX', 'GRID', 'CALLOUT', 'MOOD_TRACKER'] },
  { id: 'modern-planner', label: 'Ultimate Planner', icon: '📱', font: 'font-sans', blocks: ['HEADING', 'CHECKBOX', 'CHECKBOX', 'CHECKBOX', 'GRID', 'DIVIDER'] },
  { id: 'bujo', label: 'Bullet Journal', icon: '✍️', font: 'font-hand', blocks: ['HEADING', 'CHECKBOX', 'CHECKBOX', 'TEXT', 'MOOD_TRACKER'] },
  { id: 'rainbow', label: 'ADHD Rainbow', icon: '🌈', font: 'font-hand', blocks: ['HEADING', 'CHECKBOX', 'CHECKBOX', 'PRIORITY_MATRIX', 'CALLOUT'] },
  { id: 'e-ink', label: 'E-Ink Focus', icon: '📓', font: 'font-sans', blocks: ['HEADING', 'TEXT', 'TEXT', 'DIVIDER', 'TEXT'] },
  { id: 'cornell', label: 'Cornell Notes', icon: '📝', font: 'font-serif', blocks: ['HEADING', 'TEXT', 'CALLOUT', 'DIVIDER', 'TEXT'] },
];
```

**Step 2: Update SUGGESTIONS for planner-focused prompts**

```typescript
const SUGGESTIONS = [
  'Weekly Planner',
  'Daily Schedule',
  'Habit Tracker',
  'Meal Planner',
  'Study Plan',
  'Budget Tracker',
  'Workout Log',
  'Meeting Notes',
];
```

**Step 3: Add BLOCK_PREVIEW entries for MOOD_TRACKER and PRIORITY_MATRIX**

These should already exist in the BLOCK_PREVIEW map (verify at line 20-30).

**Step 4: Commit**

```bash
git add packages/web/src/components/LayoutGenerator.tsx
git commit -m "feat: add pastel, rainbow, ADHD aesthetic presets and planner-focused suggestions"
```

---

## Phase 1: New Planner Block Types (Days 3-5)

### Task 4: Add 6 New Block Types to Core

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/schemas.ts`

**Step 1: Add new BlockType enum values**

In `packages/core/src/types.ts`, add to the `BlockType` enum:

```typescript
export enum BlockType {
  // ... existing types ...
  MUSIC_STAFF = 'MUSIC_STAFF',
  // New planner block types
  CALENDAR = 'CALENDAR',
  WEEKLY_VIEW = 'WEEKLY_VIEW',
  HABIT_TRACKER = 'HABIT_TRACKER',
  GOAL_SECTION = 'GOAL_SECTION',
  TIME_BLOCK = 'TIME_BLOCK',
  DAILY_SECTION = 'DAILY_SECTION',
}
```

**Step 2: Add data interfaces for new types**

In `packages/core/src/types.ts`, add:

```typescript
export interface CalendarData {
  month: number;    // 1-12
  year: number;     // e.g., 2026
  highlights?: number[];  // highlighted dates
}

export interface WeeklyViewData {
  startDate?: string;  // ISO date string for week start
  days: Array<{
    label: string;     // "Monday", "Tue", etc.
    content: string;
  }>;
}

export interface HabitTrackerData {
  habits: string[];
  days: number;        // 7, 14, 28, 30, 31
  checked: boolean[][]; // habits x days matrix
}

export interface GoalSectionData {
  goals: Array<{
    text: string;
    subItems: Array<{ text: string; checked: boolean }>;
    progress?: number; // 0-100
  }>;
}

export interface TimeBlockData {
  startHour: number;  // 0-23
  endHour: number;
  interval: 30 | 60;  // minutes
  entries: Array<{
    time: string;
    content: string;
    color?: string;
  }>;
}

export interface DailySectionData {
  date?: string;      // ISO date
  dayLabel?: string;   // "Monday, March 2"
  sections: Array<{
    label: string;     // "Morning", "Afternoon", "Evening" or custom
    content: string;
  }>;
}
```

**Step 3: Extend the Block interface**

```typescript
export interface Block {
  // ... existing fields ...
  calendarData?: CalendarData;
  weeklyViewData?: WeeklyViewData;
  habitTrackerData?: HabitTrackerData;
  goalSectionData?: GoalSectionData;
  timeBlockData?: TimeBlockData;
  dailySectionData?: DailySectionData;
}
```

**Step 4: Update Zod schemas**

In `packages/core/src/schemas.ts`, add schemas for all new data types and update `BlockTypeSchema`, `BlockSchema`, and `AILayoutResponseSchema`.

**Step 5: Verify TypeScript compiles**

Run: `cd packages/core && npx tsc --noEmit`

**Step 6: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/schemas.ts
git commit -m "feat: add 6 planner block types with data interfaces and Zod schemas"
```

---

### Task 5: Build Renderers for New Block Types

**Files:**
- Create: `packages/web/src/components/planner/CalendarBlock.tsx`
- Create: `packages/web/src/components/planner/WeeklyViewBlock.tsx`
- Create: `packages/web/src/components/planner/HabitTrackerBlock.tsx`
- Create: `packages/web/src/components/planner/GoalSectionBlock.tsx`
- Create: `packages/web/src/components/planner/TimeBlockBlock.tsx`
- Create: `packages/web/src/components/planner/DailySectionBlock.tsx`
- Modify: `packages/web/src/components/BlockComponent.tsx`

Each renderer must:
- Follow the 32px vertical rhythm from globals.css
- Use pastel color scheme by default (soft backgrounds, rounded corners)
- Match the quality bar of existing blocks (callout with washi tape, priority matrix with colored quadrants)
- Be interactive (editable cells, checkable items)
- Accept the same `BlockProps` pattern as existing blocks

**Step 1: Create CalendarBlock.tsx**

A beautiful mini month-view calendar grid. Shows month name, day-of-week headers (S M T W T F S), numbered date cells. Current date highlighted. Pastel theme colors for header. Clickable dates to highlight.

**Step 2: Create WeeklyViewBlock.tsx**

A 7-column day layout. Each column has a day header (Mon-Sun) with content area below. Columns use alternating pastel backgrounds. Editable content per day. Weekend columns slightly tinted.

**Step 3: Create HabitTrackerBlock.tsx**

Grid with habit names as rows and days as columns. Circular checkboxes at each intersection. Completed checks get a soft color fill. Streak counter per habit. Header row shows day numbers.

**Step 4: Create GoalSectionBlock.tsx**

Titled section with editable goal items. Each goal has sub-items with checkboxes. Optional progress bar per goal (thin, rounded, pastel-filled). "Add goal" button matching existing "Add Row" pattern.

**Step 5: Create TimeBlockBlock.tsx**

Vertical timeline with hour labels on the left (8:00 AM, 9:00 AM, etc.). Each hour has an editable content area. Optional color coding per time slot. Pastel hour dividers.

**Step 6: Create DailySectionBlock.tsx**

Date header with day name (editable), followed by sections (Morning/Afternoon/Evening). Each section has a label and editable content area. Soft dividers between sections.

**Step 7: Wire new blocks into BlockComponent.tsx**

Add imports and render cases for all 6 new types. Follow existing pattern:
```typescript
{block.type === BlockType.CALENDAR && (
  <CalendarBlock block={block} onChange={onChange} />
)}
```

**Step 8: Commit**

```bash
git add packages/web/src/components/planner/ packages/web/src/components/BlockComponent.tsx
git commit -m "feat: add 6 pastel planner block renderers (calendar, weekly, habit, goal, time, daily)"
```

---

### Task 6: Update Gemini Schema for New Block Types

**Files:**
- Modify: `packages/convex/convex/http.ts`

**Step 1: Add new block types to the Gemini responseSchema enum**

Update the `type.enum` in the blocks schema to include all 17 types:
```json
["TEXT", "HEADING", "GRID", "CHECKBOX", "CALLOUT", "QUOTE", "DIVIDER",
 "MOOD_TRACKER", "PRIORITY_MATRIX", "INDEX", "MUSIC_STAFF",
 "CALENDAR", "WEEKLY_VIEW", "HABIT_TRACKER", "GOAL_SECTION", "TIME_BLOCK", "DAILY_SECTION"]
```

**Step 2: Add data schemas for new types**

Add `calendarData`, `weeklyViewData`, `habitTrackerData`, `goalSectionData`, `timeBlockData`, `dailySectionData` as nullable object properties in the blocks schema.

**Step 3: Update prompt rules**

Add rules for when to use each new block type:
```
- For "planner", "schedule", or "weekly": use WEEKLY_VIEW and CALENDAR blocks
- For "habit", "tracker", or "routine": use HABIT_TRACKER with relevant habits
- For "goals", "objectives", or "monthly": use GOAL_SECTION blocks
- For "daily", "schedule", or "time": use TIME_BLOCK and DAILY_SECTION blocks
```

**Step 4: Update hydration logic**

Add hydration for new block types in the response processing section, including default data for each new type.

**Step 5: Commit**

```bash
git add packages/convex/convex/http.ts
git commit -m "feat: add 6 new planner block types to Gemini schema and prompt rules"
```

---

### Task 7: Update Reference Layouts with New Block Types

**Files:**
- Modify: `packages/core/src/referenceLayouts.ts`

**Step 1: Enhance existing reference layouts to use new block types**

For example, the Weekly Planner (ref-001) should use `WEEKLY_VIEW` and `CALENDAR` instead of the GRID workaround. The ADHD planner should use `GOAL_SECTION` and `HABIT_TRACKER`.

**Step 2: Add 5 more reference layouts using new types**

- Ref 11: Study Schedule (TIME_BLOCK + DAILY_SECTION)
- Ref 12: Fitness Habit Tracker (HABIT_TRACKER + CALENDAR)
- Ref 13: Project Timeline (WEEKLY_VIEW + GOAL_SECTION)
- Ref 14: Self-Care Planner (MOOD_TRACKER + HABIT_TRACKER + DAILY_SECTION)
- Ref 15: Meeting Agenda (TIME_BLOCK + CHECKBOX + CALLOUT)

**Step 3: Commit**

```bash
git add packages/core/src/referenceLayouts.ts
git commit -m "feat: enhance reference layouts with new planner block types, add 5 more"
```

---

## Phase 2: Firecrawl Scraping Pipeline (Days 6-8)

### Task 8: Install Firecrawl and Build Scraping Script

**Files:**
- Create: `scripts/scrape-references.ts`
- Create: `scripts/README.md`

**Step 1: Install Firecrawl SDK**

Run: `npm install firecrawl-js --save-dev` (in project root)

**Step 2: Create scraping script**

The script should:
1. Read all URLs from `components/links.txt`
2. Use Firecrawl to scrape each page (title, description, images)
3. Download product images to `data/reference-images/`
4. Search Firecrawl for similar planner listings (expand the 7 URLs to 50+)
5. Save structured metadata to `data/scraped-references.json`

Search queries to expand the reference vault:
- "digital planner template 2026"
- "ADHD planner printable"
- "student notebook template"
- "weekly planner pastel"
- "habit tracker printable"
- "bullet journal template digital"
- "meal planner template"
- "fitness tracker printable"

**Step 3: Run the scraper**

Run: `npx tsx scripts/scrape-references.ts`
Expected: 50+ reference entries in `data/scraped-references.json`, images in `data/reference-images/`

**Step 4: Commit**

```bash
git add scripts/ data/scraped-references.json
git commit -m "feat: Firecrawl scraping pipeline for Etsy planner references"
```

---

## Phase 3: Gemini Vision Ingestion (Days 9-11)

### Task 9: Build Vision Analysis Pipeline

**Files:**
- Create: `scripts/ingest-references.ts`

**Step 1: Create Gemini Vision ingestion script**

For each scraped image in `data/reference-images/`:
1. Send to Gemini Vision API with a structured extraction prompt
2. Extract: layout structure, block types, colors, niche, style, paper type
3. Convert to PaperGrid `ReferenceLayout` format
4. Validate with Zod `AILayoutResponseSchema`
5. Append to `data/ingested-references.json`

Vision prompt:
```
Analyze this planner/notebook layout image. Extract the structural elements:
1. What type of planner is this? (weekly, daily, monthly, habit, etc.)
2. What sections/blocks does it contain? Map each to PaperGrid types:
   TEXT, HEADING, GRID, CHECKBOX, CALLOUT, QUOTE, DIVIDER,
   MOOD_TRACKER, PRIORITY_MATRIX, CALENDAR, WEEKLY_VIEW,
   HABIT_TRACKER, GOAL_SECTION, TIME_BLOCK, DAILY_SECTION
3. What is the color scheme? (pastel, minimalist, rainbow, etc.)
4. What paper type? (lined, grid, dotted, blank, etc.)
5. How are blocks arranged? (left page vs right page in a spread)

Return a JSON object matching the PaperGrid layout schema.
```

**Step 2: Run ingestion**

Run: `npx tsx scripts/ingest-references.ts`
Expected: 50+ ingested reference layouts in PaperGrid format

**Step 3: Merge into core reference layouts**

Add the best 30-40 ingested layouts to the `REFERENCE_LAYOUTS` array (or a separate `INGESTED_LAYOUTS` array that gets loaded alongside).

**Step 4: Commit**

```bash
git add scripts/ingest-references.ts data/ingested-references.json
git commit -m "feat: Gemini Vision ingestion pipeline converts planner images to PaperGrid blocks"
```

---

## Phase 4: Smart Reference-Matched Generation (Days 12-14)

### Task 10: Upgrade Reference Matching to Vector Search

**Files:**
- Modify: `packages/core/src/referenceLayouts.ts`
- Modify: `packages/convex/convex/http.ts`

**Step 1: Improve matching algorithm**

Upgrade `matchReferences()` with TF-IDF-style scoring and synonym expansion. For example, "study" matches "student", "workout" matches "fitness".

**Step 2: Inject top 3 matched references as few-shot examples**

In http.ts, before calling Gemini, run `matchReferences(prompt, aesthetic)` and serialize the top 3 as JSON examples in the prompt.

**Step 3: Add generation metadata tracking**

After successful generation, log to console (pre-Convex deployment):
```typescript
console.log('AI Generation:', {
  prompt,
  aesthetic,
  matchedReferences: matches.map(m => m.id),
  modelUsed: 'gemini-2.5-pro',
  blockCount: blocks.length,
  blockTypes: [...new Set(blocks.map(b => b.type))],
});
```

**Step 4: Commit**

```bash
git add packages/core/src/referenceLayouts.ts packages/convex/convex/http.ts
git commit -m "feat: smart reference matching with few-shot injection and generation tracking"
```

---

## Phase 5: Fine-Tuning Data Pipeline (Days 15-17)

### Task 11: Build Generation Tracking for Fine-Tuning

**Files:**
- Create: `packages/web/src/hooks/useGenerationTracking.ts`
- Modify: `packages/web/src/App.tsx` (wire in tracking)

**Step 1: Create a hook that tracks generations and user edits**

The hook should:
1. Record the initial AI-generated layout (prompt + blocks)
2. After 5 minutes of editing, snapshot the current state of the page
3. Compute a simple edit distance (blocks added, removed, modified)
4. Store the generation-edit pair in localStorage (pre-Convex)
5. Export all pairs as JSONL for fine-tuning

**Step 2: Create export function**

```typescript
export function exportTrainingData(): string {
  const pairs = JSON.parse(localStorage.getItem('papergrid-training-data') || '[]');
  return pairs.map((p: any) => JSON.stringify({
    input: { prompt: p.prompt, aesthetic: p.aesthetic, industry: p.industry },
    output: { title: p.finalTitle, paperType: p.finalPaperType, themeColor: p.finalThemeColor, blocks: p.finalBlocks }
  })).join('\n');
}
```

**Step 3: Commit**

```bash
git add packages/web/src/hooks/useGenerationTracking.ts packages/web/src/App.tsx
git commit -m "feat: generation tracking hook for fine-tuning data collection"
```

---

## Decision Log

| # | Decision | Alternatives | Rationale |
|---|---|---|---|
| 1 | A+C hybrid approach (quick win + full pipeline) | Pure Phase A (sequential), Pure Phase C (manual only) | Immediate user value while building scalable intelligence |
| 2 | 10 hand-crafted reference layouts first | Skip to automated scraping | Unblocks prompt improvement in 1 day vs 1 week |
| 3 | 6 new planner block types (CALENDAR, WEEKLY_VIEW, HABIT_TRACKER, GOAL_SECTION, TIME_BLOCK, DAILY_SECTION) | 2 minimum (CALENDAR + WEEKLY_VIEW), 4 essential | Intelligence-first philosophy — AI needs all types to express any planner |
| 4 | Pastel & soft as default aesthetic | Minimalist default, user-picked | #1 aesthetic on Etsy/TikTok, appeals to largest audience (women 18-35, students) |
| 5 | Firecrawl for scraping | Chrome MCP, manual screenshots | User preference + scalable + can search for similar listings |
| 6 | Static reference file first, Convex later | Straight to Convex | No Convex deployment needed for immediate value |
| 7 | Keep Gemini 2.5 Pro for now | Upgrade to 3.1 Pro immediately | 2.5 Pro is already in http.ts and working; upgrade when 3.1 is GA |
| 8 | localStorage for training data | Convex aiGenerations table | No backend dependency for data collection; export to JSONL for fine-tuning |
| 9 | Keyword matching for references | Vector embeddings with Gemini Embedding API | Simple matching is good enough for 50-100 references; upgrade to vectors at 500+ |

---

## Summary Timeline

| Phase | Days | Deliverable |
|---|---|---|
| **Phase 0**: Quick Win | 1-2 | 10 reference layouts + upgraded prompts + new aesthetics = immediate quality jump |
| **Phase 1**: New Block Types | 3-5 | 6 planner block types + beautiful pastel renderers |
| **Phase 2**: Firecrawl Scraping | 6-8 | 50+ scraped planner references from Etsy |
| **Phase 3**: Vision Ingestion | 9-11 | Scraped images → PaperGrid block format via Gemini Vision |
| **Phase 4**: Smart Generation | 12-14 | Reference-matched few-shot prompting with top 3 matches |
| **Phase 5**: Fine-Tuning Pipeline | 15-17 | Generation+edit tracking → JSONL export for Gemini fine-tuning |
