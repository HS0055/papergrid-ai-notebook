# PaperGrid AI - Comprehensive Scale Design

**Date**: 2026-02-28
**Status**: Approved
**Scope**: Mobile App + AI Intelligence + Feature Roadmap

---

## Understanding Summary

- **What**: Transform PaperGrid from a client-only React prototype into a production-ready cross-platform notebook app with intelligent AI layout generation powered by proven Etsy reference layouts
- **Why**: Scale from prototype to a real startup product serving 1K-50K users within 6-12 months
- **Who**: Productivity-focused users who want AI-powered digital notebooks (planners, journals, trackers)
- **Key constraints**:
  - Convex.dev as backend (real-time, serverless, TypeScript-native)
  - React Native (Expo) for mobile (code sharing with web)
  - Progressive AI strategy: smart prompting + reference vault + fine-tuning
  - Offline-first mobile experience
  - Startup scale (1K-50K users target)
- **Non-goals**: Enterprise features, white-labeling, self-hosted options

---

## Assumptions

1. Small team (1-3 developers)
2. Convex free/starter tier is sufficient initially
3. Gemini remains the primary AI model
4. App Store + Play Store distribution for mobile
5. Monetization strategy TBD but architecture supports freemium
6. Existing ~1,400 lines of UI code is preserved and migrated (not a full rewrite)
7. Etsy reference layouts can be legally used as structural inspiration (not copied verbatim)

---

## System Architecture

```
papergrid/
  packages/
    core/          # Shared business logic, types, Zod validation, AI prompts
    web/           # React web app (Vite + Tailwind PostCSS)
    mobile/        # React Native app (Expo + Expo Router)
    convex/        # Convex backend (functions, schema, HTTP actions)
  turbo.json       # Turborepo orchestration
  package.json
```

### Architecture Diagram

```
+-----------------------------------------------------------+
|                    PAPERGRID MONOREPO                       |
|                                                             |
|  +-------------+  +-------------+  +-----------------+     |
|  |  @papergrid  |  |  @papergrid  |  |   @papergrid    |   |
|  |    /web      |  |   /mobile   |  |    /core        |   |
|  |  (Vite+React)|  | (Expo+RN)  |  |  (shared logic) |   |
|  +------+-------+  +------+------+  +--------+--------+   |
|         |                 |                   |             |
|         +--------+--------+                   |             |
|                  |                            |             |
|         +--------v--------+         +--------v--------+    |
|         |   Convex Client |         |   AI Service    |    |
|         |  (shared hooks) |         | (Gemini + Refs) |    |
|         +--------+--------+         +--------+--------+    |
|                  |                            |             |
+------------------+----------------------------+-------------+
                   |                            |
          +--------v--------+          +--------v--------+
          |   CONVEX.DEV    |          |   GEMINI API    |
          |                 |          |                 |
          | - Notebooks DB  |          | - Layout Gen    |
          | - User Auth     |          | - Vision Ingest |
          | - Real-time Sync|          | - Fine-tuned    |
          | - File Storage  |          |   (future)      |
          | - Cron Jobs     |          +-----------------+
          | - HTTP Actions  |
          +-----------------+
```

### Key Decisions
- Convex handles ALL backend: database, auth, real-time sync, serverless functions, file storage
- Gemini API calls go through Convex HTTP actions (API key stays server-side)
- Core package contains: types, Zod schemas, AI prompt templates, shared utilities
- Web and mobile share Convex hooks and core logic, platform-specific UI only

---

## Convex Data Model

```typescript
// convex/schema.ts

users: defineTable({
  name: v.string(),
  email: v.string(),
  avatarUrl: v.optional(v.string()),
  plan: v.union(v.literal("free"), v.literal("pro")),
  preferences: v.object({
    defaultAesthetic: v.string(),
    defaultPaperType: v.string(),
  }),
})

notebooks: defineTable({
  userId: v.id("users"),
  title: v.string(),
  coverColor: v.string(),
  bookmarks: v.array(v.id("pages")),
  isShared: v.boolean(),
})
.index("by_user", ["userId"])

pages: defineTable({
  notebookId: v.id("notebooks"),
  title: v.string(),
  paperType: v.union("lined", "grid", "dotted", "blank", "music", "rows", "isometric", "hex", "legal", "crumpled"),
  aesthetic: v.optional(v.string()),
  themeColor: v.optional(v.string()),
  sortOrder: v.number(),
})
.index("by_notebook", ["notebookId"])

blocks: defineTable({
  pageId: v.id("pages"),
  type: v.union("TEXT", "HEADING", "GRID", "CHECKBOX", "CALLOUT", "QUOTE", "DIVIDER", "MOOD_TRACKER", "PRIORITY_MATRIX", "INDEX"),
  content: v.string(),
  side: v.union(v.literal("left"), v.literal("right")),
  sortOrder: v.number(),
  checked: v.optional(v.boolean()),
  alignment: v.optional(v.union("left", "center", "right")),
  emphasis: v.optional(v.union("bold", "italic", "highlight", "none")),
  color: v.optional(v.string()),
  gridData: v.optional(v.object({
    columns: v.array(v.string()),
    rows: v.array(v.array(v.object({
      id: v.string(),
      content: v.string(),
    }))),
  })),
  matrixData: v.optional(v.object({
    q1: v.string(), q2: v.string(), q3: v.string(), q4: v.string(),
  })),
  moodValue: v.optional(v.number()),
})
.index("by_page", ["pageId"])

referenceLayouts: defineTable({
  source: v.string(),           // "etsy", "community", "curated"
  sourceUrl: v.optional(v.string()),
  niche: v.string(),            // "fitness", "finance", "wedding", "student"
  style: v.string(),            // "modern-planner", "bujo", "minimalist"
  tags: v.array(v.string()),    // ["weekly", "tracker", "habit", "meal-prep"]
  paperType: v.string(),
  blocks: v.array(v.any()),     // layout structure in PaperGrid format
  popularity: v.number(),
  imageStorageId: v.optional(v.id("_storage")),
})
.index("by_niche", ["niche"])
.index("by_style", ["style"])
.searchIndex("search_tags", { searchField: "tags" })

aiGenerations: defineTable({
  userId: v.id("users"),
  prompt: v.string(),
  industry: v.optional(v.string()),
  aesthetic: v.optional(v.string()),
  referenceIds: v.array(v.id("referenceLayouts")),
  generatedBlocks: v.array(v.any()),
  userEdits: v.optional(v.array(v.any())),
  rating: v.optional(v.number()),
  editDistance: v.optional(v.number()),
})
.index("by_user", ["userId"])
.index("by_aesthetic", ["aesthetic"])
```

### Key Changes from Current Model
- **Normalized tables** (notebooks -> pages -> blocks) instead of deeply nested JSON
- **Real-time sync** via Convex subscriptions across devices
- **`referenceLayouts`** table stores digitized Etsy layouts as AI training data
- **`aiGenerations`** table captures every generation + user edits for feedback loop
- **`sortOrder`** fields enable drag-and-drop reordering
- **User auth** built into Convex

---

## AI Intelligence System

### Phase A: Smart Prompting + Reference Vault (Weeks 5-6)

```
User Prompt --> Context Enrichment --> Gemini --> Zod Validated Output
                     |
                     +-- User's past layouts (style preferences)
                     +-- Top 3 matching Etsy reference layouts
                     +-- Industry-specific few-shot examples
                     +-- Device context (mobile vs desktop)
```

- Move AI calls to Convex HTTP actions (API key server-side)
- Ingest Etsy layouts via Gemini Vision (screenshot -> PaperGrid blocks)
- Match user prompts to best reference layouts by niche/style/tags
- Inject references as few-shot examples in generation prompt
- Zod validation on all AI outputs

### Phase B: Feedback Loop (Month 2-3)

```
AI Generates --> User Edits --> Diff Computed --> Stored in aiGenerations
                                                       |
                                                       v
                                             Next generation uses
                                             "Users like you edited
                                              these layouts by doing Y"
```

- Track every generation in `aiGenerations` table
- After 5 minutes of editing, snapshot the "after" state
- Compute edit distance (how much user changed AI output)
- Optional: quick "Rate this layout" (1-5 stars) modal
- Feed back into prompts for improvement

### Phase C: Fine-Tuning (Month 4-6)

- Export 1,000+ generation-edit pairs as training data
- Format: input (prompt + context) -> output (user's final layout)
- Fine-tune Gemini Flash via Google AI Studio
- A/B test fine-tuned vs base model
- Measure edit distance reduction as success metric

### Etsy Ingestion Pipeline

```
Etsy URLs --> Scrape Images --> Gemini Vision Analysis --> PaperGrid Block Format --> Reference Vault
```

1. Fetch listing images from Etsy URLs
2. Use Gemini Vision to decompose layouts into structural elements
3. Convert analysis into PaperGrid block format
4. Auto-tag with niche, style, paper type, features
5. Store in `referenceLayouts` table with popularity score

---

## React Native Mobile App

### Project Structure

```
@papergrid/mobile (Expo)
  app/                    # Expo Router (file-based routing)
    (auth)/               # Login/signup screens
    (tabs)/
      notebooks.tsx       # Notebook grid/list
      ai.tsx              # AI generation screen
      settings.tsx        # User preferences
    notebook/[id].tsx     # Single notebook (page carousel)
    page/[id].tsx         # Full page editor
  components/
    MobileBlockComponent.tsx  # Touch-optimized blocks
    MobileNotebookView.tsx    # Single-page view (not spread on phone)
    GestureBlockEditor.tsx    # Swipe, pinch, drag interactions
    OfflineIndicator.tsx
  hooks/
    useOfflineSync.ts     # Convex offline mutation queue
```

### Platform Differences

| Feature | Web (Spread) | Mobile (Single Page) |
|---------|-------------|---------------------|
| Layout | 2-page spread | Single page, swipe between |
| Block editing | Click to edit | Tap to edit, long-press for options |
| Block reorder | Drag handle | Press-and-hold drag |
| AI generation | Modal dialog | Full-screen flow |
| Navigation | Arrow buttons | Swipe gestures |
| Paper feel | CSS patterns | React Native Canvas/SVG |

### Offline-First Architecture

1. On edit: write to local AsyncStorage AND send to Convex
2. If offline: queue mutations in AsyncStorage
3. On reconnect: flush queue to Convex in order
4. Conflict resolution: last-write-wins at block level

---

## Implementation Roadmap (12 Weeks)

### Week 1-2: Foundation
- Turborepo monorepo setup
- Extract `@papergrid/core` (types, validation, utilities)
- Fix critical bugs (color bug, state mutation, navigation bounds)
- Zod validation layer for all data
- Proper Tailwind PostCSS build (remove CDN)
- Git init + CI pipeline
- Replace Math.random() with crypto.randomUUID()

### Week 3-4: Convex Backend
- Convex project setup + schema deployment
- Auth integration (Clerk or Convex Auth)
- CRUD mutations (notebooks, pages, blocks)
- Real-time subscription queries
- Migrate from localStorage to Convex
- AI proxy as Convex HTTP action (fixes API key exposure)

### Week 5-6: AI Intelligence
- Etsy scraper pipeline (images from links.txt)
- Gemini Vision ingestion (screenshot -> blocks)
- Reference vault populated with 50+ layouts
- Smart prompting v2 with reference matching
- User preference context injection
- Feedback tracking (aiGenerations table)

### Week 7-8: Mobile App
- Expo project setup in monorepo
- Mobile block editor components
- Touch gestures (swipe, drag, long-press)
- Offline mutation queue
- Push notifications setup
- App Store / Play Store prep

### Week 9-10: Features
- Template marketplace (browse reference layouts)
- Export to PDF/PNG
- Drag & drop block reordering
- Search across notebooks
- Keyboard shortcuts (web)
- Share/collaborate on notebooks

### Week 11-12: Launch
- Beta testing (TestFlight + internal)
- Performance audit
- App Store submission
- Landing page
- Analytics integration (PostHog)
- Monetization setup (freemium tiers)

---

## Decision Log

| # | Decision | Alternatives | Rationale |
|---|----------|-------------|-----------|
| 1 | Turborepo monorepo | Separate repos, Capacitor | Max code reuse, single TS codebase, best DX for small team |
| 2 | Convex.dev backend | Supabase, Firebase, custom | User preference + TypeScript-native + real-time built-in |
| 3 | React Native (Expo) | Flutter, PWA, native | Shares React codebase, Expo simplifies deployment |
| 4 | Etsy Reference Vault | Generic prompt templates | Proven layouts = competitive moat, real market data |
| 5 | Gemini Vision for ingestion | Manual digitization | Scalable, can process hundreds of layouts automatically |
| 6 | 3-phase AI progression | Jump to fine-tuning | Ships value fast, builds training data progressively |
| 7 | Normalized Convex schema | Nested JSON (current) | Granular real-time sync, better queries, block-level updates |
| 8 | Offline-first mobile | Online-only | Notebooks must work anywhere (airplane, commute) |
| 9 | 12-week roadmap | 6 weeks (aggressive) | Realistic for quality across 3 parallel tracks |
| 10 | Gemini 3.1 Pro for complex layouts | Keep 2.5 Flash for all | 2x reasoning performance (77.1% ARC-AGI-2), thinking levels, 1M context, $2/M input |
| 11 | Gemini 3 Flash for bulk/simple tasks | Use Pro for everything | 4x cheaper ($0.50/M input), fast enough for simple layouts and ingestion |
| 12 | Nano Banana 2 for image generation | External image tools | Native Gemini image gen, $0.03/image, text rendering, search grounding |
| 13 | Dedicated Python (FastAPI) AI microservice | Convex HTTP actions only | ML ecosystem, vector DB support, model switching, GPU inference path |
| 14 | Hybrid pricing (buy-once + optional sub) | Pure subscription | GoodNotes/Notability subscription backlash; hybrid respects users' wallets |
| 15 | Sticker/washi tape system (Tier 1 viral) | Skip customization | Etsy top planners include 5000+ stickers; direct monetization + TikTok content |
| 16 | Writing sounds / ASMR mode | Skip audio | Low effort, massive TikTok viral potential; note-taking ASMR = millions of views |

---

## AI Intelligence Stack (Updated 2026-02-28)

### Model Lineup

| Model | ID | Role | Price (in/out per 1M) |
|-------|----|----|----------------------|
| Gemini 3.1 Pro | `gemini-3.1-pro-preview` | Complex layout generation (thinking_level=high) | $2 / $12 |
| Gemini 3 Flash | `gemini-3-flash-preview` | Bulk ingestion, simple layouts, re-generation | $0.50 / $3 |
| Nano Banana 2 | `gemini-3.1-flash-image-preview` | Visual boards, cover previews, thumbnails | ~$0.03/img |
| Embeddings | `gemini-embedding-001` | Semantic reference vault search | Cheap |

### Current Generation Quality Audit (Grade: C+)

| Dimension | Grade | Biggest Gap |
|-----------|-------|-------------|
| Model Choice | D | Using 2.5 Flash instead of 3.1 Pro |
| Prompt Engineering | C+ | No few-shot examples, no references, no user context |
| Schema Design | B- | Missing matrixData, moodValue, checked from schema |
| Output Processing | C | No validation, Math.random IDs, hardcoded defaults |
| Context Pipeline | F | Completely stateless — zero user awareness |
| UX Flow | B | No preview, no regenerate, no history |
| Security | F | API key exposed in client bundle |

### AI Microservice Architecture (Python FastAPI)

```
Client → Convex (user context) → Python AI Service → Gemini → Convex (store) → Client

Components:
- Context Builder: assembles user history + preferences + device + time
- Reference Matcher: vector search against 50+ Etsy reference layouts
- Prompt Composer: builds mega-prompt with few-shot examples
- Model Router: picks model + thinking level per task complexity
- Output Validator: Pydantic validation + auto-repair
- Feedback Analyzer: edit distance tracking + pattern extraction
```

### Implementation Phases

- **Phase A (MVP)**: Reference-matched generation with 3.1 Pro + vault of 50+ layouts
- **Phase B (+2 weeks)**: Feedback loop — silent edit tracking + optional ratings
- **Phase C (+4 weeks)**: Fine-tuning with 1000+ generation-edit pairs

---

## Viral Features Strategy (Research-Backed)

### Market Window
GoodNotes 7 backlash + Notability trust issues + Remarkable pricing anger = clear opening.
Global digital planner market: $1.5B (2025) → $7B+ (2033).

### Tier 1: Build Immediately (High Viral + Low-Medium Effort)
1. **Polish AI Layout Generation** — PaperGrid's unique weapon, nobody else has this
2. **Sticker & Washi Tape System** — Direct monetization + TikTok content
3. **Paper Textures + Page Curl Animations** — Core brand identity, satisfying UX
4. **Writing/Page Sounds (ASMR Mode)** — Minimal dev effort, massive TikTok viral potential

### Tier 2: Build Next (Strong Differentiation)
5. **AI Handwriting Beautification** — GoodNotes' #1 most requested feature
6. **Template Marketplace + Creator Economy** — Notion's marketplace = $100M+ ecosystem
7. **Hyperlinked Navigation** — Premium planner standard
8. **Gamified Habit/Streak Tracking** — 40-60% higher DAU

### Tier 3: Strategic Investments
9. **Collaborative Shared Notebooks** — Couples, families, teams
10. **Offline-First + Cross-Device Sync** — Table stakes done well

### Revenue Model
- **Free**: 3 notebooks, basic papers, 20 stickers, 5 AI generations/month
- **One-Time ($29-39)**: Unlimited notebooks + papers + 200 stickers + offline
- **Pro Sub ($4.99/mo)**: Unlimited AI + cloud sync + marketplace access
- **Marketplace**: 15% commission on creator sales

---

## Sprint Status (2026-02-28)

### Week 1-2 Completion: 29%
| Milestone | Status |
|-----------|--------|
| Turborepo monorepo setup | Done |
| Tailwind v4 PostCSS build | Done |
| Extract @papergrid/core | Partial (types only, no barrel file, no Zod) |
| Fix 5 critical bugs | Not started (0/5 fixed) |
| Zod validation layer | Not started (installed but unused) |
| Git init + CI pipeline | Not started |
| Replace Math.random() | Not started (6 occurrences) |

### Critical Bugs (All Unfixed)
1. NotebookView.tsx:68 — default color returns red instead of gray
2. BlockComponent.tsx:78 — state mutation in grid cell handler
3. App.tsx:313 — navigation can exceed page bounds
4. App.tsx:110,129 — stale closure on page creation
5. vite.config.ts:13 — API key exposed in client bundle

### Convex Backend: Code Complete, Pending Deployment
- 8 files created in packages/convex/
- 6 tables, 9 indexes, full CRUD, HTTP AI proxy
- Manual steps: `npx convex dev` (login), set GEMINI_API_KEY, install client, add provider

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Convex offline support is limited | Mobile UX degrades offline | Custom AsyncStorage queue with conflict resolution |
| Etsy layouts may have copyright concerns | Legal risk | Use structural patterns only, not visual assets; transform into original layouts |
| Fine-tuning requires 1000+ examples | Delays Phase C | Phase A + B provide value immediately; fine-tuning is a bonus |
| React Native paper patterns are complex | Mobile parity with web | Start with simple patterns, iterate; use react-native-skia for canvas rendering |
| Small team, large scope | Burnout / delays | Strict YAGNI, ship incrementally, defer features that don't drive adoption |
