# Convex Backend Setup Report

**Date:** 2026-02-28
**Status:** Code complete, pending deployment
**Package:** `packages/convex/`

---

## What Was Created

### 1. Package Structure

```
packages/convex/
  package.json          -- @papergrid/convex workspace package
  tsconfig.json         -- TypeScript config for Convex functions
  convex/
    schema.ts           -- Full normalized database schema (6 tables)
    users.ts            -- User CRUD + preferences + plan management
    notebooks.ts        -- Notebook CRUD with cascade delete
    pages.ts            -- Page CRUD with sortOrder + reorder
    blocks.ts           -- Block CRUD + reorder + move between pages + batch create
    referenceLayouts.ts -- Etsy reference layout storage and queries
    aiGenerations.ts    -- AI generation history tracking + rating
    http.ts             -- HTTP action: AI proxy for Gemini API (server-side key)
```

### 2. Database Schema (6 tables, 9 indexes)

| Table | Fields | Indexes |
|-------|--------|---------|
| `users` | name, email, avatarUrl, plan, preferences | `by_email` |
| `notebooks` | userId, title, coverColor, bookmarks, isShared | `by_user` |
| `pages` | notebookId, title, paperType, aesthetic, themeColor, sortOrder | `by_notebook` |
| `blocks` | pageId, type, content, side, sortOrder, checked, alignment, emphasis, color, gridData, matrixData, moodValue | `by_page` |
| `referenceLayouts` | source, sourceUrl, niche, style, tags, paperType, blocks, popularity, imageStorageId | `by_niche`, `by_style` |
| `aiGenerations` | userId, prompt, industry, aesthetic, referenceIds, generatedBlocks, userEdits, rating, editDistance | `by_user`, `by_aesthetic` |

### 3. API Surface

#### Queries (real-time subscriptions)
- `notebooks:listByUser` -- List all notebooks for a user
- `notebooks:get` -- Get single notebook by ID
- `pages:listByNotebook` -- List pages ordered by sortOrder
- `pages:get` -- Get single page
- `blocks:listByPage` -- List blocks ordered by sortOrder
- `blocks:get` -- Get single block
- `users:getByEmail` -- Find user by email
- `users:get` -- Get user by ID
- `referenceLayouts:listByNiche` -- Query references by niche
- `referenceLayouts:listByStyle` -- Query references by style
- `aiGenerations:listByUser` -- User's generation history

#### Mutations (CRUD operations)
- `notebooks:create` / `notebooks:update` / `notebooks:remove` (cascade deletes pages+blocks)
- `pages:create` / `pages:update` / `pages:remove` (cascade deletes blocks, cleans bookmarks)
- `pages:reorder` -- Batch update sortOrder for drag-and-drop
- `blocks:create` / `blocks:update` / `blocks:remove`
- `blocks:reorder` -- Batch update sortOrder
- `blocks:moveBetweenPages` -- Move block to different page
- `blocks:createBatch` -- Insert multiple blocks at once (for AI-generated layouts)
- `users:create` -- Upsert user by email
- `users:updatePreferences` / `users:updatePlan`
- `referenceLayouts:create` / `referenceLayouts:update`
- `aiGenerations:create` / `aiGenerations:addUserEdits` / `aiGenerations:rate`

#### HTTP Actions
- `POST /api/generate-layout` -- AI proxy endpoint
  - Accepts: `{ prompt: string, industry?: string, aesthetic?: string }`
  - Returns: `{ title, paperType, themeColor, blocks[] }`
  - Server-side Gemini API key (fixes the client-side API key exposure)
  - Input validation: prompt required, 2000 char limit
  - CORS headers for cross-origin requests
  - Error responses: 400 (bad input), 502 (Gemini failure), 503 (not configured)

### 4. Security Improvements

- **API key moved server-side**: The Gemini API key is now stored as a Convex environment variable (`GEMINI_API_KEY`) and never exposed to the client bundle
- **Input validation**: Prompt length capped at 2000 characters
- **Proper error handling**: Server errors don't leak internal details to clients

---

## Manual Steps Required

### Step 1: Initialize Convex Project

```bash
cd packages/convex
npx convex dev
```

This will:
- Prompt you to log in to Convex (browser-based OAuth)
- Create a new Convex project (choose "create a new project")
- Generate the `convex/_generated/` directory with type definitions
- Deploy the schema and functions
- Start the development server with hot reload

### Step 2: Set the Gemini API Key

After the project is created, set the environment variable:

```bash
npx convex env set GEMINI_API_KEY "your-gemini-api-key-here"
```

### Step 3: Install Convex Client in Web Package

```bash
cd packages/web
npm install convex
```

### Step 4: Configure Web App to Use Convex

Add the Convex provider to the web app's entry point. You'll need the deployment URL from `npx convex dev` output:

```tsx
// packages/web/src/index.tsx
import { ConvexProvider, ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

// Wrap <App /> with:
<ConvexProvider client={convex}>
  <App />
</ConvexProvider>
```

Add to `.env.local` in `packages/web/`:
```
VITE_CONVEX_URL=https://your-deployment.convex.cloud
```

### Step 5: Migrate from localStorage to Convex

The current app uses `localStorage` for all data (see `App.tsx:9`). Migration path:

1. Replace `useState` + `localStorage` with `useQuery` / `useMutation` from `convex/react`
2. Replace `generateLayout` (client-side Gemini call) with a `fetch` to the HTTP action
3. Remove the `@google/genai` dependency from `packages/web`
4. Remove `API_KEY` from `vite.config.ts` defines

### Step 6: Production Deployment

```bash
cd packages/convex
npx convex deploy
```

---

## Architecture Notes

- **Normalized schema**: Notebooks -> Pages -> Blocks hierarchy uses foreign key references (Convex IDs), not nested JSON. This enables real-time granular updates.
- **Cascade deletes**: Deleting a notebook removes all its pages and blocks. Deleting a page removes all its blocks and cleans bookmark references.
- **Sort ordering**: Pages and blocks use `sortOrder` (number) for drag-and-drop reordering. Batch reorder mutations accept an ordered array of IDs.
- **Batch block creation**: The `blocks:createBatch` mutation inserts multiple blocks in a single transaction, used when an AI-generated layout produces a full page of blocks.
- **Reference layouts**: The `referenceLayouts` table stores Etsy publisher layout patterns for AI training reference data. Supports image storage via Convex's built-in `_storage` system.
- **AI generation tracking**: Every AI generation is recorded with prompt, parameters, output, and optional user edits + rating. This creates the training data pipeline for fine-tuning.
