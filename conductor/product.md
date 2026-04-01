# Product Context: PaperGrid AI Notebook

## What It Is
A digital notebook app that simulates real physical notebooks with AI-powered layout generation. Users describe what they want ("weekly meal planner", "ADHD-friendly daily planner") and AI generates a structured, beautiful notebook page.

## Target Users
- Planner enthusiasts (bullet journal, weekly planners)
- Students (study planners, assignment trackers)
- Professionals (meeting notes, project trackers)
- Wellness/self-care users (habit trackers, mood journals)

## Core Value Proposition
- AI generates complete notebook layouts from natural language prompts
- Beautiful paper types (lined, grid, dotted, isometric, hex, etc.)
- Rich block types (17 total): text, headings, grids, calendars, habit trackers, mood trackers, time blocks, goal sections, etc.
- 3D book covers with PBR materials
- Sound effects (paper ASMR) and haptics

## Tech Stack Summary
- Frontend: React 19 + TypeScript + Vite + Tailwind CSS 4
- 3D: Three.js via @react-three/fiber
- Backend: Convex.dev (auth, AI proxy, real-time)
- AI: Google Gemini API (layout + cover generation)
- Validation: Zod schemas
- Mobile: Capacitor (iOS)
- Monorepo: packages/web, packages/core, packages/convex

## Current State
- Auth working (email/password via Convex)
- AI layout generation working (with few-shot reference matching)
- AI cover generation working
- 17 block types rendered
- Notebooks stored in localStorage (not yet cloud-synced)
- Deployed on Vercel
