import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { detectDomain, getDomainRules, getDesignPrinciples } from "./domainDetection";
import type { CompactBlock, CompactReference } from "./referenceLayouts";
import { registerAffiliateRoutes } from "./affiliateHttp";
import { registerStripeRoutes } from "./stripeWebhook";
import { registerCommunityRoutes } from "./communityHttp";
import { registerReferralRoutes } from "./referralsHttp";

// Generate a procedural premium SVG data URL as fallback cover
function buildFallbackCover(prompt: string): string {
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) {
    hash = ((hash << 5) - hash) + prompt.charCodeAt(i);
    hash |= 0;
  }
  const hue1 = Math.abs(hash % 360);
  const hue2 = (hue1 + 30) % 360;

  // Use a noise pattern + organic SVG shapes for a premium look
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="960" height="1280" viewBox="0 0 960 1280">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="hsl(${hue1},40%,20%)"/>
          <stop offset="100%" stop-color="hsl(${hue2},40%,30%)"/>
        </linearGradient>
        <filter id="n">
          <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="3" stitchTiles="stitch"/>
          <feColorMatrix type="saturate" values="0"/>
          <feBlend mode="multiply" in2="SourceGraphic"/>
        </filter>
      </defs>
      <rect width="960" height="1280" fill="url(#g)"/>
      <rect width="960" height="1280" fill="white" opacity="0.05" filter="url(#n)"/>
      <path d="M0 1280 L960 120 L960 1280 Z" fill="white" opacity="0.03"/>
      <rect x="76" y="76" width="808" height="1128" rx="4" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
      <circle cx="480" cy="640" r="280" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="40"/>
    </svg>
  `.trim();

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// Reference layouts and types imported from ./referenceLayouts

const REFERENCE_LAYOUTS: readonly CompactReference[] = [
  {
    id: "weekly-planner",
    niche: "productivity",
    style: "structured weekly overview with focus and notes areas",
    aesthetic: "minimalist",
    tags: ["weekly", "planner", "schedule", "week", "productivity", "time management", "organization", "minimalist", "professional"],
    paperType: "grid",
    themeColor: "slate",
    title: "Weekly Planner",
    blocks: [
      { type: "HEADING", content: "Week of ___________", side: "left", color: "slate", emphasis: "bold", alignment: "center" },
      { type: "WEEKLY_VIEW", content: "Weekly Schedule", side: "left", color: "slate", weeklyViewData: { days: [{ label: "Monday", content: "" }, { label: "Tuesday", content: "" }, { label: "Wednesday", content: "" }, { label: "Thursday", content: "" }, { label: "Friday", content: "" }, { label: "Saturday", content: "" }, { label: "Sunday", content: "" }] } },
      { type: "DIVIDER", content: "", side: "right" },
      { type: "HEADING", content: "Focus This Week", side: "right", color: "indigo", emphasis: "bold" },
      { type: "CHECKBOX", content: "Top priority #1", side: "right", checked: false },
      { type: "CHECKBOX", content: "Top priority #2", side: "right", checked: false },
      { type: "CHECKBOX", content: "Top priority #3", side: "right", checked: false },
      { type: "CALLOUT", content: "Notes & reminders for the week go here.", side: "right", color: "gray", emphasis: "italic" },
    ],
  },
  {
    id: "daily-planner",
    niche: "self-care",
    style: "time-blocked daily page with gratitude and mood",
    aesthetic: "pastel",
    tags: ["daily", "planner", "schedule", "time blocks", "gratitude", "mood", "pastel", "self-care", "rose", "priorities"],
    paperType: "lined",
    themeColor: "rose",
    title: "Daily Planner",
    blocks: [
      { type: "HEADING", content: "Today: ___________", side: "left", color: "rose", emphasis: "bold", alignment: "center" },
      { type: "CALLOUT", content: "Top 3 Priorities", side: "left", color: "rose", emphasis: "bold" },
      { type: "CHECKBOX", content: "1. _______________", side: "left", checked: false },
      { type: "CHECKBOX", content: "2. _______________", side: "left", checked: false },
      { type: "CHECKBOX", content: "3. _______________", side: "left", checked: false },
      { type: "TIME_BLOCK", content: "Time Blocks", side: "left", color: "rose", timeBlockData: { startHour: 7, endHour: 17, interval: 60, entries: [{ time: "7:00 AM", content: "" }, { time: "8:00 AM", content: "" }, { time: "9:00 AM", content: "" }, { time: "10:00 AM", content: "" }, { time: "11:00 AM", content: "" }, { time: "12:00 PM", content: "Lunch" }, { time: "1:00 PM", content: "" }, { time: "2:00 PM", content: "" }, { time: "3:00 PM", content: "" }, { time: "4:00 PM", content: "" }, { time: "5:00 PM", content: "" }] } },
      { type: "DIVIDER", content: "", side: "right" },
      { type: "HEADING", content: "Gratitude", side: "right", color: "rose", emphasis: "bold" },
      { type: "TEXT", content: "Today I am grateful for...", side: "right", color: "rose", emphasis: "italic" },
      { type: "MOOD_TRACKER", content: "How are you feeling today?", side: "right", color: "rose", moodValue: 3, alignment: "center" },
      { type: "QUOTE", content: "\"The secret of getting ahead is getting started.\" - Mark Twain", side: "right", color: "rose", emphasis: "italic", alignment: "center" },
    ],
  },
  {
    id: "student-study-planner",
    niche: "student",
    style: "class schedule with assignment tracker and study tips",
    aesthetic: "pastel",
    tags: ["student", "study", "school", "college", "university", "assignments", "class schedule", "homework", "academic", "education", "planner"],
    paperType: "grid",
    themeColor: "rose",
    title: "Student Study Planner",
    blocks: [
      { type: "HEADING", content: "Study Planner - Week of ___", side: "left", color: "rose", emphasis: "bold", alignment: "center" },
      { type: "GRID", content: "Class Schedule", side: "left", color: "rose", gridColumns: ["Time", "Mon", "Tue", "Wed", "Thu", "Fri"], gridRowCount: 7 },
      { type: "DIVIDER", content: "", side: "right" },
      { type: "HEADING", content: "Assignments Due", side: "right", color: "indigo", emphasis: "bold" },
      { type: "GRID", content: "Assignment Tracker", side: "right", color: "indigo", gridColumns: ["Subject", "Assignment", "Due Date", "Status"], gridRowCount: 5 },
      { type: "CALLOUT", content: "Study Tips: Use active recall, space your reviews (1-3-7 days), and take breaks every 25 min (Pomodoro).", side: "right", color: "rose", emphasis: "italic" },
      { type: "CHECKBOX", content: "Review flashcards", side: "right", checked: false },
      { type: "CHECKBOX", content: "Finish reading chapter", side: "right", checked: false },
      { type: "CHECKBOX", content: "Submit homework", side: "right", checked: false },
    ],
  },
  {
    id: "adhd-friendly-planner",
    niche: "adhd",
    style: "brain dump with pick just 3 and priority matrix, bold colors",
    aesthetic: "bold",
    tags: ["adhd", "neurodivergent", "brain dump", "focus", "rainbow", "priority matrix", "executive function", "planner", "colorful", "tasks", "simple"],
    paperType: "dotted",
    themeColor: "amber",
    title: "ADHD-Friendly Daily Planner",
    blocks: [
      { type: "HEADING", content: "Brain Dump Zone", side: "left", color: "amber", emphasis: "bold", alignment: "center" },
      { type: "CALLOUT", content: "Write EVERYTHING on your mind. No filtering, no judging. Just get it out of your head.", side: "left", color: "amber", emphasis: "italic" },
      { type: "TEXT", content: "", side: "left" },
      { type: "DIVIDER", content: "", side: "left" },
      { type: "HEADING", content: "Pick Just 3", side: "left", color: "emerald", emphasis: "bold", alignment: "center" },
      { type: "CALLOUT", content: "From your brain dump, pick ONLY 3 things. That is enough. You are enough.", side: "left", color: "emerald", emphasis: "italic" },
      { type: "CHECKBOX", content: "1.", side: "left", color: "emerald", emphasis: "bold", checked: false },
      { type: "CHECKBOX", content: "2.", side: "left", color: "sky", emphasis: "bold", checked: false },
      { type: "CHECKBOX", content: "3.", side: "left", color: "rose", emphasis: "bold", checked: false },
      { type: "DIVIDER", content: "", side: "right" },
      { type: "HEADING", content: "Priority Matrix", side: "right", color: "sky", emphasis: "bold", alignment: "center" },
      { type: "PRIORITY_MATRIX", content: "Sort your tasks", side: "right", color: "sky", matrixData: { q1: "Urgent + Important: DO NOW", q2: "Important, Not Urgent: SCHEDULE", q3: "Urgent, Not Important: DELEGATE", q4: "Neither: DROP IT" } },
      { type: "MOOD_TRACKER", content: "Energy check-in", side: "right", color: "rose", moodValue: 2, alignment: "center" },
      { type: "CALLOUT", content: "Remember: Done is better than perfect. Progress, not perfection.", side: "right", color: "amber", emphasis: "bold", alignment: "center" },
    ],
  },
  {
    id: "habit-tracker",
    niche: "habits",
    style: "habits-by-week grid with monthly reflection",
    aesthetic: "minimalist",
    tags: ["habit", "tracker", "habits", "routine", "wellness", "health", "consistency", "goals", "self-improvement", "monthly", "reflection"],
    paperType: "grid",
    themeColor: "emerald",
    title: "Monthly Habit Tracker",
    blocks: [
      { type: "HEADING", content: "Habit Tracker - Month: ___", side: "left", color: "emerald", emphasis: "bold", alignment: "center" },
      { type: "GRID", content: "Habits", side: "left", color: "emerald", gridColumns: ["Habit", "Wk 1", "Wk 2", "Wk 3", "Wk 4"], gridRowCount: 7 },
      { type: "DIVIDER", content: "", side: "right" },
      { type: "HEADING", content: "Monthly Reflection", side: "right", color: "emerald", emphasis: "bold" },
      { type: "TEXT", content: "What went well this month?\n\nWhat could be better?\n\nWhat habit do I want to add next month?", side: "right", color: "emerald" },
      { type: "MOOD_TRACKER", content: "Overall month mood", side: "right", color: "emerald", moodValue: 3, alignment: "center" },
      { type: "QUOTE", content: "\"We are what we repeatedly do. Excellence, then, is not an act, but a habit.\" - Aristotle", side: "right", color: "emerald", emphasis: "italic", alignment: "center" },
    ],
  },
  {
    id: "monthly-overview",
    niche: "productivity",
    style: "monthly goals with key dates and budget snapshot",
    aesthetic: "minimalist",
    tags: ["monthly", "overview", "goals", "budget", "calendar", "dates", "planner", "organization", "planning", "professional"],
    paperType: "grid",
    themeColor: "indigo",
    title: "Monthly Overview",
    blocks: [
      { type: "HEADING", content: "Monthly Overview - ___________", side: "left", color: "indigo", emphasis: "bold", alignment: "center" },
      { type: "CALLOUT", content: "Monthly Goals", side: "left", color: "indigo", emphasis: "bold" },
      { type: "CHECKBOX", content: "Goal 1: _______________", side: "left", checked: false },
      { type: "CHECKBOX", content: "Goal 2: _______________", side: "left", checked: false },
      { type: "CHECKBOX", content: "Goal 3: _______________", side: "left", checked: false },
      { type: "DIVIDER", content: "", side: "left" },
      { type: "GRID", content: "Key Dates", side: "left", color: "indigo", gridColumns: ["Date", "Event / Deadline"], gridRowCount: 6 },
      { type: "DIVIDER", content: "", side: "right" },
      { type: "HEADING", content: "Budget Snapshot", side: "right", color: "emerald", emphasis: "bold" },
      { type: "GRID", content: "Budget", side: "right", color: "emerald", gridColumns: ["Category", "Planned", "Actual"], gridRowCount: 6 },
      { type: "TEXT", content: "Notes: _______________", side: "right", color: "gray" },
    ],
  },
  {
    id: "meal-planner",
    niche: "cooking",
    style: "7-day meal grid with grocery checklist",
    aesthetic: "clean",
    tags: ["meal", "planner", "food", "cooking", "grocery", "shopping list", "recipes", "nutrition", "diet", "weekly meals", "health"],
    paperType: "grid",
    themeColor: "emerald",
    title: "Weekly Meal Planner",
    blocks: [
      { type: "HEADING", content: "Meal Planner - Week of ___", side: "left", color: "emerald", emphasis: "bold", alignment: "center" },
      { type: "GRID", content: "Meals", side: "left", color: "emerald", gridColumns: ["Day", "Breakfast", "Lunch", "Dinner"], gridRowCount: 7 },
      { type: "DIVIDER", content: "", side: "right" },
      { type: "HEADING", content: "Grocery List", side: "right", color: "emerald", emphasis: "bold" },
      { type: "CHECKBOX", content: "Produce: _______________", side: "right", checked: false },
      { type: "CHECKBOX", content: "Protein: _______________", side: "right", checked: false },
      { type: "CHECKBOX", content: "Dairy: _______________", side: "right", checked: false },
      { type: "CHECKBOX", content: "Grains: _______________", side: "right", checked: false },
      { type: "CHECKBOX", content: "Snacks: _______________", side: "right", checked: false },
      { type: "CALLOUT", content: "Meal prep tip: Prep protein + grains on Sunday, assemble fresh salads daily.", side: "right", color: "emerald", emphasis: "italic" },
    ],
  },
  {
    id: "fitness-tracker",
    niche: "fitness",
    style: "exercise grid with body stats and progress tracking",
    aesthetic: "bold",
    tags: ["fitness", "exercise", "gym", "workout", "tracker", "health", "strength", "cardio", "body", "weight", "progress", "training"],
    paperType: "grid",
    themeColor: "sky",
    title: "Fitness Tracker",
    blocks: [
      { type: "HEADING", content: "Workout Log - Week of ___", side: "left", color: "sky", emphasis: "bold", alignment: "center" },
      { type: "GRID", content: "Exercise Log", side: "left", color: "sky", gridColumns: ["Exercise", "Sets", "Reps", "Weight", "Notes"], gridRowCount: 7 },
      { type: "DIVIDER", content: "", side: "right" },
      { type: "HEADING", content: "Body Stats", side: "right", color: "sky", emphasis: "bold" },
      { type: "GRID", content: "Measurements", side: "right", color: "sky", gridColumns: ["Metric", "This Week", "Last Week", "Change"], gridRowCount: 5 },
      { type: "CALLOUT", content: "Progress note: How do you feel compared to last week? Any PRs?", side: "right", color: "sky", emphasis: "italic" },
      { type: "MOOD_TRACKER", content: "Post-workout energy", side: "right", color: "sky", moodValue: 4, alignment: "center" },
    ],
  },
  {
    id: "budget-tracker",
    niche: "finance",
    style: "income and expense grids with savings goals",
    aesthetic: "clean",
    tags: ["budget", "finance", "money", "tracker", "income", "expenses", "savings", "financial", "spending", "planner", "accounting"],
    paperType: "grid",
    themeColor: "emerald",
    title: "Monthly Budget Tracker",
    blocks: [
      { type: "HEADING", content: "Budget Tracker - Month: ___", side: "left", color: "emerald", emphasis: "bold", alignment: "center" },
      { type: "CALLOUT", content: "Income Sources", side: "left", color: "emerald", emphasis: "bold" },
      { type: "GRID", content: "Income", side: "left", color: "emerald", gridColumns: ["Source", "Expected", "Actual", "Date"], gridRowCount: 3 },
      { type: "DIVIDER", content: "", side: "left" },
      { type: "CALLOUT", content: "Expenses", side: "left", color: "rose", emphasis: "bold" },
      { type: "GRID", content: "Expenses", side: "left", color: "rose", gridColumns: ["Category", "Budget", "Spent", "Remaining"], gridRowCount: 7 },
      { type: "DIVIDER", content: "", side: "right" },
      { type: "HEADING", content: "Savings Goals", side: "right", color: "sky", emphasis: "bold" },
      { type: "GRID", content: "Savings", side: "right", color: "sky", gridColumns: ["Goal", "Target", "Saved", "Progress"], gridRowCount: 3 },
      { type: "TEXT", content: "Total Income: $___  |  Total Expenses: $___  |  Net: $___", side: "right", color: "indigo", emphasis: "bold", alignment: "center" },
      { type: "CALLOUT", content: "Financial tip: Follow the 50/30/20 rule - 50% needs, 30% wants, 20% savings.", side: "right", color: "amber", emphasis: "italic" },
    ],
  },
  {
    id: "bullet-journal-daily-log",
    niche: "bujo",
    style: "rapid logging with checkboxes, gratitude, and mood",
    aesthetic: "bujo",
    tags: ["bullet journal", "bujo", "rapid log", "daily log", "journal", "gratitude", "mood", "minimalist", "analog", "planner", "creative"],
    paperType: "dotted",
    themeColor: "amber",
    title: "Daily Log",
    blocks: [
      { type: "HEADING", content: "Daily Log - ___________", side: "left", color: "amber", emphasis: "bold", alignment: "center" },
      { type: "CALLOUT", content: "Rapid Log: Use checkboxes for tasks, text for notes and events.", side: "left", color: "amber", emphasis: "italic" },
      { type: "CHECKBOX", content: "Task: _______________", side: "left", checked: false },
      { type: "CHECKBOX", content: "Task: _______________", side: "left", checked: false },
      { type: "CHECKBOX", content: "Task: _______________", side: "left", checked: false },
      { type: "TEXT", content: "Event: _______________", side: "left", color: "indigo" },
      { type: "TEXT", content: "Note: _______________", side: "left", color: "gray", emphasis: "italic" },
      { type: "DIVIDER", content: "", side: "right" },
      { type: "HEADING", content: "Gratitude", side: "right", color: "amber", emphasis: "bold" },
      { type: "TEXT", content: "Three things I am grateful for today:\n1.\n2.\n3.", side: "right", color: "amber" },
      { type: "MOOD_TRACKER", content: "End of day mood", side: "right", color: "amber", moodValue: 3, alignment: "center" },
      { type: "QUOTE", content: "\"The best time to plant a tree was 20 years ago. The second best time is now.\"", side: "right", color: "amber", emphasis: "italic", alignment: "center" },
    ],
  },
  {
    id: "monthly-planner",
    niche: "productivity",
    style: "full page monthly calendar grid with daily typable boxes",
    aesthetic: "clean",
    tags: ["monthly", "planner", "calendar", "month", "grid", "planning", "schedule", "typable", "dates"],
    paperType: "grid",
    themeColor: "indigo",
    title: "Monthly Calendar Planner",
    blocks: [
      { type: "HEADING", content: "Month: ___________", side: "left", color: "indigo", emphasis: "bold", alignment: "center" },
      { type: "GRID", content: "", side: "left", color: "indigo", gridColumns: ["Sunday", "Monday", "Tuesday", "Wednesday"], gridRowCount: 5 },
      { type: "HEADING", content: "Monthly Focus", side: "right", color: "indigo", emphasis: "bold", alignment: "center" },
      { type: "GRID", content: "", side: "right", color: "indigo", gridColumns: ["Thursday", "Friday", "Saturday"], gridRowCount: 5 },
      { type: "GOAL_SECTION", content: "Goals", side: "right", color: "indigo", goalSectionData: { goals: [{ text: "Main Goal 1", subItems: [{ text: "Action step", checked: false }] }, { text: "Main Goal 2", subItems: [{ text: "Action step", checked: false }] }] } },
      { type: "HABIT_TRACKER", content: "Key Habits", side: "right", color: "emerald", habitTrackerData: { habits: ["Workout", "Read", "Meditate"], days: 30, checked: [[false], [false], [false]] } },
    ],
  },
];

// ---------------------------------------------------------------------------
// matchReferences  --  scores each reference layout against a user prompt and
// returns the top N best-matching layouts.  Embedded here because Convex
// cannot import from @papergrid/core.
// ---------------------------------------------------------------------------

// Domain-to-niche mapping for boosting references in the same domain
const DOMAIN_NICHE_MAP: Record<string, string[]> = {
  finance: ["finance", "budget", "money", "accounting"],
  wellness: ["self-care", "wellness", "mindfulness", "journal", "gratitude"],
  health_fitness: ["fitness", "cooking", "health", "nutrition", "exercise"],
  lifestyle: ["lifestyle", "travel", "reading", "cleaning", "organization"],
  business: ["business", "project", "sales", "freelance"],
  marketing: ["marketing", "social media", "content", "brand"],
  academic: ["student", "academic", "study", "research", "education"],
  planning: ["productivity", "planner", "habits", "bujo", "time management"],
};

function matchReferences(
  prompt: string,
  aesthetic?: string,
  maxResults = 4,
  detectedDomain?: string,
): { layout: CompactReference; score: number }[] {
  const lowerPrompt = prompt.toLowerCase();
  const promptWords = lowerPrompt.split(/\s+/);
  const lowerAesthetic = aesthetic?.toLowerCase();

  // Get niches that belong to the detected domain for boosting
  const domainNiches = detectedDomain ? (DOMAIN_NICHE_MAP[detectedDomain] || []) : [];

  const scored = REFERENCE_LAYOUTS.map((layout) => {
    let score = 0;

    // Tag matches: 3 points each
    for (const tag of layout.tags) {
      if (lowerPrompt.includes(tag.toLowerCase())) {
        score += 3;
      }
    }

    // Niche match: 5 points
    if (lowerPrompt.includes(layout.niche.toLowerCase())) {
      score += 5;
    }

    // Domain boost: if this layout's niche belongs to the detected domain, +8 points
    // This ensures domain-relevant layouts rank higher even without exact keyword matches
    if (domainNiches.some(n => layout.niche.toLowerCase().includes(n) || layout.tags.some(t => t.toLowerCase().includes(n)))) {
      score += 8;
    }

    // Aesthetic match (from explicit parameter): 2 points
    if (lowerAesthetic && layout.aesthetic.toLowerCase() === lowerAesthetic) {
      score += 2;
    }

    // Also check if the prompt itself mentions the layout's aesthetic: 2 points
    if (lowerPrompt.includes(layout.aesthetic.toLowerCase())) {
      score += 2;
    }

    // Style keyword matches: 2 points per overlapping word
    const styleWords = layout.style.toLowerCase().split(/\s+/);
    for (const word of styleWords) {
      if (word.length <= 2) continue;
      if (promptWords.includes(word)) {
        score += 2;
      }
    }

    return { layout, score };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.layout.id.localeCompare(b.layout.id);
  });

  return scored.slice(0, maxResults);
}

// ---------------------------------------------------------------------------
// HTTP Router
// ---------------------------------------------------------------------------

const http = httpRouter();

// Allowed origins for local/dev + production/custom domains + Vercel aliases/previews
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  // Production-mode local preview (npm run dev:prod) — same code, different port,
  // so VITE_COMING_SOON_PAPERS env var can be tested side-by-side with dev.
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "capacitor://localhost",
  "ionic://localhost",
  "https://papergrid.app",
  "https://www.papergrid.app",
  "https://papergrid-five.vercel.app",
  "https://papergrid-hayks-projects-362899dc.vercel.app",
  "https://papergrid-hayksayadyan155-2492-hayks-projects-362899dc.vercel.app",
];

function isAllowedVercelPreview(origin: string): boolean {
  if (!origin.startsWith("https://")) return false;
  const host = origin.slice("https://".length);
  return host.startsWith("papergrid-") && host.endsWith(".vercel.app");
}

function getCorsOrigin(request: Request): string {
  const origin = request.headers.get("Origin") ?? "";
  if (!origin) return ALLOWED_ORIGINS[0];
  if (ALLOWED_ORIGINS.includes(origin) || isAllowedVercelPreview(origin)) return origin;
  return ALLOWED_ORIGINS[0];
}

function makeCorsHeaders(request: Request) {
  return {
    "Access-Control-Allow-Origin": getCorsOrigin(request),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Session-Token",
  };
}

// Extract clean error message from Convex mutation errors.
// Convex wraps thrown errors as "Uncaught Error: <message>\n    at handler (...)"
function extractErrorMessage(error: any, fallback: string): string {
  const raw: string = error?.message || error?.data || fallback;
  // Strip "Uncaught Error: " prefix
  let msg = raw.replace(/^Uncaught Error:\s*/i, "");
  // Strip stack trace (everything from first newline)
  const newlineIdx = msg.indexOf("\n");
  if (newlineIdx !== -1) msg = msg.slice(0, newlineIdx);
  return msg.trim() || fallback;
}

function getSessionTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }
  return request.headers.get("X-Session-Token");
}

// Best-effort client IP extraction. Cloudflare → cf-connecting-ip; most
// proxies → x-forwarded-for (first entry). Clamped to 64 chars so a
// pathological header can't blow up rate-limit keys.
function getClientIp(request: Request): string | null {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf.trim().slice(0, 64);
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim().slice(0, 64) ?? null;
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim().slice(0, 64);
  return null;
}

http.route({
  path: "/api/generate-layout",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // CORS headers
    const corsHeaders = makeCorsHeaders(request);

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      // --- Auth is REQUIRED. No more silent fallback on failure. ---
      // Previously this route wrapped the auth/Ink check in try/catch and
      // on failure continued to the expensive Gemini call anyway. That was
      // an unauthenticated cost-drain vector. Now: no session → 401; any
      // error in the auth/Ink path → 401 (fail closed).
      const sessionToken = getSessionTokenFromRequest(request) ?? undefined;
      if (!sessionToken) {
        return new Response(
          JSON.stringify({ error: "Authentication required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const me = await ctx.runQuery(api.users.getCurrentUser, { sessionToken });
      if (!me) {
        return new Response(
          JSON.stringify({ error: "Authentication required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const userId = (me as any)._id as string;

      // Rate limit: 20 layout generations / user / hour. Admin can loosen
      // via the RATE_LIMIT_RULES constants in rateLimit.ts.
      const rlUser = await ctx.runMutation(api.rateLimit.consume, {
        scope: "user", subject: userId,
        action: "ai.generate_layout", limit: 20, windowMs: 60 * 60 * 1000,
      });
      if (!rlUser.allowed) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded for AI generation.", retryAfterSec: rlUser.retryAfterSec }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rlUser.retryAfterSec) } }
        );
      }
      // IP floor: 60/hr catches credential sharing across many accounts.
      const clientIp = getClientIp(request);
      if (clientIp) {
        const rlIp = await ctx.runMutation(api.rateLimit.consume, {
          scope: "ip", subject: clientIp,
          action: "ai.generate_layout_ip", limit: 60, windowMs: 60 * 60 * 1000,
        });
        if (!rlIp.allowed) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded from this network." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rlIp.retryAfterSec) } }
          );
        }
      }

      // Ink pre-check. Fails closed: if the user has <1 Ink OR the check
      // errors, we 402 — we do NOT continue to Gemini.
      const preview = await ctx.runQuery(api.users.previewInkCost, {
        sessionToken, action: "layout",
      });
      const inkBalance = preview.balance;
      if (inkBalance < 1) {
        return new Response(
          JSON.stringify({
            error: "Not enough Ink. You need at least 1 Ink to generate.",
            inkRequired: 1,
            inkBalance,
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const body = await request.json();
      const { prompt, industry, aesthetic, existingPages, pageCount } = body as {
        prompt: string;
        industry?: string;
        aesthetic?: string;
        existingPages?: Array<{ title: string; paperType: string; themeColor: string; blockSummary: string }>;
        pageCount?: string;
      };

      if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: "prompt is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Rate limiting: max prompt length 2000 chars
      if (prompt.length > 2000) {
        return new Response(
          JSON.stringify({ error: "prompt exceeds 2000 character limit" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Retrieve server-side API key from environment variable
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error("GEMINI_API_KEY environment variable is not set");
        return new Response(
          JSON.stringify({ error: "AI service is not configured" }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // --- Domain Detection ---
      const domainMatch = detectDomain(prompt, industry);
      const domainRules = getDomainRules(domainMatch.domain);
      const designPrinciples = getDesignPrinciples();

      // --- Few-shot reference matching (domain-aware) ---
      const matches = matchReferences(prompt, aesthetic, 4, domainMatch.domain);
      const referenceExamples = matches
        .filter((m) => m.score > 0)
        .map(
          (m, i) =>
            `Example ${i + 1} (${m.layout.title} - ${m.layout.aesthetic} style, ${m.layout.niche} niche):\n${JSON.stringify(
              {
                title: m.layout.title,
                paperType: m.layout.paperType,
                themeColor: m.layout.themeColor,
                blocks: m.layout.blocks,
              },
              null,
              2
            )}`
        )
        .join("\n\n");

      const hasReferences = referenceExamples.length > 0;

      // --- Build context strings ---
      const industryContext = industry ? `Industry/Context: ${industry}.` : "";
      const aestheticContext = aesthetic
        ? `Aesthetic Style: ${aesthetic}.`
        : "Aesthetic Style: pastel (default -- use soft rose, sky, emerald tones).";
      const currentDate = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      // --- Build continuation context ---
      const continuationContext = existingPages && existingPages.length > 0
        ? `
=== EXISTING PAGES IN THIS NOTEBOOK ===
The user already has these pages. DO NOT repeat them. Continue from where they left off. Match their style and aesthetic for consistency.
${existingPages.map((p, i) => `Page ${i + 1}: "${p.title}" (${p.paperType}, ${p.themeColor}) — ${p.blockSummary}`).join("\n")}
=== END EXISTING PAGES ===
`
        : "";

      // --- Build user prompt ---
      const domainLabel = domainMatch.domain !== "general" ? `\nDetected Domain: ${domainMatch.domain.replace("_", " ")} (${domainMatch.confidence} confidence)` : "";

      const userPrompt = `You are a world-class planner product designer creating pages for a premium digital notebook app. You think like an Etsy/KDP template creator — every page you design should look like it belongs in a $29 planner bundle, not a free to-do app.
${industryContext} ${aestheticContext}${domainLabel}
Current Date: ${currentDate}

User Request: "${prompt}"
${continuationContext}
${hasReferences
          ? `
=== REFERENCE EXAMPLES ===
Here are ${matches.filter((m) => m.score > 0).length} high-quality layouts from our design library. Study their structure, block variety, and content density — then create something BETTER:

${referenceExamples}

=== END REFERENCE EXAMPLES ===
`
          : ""
        }
${designPrinciples}

${domainRules}

=== PAGE COUNT ===
${pageCount === "1" ? "Generate EXACTLY 1 page. Do NOT generate multiple pages. Focus all content into a single, rich, well-designed page." : "YOU decide how many pages this request needs (1 to 5 pages max per generation). Think like a planner designer — a 'weekly planner' needs 2-3 pages, a 'monthly planner' needs 4-5, a 'daily planner for the week' needs 5 (Mon-Fri). Simple requests like 'meeting notes' or 'grocery list' need just 1 page."}

=== DATE RULES ===
- Current date is ${currentDate}.
- ALL dates inside blocks MUST match the page they belong to. This is CRITICAL:
  * DAILY_SECTION blocks: dayLabel and date fields MUST match the page title. If page is "Monday, April 7" then dayLabel = "Monday, April 7" and date = "2026-04-07". NEVER use a different date.
  * WEEKLY_VIEW blocks: day labels MUST use correct days for that week. "Week of April 7-13" → Monday April 7 through Sunday April 13.
  * CALENDAR blocks: month/year MUST match page context.
  * TIME_BLOCK entries should reflect the page's date.
  * HEADING and TEXT blocks with dates MUST match the page title date.
- When generating multiple pages, EACH page covers a DIFFERENT time period. NEVER repeat dates across pages.
- Calculate the next Monday from ${currentDate} as start of first week.
- Use actual calendar math: April has 30 days, correct day-of-week names.

Each page is a SEPARATE notebook page with its own title, paper type, theme color, and blocks.
${pageCount !== "1" ? "Vary the page designs — different pages should serve different roles (overview vs detail, schedule vs reflection, tracker vs notes)." : "Pack as much useful content as possible into this single page."}
${existingPages && existingPages.length > 0 ? "IMPORTANT: This is a CONTINUATION. The user already has pages. Generate the NEXT logical pages that follow from what exists. Do not repeat content." : ""}

=== AESTHETIC RULES ===
Adhere to the requested aesthetic:
- 'pastel': Soft, warm tones. Favor rose, sky, emerald. Use 'lined' or 'dotted' paper.
- 'modern-planner': Comprehensive dashboards. Use 'blank' or 'lined', 'indigo' or 'rose' theme.
- 'e-ink': High contrast, minimalist. Use 'grid' or 'dotted', 'slate' or 'gray' theme.
- 'bujo': Playful, freeform. Use 'dotted' or 'crumpled', 'amber' or 'sky' theme.
- 'cornell': Academic. Use 'legal' or 'lined', 'slate' theme.
- 'rainbow': Vibrant, ADHD-friendly. Vary colors per section. Use 'dotted' or 'blank'.

=== BLOCK USAGE ===
1. Mix TEXT blocks with GRID, CALLOUT, QUOTE, DIVIDER, MOOD_TRACKER, PRIORITY_MATRIX, INDEX.
2. For "planners", "trackers", or "logs": favor GRID with specific columns, WEEKLY_VIEW for weekly spreads, HABIT_TRACKER for habits, TIME_BLOCK for hourly schedules, DAILY_SECTION for day structure, CALENDAR for month views.
3. Prefer specialized block types: WEEKLY_VIEW over 7-row GRID, HABIT_TRACKER over habits-in-columns GRID, TIME_BLOCK over time-slot GRID.
4. Use REAL dates based on ${currentDate}. Fill in actual day names, dates, month names — never placeholders like "___".
5. CRITICAL — SPREAD LAYOUT: Each page is a 2-page spread (left page + right page). You MUST use BOTH sides:
   - Put roughly HALF the blocks on side:"left" and HALF on side:"right".
   - The first 2-3 sections go on the left page, the remaining sections go on the right page.
   - NEVER put all blocks on one side. A page with 10 blocks should have ~5 left and ~5 right.
   - Each side should have at least 3 blocks. An empty right page looks broken.
6. Pre-populate GRID blocks with realistic headers AND example data rows. CHECKBOX blocks default checked=false.
7. Each page must have a unique, descriptive title using real dates: "Week of April 7-13" or "April Savings Dashboard".
8. Vary themeColor subtly across pages for visual interest while maintaining aesthetic coherence.
9. Every page needs 6-14 blocks minimum for a rich, professional look. Aim for 8-12.
10. PROGRESS_BAR: Use for savings goals, budget remaining, project completion. Set current (0-100), target label, and color.
11. RATING: Use for satisfaction, quality, mood ratings. Use star style for reviews, heart for wellness, circle for neutral. Set max=5 for quick, max=10 for detailed.
12. WATER_TRACKER: Use for daily wellness pages. Default goal=8. Set filled=0 for fresh trackers.
13. SECTION_NAV: Use on index/overview pages to link to other pages. Include descriptive labels and optional emoji icons.
14. KANBAN: Use for project management, task boards, workflows. Create 3-4 columns (e.g. "To Do", "In Progress", "Done"). Pre-populate with realistic cards.

=== MANDATORY VISUAL DESIGN ===
EVERY page MUST use these visual features. Do NOT skip them even when generating multiple pages.

REQUIRED on EVERY HEADING block:
- icon: ALWAYS set an emoji icon. Use: ⏰📅🎯💰📊✅📝💡⚡💪🧘💧🍽️📚🏃✈️📈🤝
- containerStyle: ALWAYS set to "banner" on section headings, "card" on standalone blocks
- emphasis: "bold" for section labels (ALL-CAPS), default for page titles

REQUIRED on EVERY page:
- groupId: EVERY block MUST have a groupId. Group 2-5 consecutive related blocks with the same groupId.
- Each page needs 3-4 groups. Name them: "top-priorities", "schedule", "habits", "notes", "reflection", "tracking", etc.
- Each group uses a DIFFERENT color for visual contrast.

CONTAINER STYLES (use on every page):
- "banner" on HEADING blocks = colored background section bar
- "card" on GRID, GOAL_SECTION, KANBAN, HABIT_TRACKER = rounded card with shadow
- "accent-left" on CALLOUT, QUOTE = colored left border

HEADING RULES:
- MAX 3-4 HEADING blocks per page.
- NEVER repeat the same heading text.
- 1 default heading (page title) + 2-3 bold banner headings (section labels).

COLOR VARIETY:
- Use different colors for different sections on the same page. Finance group = emerald, Goals group = indigo, Habits group = amber, Wellness = pink, Schedule = sky.
- Available colors: rose, indigo, emerald, amber, slate, sky, gray, violet, pink.
- Each group should use a DIFFERENT color for visual contrast.

SIDE-BY-SIDE LAYOUT (Premium Etsy Feature):
- When two SMALL blocks should appear SIDE BY SIDE, give them the same groupId ending with "-row".
- Example: groupId "wellness-row" for WATER_TRACKER + MOOD_TRACKER displayed side by side.
- Example: groupId "metrics-row" for PROGRESS_BAR + RATING side by side.
- Example: groupId "notes-row" for two short TEXT blocks or CALLOUT + QUOTE side by side.
- RULES: Only use "-row" for PAIRS of exactly 2 blocks. Never 3+ blocks in a row group.
- NEVER put these in a "-row" group (they need full width): WEEKLY_VIEW, KANBAN, GRID, TIME_BLOCK, CALENDAR, HABIT_TRACKER, DAILY_SECTION.
- Good "-row" candidates: PROGRESS_BAR + PROGRESS_BAR, RATING + WATER_TRACKER, MOOD_TRACKER + RATING, CALLOUT + CALLOUT, CHECKBOX + CHECKBOX (short pairs), TEXT + TEXT (two reflection prompts).
- Use at least 1-2 "-row" groups per page for professional layout variety. This is what makes Etsy planners look premium.

SECTION CONTAINERS (Level 3 — Premium Design):
- For rich section containers, combine a banner HEADING + "-row" group:
  * First block: HEADING with containerStyle:"banner" → spans full width as section header
  * Next 2 blocks: small blocks that appear side by side below the header
  * Example: groupId "finances-row" with [HEADING "📊 MONTHLY FINANCES" (banner), PROGRESS_BAR "Income", PROGRESS_BAR "Expenses"]
  * This creates a professional container: colored header bar on top, two metrics side by side below
- Mix vertical groups and "-row" groups on each page for visual variety.

Return ONLY a JSON object. No markdown, no explanation. Exact format:
{
  "pages": [
    {
      "title": "Page Title With Real Date",
      "paperType": "dotted",
      "themeColor": "indigo",
      "blocks": [
        {
          "type": "HEADING",
          "content": "Section Title",
          "side": "left",
          "color": "indigo",
          "emphasis": "bold",
          "containerStyle": "banner",
          "icon": "🎯",
          "groupId": "section-name"
        },
        {
          "type": "CHECKBOX",
          "content": "Task description",
          "side": "left",
          "color": "indigo",
          "checked": false,
          "groupId": "section-name"
        },
        {
          "type": "WEEKLY_VIEW",
          "content": "Weekly Schedule",
          "side": "right",
          "color": "sky",
          "containerStyle": "card",
          "groupId": "schedule",
          "weeklyViewData": {
            "startDate": "2026-04-06",
            "days": [
              {"label": "Monday", "content": "", "tasks": [{"text": "Team meeting", "checked": false}]},
              {"label": "Tuesday", "content": "", "tasks": []},
              {"label": "Wednesday", "content": "", "tasks": []},
              {"label": "Thursday", "content": "", "tasks": []},
              {"label": "Friday", "content": "", "tasks": []},
              {"label": "Saturday", "content": "", "tasks": []},
              {"label": "Sunday", "content": "", "tasks": []}
            ]
          }
        }
      ]
    }
  ]
}

Block types available: TEXT, HEADING, GRID, CHECKBOX, CALLOUT, QUOTE, DIVIDER, MOOD_TRACKER, PRIORITY_MATRIX, INDEX, CALENDAR, WEEKLY_VIEW, HABIT_TRACKER, GOAL_SECTION, TIME_BLOCK, DAILY_SECTION, PROGRESS_BAR, RATING, WATER_TRACKER, SECTION_NAV, KANBAN.
Paper types: lined, grid, dotted, blank, music, rows, isometric, hex, legal, crumpled.
Theme colors: rose, indigo, emerald, amber, slate, sky, gray, violet, pink.
Container styles: banner, card, accent-left, none.
Side: left, right (use BOTH sides on every page).
Each block MUST have: type, content, side, color. Optional: emphasis, alignment, containerStyle, icon, groupId, checked, gridData, weeklyViewData, habitTrackerData, goalSectionData, timeBlockData, dailySectionData, calendarData, matrixData, progressBarData, ratingData, waterTrackerData, kanbanData, sectionNavData.

Generate 8-14 blocks per page. Use diverse block types. Fill BOTH left and right sides.`;

      // Block schema (reused for each page)
      const blockSchema = {
        type: "OBJECT" as const,
        properties: {
          type: {
            type: "STRING" as const,
            enum: ["TEXT", "HEADING", "GRID", "CHECKBOX", "CALLOUT", "QUOTE", "DIVIDER", "MOOD_TRACKER", "PRIORITY_MATRIX", "INDEX", "MUSIC_STAFF", "CALENDAR", "WEEKLY_VIEW", "HABIT_TRACKER", "GOAL_SECTION", "TIME_BLOCK", "DAILY_SECTION", "PROGRESS_BAR", "RATING", "WATER_TRACKER", "SECTION_NAV", "KANBAN"],
          },
          content: { type: "STRING" as const },
          alignment: { type: "STRING" as const, enum: ["left", "center", "right"] },
          emphasis: { type: "STRING" as const, enum: ["bold", "italic", "highlight", "none"] },
          color: { type: "STRING" as const, enum: ["rose", "indigo", "emerald", "amber", "slate", "sky", "gray", "violet", "pink"] },
          side: { type: "STRING" as const, enum: ["left", "right"] },
          gridData: {
            type: "OBJECT" as const,
            properties: {
              columns: { type: "ARRAY" as const, items: { type: "STRING" as const } },
              rows: { type: "ARRAY" as const, items: { type: "ARRAY" as const, items: { type: "STRING" as const } } },
            },
            nullable: true,
          },
          moodValue: { type: "NUMBER" as const, nullable: true },
          matrixData: {
            type: "OBJECT" as const,
            properties: { q1: { type: "STRING" as const }, q2: { type: "STRING" as const }, q3: { type: "STRING" as const }, q4: { type: "STRING" as const } },
            nullable: true,
          },
          checked: { type: "BOOLEAN" as const, nullable: true },
          calendarData: {
            type: "OBJECT" as const,
            properties: {
              month: { type: "NUMBER" as const }, year: { type: "NUMBER" as const },
              highlights: { type: "ARRAY" as const, items: { type: "NUMBER" as const } },
              events: { type: "ARRAY" as const, items: { type: "OBJECT" as const, properties: { day: { type: "NUMBER" as const }, title: { type: "STRING" as const }, color: { type: "STRING" as const } } } },
            },
            nullable: true,
          },
          weeklyViewData: {
            type: "OBJECT" as const,
            properties: {
              startDate: { type: "STRING" as const },
              days: { type: "ARRAY" as const, items: { type: "OBJECT" as const, properties: { label: { type: "STRING" as const }, content: { type: "STRING" as const }, tasks: { type: "ARRAY" as const, items: { type: "OBJECT" as const, properties: { text: { type: "STRING" as const }, checked: { type: "BOOLEAN" as const } } } } } } },
            },
            nullable: true,
          },
          habitTrackerData: {
            type: "OBJECT" as const,
            properties: {
              habits: { type: "ARRAY" as const, items: { type: "STRING" as const } },
              days: { type: "NUMBER" as const },
              checked: { type: "ARRAY" as const, items: { type: "ARRAY" as const, items: { type: "BOOLEAN" as const } } },
            },
            nullable: true,
          },
          goalSectionData: {
            type: "OBJECT" as const,
            properties: {
              goals: { type: "ARRAY" as const, items: { type: "OBJECT" as const, properties: {
                text: { type: "STRING" as const },
                subItems: { type: "ARRAY" as const, items: { type: "OBJECT" as const, properties: { text: { type: "STRING" as const }, checked: { type: "BOOLEAN" as const } } } },
                progress: { type: "NUMBER" as const },
              } } },
            },
            nullable: true,
          },
          timeBlockData: {
            type: "OBJECT" as const,
            properties: {
              startHour: { type: "NUMBER" as const }, endHour: { type: "NUMBER" as const }, interval: { type: "NUMBER" as const },
              entries: { type: "ARRAY" as const, items: { type: "OBJECT" as const, properties: { time: { type: "STRING" as const }, content: { type: "STRING" as const }, color: { type: "STRING" as const } } } },
            },
            nullable: true,
          },
          dailySectionData: {
            type: "OBJECT" as const,
            properties: {
              date: { type: "STRING" as const }, dayLabel: { type: "STRING" as const },
              sections: { type: "ARRAY" as const, items: { type: "OBJECT" as const, properties: { label: { type: "STRING" as const }, content: { type: "STRING" as const } } } },
            },
            nullable: true,
          },
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
          containerStyle: {
            type: "STRING" as const,
            enum: ["card", "banner", "accent-left", "none"],
            nullable: true,
          },
          icon: { type: "STRING" as const, nullable: true },
          groupId: { type: "STRING" as const, nullable: true },
        },
        required: ["type", "content"],
      };

      const geminiPayload = {
        contents: [
          { parts: [{ text: userPrompt }] },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 4096 },
        },
        systemInstruction: {
          parts: [
            {
              text: "You are an expert planner and notebook designer. You create multi-page notebook layouts that feel hand-crafted and highly usable — like a premium paper planner brought to life digitally. You decide how many pages each request needs based on the content scope. You use real dates and never leave placeholders. Each page you create serves a distinct purpose and has unique content.",
            },
          ],
        },
      };

      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geminiPayload),
        }
      );

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        console.error("Gemini API error:", geminiResponse.status, errorText);
        return new Response(
          JSON.stringify({ error: "AI generation failed" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const geminiData = await geminiResponse.json();

      // Extract the generated text from Gemini response
      // Check for finish reason issues
      const finishReason = geminiData?.candidates?.[0]?.finishReason;
      if (finishReason && finishReason !== "STOP") {
        console.warn(`Gemini finishReason: ${finishReason}`);
      }

      // With thinking mode, parts[0] may be thinking content, parts[last] is the actual response
      // Get the LAST part that has a text field (the final JSON output)
      const allParts = geminiData?.candidates?.[0]?.content?.parts || [];
      const textParts = allParts.filter((p: Record<string, unknown>) => typeof p.text === "string" && !p.thought);
      const generatedText = textParts.length > 0 ? textParts[textParts.length - 1].text : null;
      if (!generatedText) {
        console.error("Gemini returned no text. Full response:", JSON.stringify(geminiData).slice(0, 500));
        return new Response(
          JSON.stringify({ error: "No content generated", finishReason }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Gemini response: ${generatedText.length} chars, finishReason: ${finishReason}, parts: ${allParts.length}, textParts: ${textParts.length}`);
      console.log(`Gemini raw first 500 chars: ${generatedText.slice(0, 500)}`);

      // Parse and validate the response
      const layoutData = JSON.parse(generatedText);

      // Hydrate blocks with IDs (using crypto.randomUUID for proper unique IDs)
      const generateId = () => crypto.randomUUID();

      const parseGridData = (raw: unknown) => {
        if (!raw || typeof raw !== "object") return undefined;
        const grid = raw as Record<string, unknown>;
        const columns = Array.isArray(grid.columns) ? grid.columns : [];
        const rows = Array.isArray(grid.rows) ? grid.rows : [];
        return {
          columns,
          rows: rows.map((row: unknown) =>
            (Array.isArray(row) ? row : []).map((cellText: unknown) => ({
              id: generateId(),
              content: typeof cellText === "string" ? cellText : "",
            }))
          ),
        };
      };

      const parseMatrixData = (raw: unknown) => {
        if (!raw || typeof raw !== "object") return undefined;
        const matrix = raw as Record<string, unknown>;
        return {
          q1: typeof matrix.q1 === "string" ? matrix.q1 : "",
          q2: typeof matrix.q2 === "string" ? matrix.q2 : "",
          q3: typeof matrix.q3 === "string" ? matrix.q3 : "",
          q4: typeof matrix.q4 === "string" ? matrix.q4 : "",
        };
      };

      const parseCalendarData = (raw: unknown) => {
        if (!raw || typeof raw !== "object") return undefined;
        const cal = raw as Record<string, unknown>;
        return {
          month: typeof cal.month === "number" ? cal.month : new Date().getMonth() + 1,
          year: typeof cal.year === "number" ? cal.year : new Date().getFullYear(),
          highlights: Array.isArray(cal.highlights) ? cal.highlights.filter((n: unknown) => typeof n === "number") : [],
          events: Array.isArray(cal.events)
            ? cal.events.map((e: unknown) => {
              const ev = e as Record<string, unknown>;
              return {
                day: typeof ev.day === "number" ? ev.day : 1,
                title: typeof ev.title === "string" ? ev.title : "",
                color: typeof ev.color === "string" ? ev.color : undefined,
              };
            })
            : [],
        };
      };

      const parseWeeklyViewData = (raw: unknown) => {
        if (!raw || typeof raw !== "object") return undefined;
        const wv = raw as Record<string, unknown>;
        const days = Array.isArray(wv.days)
          ? wv.days.map((d: unknown) => {
            const day = d as Record<string, unknown>;
            return {
              label: typeof day.label === "string" ? day.label : "",
              content: typeof day.content === "string" ? day.content : "",
              tasks: Array.isArray(day.tasks)
                ? day.tasks.map((t: unknown) => {
                  const task = t as Record<string, unknown>;
                  return {
                    text: typeof task.text === "string" ? task.text : "",
                    checked: task.checked === true,
                  };
                })
                : [],
            };
          })
          : [
            { label: "Monday", content: "", tasks: [] }, { label: "Tuesday", content: "", tasks: [] },
            { label: "Wednesday", content: "", tasks: [] }, { label: "Thursday", content: "", tasks: [] },
            { label: "Friday", content: "", tasks: [] }, { label: "Saturday", content: "", tasks: [] },
            { label: "Sunday", content: "", tasks: [] },
          ];
        return { startDate: typeof wv.startDate === "string" ? wv.startDate : undefined, days };
      };

      const parseHabitTrackerData = (raw: unknown) => {
        if (!raw || typeof raw !== "object") return undefined;
        const ht = raw as Record<string, unknown>;
        const habits = Array.isArray(ht.habits) ? ht.habits.filter((h: unknown) => typeof h === "string") as string[] : [];
        const days = typeof ht.days === "number" ? ht.days : 7;
        const checked = Array.isArray(ht.checked)
          ? ht.checked.map((row: unknown) =>
            Array.isArray(row) ? row.map((v: unknown) => v === true) : new Array(days).fill(false)
          )
          : habits.map(() => new Array(days).fill(false));
        return { habits, days, checked };
      };

      const parseGoalSectionData = (raw: unknown) => {
        if (!raw || typeof raw !== "object") return undefined;
        const gs = raw as Record<string, unknown>;
        const goals = Array.isArray(gs.goals)
          ? gs.goals.map((g: unknown) => {
            const goal = g as Record<string, unknown>;
            return {
              text: typeof goal.text === "string" ? goal.text : "",
              subItems: Array.isArray(goal.subItems)
                ? goal.subItems.map((si: unknown) => {
                  const sub = si as Record<string, unknown>;
                  return { text: typeof sub.text === "string" ? sub.text : "", checked: sub.checked === true };
                })
                : [],
              progress: typeof goal.progress === "number" ? goal.progress : undefined,
            };
          })
          : [];
        return { goals };
      };

      const parseTimeBlockData = (raw: unknown) => {
        if (!raw || typeof raw !== "object") return undefined;
        const tb = raw as Record<string, unknown>;
        return {
          startHour: typeof tb.startHour === "number" ? tb.startHour : 8,
          endHour: typeof tb.endHour === "number" ? tb.endHour : 18,
          interval: (tb.interval === 30 ? 30 : 60) as 30 | 60,
          entries: Array.isArray(tb.entries)
            ? tb.entries.map((e: unknown) => {
              const entry = e as Record<string, unknown>;
              return {
                time: typeof entry.time === "string" ? entry.time : "",
                content: typeof entry.content === "string" ? entry.content : "",
                color: typeof entry.color === "string" ? entry.color : undefined,
              };
            })
            : [],
        };
      };

      const parseDailySectionData = (raw: unknown) => {
        if (!raw || typeof raw !== "object") return undefined;
        const ds = raw as Record<string, unknown>;
        return {
          date: typeof ds.date === "string" ? ds.date : undefined,
          dayLabel: typeof ds.dayLabel === "string" ? ds.dayLabel : undefined,
          sections: Array.isArray(ds.sections)
            ? ds.sections.map((s: unknown) => {
              const section = s as Record<string, unknown>;
              return {
                label: typeof section.label === "string" ? section.label : "",
                content: typeof section.content === "string" ? section.content : "",
              };
            })
            : [{ label: "Morning", content: "" }, { label: "Afternoon", content: "" }, { label: "Evening", content: "" }],
        };
      };

      const hydrateBlocks = (rawBlocks: Record<string, unknown>[], fallbackColor: string) =>
        rawBlocks.map((b, index) => ({
          id: generateId(),
          type: b.type || "TEXT",
          content: b.content || "",
          checked: typeof b.checked === "boolean" ? b.checked : false,
          alignment: b.alignment || "left",
          emphasis: b.emphasis || "none",
          color: b.color || fallbackColor || "rose",
          side: b.side || "left",
          sortOrder: index,
          moodValue:
            b.type === "MOOD_TRACKER"
              ? (typeof b.moodValue === "number" ? b.moodValue : 3)
              : undefined,
          matrixData:
            b.type === "PRIORITY_MATRIX"
              ? parseMatrixData(b.matrixData) || { q1: "", q2: "", q3: "", q4: "" }
              : undefined,
          gridData: parseGridData(b.gridData) || (
            // Fallback: handle gridColumns/gridRowCount format from reference layouts
            Array.isArray(b.gridColumns) ? {
              columns: b.gridColumns as string[],
              rows: Array.from({ length: typeof b.gridRowCount === "number" ? b.gridRowCount : 3 }, () =>
                (b.gridColumns as string[]).map(() => ({ id: generateId(), content: "" }))
              ),
            } : undefined
          ),
          calendarData:
            b.type === "CALENDAR"
              ? parseCalendarData(b.calendarData) || { month: new Date().getMonth() + 1, year: new Date().getFullYear(), highlights: [] }
              : undefined,
          weeklyViewData:
            b.type === "WEEKLY_VIEW"
              ? parseWeeklyViewData(b.weeklyViewData)
              : undefined,
          habitTrackerData:
            b.type === "HABIT_TRACKER"
              ? parseHabitTrackerData(b.habitTrackerData)
              : undefined,
          goalSectionData:
            b.type === "GOAL_SECTION"
              ? parseGoalSectionData(b.goalSectionData)
              : undefined,
          timeBlockData:
            b.type === "TIME_BLOCK"
              ? parseTimeBlockData(b.timeBlockData)
              : undefined,
          dailySectionData:
            b.type === "DAILY_SECTION"
              ? parseDailySectionData(b.dailySectionData)
              : undefined,
          // Phase 2 block types — pass through as-is
          progressBarData: b.type === "PROGRESS_BAR" && b.progressBarData ? b.progressBarData : undefined,
          ratingData: b.type === "RATING" && b.ratingData ? b.ratingData : undefined,
          waterTrackerData: b.type === "WATER_TRACKER" && b.waterTrackerData ? b.waterTrackerData : undefined,
          sectionNavData: b.type === "SECTION_NAV" && b.sectionNavData ? b.sectionNavData : undefined,
          kanbanData: b.type === "KANBAN" && b.kanbanData ? b.kanbanData : undefined,
          // Visual styling fields
          containerStyle: typeof b.containerStyle === "string" ? b.containerStyle : undefined,
          icon: typeof b.icon === "string" ? b.icon : undefined,
          groupId: typeof b.groupId === "string" ? b.groupId : undefined,
        }));

      // Multi-page support: AI returns { pages: [...] }
      const rawPages: Record<string, unknown>[] = Array.isArray(layoutData.pages)
        ? layoutData.pages
        : [layoutData];

      // Structural block types that are valid even without text content
      const structuralTypes = new Set(["DIVIDER", "MOOD_TRACKER", "PRIORITY_MATRIX", "CALENDAR", "WEEKLY_VIEW", "HABIT_TRACKER", "GOAL_SECTION", "TIME_BLOCK", "DAILY_SECTION", "INDEX", "PROGRESS_BAR", "RATING", "WATER_TRACKER", "SECTION_NAV", "KANBAN"]);

      const pages = rawPages.map((page: Record<string, unknown>) => {
        const allBlocks = hydrateBlocks(
          (Array.isArray(page.blocks) ? page.blocks : []) as Record<string, unknown>[],
          (page.themeColor as string) || "slate"
        );
        // Filter out blank blocks: keep structural types + blocks with actual content or grid data
        const validBlocks = allBlocks.filter((b) =>
          structuralTypes.has(b.type as string) ||
          (typeof b.content === "string" && b.content.trim().length > 0) ||
          b.gridData
        );
        return {
          title: (page.title as string) || "Untitled",
          paperType: (page.paperType as string) || "lined",
          themeColor: (page.themeColor as string) || "slate",
          blocks: validBlocks,
        };
      }).filter((p) => p.blocks.length > 0); // Remove entirely empty pages

      if (pages.length === 0) {
        return new Response(
          JSON.stringify({ error: "AI generated empty content. Please try again." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Charge Ink per page generated (1 Ink per page)
      let inkCharged = 0;
      try {
        if (sessionToken && pages.length > 0) {
          const chargeResult = await ctx.runMutation(api.users.spendInk, {
            sessionToken,
            action: "layout",
            amount: pages.length,
          });
          inkCharged = chargeResult.allowed ? pages.length : 0;
        }
      } catch (e) {
        console.warn("Ink charging skipped:", e);
      }

      const result = { pages, inkCharged, pageCount: pages.length };

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Generate layout error:", error);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }),
});

http.route({
  path: "/api/generate-cover",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = makeCorsHeaders(request);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      // REQUIRE auth. Previously this route had NO auth, NO rate limit,
      // and NO Ink charge — anyone could hit it to generate unlimited
      // Gemini images on our API key.
      const sessionToken = getSessionTokenFromRequest(request) ?? undefined;
      if (!sessionToken) {
        return new Response(
          JSON.stringify({ error: "Authentication required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const me = await ctx.runQuery(api.users.getCurrentUser, { sessionToken });
      if (!me) {
        return new Response(
          JSON.stringify({ error: "Authentication required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const userId = (me as any)._id as string;

      // Rate limit: 20 covers / user / hour.
      const rlUser = await ctx.runMutation(api.rateLimit.consume, {
        scope: "user", subject: userId,
        action: "ai.generate_cover", limit: 20, windowMs: 60 * 60 * 1000,
      });
      if (!rlUser.allowed) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded.", retryAfterSec: rlUser.retryAfterSec }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rlUser.retryAfterSec) } }
        );
      }

      const body = await request.json();
      const { prompt, aesthetic } = body as {
        prompt: string;
        aesthetic?: string;
      };

      if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: "prompt is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (prompt.length > 2000) {
        return new Response(
          JSON.stringify({ error: "prompt exceeds 2000 character limit" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "AI service is not configured" }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Atomic Ink spend BEFORE the Gemini call.
      const spend = (await ctx.runMutation(api.users.spendInk, {
        sessionToken, action: "cover",
      })) as { allowed: boolean; balance?: number; cost?: number };
      if (!spend.allowed) {
        return new Response(
          JSON.stringify({
            error: "Not enough Ink to generate a cover.",
            inkBalance: spend.balance,
            inkRequired: spend.cost,
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const styleContext = aesthetic || "premium leather journal";
      // Title is NEVER baked into the image — the 3D BookCoverScene renders it
      // dynamically as a gold foil text overlay, so name changes are free/instant.
      const imagePrompt = `Generate a flat, front-facing notebook cover surface design that will be texture-mapped onto a 3D book model. CRITICAL REQUIREMENTS: The artwork MUST fill the ENTIRE canvas edge-to-edge with ZERO white borders, margins, padding, or empty space around the edges. The design must bleed all the way to every edge. No perspective, no angled book, no book spine, no desk, no props, no mockup, no physical shadows. Do NOT include any text, words, titles, initials, or lettering. The design features: ${prompt}. Style: ${styleContext}. Use premium surface details such as leather grain, linen weave, foil stamping, embossing, debossing, ornamental pattern, painted artwork, or refined texture. The design must have a rich, fully saturated background color or pattern that extends to all four edges — imagine wrapping paper that has no white border. Include a visible focal composition (centered emblem, medallion, decorative frame, botanical motif, or art-deco geometry) with enough contrast to read clearly. Portrait orientation, taller than wide, 3:4 aspect ratio. The ENTIRE rectangle must be filled with design — absolutely no white or blank areas at any edge.`;

      // Use the current Gemini native image generation model
      const geminiPayload = {
        contents: [{ parts: [{ text: imagePrompt }] }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      };

      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geminiPayload),
        }
      );

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        console.error("Gemini image gen error:", geminiResponse.status, errorText);
        let detail = `Gemini API error ${geminiResponse.status}`;
        try {
          const parsed = JSON.parse(errorText);
          detail = parsed?.error?.message || detail;
        } catch { /* keep default */ }
        return new Response(
          JSON.stringify({ error: detail }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const geminiData = await geminiResponse.json();
      const parts = geminiData?.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find((p: Record<string, unknown>) => p.inlineData);

      if (!imagePart?.inlineData) {
        // Check for blocked content or missing image
        const blockReason = geminiData?.candidates?.[0]?.finishReason;
        const feedback = geminiData?.promptFeedback?.blockReason;
        const reason = feedback || blockReason || "unknown";
        console.error("Gemini returned no image. Reason:", reason, JSON.stringify(geminiData).slice(0, 500));
        return new Response(
          JSON.stringify({ error: `AI could not generate image (${reason}). Try a different prompt.` }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { mimeType, data } = imagePart.inlineData as { mimeType: string; data: string };
      const dataUrl = `data:${mimeType};base64,${data}`;
      return new Response(JSON.stringify({ imageUrl: dataUrl }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Generate cover error:", error);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }),
});

http.route({
  path: "/api/auth/login",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = makeCorsHeaders(request);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      const body = await request.json();
      const email = typeof body?.email === "string" ? body.email : "";
      const password = typeof body?.password === "string" ? body.password : "";

      if (!email.trim() || !password) {
        return new Response(JSON.stringify({ error: "email and password are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Rate limit: 5 login attempts per email per minute + 30 per IP per
      // minute (credential-stuffing protection). Runs BEFORE the password
      // comparison so we don't amplify a timing oracle.
      const emailLower = email.trim().toLowerCase();
      const rlEmail = await ctx.runMutation(api.rateLimit.consume, {
        scope: "email", subject: emailLower,
        action: "auth.login", limit: 5, windowMs: 60_000,
      });
      if (!rlEmail.allowed) {
        return new Response(JSON.stringify({ error: "Too many login attempts. Please wait a minute and try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rlEmail.retryAfterSec) },
        });
      }
      const clientIp = getClientIp(request);
      if (clientIp) {
        const rlIp = await ctx.runMutation(api.rateLimit.consume, {
          scope: "ip", subject: clientIp,
          action: "auth.login_ip", limit: 30, windowMs: 60_000,
        });
        if (!rlIp.allowed) {
          return new Response(JSON.stringify({ error: "Too many login attempts from this network." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rlIp.retryAfterSec) },
          });
        }
      }

      const result = await ctx.runMutation(api.users.loginWithEmailPassword, {
        email,
        password,
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error: any) {
      console.error("Auth login error:", error);
      const message = extractErrorMessage(error, "Login failed");
      const status = message.includes("Invalid") || message.includes("no password") ? 401 : 500;
      return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/api/auth/signup",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = makeCorsHeaders(request);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      const body = await request.json();
      const email = typeof body?.email === "string" ? body.email : "";
      const password = typeof body?.password === "string" ? body.password : "";
      const name = typeof body?.name === "string" ? body.name : undefined;
      // Optional referral code captured at signup — consumed AFTER the
      // user row exists via internal.referrals.attachOnSignupInternal.
      // We accept it from the body (client persisted from ?ref=) OR a
      // signed cookie if we ever issue one.
      const referralCode =
        typeof body?.referralCode === "string" && body.referralCode.trim()
          ? body.referralCode.trim().slice(0, 32)
          : undefined;

      if (!email.trim() || !password) {
        return new Response(JSON.stringify({ error: "email and password are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Rate limit: 3 signups per email per minute + 10 per IP per minute
      // (signup spam + throwaway-account abuse protection).
      const rlEmail = await ctx.runMutation(api.rateLimit.consume, {
        scope: "email", subject: email.trim().toLowerCase(),
        action: "auth.signup", limit: 3, windowMs: 60_000,
      });
      if (!rlEmail.allowed) {
        return new Response(JSON.stringify({ error: "Too many signups. Please wait a minute." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rlEmail.retryAfterSec) },
        });
      }
      const clientIp = getClientIp(request);
      if (clientIp) {
        const rlIp = await ctx.runMutation(api.rateLimit.consume, {
          scope: "ip", subject: clientIp,
          action: "auth.signup_ip", limit: 10, windowMs: 60_000,
        });
        if (!rlIp.allowed) {
          return new Response(JSON.stringify({ error: "Too many signups from this network." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rlIp.retryAfterSec) },
          });
        }
      }

      const result = await ctx.runMutation(api.users.signupWithEmailPassword, {
        email,
        password,
        name,
      });

      // If a referral code was supplied, attach the user to the
      // referrer. Any failure here is swallowed — we never want to
      // block a signup on the growth-loop side path.
      if (referralCode && result && typeof (result as any).user?._id === "string") {
        try {
          await ctx.runMutation(internal.referrals.attachOnSignupInternal, {
            userId: (result as any).user._id,
            code: referralCode,
            ip: clientIp ?? undefined,
            userAgent: request.headers.get("user-agent") ?? undefined,
          });
        } catch (e) {
          console.warn("Referral attach failed (non-fatal):", e);
        }
      }

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error: any) {
      console.error("Auth signup error:", error);
      const message = extractErrorMessage(error, "Signup failed");
      const status = message.includes("already in use") ? 409 : 500;
      return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/api/auth/me",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = makeCorsHeaders(request);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      const sessionToken = getSessionTokenFromRequest(request) ?? undefined;
      const user = await ctx.runQuery(api.users.getCurrentUser, { sessionToken });
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ user }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Auth me error:", error);
      return new Response(JSON.stringify({ error: "Failed to resolve user" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/api/auth/logout",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = makeCorsHeaders(request);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      const body = await request.json().catch(() => ({}));
      const fromBody = typeof body?.sessionToken === "string" ? body.sessionToken : null;
      const sessionToken = fromBody ?? getSessionTokenFromRequest(request);
      if (!sessionToken) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await ctx.runMutation(api.users.logoutWithSession, { sessionToken });
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Auth logout error:", error);
      return new Response(JSON.stringify({ error: "Logout failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }),
});

// ── Password Reset ───────────────────────────────────────

http.route({
  path: "/api/auth/forgot-password",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = makeCorsHeaders(request);
    try {
      const body = await request.json();
      const email = typeof body?.email === "string" ? body.email : "";
      if (!email.trim()) {
        return new Response(JSON.stringify({ error: "Email is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Rate limit: 3 resets per email per minute AND a per-IP floor of
      // 10/min. Both checks run before any DB lookup.
      const clientIp = getClientIp(request);
      const rl1 = await ctx.runMutation(api.rateLimit.consume, {
        scope: "email", subject: email.trim().toLowerCase(),
        action: "auth.password_reset_req", limit: 3, windowMs: 60_000,
      });
      if (!rl1.allowed) {
        return new Response(JSON.stringify({ error: "Too many requests" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rl1.retryAfterSec) },
        });
      }
      if (clientIp) {
        const rl2 = await ctx.runMutation(api.rateLimit.consume, {
          scope: "ip", subject: clientIp,
          action: "auth.password_reset_req_ip", limit: 10, windowMs: 60_000,
        });
        if (!rl2.allowed) {
          return new Response(JSON.stringify({ error: "Too many requests" }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rl2.retryAfterSec) },
          });
        }
      }

      // This mutation now returns ONLY { success: true } — never the code.
      await ctx.runMutation(api.users.requestPasswordReset, { email });

      // Pick the code up out of the DB via an internal query (never crosses
      // a public boundary) and send it via email. If the user didn't exist
      // the internal query returns null and we silently succeed (prevents
      // email enumeration).
      const pending = await ctx.runQuery(internal.users.getPendingResetCodeInternal, { email });
      if (pending) {
        // TODO: wire up real transactional email (Resend / Postmark /
        // SendGrid). For now we log the code on the server only — the
        // client never sees it.
        console.log(`[password-reset] ${email.trim()}: code=${pending.code} expires=${pending.expiresAt}`);
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error: any) {
      const message = extractErrorMessage(error, "Failed to process request");
      return new Response(JSON.stringify({ error: message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/api/auth/reset-password",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = makeCorsHeaders(request);
    try {
      const body = await request.json();
      const email = typeof body?.email === "string" ? body.email : "";
      const code = typeof body?.code === "string" ? body.code : "";
      const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

      if (!email.trim() || !code || !newPassword) {
        return new Response(JSON.stringify({ error: "Email, code, and new password are required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Rate limit: 10 confirm attempts per email per minute. This defeats
      // brute-forcing the 6-digit code within the 15-minute TTL.
      const rl = await ctx.runMutation(api.rateLimit.consume, {
        scope: "email", subject: email.trim().toLowerCase(),
        action: "auth.password_reset_conf", limit: 10, windowMs: 60_000,
      });
      if (!rl.allowed) {
        return new Response(JSON.stringify({ error: "Too many attempts. Please wait and try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rl.retryAfterSec) },
        });
      }

      const result = await ctx.runMutation(api.users.confirmPasswordReset, { email, code, newPassword });
      return new Response(JSON.stringify(result), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error: any) {
      const message = extractErrorMessage(error, "Failed to reset password");
      return new Response(JSON.stringify({ error: message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }),
});

// ── Site Config (Pricing + Roadmap live edit) ─────────────
http.route({
  path: "/api/site-config/pricing",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = makeCorsHeaders(request);
    try {
      const value = await ctx.runQuery(api.siteConfig.getPricing, {});
      return new Response(JSON.stringify({ value }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: extractErrorMessage(error, "Failed to load pricing") }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/api/site-config/pricing",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = makeCorsHeaders(request);
    try {
      const sessionToken = getSessionTokenFromRequest(request);
      if (!sessionToken) {
        return new Response(JSON.stringify({ error: "Not authenticated" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const body = await request.json();
      await ctx.runMutation(api.siteConfig.updatePricing, { sessionToken, value: body?.value });
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error: any) {
      const message = extractErrorMessage(error, "Failed to update pricing");
      const status = /admin only|not authenticated/i.test(message) ? 403 : 500;
      return new Response(JSON.stringify({ error: message }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/api/site-config/roadmap",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = makeCorsHeaders(request);
    try {
      const value = await ctx.runQuery(api.siteConfig.getRoadmap, {});
      return new Response(JSON.stringify({ value }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: extractErrorMessage(error, "Failed to load roadmap") }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/api/site-config/roadmap",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = makeCorsHeaders(request);
    try {
      const sessionToken = getSessionTokenFromRequest(request);
      if (!sessionToken) {
        return new Response(JSON.stringify({ error: "Not authenticated" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const body = await request.json();
      await ctx.runMutation(api.siteConfig.updateRoadmap, { sessionToken, value: body?.value });
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error: any) {
      const message = extractErrorMessage(error, "Failed to update roadmap");
      const status = /admin only|not authenticated/i.test(message) ? 403 : 500;
      return new Response(JSON.stringify({ error: message }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }),
});

// ── Admin: Plan Limits (live edit) ────────────────────────
http.route({
  path: "/api/admin/plan-limits",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = makeCorsHeaders(request);
    try {
      const limits = await ctx.runQuery(api.planLimits.getAll, {});
      return new Response(JSON.stringify({ limits }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error: any) {
      const message = extractErrorMessage(error, "Failed to load plan limits");
      return new Response(JSON.stringify({ error: message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/api/admin/plan-limits",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = makeCorsHeaders(request);
    try {
      const sessionToken = getSessionTokenFromRequest(request);
      if (!sessionToken) {
        return new Response(JSON.stringify({ error: "Not authenticated" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const body = await request.json();
      const planId = body?.planId as "free" | "starter" | "pro" | "founder" | "creator";
      const patch = body?.patch ?? {};
      if (!planId) {
        return new Response(JSON.stringify({ error: "planId is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const limits = await ctx.runMutation(api.planLimits.update, { sessionToken, planId, patch });
      return new Response(JSON.stringify({ limits }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error: any) {
      const message = extractErrorMessage(error, "Failed to update plan limits");
      const status = /admin only|not authenticated/i.test(message) ? 403 : 500;
      return new Response(JSON.stringify({ error: message }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }),
});

// ── iOS Launch Waitlist ───────────────────────────────────
http.route({
  path: "/api/waitlist",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = makeCorsHeaders(request);
    try {
      const body = await request.json();
      const email = typeof body?.email === "string" ? body.email.trim() : "";
      const source = typeof body?.source === "string" ? body.source : "ios-landing";
      const referrer = request.headers.get("referer") ?? undefined;

      if (!email) {
        return new Response(JSON.stringify({ error: "Email is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (email.length > 254) {
        return new Response(JSON.stringify({ error: "Email is too long" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await ctx.runMutation(api.waitlist.join, { email, source, referrer });
      // Always return the same shape regardless of isNew so the client can't
      // tell whether the email was already on the list (no enumeration).
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error: any) {
      const message = extractErrorMessage(error, "Failed to join waitlist");
      return new Response(JSON.stringify({ error: message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }),
});

// ── Notebook sync: full load ──────────────────────────────
http.route({
  path: "/api/notebooks",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = makeCorsHeaders(request);
    try {
      const sessionToken = getSessionTokenFromRequest(request) ?? undefined;
      const user = await ctx.runQuery(api.users.getCurrentUser, { sessionToken });
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const notebooks = await ctx.runQuery(api.notebooks.listByUser, {
        userId: user._id as any,
        sessionToken,
      });

      // Parallelize notebook → pages → blocks reads. Previously this was
      // three nested serial awaits, which for a user with 50 notebooks ×
      // 20 pages × 30 blocks meant 1000+ sequential DB round-trips per
      // /api/notebooks call — several seconds of wall clock on a cold
      // load. Now we fan out at each level with Promise.all so the total
      // latency is bounded by the slowest single-notebook subtree, not
      // the sum of everything.
      const full = await Promise.all(
        notebooks.map(async (nb) => {
          const pages = await ctx.runQuery(api.pages.listByNotebook, {
            notebookId: nb._id,
            sessionToken,
          });
          const pagesWithBlocks = await Promise.all(
            pages.map(async (page: any) => {
              const blocks = await ctx.runQuery(api.blocks.listByPage, {
                pageId: page._id,
                sessionToken,
              });
              return {
                id: page._id,
                title: page.title,
                createdAt: page.createdAt || "",
                paperType: page.paperType,
                aesthetic: page.aesthetic,
                themeColor: page.themeColor,
                aiGenerated: page.aiGenerated,
                blocks: blocks.map((b: any) => ({
                  id: b._id,
                  type: b.type,
                  content: b.content,
                  side: b.side,
                  checked: b.checked,
                  alignment: b.alignment,
                  emphasis: b.emphasis,
                  color: b.color,
                  gridData: b.gridData,
                  matrixData: b.matrixData,
                  moodValue: b.moodValue,
                  musicData: b.musicData,
                  calendarData: b.calendarData,
                  weeklyViewData: b.weeklyViewData,
                  habitTrackerData: b.habitTrackerData,
                  goalSectionData: b.goalSectionData,
                  timeBlockData: b.timeBlockData,
                  dailySectionData: b.dailySectionData,
                })),
              };
            }),
          );
          return {
            id: nb._id,
            title: nb.title,
            coverColor: nb.coverColor,
            coverImageUrl: (nb as any).coverImageUrl || undefined,
            bookmarks: nb.bookmarks,
            createdAt: (nb as any).createdAt || "",
            pages: pagesWithBlocks,
          };
        }),
      );

      return new Response(JSON.stringify({ notebooks: full }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Notebooks load error:", error);
      return new Response(JSON.stringify({ error: "Failed to load notebooks" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }),
});

// ── Notebook sync: save one notebook with all pages + blocks ──
http.route({
  path: "/api/notebooks/save",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = makeCorsHeaders(request);
    try {
      const sessionToken = getSessionTokenFromRequest(request) ?? undefined;
      const user = await ctx.runQuery(api.users.getCurrentUser, { sessionToken });
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await request.json();
      const notebook = body?.notebook;
      if (!notebook || !notebook.title) {
        return new Response(JSON.stringify({ error: "notebook object required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Try to find existing notebook by ID (Convex doc ID) for upsert
      let nbId: any = null;
      let isUpdate = false;
      if (notebook.id) {
        try {
          const existing = await ctx.runQuery(api.notebooks.get, { id: notebook.id, sessionToken });
          if (existing && existing.userId === (user._id as any)) {
            nbId = existing._id;
            isUpdate = true;
          }
        } catch {
          // Not a valid Convex ID — will create new
        }
      }

      if (isUpdate && nbId) {
        // Update notebook metadata
        await ctx.runMutation(api.notebooks.update, {
          id: nbId,
          title: notebook.title,
          coverColor: notebook.coverColor || "bg-indigo-900",
          coverImageUrl: notebook.coverImageUrl || undefined,
          bookmarks: notebook.bookmarks || [],
          sessionToken,
        });

        // Delete existing pages + blocks, then recreate. Parallelized —
        // previously this serialized up to 20 page deletes per save.
        const oldPages = await ctx.runQuery(api.pages.listByNotebook, { notebookId: nbId, sessionToken });
        await Promise.all(
          oldPages.map((oldPage: any) =>
            ctx.runMutation(api.pages.remove, { id: oldPage._id, sessionToken }),
          ),
        );
      } else {
        // Create new notebook
        nbId = await ctx.runMutation(api.notebooks.create, {
          userId: user._id as any,
          title: notebook.title,
          coverColor: notebook.coverColor || "bg-indigo-900",
          coverImageUrl: notebook.coverImageUrl || undefined,
          bookmarks: notebook.bookmarks || [],
          createdAt: notebook.createdAt,
          sessionToken,
        });
      }

      // Create pages + blocks
      const pageIdMap: Record<string, string> = {};
      for (const page of notebook.pages || []) {
        const pageId = await ctx.runMutation(api.pages.create, {
          notebookId: nbId,
          title: page.title || "Untitled",
          paperType: page.paperType || "lined",
          aesthetic: page.aesthetic,
          themeColor: page.themeColor,
          aiGenerated: page.aiGenerated,
          createdAt: page.createdAt,
          sessionToken,
        });
        if (page.id) pageIdMap[page.id] = pageId;

        if (page.blocks && page.blocks.length > 0) {
          const blockData = page.blocks.map((b: any) => ({
            type: b.type || "TEXT",
            content: b.content || "",
            side: b.side === "right" ? ("right" as const) : ("left" as const),
            checked: b.checked,
            alignment: b.alignment,
            emphasis: b.emphasis,
            color: b.color,
            gridData: b.gridData,
            matrixData: b.matrixData,
            moodValue: b.moodValue,
            musicData: b.musicData,
            calendarData: b.calendarData,
            weeklyViewData: b.weeklyViewData,
            habitTrackerData: b.habitTrackerData,
            goalSectionData: b.goalSectionData,
            timeBlockData: b.timeBlockData,
            dailySectionData: b.dailySectionData,
          }));
          await ctx.runMutation(api.blocks.createBatch, { pageId, blocks: blockData, sessionToken });
        }
      }

      // ── Remap bookmarks from old local page IDs to new Convex IDs.
      //
      // The save flow deletes all old pages and recreates them, which mints
      // fresh IDs. If we left notebook.bookmarks pointing at the old IDs,
      // the next load would find no matches and the bookmarks row in the
      // sidebar would appear empty — exactly the bug the user reported.
      //
      // pageIdMap was built above (old.id → new._id), so translate and
      // patch the notebook a second time. Entries that can't be mapped
      // (stale bookmark for a deleted page) are dropped.
      const incomingBookmarks: string[] = Array.isArray(notebook.bookmarks) ? notebook.bookmarks : [];
      const remappedBookmarks = incomingBookmarks
        .map((b) => pageIdMap[b] ?? b) // fall through for already-Convex IDs
        .filter((b) => typeof b === "string" && b.length > 0);
      if (remappedBookmarks.length > 0 || incomingBookmarks.length > 0) {
        await ctx.runMutation(api.notebooks.update, {
          id: nbId,
          bookmarks: remappedBookmarks,
          sessionToken,
        });
      }

      return new Response(
        JSON.stringify({ id: nbId, success: true, pageIdMap, bookmarks: remappedBookmarks }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (error: any) {
      console.error("Notebook save error:", error);
      const message = extractErrorMessage(error, "Failed to save notebook");
      // Plan-limit rejections should surface as 403 Forbidden with the
      // real message so the client can show 'Your free plan allows 1
      // notebook. Upgrade to create more.' verbatim.
      const isPlanLimit = /plan allows|upgrade to/i.test(message);
      return new Response(JSON.stringify({ error: message, code: isPlanLimit ? "plan_limit" : undefined }), {
        status: isPlanLimit ? 403 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }),
});

// ── Notebook delete ──────────────────────────────────────
http.route({
  path: "/api/notebooks/delete",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = makeCorsHeaders(request);
    try {
      const sessionToken = getSessionTokenFromRequest(request) ?? undefined;
      const body = await request.json();
      const notebookId = body?.id;
      if (!notebookId) {
        return new Response(JSON.stringify({ error: "id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await ctx.runMutation(api.notebooks.remove, { id: notebookId, sessionToken });
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Notebook delete error:", error);
      return new Response(JSON.stringify({ error: "Failed to delete notebook" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }),
});

// ── Admin endpoints ──────────────────────────────────────

// Bootstrap first admin (one-time, only works when no admin exists).
//
// Gate: the request MUST carry an `X-Bootstrap-Token` header whose value
// matches `process.env.ADMIN_BOOTSTRAP_TOKEN`. Without this header, the
// mutation cannot be triggered — previously anyone could race to claim
// admin on a fresh deploy.
http.route({
  path: "/api/admin/bootstrap",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = makeCorsHeaders(request);
    try {
      const expectedToken = process.env.ADMIN_BOOTSTRAP_TOKEN;
      if (!expectedToken) {
        return new Response(
          JSON.stringify({ error: "Admin bootstrap is disabled (ADMIN_BOOTSTRAP_TOKEN unset)" }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const providedToken = request.headers.get("x-bootstrap-token") ?? "";
      // Constant-time comparison to prevent timing oracles.
      if (providedToken.length !== expectedToken.length) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      let diff = 0;
      for (let i = 0; i < providedToken.length; i++) {
        diff |= providedToken.charCodeAt(i) ^ expectedToken.charCodeAt(i);
      }
      if (diff !== 0) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Identify the calling user via session token, then promote them
      // through the internal mutation.
      const sessionToken = getSessionTokenFromRequest(request) ?? undefined;
      if (!sessionToken) {
        return new Response(JSON.stringify({ error: "Not authenticated" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const me = await ctx.runQuery(api.users.getCurrentUser, { sessionToken });
      if (!me) {
        return new Response(JSON.stringify({ error: "Not authenticated" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const result = await ctx.runMutation(internal.users.bootstrapAdminInternal, {
        userId: (me as any)._id,
      });
      return new Response(JSON.stringify(result), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error: any) {
      const message = extractErrorMessage(error, "Bootstrap failed");
      const status = message.includes("Forbidden") ? 403 : message.includes("Not authenticated") ? 401 : 500;
      return new Response(JSON.stringify({ error: message }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/api/admin/bootstrap",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => {
    return new Response(null, { status: 204, headers: makeCorsHeaders(request) });
  }),
});

http.route({
  path: "/api/admin/users",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = makeCorsHeaders(request);
    try {
      const sessionToken = getSessionTokenFromRequest(request) ?? undefined;
      const users = await ctx.runQuery(api.users.adminListUsers, { sessionToken });
      return new Response(JSON.stringify({ users }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error: any) {
      const message = extractErrorMessage(error, "Failed to list users");
      const status = message.includes("Forbidden") || message.includes("admin") ? 403 : 500;
      return new Response(JSON.stringify({ error: message }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/api/admin/set-plan",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = makeCorsHeaders(request);
    try {
      const sessionToken = getSessionTokenFromRequest(request) ?? undefined;
      const body = await request.json();
      const { targetUserId, plan } = body as { targetUserId: string; plan: string };
      await ctx.runMutation(api.users.adminSetPlan, {
        sessionToken,
        targetUserId: targetUserId as any,
        plan: plan as any,
      });
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error: any) {
      const message = extractErrorMessage(error, "Failed to set plan");
      const status = message.includes("Forbidden") || message.includes("admin") ? 403 : 500;
      return new Response(JSON.stringify({ error: message }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/api/admin/set-role",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = makeCorsHeaders(request);
    try {
      const sessionToken = getSessionTokenFromRequest(request) ?? undefined;
      const body = await request.json();
      const { targetUserId, role } = body as { targetUserId: string; role: string };
      await ctx.runMutation(api.users.adminSetRole, {
        sessionToken,
        targetUserId: targetUserId as any,
        role: role as any,
      });
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error: any) {
      const message = extractErrorMessage(error, "Failed to set role");
      const status = message.includes("Forbidden") || message.includes("admin") ? 403 : 500;
      return new Response(JSON.stringify({ error: message }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/api/admin/reset-usage",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = makeCorsHeaders(request);
    try {
      const sessionToken = getSessionTokenFromRequest(request) ?? undefined;
      const body = await request.json();
      const { targetUserId } = body as { targetUserId: string };
      await ctx.runMutation(api.users.adminResetUsage, {
        sessionToken,
        targetUserId: targetUserId as any,
      });
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error: any) {
      const message = extractErrorMessage(error, "Failed to reset usage");
      const status = message.includes("Forbidden") || message.includes("admin") ? 403 : 500;
      return new Response(JSON.stringify({ error: message }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }),
});

// ── Ink API ──────────────────────────────────────────────

// GET /api/ink/config — public Ink pricing config
http.route({
  path: "/api/ink/config",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = makeCorsHeaders(request);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    const config = await ctx.runQuery(api.users.getInkConfig, {});
    return new Response(JSON.stringify(config), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }),
});

// GET /api/ink/balance — user's Ink balance
http.route({
  path: "/api/ink/balance",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = makeCorsHeaders(request);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    const sessionToken = getSessionTokenFromRequest(request) ?? undefined;
    const balance = await ctx.runQuery(api.users.getInkBalance, { sessionToken });
    return new Response(JSON.stringify(balance ?? { subscription: 0, purchased: 0, total: 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }),
});

// POST /api/ink/preview — preview cost before action
http.route({
  path: "/api/ink/preview",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = makeCorsHeaders(request);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    const body = await request.json();
    const { action } = body as { action: string };
    const sessionToken = getSessionTokenFromRequest(request) ?? undefined;
    const preview = await ctx.runQuery(api.users.previewInkCost, { sessionToken, action: action || "layout" });
    return new Response(JSON.stringify(preview), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }),
});

// POST /api/ink/refill — trigger monthly Ink refill
http.route({
  path: "/api/ink/refill",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = makeCorsHeaders(request);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    const sessionToken = getSessionTokenFromRequest(request) ?? undefined;
    const result = await ctx.runMutation(api.users.refillSubscriptionInk, { sessionToken });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }),
});

// POST /api/admin/ink-config — admin update Ink config
http.route({
  path: "/api/admin/ink-config",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = makeCorsHeaders(request);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    const sessionToken = getSessionTokenFromRequest(request) ?? undefined;
    const body = await request.json();
    const { config } = body as { config: unknown };
    const result = await ctx.runMutation(api.users.adminUpdateInkConfig, { sessionToken, config });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }),
});

// POST /api/admin/backfill-ink — backfill Ink for legacy users with
// undefined inkSubscription (one-shot, idempotent).
http.route({
  path: "/api/admin/backfill-ink",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = makeCorsHeaders(request);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    try {
      const sessionToken = getSessionTokenFromRequest(request);
      if (!sessionToken) {
        return new Response(JSON.stringify({ error: "Not authenticated" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const result = await ctx.runMutation(api.users.backfillInitialInk, { sessionToken });
      return new Response(JSON.stringify(result), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error: any) {
      const message = extractErrorMessage(error, "Failed to backfill ink");
      const status = /admin only|not authenticated/i.test(message) ? 403 : 500;
      return new Response(JSON.stringify({ error: message }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }),
});

// GET /api/admin/waitlist — list waitlist entries for the admin UI
http.route({
  path: "/api/admin/waitlist",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = makeCorsHeaders(request);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    try {
      const sessionToken = getSessionTokenFromRequest(request);
      if (!sessionToken) {
        return new Response(JSON.stringify({ error: "Not authenticated" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Admin check: we require the caller to be an admin. The query itself
      // is open, but we gate access at the HTTP layer by verifying the
      // session → user role before returning rows.
      const me = await ctx.runQuery(api.users.getCurrentUser, { sessionToken });
      if (!me || (me as any).role !== "admin") {
        return new Response(JSON.stringify({ error: "Admin only" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const url = new URL(request.url);
      const limit = Number(url.searchParams.get("limit") ?? 200) || 200;
      const source = url.searchParams.get("source") ?? undefined;
      const listRes = await ctx.runQuery(api.waitlist.list, { limit, source: source ?? undefined });
      const countRes = await ctx.runQuery(api.waitlist.count, {});
      return new Response(JSON.stringify({ ...listRes, count: countRes.total }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error: any) {
      const message = extractErrorMessage(error, "Failed to load waitlist");
      return new Response(JSON.stringify({ error: message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }),
});

// POST /api/admin/grant-ink — admin grant Ink to user
http.route({
  path: "/api/admin/grant-ink",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = makeCorsHeaders(request);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    const sessionToken = getSessionTokenFromRequest(request) ?? undefined;
    const body = await request.json();
    const { targetUserId, amount, description } = body as { targetUserId: string; amount: number; description?: string };
    const result = await ctx.runMutation(api.users.adminGrantInk, {
      sessionToken,
      targetUserId: targetUserId as any,
      amount,
      description,
    });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }),
});

// Handle CORS preflight for all routes
for (const path of [
  "/api/generate-layout",
  "/api/generate-cover",
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/me",
  "/api/auth/logout",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/waitlist",
  "/api/admin/plan-limits",
  "/api/site-config/pricing",
  "/api/site-config/roadmap",
  "/api/notebooks",
  "/api/notebooks/save",
  "/api/notebooks/delete",
  "/api/admin/users",
  "/api/admin/set-plan",
  "/api/admin/set-role",
  "/api/admin/reset-usage",
  "/api/ink/config",
  "/api/ink/balance",
  "/api/ink/preview",
  "/api/ink/refill",
  "/api/admin/ink-config",
  "/api/admin/grant-ink",
  "/api/admin/backfill-ink",
  "/api/admin/waitlist",
]) {
  http.route({
    path,
    method: "OPTIONS",
    handler: httpAction(async (_ctx, request) => {
      const corsHeaders = makeCorsHeaders(request);
      return new Response(null, { status: 204, headers: corsHeaders });
    }),
  });
}

// Register the affiliate routes (click tracking, lookup, payouts, admin).
// Previously this was defined in affiliateHttp.ts but the registration
// call was never made — every affiliate route was dead.
registerAffiliateRoutes(http);

// Register Stripe checkout + webhook routes. Both require the STRIPE_*
// env vars to be set — the routes return 503 if not configured so the
// landing page can render a graceful fallback.
registerStripeRoutes(http);

// Register community HTTP routes (feed, posts, comments, likes, follows,
// profiles). These are thin wrappers around api.community.* that forward
// the session token.
registerCommunityRoutes(http);

// Register user-to-user referral routes (growth loop).
registerReferralRoutes(http);


export default http;
