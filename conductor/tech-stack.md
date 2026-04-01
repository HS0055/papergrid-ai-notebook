# Tech Stack

## Frontend
- React 19.2 + TypeScript 5.8
- Vite 6.2 (build tool)
- Tailwind CSS 4.1
- React Router 7.13
- Three.js 0.183 via @react-three/fiber 9.5
- GSAP 3.14 (animations)
- Lucide React (icons)
- html2canvas (export)
- dnd-kit (drag & drop)

## Backend
- Convex.dev (real-time backend)
  - HTTP actions for AI proxy
  - Mutations for auth/user management
  - Environment variables for API keys

## AI
- Google Gemini API (@google/genai)
  - Layout generation: structured JSON output with responseSchema
  - Cover generation: image generation
  - Few-shot prompting with reference layout matching

## Validation
- Zod 3.24 (shared schemas in @papergrid/core)

## Mobile
- Capacitor 8.1 (iOS)
- @capacitor/haptics

## Monorepo Structure
- packages/web - React app
- packages/core - Shared types, schemas, constants
- packages/convex - Backend functions

## Key Files
- `packages/convex/convex/http.ts` - AI generation endpoints, reference layouts, prompt engineering
- `packages/web/src/services/geminiService.ts` - Client-side AI service
- `packages/core/src/schemas.ts` - Zod schemas for all block types
- `packages/web/src/components/planner/` - Calendar, WeeklyView, HabitTracker, GoalSection, TimeBlock, DailySection blocks
