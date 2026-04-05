// ---------------------------------------------------------------------------
// Domain Detection & Design Intelligence for AI Layout Generation
// Classifies user prompts into domains and provides domain-specific
// design rules, color palettes, and anti-patterns for the Gemini prompt.
// ---------------------------------------------------------------------------

export type Domain =
  | "finance"
  | "wellness"
  | "health_fitness"
  | "lifestyle"
  | "business"
  | "marketing"
  | "academic"
  | "planning"
  | "general";

interface DomainMatch {
  domain: Domain;
  score: number;
  confidence: "high" | "medium" | "low";
}

// Keyword → domain mappings with weights
const DOMAIN_KEYWORDS: Record<Domain, { keywords: string[]; weight: number }[]> = {
  finance: [
    { keywords: ["budget", "expense", "income", "savings", "debt", "financial", "money", "finance"], weight: 5 },
    { keywords: ["bill", "payment", "invoice", "subscription", "profit", "revenue", "tax", "net worth"], weight: 4 },
    { keywords: ["bank", "credit", "loan", "mortgage", "investment", "stock", "retirement", "401k"], weight: 4 },
    { keywords: ["paycheck", "salary", "cash flow", "spending", "frugal", "sinking fund"], weight: 3 },
  ],
  wellness: [
    { keywords: ["wellness", "self-care", "self care", "mindfulness", "meditation", "gratitude", "journal"], weight: 5 },
    { keywords: ["mood", "mental health", "anxiety", "stress", "therapy", "affirmation", "manifestation"], weight: 4 },
    { keywords: ["water intake", "hydration", "sleep", "rest", "relaxation", "breathwork", "yoga"], weight: 4 },
    { keywords: ["gratitude", "reflection", "mindful", "calm", "peace", "balance", "emotional"], weight: 3 },
  ],
  health_fitness: [
    { keywords: ["workout", "exercise", "fitness", "gym", "training", "cardio", "strength"], weight: 5 },
    { keywords: ["meal", "diet", "nutrition", "calories", "macro", "protein", "recipe", "food", "cooking"], weight: 5 },
    { keywords: ["weight", "body", "measurement", "bmi", "muscle", "running", "steps"], weight: 4 },
    { keywords: ["medication", "supplement", "vitamin", "health", "doctor", "appointment"], weight: 3 },
    { keywords: ["meal prep", "grocery", "shopping list", "ingredients"], weight: 4 },
  ],
  lifestyle: [
    { keywords: ["travel", "itinerary", "trip", "vacation", "packing"], weight: 5 },
    { keywords: ["reading", "book", "movie", "tv show", "film", "watchlist"], weight: 4 },
    { keywords: ["cleaning", "chore", "housework", "organization", "declutter"], weight: 4 },
    { keywords: ["brain dump", "idea", "brainstorm", "password", "contact", "address book"], weight: 3 },
    { keywords: ["meeting", "notes", "minutes", "agenda"], weight: 3 },
  ],
  business: [
    { keywords: ["business", "client", "customer", "sales", "revenue", "startup"], weight: 5 },
    { keywords: ["project", "milestone", "deliverable", "deadline", "sprint"], weight: 4 },
    { keywords: ["invoice", "order", "inventory", "product launch", "time tracking"], weight: 4 },
    { keywords: ["team", "employee", "contractor", "freelance", "proposal"], weight: 3 },
    { keywords: ["kpi", "okr", "quarterly", "annual review", "performance"], weight: 3 },
  ],
  marketing: [
    { keywords: ["marketing", "social media", "instagram", "tiktok", "facebook", "youtube", "pinterest"], weight: 5 },
    { keywords: ["content", "posting", "hashtag", "engagement", "followers", "audience", "brand"], weight: 4 },
    { keywords: ["campaign", "launch", "seo", "email marketing", "newsletter", "blog"], weight: 4 },
    { keywords: ["influencer", "analytics", "reach", "impression", "conversion", "funnel"], weight: 3 },
    { keywords: ["visual brand", "brand voice", "tone", "content calendar", "editorial"], weight: 4 },
  ],
  academic: [
    { keywords: ["study", "student", "school", "college", "university", "class", "course", "academic"], weight: 5 },
    { keywords: ["exam", "test", "quiz", "homework", "assignment", "essay", "thesis", "dissertation"], weight: 5 },
    { keywords: ["semester", "syllabus", "lecture", "professor", "gpa", "grade"], weight: 4 },
    { keywords: ["cornell", "notes", "flashcard", "research", "bibliography", "citation"], weight: 4 },
    { keywords: ["pomodoro", "study group", "tutor", "lab", "major", "minor"], weight: 3 },
  ],
  planning: [
    { keywords: ["planner", "planning", "schedule", "calendar", "agenda", "organizer"], weight: 4 },
    { keywords: ["daily", "weekly", "monthly", "yearly", "annual", "quarterly"], weight: 4 },
    { keywords: ["goal", "resolution", "habit", "routine", "tracker", "log"], weight: 3 },
    { keywords: ["time block", "priorities", "to-do", "todo", "task list", "checklist"], weight: 3 },
    { keywords: ["bullet journal", "bujo", "spread", "layout"], weight: 4 },
  ],
  general: [],
};

/**
 * Detects the primary domain of a user prompt using keyword matching.
 * Returns the best match with confidence level.
 */
export function detectDomain(prompt: string, industry?: string): DomainMatch {
  const text = `${prompt} ${industry || ""}`.toLowerCase();
  const scores: Record<Domain, number> = {
    finance: 0,
    wellness: 0,
    health_fitness: 0,
    lifestyle: 0,
    business: 0,
    marketing: 0,
    academic: 0,
    planning: 0,
    general: 0,
  };

  for (const [domain, groups] of Object.entries(DOMAIN_KEYWORDS) as [Domain, { keywords: string[]; weight: number }[]][]) {
    for (const group of groups) {
      for (const keyword of group.keywords) {
        if (text.includes(keyword)) {
          scores[domain] += group.weight;
        }
      }
    }
  }

  // Find the best domain
  let bestDomain: Domain = "general";
  let bestScore = 0;
  for (const [domain, score] of Object.entries(scores) as [Domain, number][]) {
    if (score > bestScore) {
      bestScore = score;
      bestDomain = domain;
    }
  }

  const confidence: "high" | "medium" | "low" =
    bestScore >= 10 ? "high" : bestScore >= 5 ? "medium" : "low";

  return { domain: bestDomain, score: bestScore, confidence };
}

/**
 * Returns domain-specific design rules to inject into the Gemini prompt.
 */
export function getDomainRules(domain: Domain): string {
  const rules: Record<Domain, string> = {
    finance: `[FINANCE DESIGN RULES]
- Use emerald/green tones for income and savings, rose/red for expenses, amber for warnings/goals
- Always include a summary/totals row in financial GRIDs — real planners never skip the bottom line
- Pair expense tracking with a visual indicator of budget remaining (CALLOUT with budget status)
- Use GRID blocks as the visual anchor — finance pages are data-heavy by nature
- Include category breakdowns (Housing, Food, Transport, Entertainment, etc.) with realistic amounts
- Add a "Notes" or "Financial Tip" CALLOUT at the bottom — Etsy planners always include these
- Prefer 'grid' or 'lined' paperType for clean financial layouts`,

    wellness: `[WELLNESS DESIGN RULES]
- Lead with MOOD_TRACKER or emotional check-in — feelings first, then structure
- Include at least one reflection TEXT block — journals need writing space, not just checkboxes
- Use soft, calming colors: rose for self-care, sky for calm, amber for warmth
- Include gratitude sections (3 items minimum) — this is the #1 requested wellness feature
- Add breathing room with DIVIDERs and QUOTEs — wellness pages should feel spacious, not cramped
- Use CALLOUT blocks for affirmations and self-care reminders
- Prefer 'dotted' or 'lined' paperType for a gentle, organic feel
- Include water intake tracking when daily wellness is mentioned`,

    health_fitness: `[HEALTH & FITNESS DESIGN RULES]
- Use GRID as the visual anchor for workout logs — columns: Exercise, Sets, Reps, Weight, Notes
- For meal planners: use 7-row GRIDs with day columns (B/L/D/S) + separate grocery CHECKBOX list
- Categorize grocery lists by department (Produce, Protein, Dairy, Grains, Frozen) like real Etsy templates
- Include a progress/body stats section with measurable metrics
- Use sky/blue for fitness, emerald for nutrition/health
- Add motivational QUOTEs specific to health and fitness
- For meal plans, pair the meal GRID with a shopping list on the opposite side (left/right)
- Prefer 'grid' paperType for structured tracking layouts`,

    lifestyle: `[LIFESTYLE DESIGN RULES]
- Match the block structure to the activity: TIME_BLOCK for travel, GRID for reading logs, CHECKBOX for packing
- For reading journals: include rating, quotes section, and reflection — mimic Goodreads-style layouts
- Travel itineraries need: schedule + budget + packing list on one spread
- Use warm, inviting colors: amber for cozy lifestyle, indigo for organization
- Brain dump pages need a large TEXT area followed by "Pick 3" action items
- Meeting notes need clear hierarchy: agenda → discussion → action items → follow-ups
- Prefer 'lined' or 'dotted' paperType for flexible lifestyle layouts`,

    business: `[BUSINESS DESIGN RULES]
- Use professional color schemes: slate for headers, indigo for data, emerald for financial positive
- Structure pages like real business documents: clear sections with labeled GRIDs
- Include status columns in tracking GRIDs (Not Started / In Progress / Complete / Blocked)
- Project dashboards need: milestones GOAL_SECTION + deliverables CHECKBOX + timeline GRID
- Sales and invoice tracking need totals rows and date-based organization
- Add a professional CALLOUT with business tips or best practices
- Use 'grid' or 'blank' paperType for clean, corporate-feeling layouts
- Include realistic column headers that match industry standards`,

    marketing: `[MARKETING & SOCIAL MEDIA DESIGN RULES]
- Structure social media pages BY PLATFORM (Facebook, Instagram, TikTok, Pinterest, YouTube sections)
- Include engagement metrics: followers, likes, comments, shares, reach
- Content calendars should use WEEKLY_VIEW with post-type labels per day
- Brand worksheets need: tone attributes, language style, target audience, visual identity sections
- Use vibrant but professional colors: indigo for strategy, rose for creative, sky for analytics
- Campaign planners need: objectives → timeline → deliverables → metrics structure
- Hashtag research pages should group by topic/niche with reach estimates
- Use 'blank' or 'grid' paperType for modern marketing layouts`,

    academic: `[ACADEMIC DESIGN RULES]
- Cornell notes layout: use left side for cue/questions column, right side for main notes, bottom for summary
- Class schedules need: GRID with Time/Mon/Tue/Wed/Thu/Fri columns
- Exam prep pages need countdown-style organization with study task CHECKBOXes
- Include SMART goal format for academic goal-setting (Specific/Measurable/Achievable/Relevant/Time-bound)
- Use scholarly colors: slate, indigo, gray for professional academic feel
- Research notes need source attribution, key findings, and bibliography sections
- Prefer 'legal' or 'lined' paperType for academic layouts
- Include study tips in CALLOUT blocks (Pomodoro, active recall, spaced repetition)`,

    planning: `[TIME PLANNING DESIGN RULES]
- Follow time hierarchy: yearly overview → monthly dashboard → weekly spread → daily focus
- Weekly pages need a mini CALENDAR block for month context
- Daily pages need: TIME_BLOCK schedule + top 3 priorities CHECKBOX + at least one reflection element
- Monthly dashboards need: GOAL_SECTION + HABIT_TRACKER + CALENDAR + focus areas
- Use progressive disclosure across pages: overview first, then detail pages
- Pair every planning page with a reflection element (MOOD_TRACKER, TEXT for "How did it go?")
- Use indigo for structure, rose for personal, emerald for achievement
- Vary layouts between pages: vertical vs horizontal, data-heavy vs reflection-focused
- Prefer 'grid' or 'dotted' paperType for planning layouts`,

    general: `[GENERAL DESIGN RULES]
- Create a visually balanced layout with clear hierarchy
- Use a mix of block types — never just CHECKBOXes or just TEXT
- Include at least one structured element (GRID, TIME_BLOCK, or WEEKLY_VIEW) as visual anchor
- Add complementary elements: CALLOUT for tips, QUOTE for inspiration, DIVIDER for sections`,
  };

  return rules[domain];
}

/**
 * Returns the complete design principles that go into every prompt.
 */
export function getDesignPrinciples(): string {
  return `=== DESIGN PRINCIPLES (follow these for EVERY page) ===
1. VISUAL ANCHOR — Every page needs ONE dominant block that catches the eye:
   a large GRID, CALENDAR, TIME_BLOCK, WEEKLY_VIEW, or HABIT_TRACKER.
   This is the centerpiece that makes the page feel purposeful, not random.

2. COMPLEMENTARY BLOCKS — Support the anchor with 2-4 smaller blocks:
   If the anchor is a schedule, add priorities + mood + notes alongside it.
   If the anchor is a tracker, add goals + reflection + tips.

3. VISUAL RHYTHM — Alternate between dense blocks (GRID, TIME_BLOCK) and
   breathing room (DIVIDER, CALLOUT, QUOTE). Never stack 3+ dense blocks
   without a break. A planner page that feels cramped will be abandoned.

4. PROGRESSIVE DISCLOSURE — When generating multi-page sets:
   Page 1 = overview/dashboard, Pages 2-3 = detailed tracking/schedules,
   Last page = reflection/review. Each page serves a distinct purpose.

5. USEFUL STANDALONE, BETTER TOGETHER — Each page should be functional on
   its own but create a complete system when used as a set.

6. PROFESSIONAL FINISHING — Every page needs:
   - A specific, descriptive title (not "Page 1" or "Notes")
   - Realistic pre-filled example data in GRIDs (not "Item 1", "Item 2")
   - A balanced left/right side distribution for the 2-page spread
   - At least one CALLOUT or QUOTE for personality and guidance

=== ANTI-PATTERNS (never do these) ===
- DON'T generate pages that are just lists of CHECKBOXes — that's a to-do app, not a planner
- DON'T use generic titles like "Notes" or "Page 1" — use specific: "January Savings Dashboard"
- DON'T repeat the same block layout on every page — vary the visual structure
- DON'T leave GRID blocks with empty placeholder text — fill with realistic example data
- DON'T make every page look the same — a finance tracker should LOOK different from a wellness journal
- DON'T use only one side (left or right) — distribute blocks across both sides
- DON'T stack more than 3 CHECKBOX blocks without a different block type between them
- DON'T forget DIVIDER blocks to create visual sections`;
}
