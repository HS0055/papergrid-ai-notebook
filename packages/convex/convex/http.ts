import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { detectDomain, getDomainRules, getDesignPrinciples } from "./domainDetection";
import { REFERENCE_LAYOUTS, type CompactBlock, type CompactReference } from "./referenceLayouts";

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
      // --- Auth + Usage Gating (graceful: don't block if auth fails) ---
      let usageAllowed = true;
      try {
        const sessionToken = getSessionTokenFromRequest(request) ?? undefined;
        if (sessionToken) {
          const usageResult = await ctx.runMutation(api.users.incrementAiUsage, { sessionToken });
          usageAllowed = usageResult.allowed;
        }
      } catch (e) {
        // If auth fails, allow generation but don't track usage
        console.warn("AI usage gating skipped:", e);
      }
      if (!usageAllowed) {
        return new Response(
          JSON.stringify({ error: "Monthly AI generation limit reached. Upgrade your plan for more." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const body = await request.json();
      const { prompt, industry, aesthetic, existingPages } = body as {
        prompt: string;
        industry?: string;
        aesthetic?: string;
        existingPages?: Array<{ title: string; paperType: string; themeColor: string; blockSummary: string }>;
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
- "social media planner" → 3 pages (accounts audit + content calendar + posting schedule)
- "study notes for chapter" → 1-2 pages
Think like a real planner designer: what set of pages would make a COMPLETE, useful section?

Each page is a SEPARATE notebook page with its own title, paper type, theme color, and blocks.
Vary the page designs — different pages should serve different roles (overview vs detail, schedule vs reflection, tracker vs notes).
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
5. Assign 'left' or 'right' to each block's side property for 2-page spread layout.
6. Pre-populate GRID blocks with realistic headers AND example data rows. CHECKBOX blocks default checked=false.
7. Each page must have a unique, descriptive title using real dates: "Week of April 7-13" or "April Savings Dashboard".
8. Vary themeColor subtly across pages for visual interest while maintaining aesthetic coherence.
9. Every page needs 6-14 blocks minimum for a rich, professional look. Aim for 8-12.
10. PROGRESS_BAR: Use for savings goals, budget remaining, project completion. Set current (0-100), target label, and color.
11. RATING: Use for satisfaction, quality, mood ratings. Use star style for reviews, heart for wellness, circle for neutral. Set max=5 for quick, max=10 for detailed.
12. WATER_TRACKER: Use for daily wellness pages. Default goal=8. Set filled=0 for fresh trackers.
13. SECTION_NAV: Use on index/overview pages to link to other pages. Include descriptive labels and optional emoji icons.
14. KANBAN: Use for project management, task boards, workflows. Create 3-4 columns (e.g. "To Do", "In Progress", "Done"). Pre-populate with realistic cards.

Return a JSON object with a "pages" array. Each page has: title, paperType, themeColor, and blocks array.`;

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
          color: { type: "STRING" as const, enum: ["rose", "indigo", "emerald", "amber", "slate", "sky", "gray"] },
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
          responseSchema: {
            type: "OBJECT" as const,
            properties: {
              pages: {
                type: "ARRAY" as const,
                items: {
                  type: "OBJECT" as const,
                  properties: {
                    title: { type: "STRING" as const },
                    paperType: {
                      type: "STRING" as const,
                      enum: ["lined", "grid", "dotted", "blank", "music", "rows", "isometric", "hex", "legal", "crumpled"],
                    },
                    themeColor: {
                      type: "STRING" as const,
                      enum: ["rose", "indigo", "emerald", "amber", "slate", "sky", "gray"],
                    },
                    blocks: { type: "ARRAY" as const, items: blockSchema },
                  },
                  required: ["title", "paperType", "themeColor", "blocks"],
                },
              },
            },
            required: ["pages"],
          },
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
      const generatedText =
        geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!generatedText) {
        return new Response(
          JSON.stringify({ error: "No content generated" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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
          gridData: parseGridData(b.gridData),
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
        }));

      // Multi-page support: AI returns { pages: [...] }
      const rawPages: Record<string, unknown>[] = Array.isArray(layoutData.pages)
        ? layoutData.pages
        : [layoutData];

      // Structural block types that are valid even without text content
      const structuralTypes = new Set(["DIVIDER", "MOOD_TRACKER", "PRIORITY_MATRIX", "CALENDAR", "WEEKLY_VIEW", "HABIT_TRACKER", "GOAL_SECTION", "TIME_BLOCK", "DAILY_SECTION", "INDEX"]);

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

      const result = { pages };

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
      const body = await request.json();
      const { prompt, aesthetic } = body as {
        prompt: string;
        aesthetic?: string;
      };

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "AI service is not configured" }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

      if (!email.trim() || !password) {
        return new Response(JSON.stringify({ error: "email and password are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await ctx.runMutation(api.users.signupWithEmailPassword, {
        email,
        password,
        name,
      });

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
      const result = await ctx.runMutation(api.users.requestPasswordReset, { email });
      return new Response(JSON.stringify(result), {
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

      const full = [];
      for (const nb of notebooks) {
        const pages = await ctx.runQuery(api.pages.listByNotebook, { notebookId: nb._id });
        const pagesWithBlocks = [];
        for (const page of pages) {
          const blocks = await ctx.runQuery(api.blocks.listByPage, { pageId: page._id });
          pagesWithBlocks.push({
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
          });
        }
        full.push({
          id: nb._id,
          title: nb.title,
          coverColor: nb.coverColor,
          coverImageUrl: (nb as any).coverImageUrl || undefined,
          bookmarks: nb.bookmarks,
          createdAt: (nb as any).createdAt || "",
          pages: pagesWithBlocks,
        });
      }

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
          const existing = await ctx.runQuery(api.notebooks.get, { id: notebook.id });
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

        // Delete existing pages + blocks, then recreate
        const oldPages = await ctx.runQuery(api.pages.listByNotebook, { notebookId: nbId });
        for (const oldPage of oldPages) {
          await ctx.runMutation(api.pages.remove, { id: oldPage._id });
        }
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
          await ctx.runMutation(api.blocks.createBatch, { pageId, blocks: blockData });
        }
      }

      return new Response(JSON.stringify({ id: nbId, success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Notebook save error:", error);
      return new Response(JSON.stringify({ error: "Failed to save notebook" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
  "/api/notebooks",
  "/api/notebooks/save",
  "/api/notebooks/delete",
  "/api/admin/users",
  "/api/admin/set-plan",
  "/api/admin/set-role",
  "/api/admin/reset-usage",
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


export default http;
