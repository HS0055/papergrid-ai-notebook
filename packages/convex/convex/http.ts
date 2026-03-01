import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

// ---------------------------------------------------------------------------
// Embedded reference layouts for few-shot prompting.
// These are copied from @papergrid/core because Convex runtime cannot import
// arbitrary monorepo packages.  We use a compact representation (no full
// block objects) to keep the payload small while still giving the AI model
// enough structure to learn from.
// ---------------------------------------------------------------------------

interface CompactBlock {
  type: string;
  content: string;
  side: string;
  color?: string;
  emphasis?: string;
  alignment?: string;
  gridColumns?: string[];
  gridRowCount?: number;
  moodValue?: number;
  matrixData?: { q1: string; q2: string; q3: string; q4: string };
  checked?: boolean;
  calendarData?: { month: number; year: number; highlights?: number[] };
  weeklyViewData?: { startDate?: string; days: Array<{ label: string; content: string }> };
  habitTrackerData?: { habits: string[]; days: number; checked: boolean[][] };
  goalSectionData?: { goals: Array<{ text: string; subItems: Array<{ text: string; checked: boolean }>; progress?: number }> };
  timeBlockData?: { startHour: number; endHour: number; interval: number; entries: Array<{ time: string; content: string; color?: string }> };
  dailySectionData?: { date?: string; dayLabel?: string; sections: Array<{ label: string; content: string }> };
}

interface CompactReference {
  id: string;
  niche: string;
  style: string;
  aesthetic: string;
  tags: string[];
  paperType: string;
  themeColor: string;
  title: string;
  blocks: CompactBlock[];
}

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
      { type: "GRID", content: "Weekly Schedule", side: "left", color: "slate", gridColumns: ["Day", "Morning", "Afternoon", "Evening"], gridRowCount: 7 },
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
      { type: "GRID", content: "Time Blocks", side: "left", color: "rose", gridColumns: ["Time", "Task / Activity"], gridRowCount: 11 },
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
];

// ---------------------------------------------------------------------------
// matchReferences  --  scores each reference layout against a user prompt and
// returns the top N best-matching layouts.  Embedded here because Convex
// cannot import from @papergrid/core.
// ---------------------------------------------------------------------------

function matchReferences(
  prompt: string,
  aesthetic?: string,
  maxResults = 3,
): { layout: CompactReference; score: number }[] {
  const lowerPrompt = prompt.toLowerCase();
  const promptWords = lowerPrompt.split(/\s+/);
  const lowerAesthetic = aesthetic?.toLowerCase();

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

http.route({
  path: "/api/generate-layout",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      const body = await request.json();
      const { prompt, industry, aesthetic } = body as {
        prompt: string;
        industry?: string;
        aesthetic?: string;
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

      // --- Few-shot reference matching ---
      const matches = matchReferences(prompt, aesthetic, 3);
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

      // --- Build user prompt ---
      const userPrompt = `Generate a structured notebook layout.
${industryContext} ${aestheticContext}
Current Date: ${currentDate}

User Request: "${prompt}"
${
  hasReferences
    ? `
=== REFERENCE EXAMPLES ===
Here are ${matches.filter((m) => m.score > 0).length} similar high-quality layouts that users love. Use them as inspiration for structure and block composition, but adapt them to the user's specific request:

${referenceExamples}

=== END REFERENCE EXAMPLES ===
`
    : ""
}
=== DESIGN RULES ===
1. Act as a world-class editorial designer. Use "layers" of content. Mix TEXT blocks with structured GRID blocks (tables), CALLOUTs, QUOTEs, DIVIDERs, MOOD_TRACKERs, PRIORITY_MATRIXes, and INDEXes.
2. For "planners", "trackers", or "logs", heavily favor GRID type with specific columns relevant to the industry. Use MOOD_TRACKER for daily journals or wellness logs. Use PRIORITY_MATRIX for task management and Eisenhower matrices.
3. Use CALLOUT blocks for tips, warnings, or daily focus (they look like sticky notes with washi tape!). Use QUOTE for inspirational or important text. Use DIVIDER to separate major sections. Use INDEX to create a table of contents for the notebook.
4. Ensure the structure mimics a real paper worksheet, Notion template, or magazine layout.
5. Adhere to the requested aesthetic:
   - 'pastel': Soft, warm tones. Favor rose, sky, and emerald colors. Use 'lined' or 'dotted' paper.
   - 'modern-planner': Comprehensive dashboards, finance/wellness/schedule sections. Use 'blank' or 'lined' paper, 'indigo' or 'rose' theme.
   - 'e-ink': High contrast, minimalist. Use 'grid' or 'dotted' paper, 'slate' or 'gray' theme.
   - 'bujo': Playful, freeform. Use 'dotted' or 'crumpled' paper, 'amber' or 'sky' theme.
   - 'cornell': Academic and structured. Use 'legal' or 'lined' paper, 'slate' theme.
6. Assign appropriate alignments, emphasis, and colors to blocks.
7. Design a 2-page spread. Assign 'left' or 'right' to the 'side' property of each block.
8. For planners: include REAL dates based on the current date (${currentDate}). Replace blank date fields with actual upcoming dates.
9. Default to pastel/soft colors (rose, sky, emerald) unless a different aesthetic is explicitly specified by the user.
10. Use MOOD_TRACKER for wellness, journal, self-care, and daily reflection layouts. Set moodValue to a number 0-4 (0=awful, 1=bad, 2=okay, 3=good, 4=great).
11. Use PRIORITY_MATRIX for task management, project planning, and Eisenhower matrix layouts. Fill matrixData q1-q4 with relevant starter text.
12. Pre-populate GRID blocks with realistic column headers and example rows relevant to the user's request.
13. For CHECKBOX blocks, set checked to false by default.
14. For "planner", "schedule", or "weekly" requests: use WEEKLY_VIEW blocks for day-spread views and CALENDAR for mini month calendars. Pre-populate weeklyViewData.days with 7 days (Monday-Sunday) with content hints. For CALENDAR, set calendarData month/year to the current month based on ${currentDate}.
15. For "habit", "tracker", or "routine" requests: use HABIT_TRACKER blocks. Pre-populate habitTrackerData.habits with 5-7 relevant habits and set days to 7 (weekly) or 30 (monthly). Initialize checked as a 2D boolean array (all false).
16. For "goals", "objectives", or "project" requests: use GOAL_SECTION blocks. Pre-populate goalSectionData.goals with 3-4 relevant goals, each with 2-3 sub-items (checked: false).
17. For "daily", "schedule", or "time" requests: use TIME_BLOCK for hourly schedules (set startHour/endHour/interval and entries) and DAILY_SECTION for structured day views (set sections with "Morning", "Afternoon", "Evening" labels).
18. IMPORTANT: Prefer the new specialized planner types over GRID workarounds. Use WEEKLY_VIEW instead of a 7-row GRID for weekly schedules. Use HABIT_TRACKER instead of a habits-in-columns GRID. Use TIME_BLOCK instead of a time-slot GRID.

Return a JSON object with: title (string), paperType (enum), themeColor (enum), blocks (array of block objects with type, content, alignment, emphasis, color, side, gridData, moodValue, matrixData, checked, calendarData, weeklyViewData, habitTrackerData, goalSectionData, timeBlockData, dailySectionData).`;

      const geminiPayload = {
        contents: [
          {
            parts: [
              {
                text: userPrompt,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING" },
              paperType: {
                type: "STRING",
                enum: ["lined", "grid", "dotted", "blank", "music", "rows", "isometric", "hex", "legal", "crumpled"],
              },
              themeColor: {
                type: "STRING",
                enum: ["rose", "indigo", "emerald", "amber", "slate", "sky", "gray"],
              },
              blocks: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    type: {
                      type: "STRING",
                      enum: ["TEXT", "HEADING", "GRID", "CHECKBOX", "CALLOUT", "QUOTE", "DIVIDER", "MOOD_TRACKER", "PRIORITY_MATRIX", "INDEX", "MUSIC_STAFF", "CALENDAR", "WEEKLY_VIEW", "HABIT_TRACKER", "GOAL_SECTION", "TIME_BLOCK", "DAILY_SECTION"],
                    },
                    content: { type: "STRING" },
                    alignment: { type: "STRING", enum: ["left", "center", "right"] },
                    emphasis: { type: "STRING", enum: ["bold", "italic", "highlight", "none"] },
                    color: { type: "STRING", enum: ["rose", "indigo", "emerald", "amber", "slate", "sky", "gray"] },
                    side: { type: "STRING", enum: ["left", "right"] },
                    gridData: {
                      type: "OBJECT",
                      properties: {
                        columns: { type: "ARRAY", items: { type: "STRING" } },
                        rows: {
                          type: "ARRAY",
                          items: {
                            type: "ARRAY",
                            items: { type: "STRING" },
                          },
                        },
                      },
                      nullable: true,
                    },
                    moodValue: { type: "NUMBER", nullable: true },
                    matrixData: {
                      type: "OBJECT",
                      properties: {
                        q1: { type: "STRING" },
                        q2: { type: "STRING" },
                        q3: { type: "STRING" },
                        q4: { type: "STRING" },
                      },
                      nullable: true,
                    },
                    checked: { type: "BOOLEAN", nullable: true },
                    calendarData: {
                      type: "OBJECT",
                      properties: {
                        month: { type: "NUMBER" },
                        year: { type: "NUMBER" },
                        highlights: { type: "ARRAY", items: { type: "NUMBER" } },
                      },
                      nullable: true,
                    },
                    weeklyViewData: {
                      type: "OBJECT",
                      properties: {
                        startDate: { type: "STRING" },
                        days: {
                          type: "ARRAY",
                          items: {
                            type: "OBJECT",
                            properties: {
                              label: { type: "STRING" },
                              content: { type: "STRING" },
                            },
                          },
                        },
                      },
                      nullable: true,
                    },
                    habitTrackerData: {
                      type: "OBJECT",
                      properties: {
                        habits: { type: "ARRAY", items: { type: "STRING" } },
                        days: { type: "NUMBER" },
                        checked: {
                          type: "ARRAY",
                          items: { type: "ARRAY", items: { type: "BOOLEAN" } },
                        },
                      },
                      nullable: true,
                    },
                    goalSectionData: {
                      type: "OBJECT",
                      properties: {
                        goals: {
                          type: "ARRAY",
                          items: {
                            type: "OBJECT",
                            properties: {
                              text: { type: "STRING" },
                              subItems: {
                                type: "ARRAY",
                                items: {
                                  type: "OBJECT",
                                  properties: {
                                    text: { type: "STRING" },
                                    checked: { type: "BOOLEAN" },
                                  },
                                },
                              },
                              progress: { type: "NUMBER" },
                            },
                          },
                        },
                      },
                      nullable: true,
                    },
                    timeBlockData: {
                      type: "OBJECT",
                      properties: {
                        startHour: { type: "NUMBER" },
                        endHour: { type: "NUMBER" },
                        interval: { type: "NUMBER" },
                        entries: {
                          type: "ARRAY",
                          items: {
                            type: "OBJECT",
                            properties: {
                              time: { type: "STRING" },
                              content: { type: "STRING" },
                              color: { type: "STRING" },
                            },
                          },
                        },
                      },
                      nullable: true,
                    },
                    dailySectionData: {
                      type: "OBJECT",
                      properties: {
                        date: { type: "STRING" },
                        dayLabel: { type: "STRING" },
                        sections: {
                          type: "ARRAY",
                          items: {
                            type: "OBJECT",
                            properties: {
                              label: { type: "STRING" },
                              content: { type: "STRING" },
                            },
                          },
                        },
                      },
                      nullable: true,
                    },
                  },
                  required: ["type", "content"],
                },
              },
            },
            required: ["title", "blocks", "paperType", "themeColor"],
          },
        },
        systemInstruction: {
          parts: [
            {
              text: "You are an expert planner and notebook designer who creates structured layouts for digital notebooks. You specialize in productivity, wellness, education, and creative planners. You draw inspiration from popular Etsy, Amazon, and bullet journal designs. Your layouts feel hand-crafted, warm, and highly usable -- like a premium paper planner brought to life digitally.",
            },
          ],
        },
      };

      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
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
              };
            })
          : [
              { label: "Monday", content: "" }, { label: "Tuesday", content: "" },
              { label: "Wednesday", content: "" }, { label: "Thursday", content: "" },
              { label: "Friday", content: "" }, { label: "Saturday", content: "" },
              { label: "Sunday", content: "" },
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

      const blocks = (layoutData.blocks || []).map(
        (b: Record<string, unknown>, index: number) => ({
          id: generateId(),
          type: b.type || "TEXT",
          content: b.content || "",
          checked: typeof b.checked === "boolean" ? b.checked : false,
          alignment: b.alignment || "left",
          emphasis: b.emphasis || "none",
          color: b.color || layoutData.themeColor || "rose",
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
        })
      );

      const result = {
        title: layoutData.title,
        paperType: layoutData.paperType,
        themeColor: layoutData.themeColor,
        blocks,
      };

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Generate layout error:", error);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

// Handle CORS preflight for all routes
http.route({
  path: "/api/generate-layout",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }),
});

export default http;
