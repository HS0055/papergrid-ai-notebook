import { BlockType } from './types';
import type { Block, NotebookPage } from './types';

// ---------------------------------------------------------------------------
// ReferenceLayout - a curated, market-inspired layout used as a few-shot
// example when prompting the Gemini AI model.  Each layout captures a real
// product pattern (Amazon Labterry, Etsy pastel student, ADHD rainbow, etc.)
// so the AI can ground its generation in proven designs.
// ---------------------------------------------------------------------------

export interface ReferenceLayout {
  /** Unique stable identifier, e.g. "weekly-planner" */
  id: string;
  /** Where the design pattern comes from */
  source: string;
  /** Optional product URL */
  sourceUrl?: string;
  /** Target user niche / use-case */
  niche: string;
  /** Short style descriptor */
  style: string;
  /** Visual aesthetic keyword (minimalist, pastel, bold, etc.) */
  aesthetic: string;
  /** Searchable tags for the matching engine */
  tags: string[];
  /** Paper type for the page */
  paperType: NotebookPage['paperType'];
  /** Primary theme color */
  themeColor: string;
  /** Human-readable title shown in the generated page */
  title: string;
  /** The actual block content of the layout */
  blocks: Block[];
}

// ---------------------------------------------------------------------------
// Helper: deterministic ID generator for reference data (no crypto needed).
// ---------------------------------------------------------------------------
let _refIdCounter = 0;
const rid = (): string => `ref-${++_refIdCounter}`;

const cell = (content: string) => ({ id: rid(), content });

// ---------------------------------------------------------------------------
// 1. WEEKLY PLANNER  (Amazon Labterry 2026-2027 pattern)
// ---------------------------------------------------------------------------
const weeklyPlanner: ReferenceLayout = {
  id: 'weekly-planner',
  source: 'Amazon Labterry 2026-2027 Weekly Planner',
  sourceUrl: 'https://www.amazon.com/dp/B0DKQGC3SY',
  niche: 'productivity',
  style: 'structured weekly overview with focus and notes areas',
  aesthetic: 'minimalist',
  tags: [
    'weekly', 'planner', 'schedule', 'week', 'productivity',
    'time management', 'organization', 'minimalist', 'professional',
  ],
  paperType: 'grid',
  themeColor: 'slate',
  title: 'Weekly Planner',
  blocks: [
    {
      id: rid(), type: BlockType.HEADING, content: 'Week of ___________',
      side: 'left', alignment: 'center', emphasis: 'bold', color: 'slate',
    },
    {
      id: rid(), type: BlockType.WEEKLY_VIEW, content: 'Weekly Schedule',
      side: 'left', alignment: 'left', emphasis: 'none', color: 'slate',
      weeklyViewData: {
        days: [
          { label: 'Monday', content: '' }, { label: 'Tuesday', content: '' },
          { label: 'Wednesday', content: '' }, { label: 'Thursday', content: '' },
          { label: 'Friday', content: '' }, { label: 'Saturday', content: '' },
          { label: 'Sunday', content: '' },
        ],
      },
    },
    {
      id: rid(), type: BlockType.DIVIDER, content: '',
      side: 'right', alignment: 'left', emphasis: 'none',
    },
    {
      id: rid(), type: BlockType.CALENDAR, content: 'This Week',
      side: 'right', alignment: 'center', emphasis: 'none', color: 'slate',
      calendarData: { month: 3, year: 2026, highlights: [] },
    },
    {
      id: rid(), type: BlockType.HEADING, content: 'Focus This Week',
      side: 'right', alignment: 'left', emphasis: 'bold', color: 'indigo',
    },
    {
      id: rid(), type: BlockType.CHECKBOX, content: 'Top priority #1',
      side: 'right', alignment: 'left', emphasis: 'none', checked: false,
    },
    {
      id: rid(), type: BlockType.CHECKBOX, content: 'Top priority #2',
      side: 'right', alignment: 'left', emphasis: 'none', checked: false,
    },
    {
      id: rid(), type: BlockType.CHECKBOX, content: 'Top priority #3',
      side: 'right', alignment: 'left', emphasis: 'none', checked: false,
    },
    {
      id: rid(), type: BlockType.CALLOUT, content: 'Notes & reminders for the week go here.',
      side: 'right', alignment: 'left', emphasis: 'italic', color: 'gray',
    },
  ],
};

// ---------------------------------------------------------------------------
// 2. DAILY PLANNER  (pastel rose aesthetic, self-care vibes)
// ---------------------------------------------------------------------------
const dailyPlanner: ReferenceLayout = {
  id: 'daily-planner',
  source: 'Etsy Pastel Daily Planner pattern',
  niche: 'self-care',
  style: 'time-blocked daily page with gratitude and mood',
  aesthetic: 'pastel',
  tags: [
    'daily', 'planner', 'schedule', 'time blocks', 'gratitude',
    'mood', 'pastel', 'self-care', 'rose', 'priorities',
  ],
  paperType: 'lined',
  themeColor: 'rose',
  title: 'Daily Planner',
  blocks: [
    {
      id: rid(), type: BlockType.HEADING, content: 'Today: ___________',
      side: 'left', alignment: 'center', emphasis: 'bold', color: 'rose',
    },
    {
      id: rid(), type: BlockType.CALLOUT, content: 'Top 3 Priorities',
      side: 'left', alignment: 'left', emphasis: 'bold', color: 'rose',
    },
    {
      id: rid(), type: BlockType.CHECKBOX, content: '1. _______________',
      side: 'left', alignment: 'left', emphasis: 'none', checked: false,
    },
    {
      id: rid(), type: BlockType.CHECKBOX, content: '2. _______________',
      side: 'left', alignment: 'left', emphasis: 'none', checked: false,
    },
    {
      id: rid(), type: BlockType.CHECKBOX, content: '3. _______________',
      side: 'left', alignment: 'left', emphasis: 'none', checked: false,
    },
    {
      id: rid(), type: BlockType.TIME_BLOCK, content: 'Time Blocks',
      side: 'left', alignment: 'left', emphasis: 'none', color: 'rose',
      timeBlockData: {
        startHour: 7, endHour: 17, interval: 60,
        entries: [
          { time: '7:00 AM', content: '' }, { time: '8:00 AM', content: '' },
          { time: '9:00 AM', content: '' }, { time: '10:00 AM', content: '' },
          { time: '11:00 AM', content: '' }, { time: '12:00 PM', content: 'Lunch' },
          { time: '1:00 PM', content: '' }, { time: '2:00 PM', content: '' },
          { time: '3:00 PM', content: '' }, { time: '4:00 PM', content: '' },
          { time: '5:00 PM', content: '' },
        ],
      },
    },
    {
      id: rid(), type: BlockType.DIVIDER, content: '',
      side: 'right', alignment: 'left', emphasis: 'none',
    },
    {
      id: rid(), type: BlockType.HEADING, content: 'Gratitude',
      side: 'right', alignment: 'left', emphasis: 'bold', color: 'rose',
    },
    {
      id: rid(), type: BlockType.TEXT, content: 'Today I am grateful for...',
      side: 'right', alignment: 'left', emphasis: 'italic', color: 'rose',
    },
    {
      id: rid(), type: BlockType.TEXT, content: '1.\n2.\n3.',
      side: 'right', alignment: 'left', emphasis: 'none',
    },
    {
      id: rid(), type: BlockType.MOOD_TRACKER, content: 'How are you feeling today?',
      side: 'right', alignment: 'center', emphasis: 'none', color: 'rose',
      moodValue: 3,
    },
    {
      id: rid(), type: BlockType.QUOTE,
      content: '"The secret of getting ahead is getting started." - Mark Twain',
      side: 'right', alignment: 'center', emphasis: 'italic', color: 'rose',
    },
  ],
};

// ---------------------------------------------------------------------------
// 3. STUDENT STUDY PLANNER  (Etsy pink student notebook)
// ---------------------------------------------------------------------------
const studentStudyPlanner: ReferenceLayout = {
  id: 'student-study-planner',
  source: 'Etsy Pink Student Notebook',
  niche: 'student',
  style: 'class schedule with assignment tracker and study tips',
  aesthetic: 'pastel',
  tags: [
    'student', 'study', 'school', 'college', 'university', 'assignments',
    'class schedule', 'homework', 'academic', 'education', 'planner',
  ],
  paperType: 'grid',
  themeColor: 'rose',
  title: 'Student Study Planner',
  blocks: [
    {
      id: rid(), type: BlockType.HEADING, content: 'Study Planner - Week of ___',
      side: 'left', alignment: 'center', emphasis: 'bold', color: 'rose',
    },
    {
      id: rid(), type: BlockType.GRID, content: 'Class Schedule',
      side: 'left', alignment: 'left', emphasis: 'none', color: 'rose',
      gridData: {
        columns: ['Time', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        rows: [
          [cell('9:00 AM'), cell(''), cell(''), cell(''), cell(''), cell('')],
          [cell('10:00 AM'), cell(''), cell(''), cell(''), cell(''), cell('')],
          [cell('11:00 AM'), cell(''), cell(''), cell(''), cell(''), cell('')],
          [cell('12:00 PM'), cell(''), cell(''), cell(''), cell(''), cell('')],
          [cell('1:00 PM'), cell(''), cell(''), cell(''), cell(''), cell('')],
          [cell('2:00 PM'), cell(''), cell(''), cell(''), cell(''), cell('')],
          [cell('3:00 PM'), cell(''), cell(''), cell(''), cell(''), cell('')],
        ],
      },
    },
    {
      id: rid(), type: BlockType.DIVIDER, content: '',
      side: 'right', alignment: 'left', emphasis: 'none',
    },
    {
      id: rid(), type: BlockType.HEADING, content: 'Assignments Due',
      side: 'right', alignment: 'left', emphasis: 'bold', color: 'indigo',
    },
    {
      id: rid(), type: BlockType.GRID, content: 'Assignment Tracker',
      side: 'right', alignment: 'left', emphasis: 'none', color: 'indigo',
      gridData: {
        columns: ['Subject', 'Assignment', 'Due Date', 'Status'],
        rows: [
          [cell(''), cell(''), cell(''), cell('')],
          [cell(''), cell(''), cell(''), cell('')],
          [cell(''), cell(''), cell(''), cell('')],
          [cell(''), cell(''), cell(''), cell('')],
          [cell(''), cell(''), cell(''), cell('')],
        ],
      },
    },
    {
      id: rid(), type: BlockType.CALLOUT,
      content: 'Study Tips: Use active recall, space your reviews (1-3-7 days), and take breaks every 25 min (Pomodoro).',
      side: 'right', alignment: 'left', emphasis: 'italic', color: 'rose',
    },
    {
      id: rid(), type: BlockType.CHECKBOX, content: 'Review flashcards',
      side: 'right', alignment: 'left', emphasis: 'none', checked: false,
    },
    {
      id: rid(), type: BlockType.CHECKBOX, content: 'Finish reading chapter',
      side: 'right', alignment: 'left', emphasis: 'none', checked: false,
    },
    {
      id: rid(), type: BlockType.CHECKBOX, content: 'Submit homework',
      side: 'right', alignment: 'left', emphasis: 'none', checked: false,
    },
  ],
};

// ---------------------------------------------------------------------------
// 4. ADHD-FRIENDLY PLANNER  (Etsy rainbow ADHD planner)
// ---------------------------------------------------------------------------
const adhdPlanner: ReferenceLayout = {
  id: 'adhd-friendly-planner',
  source: 'Etsy Rainbow ADHD Planner',
  niche: 'adhd',
  style: 'brain dump with "pick just 3" and priority matrix, bold colors',
  aesthetic: 'bold',
  tags: [
    'adhd', 'neurodivergent', 'brain dump', 'focus', 'rainbow',
    'priority matrix', 'executive function', 'planner', 'colorful',
    'tasks', 'simple',
  ],
  paperType: 'dotted',
  themeColor: 'amber',
  title: 'ADHD-Friendly Daily Planner',
  blocks: [
    {
      id: rid(), type: BlockType.HEADING, content: 'Brain Dump Zone',
      side: 'left', alignment: 'center', emphasis: 'bold', color: 'amber',
    },
    {
      id: rid(), type: BlockType.CALLOUT,
      content: 'Write EVERYTHING on your mind. No filtering, no judging. Just get it out of your head.',
      side: 'left', alignment: 'left', emphasis: 'italic', color: 'amber',
    },
    {
      id: rid(), type: BlockType.TEXT, content: '',
      side: 'left', alignment: 'left', emphasis: 'none',
    },
    {
      id: rid(), type: BlockType.DIVIDER, content: '',
      side: 'left', alignment: 'left', emphasis: 'none',
    },
    {
      id: rid(), type: BlockType.HEADING, content: 'Pick Just 3',
      side: 'left', alignment: 'center', emphasis: 'bold', color: 'emerald',
    },
    {
      id: rid(), type: BlockType.CALLOUT,
      content: 'From your brain dump, pick ONLY 3 things. That is enough. You are enough.',
      side: 'left', alignment: 'left', emphasis: 'italic', color: 'emerald',
    },
    {
      id: rid(), type: BlockType.CHECKBOX, content: '1.',
      side: 'left', alignment: 'left', emphasis: 'bold', color: 'emerald', checked: false,
    },
    {
      id: rid(), type: BlockType.CHECKBOX, content: '2.',
      side: 'left', alignment: 'left', emphasis: 'bold', color: 'sky', checked: false,
    },
    {
      id: rid(), type: BlockType.CHECKBOX, content: '3.',
      side: 'left', alignment: 'left', emphasis: 'bold', color: 'rose', checked: false,
    },
    {
      id: rid(), type: BlockType.DIVIDER, content: '',
      side: 'right', alignment: 'left', emphasis: 'none',
    },
    {
      id: rid(), type: BlockType.HEADING, content: 'Priority Matrix',
      side: 'right', alignment: 'center', emphasis: 'bold', color: 'sky',
    },
    {
      id: rid(), type: BlockType.PRIORITY_MATRIX, content: 'Sort your tasks',
      side: 'right', alignment: 'left', emphasis: 'none', color: 'sky',
      matrixData: {
        q1: 'Urgent + Important: DO NOW',
        q2: 'Important, Not Urgent: SCHEDULE',
        q3: 'Urgent, Not Important: DELEGATE',
        q4: 'Neither: DROP IT',
      },
    },
    {
      id: rid(), type: BlockType.MOOD_TRACKER, content: 'Energy check-in',
      side: 'right', alignment: 'center', emphasis: 'none', color: 'rose',
      moodValue: 2,
    },
    {
      id: rid(), type: BlockType.CALLOUT,
      content: 'Remember: Done is better than perfect. Progress, not perfection.',
      side: 'right', alignment: 'center', emphasis: 'bold', color: 'amber',
    },
  ],
};

// ---------------------------------------------------------------------------
// 5. HABIT TRACKER  (emerald / wellness aesthetic)
// ---------------------------------------------------------------------------
const habitTracker: ReferenceLayout = {
  id: 'habit-tracker',
  source: 'Popular habit tracker pattern (bullet journal community)',
  niche: 'habits',
  style: 'habits-by-week grid with monthly reflection',
  aesthetic: 'minimalist',
  tags: [
    'habit', 'tracker', 'habits', 'routine', 'wellness', 'health',
    'consistency', 'goals', 'self-improvement', 'monthly', 'reflection',
  ],
  paperType: 'grid',
  themeColor: 'emerald',
  title: 'Monthly Habit Tracker',
  blocks: [
    {
      id: rid(), type: BlockType.HEADING, content: 'Habit Tracker - Month: ___',
      side: 'left', alignment: 'center', emphasis: 'bold', color: 'emerald',
    },
    {
      id: rid(), type: BlockType.HABIT_TRACKER, content: 'Habits',
      side: 'left', alignment: 'left', emphasis: 'none', color: 'emerald',
      habitTrackerData: {
        habits: ['Drink 8 glasses water', 'Exercise 30 min', 'Read 20 pages', 'Meditate', 'No phone before 9 AM', 'Journal', 'Sleep by 11 PM'],
        days: 28,
        checked: Array.from({ length: 7 }, () => new Array(28).fill(false)),
      },
    },
    {
      id: rid(), type: BlockType.DIVIDER, content: '',
      side: 'right', alignment: 'left', emphasis: 'none',
    },
    {
      id: rid(), type: BlockType.HEADING, content: 'Monthly Reflection',
      side: 'right', alignment: 'left', emphasis: 'bold', color: 'emerald',
    },
    {
      id: rid(), type: BlockType.TEXT,
      content: 'What went well this month?\n\nWhat could be better?\n\nWhat habit do I want to add next month?',
      side: 'right', alignment: 'left', emphasis: 'none', color: 'emerald',
    },
    {
      id: rid(), type: BlockType.MOOD_TRACKER, content: 'Overall month mood',
      side: 'right', alignment: 'center', emphasis: 'none', color: 'emerald',
      moodValue: 3,
    },
    {
      id: rid(), type: BlockType.QUOTE,
      content: '"We are what we repeatedly do. Excellence, then, is not an act, but a habit." - Aristotle',
      side: 'right', alignment: 'center', emphasis: 'italic', color: 'emerald',
    },
  ],
};

// ---------------------------------------------------------------------------
// 6. MONTHLY OVERVIEW
// ---------------------------------------------------------------------------
const monthlyOverview: ReferenceLayout = {
  id: 'monthly-overview',
  source: 'Classic monthly planner pattern',
  niche: 'productivity',
  style: 'monthly goals with key dates and budget snapshot',
  aesthetic: 'minimalist',
  tags: [
    'monthly', 'overview', 'goals', 'budget', 'calendar', 'dates',
    'planner', 'organization', 'planning', 'professional',
  ],
  paperType: 'grid',
  themeColor: 'indigo',
  title: 'Monthly Overview',
  blocks: [
    {
      id: rid(), type: BlockType.HEADING, content: 'Monthly Overview - ___________',
      side: 'left', alignment: 'center', emphasis: 'bold', color: 'indigo',
    },
    {
      id: rid(), type: BlockType.CALENDAR, content: 'Month at a Glance',
      side: 'left', alignment: 'center', emphasis: 'none', color: 'indigo',
      calendarData: { month: 3, year: 2026, highlights: [] },
    },
    {
      id: rid(), type: BlockType.GOAL_SECTION, content: 'Monthly Goals',
      side: 'left', alignment: 'left', emphasis: 'none', color: 'indigo',
      goalSectionData: {
        goals: [
          { text: 'Goal 1', subItems: [{ text: 'Step 1', checked: false }, { text: 'Step 2', checked: false }] },
          { text: 'Goal 2', subItems: [{ text: 'Step 1', checked: false }, { text: 'Step 2', checked: false }] },
          { text: 'Goal 3', subItems: [{ text: 'Step 1', checked: false }, { text: 'Step 2', checked: false }] },
        ],
      },
    },
    {
      id: rid(), type: BlockType.DIVIDER, content: '',
      side: 'left', alignment: 'left', emphasis: 'none',
    },
    {
      id: rid(), type: BlockType.GRID, content: 'Key Dates',
      side: 'left', alignment: 'left', emphasis: 'none', color: 'indigo',
      gridData: {
        columns: ['Date', 'Event / Deadline'],
        rows: [
          [cell(''), cell('')],
          [cell(''), cell('')],
          [cell(''), cell('')],
          [cell(''), cell('')],
          [cell(''), cell('')],
          [cell(''), cell('')],
        ],
      },
    },
    {
      id: rid(), type: BlockType.DIVIDER, content: '',
      side: 'right', alignment: 'left', emphasis: 'none',
    },
    {
      id: rid(), type: BlockType.HEADING, content: 'Budget Snapshot',
      side: 'right', alignment: 'left', emphasis: 'bold', color: 'emerald',
    },
    {
      id: rid(), type: BlockType.GRID, content: 'Budget',
      side: 'right', alignment: 'left', emphasis: 'none', color: 'emerald',
      gridData: {
        columns: ['Category', 'Planned', 'Actual'],
        rows: [
          [cell('Income'), cell('$'), cell('$')],
          [cell('Rent / Housing'), cell('$'), cell('$')],
          [cell('Food'), cell('$'), cell('$')],
          [cell('Transport'), cell('$'), cell('$')],
          [cell('Savings'), cell('$'), cell('$')],
          [cell('Other'), cell('$'), cell('$')],
        ],
      },
    },
    {
      id: rid(), type: BlockType.TEXT,
      content: 'Notes: _______________',
      side: 'right', alignment: 'left', emphasis: 'none', color: 'gray',
    },
  ],
};

// ---------------------------------------------------------------------------
// 7. MEAL PLANNER  (emerald / cooking aesthetic)
// ---------------------------------------------------------------------------
const mealPlanner: ReferenceLayout = {
  id: 'meal-planner',
  source: 'Popular weekly meal planner pattern',
  niche: 'cooking',
  style: '7-day meal grid with grocery checklist',
  aesthetic: 'clean',
  tags: [
    'meal', 'planner', 'food', 'cooking', 'grocery', 'shopping list',
    'recipes', 'nutrition', 'diet', 'weekly meals', 'health',
  ],
  paperType: 'grid',
  themeColor: 'emerald',
  title: 'Weekly Meal Planner',
  blocks: [
    {
      id: rid(), type: BlockType.HEADING, content: 'Meal Planner - Week of ___',
      side: 'left', alignment: 'center', emphasis: 'bold', color: 'emerald',
    },
    {
      id: rid(), type: BlockType.GRID, content: 'Meals',
      side: 'left', alignment: 'left', emphasis: 'none', color: 'emerald',
      gridData: {
        columns: ['Day', 'Breakfast', 'Lunch', 'Dinner'],
        rows: [
          [cell('Monday'), cell(''), cell(''), cell('')],
          [cell('Tuesday'), cell(''), cell(''), cell('')],
          [cell('Wednesday'), cell(''), cell(''), cell('')],
          [cell('Thursday'), cell(''), cell(''), cell('')],
          [cell('Friday'), cell(''), cell(''), cell('')],
          [cell('Saturday'), cell(''), cell(''), cell('')],
          [cell('Sunday'), cell(''), cell(''), cell('')],
        ],
      },
    },
    {
      id: rid(), type: BlockType.DIVIDER, content: '',
      side: 'right', alignment: 'left', emphasis: 'none',
    },
    {
      id: rid(), type: BlockType.HEADING, content: 'Grocery List',
      side: 'right', alignment: 'left', emphasis: 'bold', color: 'emerald',
    },
    {
      id: rid(), type: BlockType.CHECKBOX, content: 'Produce: _______________',
      side: 'right', alignment: 'left', emphasis: 'none', checked: false,
    },
    {
      id: rid(), type: BlockType.CHECKBOX, content: 'Protein: _______________',
      side: 'right', alignment: 'left', emphasis: 'none', checked: false,
    },
    {
      id: rid(), type: BlockType.CHECKBOX, content: 'Dairy: _______________',
      side: 'right', alignment: 'left', emphasis: 'none', checked: false,
    },
    {
      id: rid(), type: BlockType.CHECKBOX, content: 'Grains: _______________',
      side: 'right', alignment: 'left', emphasis: 'none', checked: false,
    },
    {
      id: rid(), type: BlockType.CHECKBOX, content: 'Snacks: _______________',
      side: 'right', alignment: 'left', emphasis: 'none', checked: false,
    },
    {
      id: rid(), type: BlockType.CHECKBOX, content: 'Other: _______________',
      side: 'right', alignment: 'left', emphasis: 'none', checked: false,
    },
    {
      id: rid(), type: BlockType.CALLOUT,
      content: 'Meal prep tip: Prep protein + grains on Sunday, assemble fresh salads daily.',
      side: 'right', alignment: 'left', emphasis: 'italic', color: 'emerald',
    },
  ],
};

// ---------------------------------------------------------------------------
// 8. FITNESS TRACKER  (sky / athletic aesthetic)
// ---------------------------------------------------------------------------
const fitnessTracker: ReferenceLayout = {
  id: 'fitness-tracker',
  source: 'Fitness journal / gym log pattern',
  niche: 'fitness',
  style: 'exercise grid with body stats and progress tracking',
  aesthetic: 'bold',
  tags: [
    'fitness', 'exercise', 'gym', 'workout', 'tracker', 'health',
    'strength', 'cardio', 'body', 'weight', 'progress', 'training',
  ],
  paperType: 'grid',
  themeColor: 'sky',
  title: 'Fitness Tracker',
  blocks: [
    {
      id: rid(), type: BlockType.HEADING, content: 'Workout Log - Week of ___',
      side: 'left', alignment: 'center', emphasis: 'bold', color: 'sky',
    },
    {
      id: rid(), type: BlockType.GRID, content: 'Exercise Log',
      side: 'left', alignment: 'left', emphasis: 'none', color: 'sky',
      gridData: {
        columns: ['Exercise', 'Sets', 'Reps', 'Weight', 'Notes'],
        rows: [
          [cell('Squats'), cell(''), cell(''), cell(''), cell('')],
          [cell('Bench Press'), cell(''), cell(''), cell(''), cell('')],
          [cell('Deadlift'), cell(''), cell(''), cell(''), cell('')],
          [cell('Pull-ups'), cell(''), cell(''), cell(''), cell('')],
          [cell('Rows'), cell(''), cell(''), cell(''), cell('')],
          [cell('Shoulder Press'), cell(''), cell(''), cell(''), cell('')],
          [cell('Cardio'), cell(''), cell(''), cell(''), cell('')],
        ],
      },
    },
    {
      id: rid(), type: BlockType.DIVIDER, content: '',
      side: 'right', alignment: 'left', emphasis: 'none',
    },
    {
      id: rid(), type: BlockType.HEADING, content: 'Body Stats',
      side: 'right', alignment: 'left', emphasis: 'bold', color: 'sky',
    },
    {
      id: rid(), type: BlockType.GRID, content: 'Measurements',
      side: 'right', alignment: 'left', emphasis: 'none', color: 'sky',
      gridData: {
        columns: ['Metric', 'This Week', 'Last Week', 'Change'],
        rows: [
          [cell('Weight'), cell(''), cell(''), cell('')],
          [cell('Body Fat %'), cell(''), cell(''), cell('')],
          [cell('Chest'), cell(''), cell(''), cell('')],
          [cell('Waist'), cell(''), cell(''), cell('')],
          [cell('Arms'), cell(''), cell(''), cell('')],
        ],
      },
    },
    {
      id: rid(), type: BlockType.CALLOUT,
      content: 'Progress note: How do you feel compared to last week? Any PRs?',
      side: 'right', alignment: 'left', emphasis: 'italic', color: 'sky',
    },
    {
      id: rid(), type: BlockType.MOOD_TRACKER, content: 'Post-workout energy',
      side: 'right', alignment: 'center', emphasis: 'none', color: 'sky',
      moodValue: 4,
    },
  ],
};

// ---------------------------------------------------------------------------
// 9. BUDGET TRACKER  (multi-color sections for financial clarity)
// ---------------------------------------------------------------------------
const budgetTracker: ReferenceLayout = {
  id: 'budget-tracker',
  source: 'Personal finance planner pattern',
  niche: 'finance',
  style: 'income and expense grids with savings goals',
  aesthetic: 'clean',
  tags: [
    'budget', 'finance', 'money', 'tracker', 'income', 'expenses',
    'savings', 'financial', 'spending', 'planner', 'accounting',
  ],
  paperType: 'grid',
  themeColor: 'emerald',
  title: 'Monthly Budget Tracker',
  blocks: [
    {
      id: rid(), type: BlockType.HEADING, content: 'Budget Tracker - Month: ___',
      side: 'left', alignment: 'center', emphasis: 'bold', color: 'emerald',
    },
    {
      id: rid(), type: BlockType.CALLOUT, content: 'Income Sources',
      side: 'left', alignment: 'left', emphasis: 'bold', color: 'emerald',
    },
    {
      id: rid(), type: BlockType.GRID, content: 'Income',
      side: 'left', alignment: 'left', emphasis: 'none', color: 'emerald',
      gridData: {
        columns: ['Source', 'Expected', 'Actual', 'Date'],
        rows: [
          [cell('Salary'), cell('$'), cell('$'), cell('')],
          [cell('Freelance'), cell('$'), cell('$'), cell('')],
          [cell('Other'), cell('$'), cell('$'), cell('')],
        ],
      },
    },
    {
      id: rid(), type: BlockType.DIVIDER, content: '',
      side: 'left', alignment: 'left', emphasis: 'none',
    },
    {
      id: rid(), type: BlockType.CALLOUT, content: 'Expenses',
      side: 'left', alignment: 'left', emphasis: 'bold', color: 'rose',
    },
    {
      id: rid(), type: BlockType.GRID, content: 'Expenses',
      side: 'left', alignment: 'left', emphasis: 'none', color: 'rose',
      gridData: {
        columns: ['Category', 'Budget', 'Spent', 'Remaining'],
        rows: [
          [cell('Housing'), cell('$'), cell('$'), cell('$')],
          [cell('Food & Dining'), cell('$'), cell('$'), cell('$')],
          [cell('Transportation'), cell('$'), cell('$'), cell('$')],
          [cell('Utilities'), cell('$'), cell('$'), cell('$')],
          [cell('Entertainment'), cell('$'), cell('$'), cell('$')],
          [cell('Subscriptions'), cell('$'), cell('$'), cell('$')],
          [cell('Personal'), cell('$'), cell('$'), cell('$')],
        ],
      },
    },
    {
      id: rid(), type: BlockType.DIVIDER, content: '',
      side: 'right', alignment: 'left', emphasis: 'none',
    },
    {
      id: rid(), type: BlockType.HEADING, content: 'Savings Goals',
      side: 'right', alignment: 'left', emphasis: 'bold', color: 'sky',
    },
    {
      id: rid(), type: BlockType.GRID, content: 'Savings',
      side: 'right', alignment: 'left', emphasis: 'none', color: 'sky',
      gridData: {
        columns: ['Goal', 'Target', 'Saved', 'Progress'],
        rows: [
          [cell('Emergency Fund'), cell('$'), cell('$'), cell('%')],
          [cell('Vacation'), cell('$'), cell('$'), cell('%')],
          [cell('Investment'), cell('$'), cell('$'), cell('%')],
        ],
      },
    },
    {
      id: rid(), type: BlockType.TEXT,
      content: 'Total Income: $___  |  Total Expenses: $___  |  Net: $___',
      side: 'right', alignment: 'center', emphasis: 'bold', color: 'indigo',
    },
    {
      id: rid(), type: BlockType.CALLOUT,
      content: 'Financial tip: Follow the 50/30/20 rule - 50% needs, 30% wants, 20% savings.',
      side: 'right', alignment: 'left', emphasis: 'italic', color: 'amber',
    },
  ],
};

// ---------------------------------------------------------------------------
// 10. BULLET JOURNAL DAILY LOG  (amber / bujo aesthetic)
// ---------------------------------------------------------------------------
const bulletJournalLog: ReferenceLayout = {
  id: 'bullet-journal-daily-log',
  source: 'Ryder Carroll Bullet Journal Method',
  niche: 'bujo',
  style: 'rapid logging with checkboxes, gratitude, and mood',
  aesthetic: 'bujo',
  tags: [
    'bullet journal', 'bujo', 'rapid log', 'daily log', 'journal',
    'gratitude', 'mood', 'minimalist', 'analog', 'planner', 'creative',
  ],
  paperType: 'dotted',
  themeColor: 'amber',
  title: 'Daily Log',
  blocks: [
    {
      id: rid(), type: BlockType.HEADING, content: 'Daily Log - ___________',
      side: 'left', alignment: 'center', emphasis: 'bold', color: 'amber',
    },
    {
      id: rid(), type: BlockType.CALLOUT,
      content: 'Rapid Log: Use checkboxes for tasks, text for notes and events.',
      side: 'left', alignment: 'left', emphasis: 'italic', color: 'amber',
    },
    {
      id: rid(), type: BlockType.CHECKBOX, content: 'Task: _______________',
      side: 'left', alignment: 'left', emphasis: 'none', checked: false,
    },
    {
      id: rid(), type: BlockType.CHECKBOX, content: 'Task: _______________',
      side: 'left', alignment: 'left', emphasis: 'none', checked: false,
    },
    {
      id: rid(), type: BlockType.CHECKBOX, content: 'Task: _______________',
      side: 'left', alignment: 'left', emphasis: 'none', checked: false,
    },
    {
      id: rid(), type: BlockType.CHECKBOX, content: 'Task: _______________',
      side: 'left', alignment: 'left', emphasis: 'none', checked: false,
    },
    {
      id: rid(), type: BlockType.CHECKBOX, content: 'Task: _______________',
      side: 'left', alignment: 'left', emphasis: 'none', checked: false,
    },
    {
      id: rid(), type: BlockType.TEXT, content: 'Event: _______________',
      side: 'left', alignment: 'left', emphasis: 'none', color: 'indigo',
    },
    {
      id: rid(), type: BlockType.TEXT, content: 'Note: _______________',
      side: 'left', alignment: 'left', emphasis: 'italic', color: 'gray',
    },
    {
      id: rid(), type: BlockType.DAILY_SECTION, content: 'Day Structure',
      side: 'left', alignment: 'left', emphasis: 'none', color: 'amber',
      dailySectionData: {
        dayLabel: 'Today',
        sections: [
          { label: 'Morning', content: '' },
          { label: 'Afternoon', content: '' },
          { label: 'Evening', content: '' },
        ],
      },
    },
    {
      id: rid(), type: BlockType.DIVIDER, content: '',
      side: 'right', alignment: 'left', emphasis: 'none',
    },
    {
      id: rid(), type: BlockType.HEADING, content: 'Gratitude',
      side: 'right', alignment: 'left', emphasis: 'bold', color: 'amber',
    },
    {
      id: rid(), type: BlockType.TEXT,
      content: 'Three things I am grateful for today:\n1.\n2.\n3.',
      side: 'right', alignment: 'left', emphasis: 'none', color: 'amber',
    },
    {
      id: rid(), type: BlockType.MOOD_TRACKER, content: 'End of day mood',
      side: 'right', alignment: 'center', emphasis: 'none', color: 'amber',
      moodValue: 3,
    },
    {
      id: rid(), type: BlockType.QUOTE,
      content: '"The best time to plant a tree was 20 years ago. The second best time is now."',
      side: 'right', alignment: 'center', emphasis: 'italic', color: 'amber',
    },
  ],
};

// ---------------------------------------------------------------------------
// 11. STUDY SCHEDULE  (TIME_BLOCK + DAILY_SECTION)
// ---------------------------------------------------------------------------
const studySchedule: ReferenceLayout = {
  id: 'study-schedule',
  source: 'University student schedule pattern',
  niche: 'student',
  style: 'time-blocked class schedule with daily study sections',
  aesthetic: 'pastel',
  tags: [
    'study', 'student', 'schedule', 'class', 'school', 'time',
    'university', 'academic', 'planner',
  ],
  paperType: 'lined',
  themeColor: 'rose',
  title: 'Study Schedule',
  blocks: [
    {
      id: rid(), type: BlockType.HEADING, content: 'Study Schedule',
      side: 'left', alignment: 'center', emphasis: 'bold', color: 'rose',
    },
    {
      id: rid(), type: BlockType.TIME_BLOCK, content: 'Class & Study Blocks',
      side: 'left', alignment: 'left', emphasis: 'none', color: 'rose',
      timeBlockData: {
        startHour: 8, endHour: 17, interval: 60,
        entries: [
          { time: '8:00 AM', content: 'Morning review' },
          { time: '9:00 AM', content: 'Lecture: Biology 101' },
          { time: '10:00 AM', content: 'Study hall' },
          { time: '11:00 AM', content: 'Lecture: Calculus II' },
          { time: '12:00 PM', content: 'Lunch break' },
          { time: '1:00 PM', content: 'Lab session' },
          { time: '2:00 PM', content: 'Group study' },
          { time: '3:00 PM', content: 'Library - essay research' },
          { time: '4:00 PM', content: 'Office hours' },
          { time: '5:00 PM', content: 'Review & plan tomorrow' },
        ],
      },
    },
    {
      id: rid(), type: BlockType.CALLOUT,
      content: 'Study tip: Use the Pomodoro technique - 25 min focus, 5 min break. Repeat 4x, then take a longer break.',
      side: 'left', alignment: 'left', emphasis: 'italic', color: 'rose',
    },
    {
      id: rid(), type: BlockType.DAILY_SECTION, content: 'Study Plan',
      side: 'right', alignment: 'left', emphasis: 'none', color: 'indigo',
      dailySectionData: {
        dayLabel: 'Today',
        sections: [
          { label: 'Morning', content: 'Review lecture notes, flashcards' },
          { label: 'Afternoon', content: 'Lab prep, problem sets' },
          { label: 'Evening', content: 'Essay writing, reading assignments' },
        ],
      },
    },
    {
      id: rid(), type: BlockType.CHECKBOX, content: 'Complete reading for Biology',
      side: 'right', alignment: 'left', emphasis: 'none', checked: false,
    },
    {
      id: rid(), type: BlockType.CHECKBOX, content: 'Finish Calculus problem set',
      side: 'right', alignment: 'left', emphasis: 'none', checked: false,
    },
    {
      id: rid(), type: BlockType.CHECKBOX, content: 'Submit lab report draft',
      side: 'right', alignment: 'left', emphasis: 'none', checked: false,
    },
    {
      id: rid(), type: BlockType.QUOTE,
      content: '"Education is not the filling of a pail, but the lighting of a fire." - W.B. Yeats',
      side: 'right', alignment: 'center', emphasis: 'italic', color: 'rose',
    },
  ],
};

// ---------------------------------------------------------------------------
// 12. FITNESS HABIT TRACKER  (HABIT_TRACKER + CALENDAR)
// ---------------------------------------------------------------------------
const fitnessHabitTracker: ReferenceLayout = {
  id: 'fitness-habit-tracker',
  source: 'Fitness habit tracking pattern',
  niche: 'fitness',
  style: 'fitness habits with calendar overview and goals',
  aesthetic: 'bold',
  tags: [
    'fitness', 'habit', 'tracker', 'exercise', 'workout', 'health',
    'gym', 'wellness', 'routine',
  ],
  paperType: 'grid',
  themeColor: 'sky',
  title: 'Fitness Habits',
  blocks: [
    {
      id: rid(), type: BlockType.HEADING, content: 'Fitness Habits',
      side: 'left', alignment: 'center', emphasis: 'bold', color: 'sky',
    },
    {
      id: rid(), type: BlockType.HABIT_TRACKER, content: 'Weekly Fitness Habits',
      side: 'left', alignment: 'left', emphasis: 'none', color: 'sky',
      habitTrackerData: {
        habits: ['Morning stretch', '10K steps', 'Strength training', 'Drink 3L water', 'Protein goal met', 'Cardio 20 min', 'Sleep 7+ hrs'],
        days: 7,
        checked: Array.from({ length: 7 }, () => new Array(7).fill(false)),
      },
    },
    {
      id: rid(), type: BlockType.CALLOUT,
      content: 'Consistency beats intensity. Show up every day, even if it is just 10 minutes.',
      side: 'left', alignment: 'left', emphasis: 'italic', color: 'sky',
    },
    {
      id: rid(), type: BlockType.CALENDAR, content: 'March 2026',
      side: 'right', alignment: 'center', emphasis: 'none', color: 'sky',
      calendarData: { month: 3, year: 2026, highlights: [] },
    },
    {
      id: rid(), type: BlockType.MOOD_TRACKER, content: 'Post-workout energy',
      side: 'right', alignment: 'center', emphasis: 'none', color: 'sky',
      moodValue: 4,
    },
    {
      id: rid(), type: BlockType.GOAL_SECTION, content: 'Fitness Goals',
      side: 'right', alignment: 'left', emphasis: 'none', color: 'sky',
      goalSectionData: {
        goals: [
          { text: 'Run a 5K under 25 min', subItems: [{ text: 'Run 3x per week', checked: false }, { text: 'Increase distance 10% weekly', checked: false }] },
          { text: 'Bench press bodyweight', subItems: [{ text: 'Progressive overload program', checked: false }, { text: 'Track lifts weekly', checked: false }] },
          { text: 'Touch toes (flexibility)', subItems: [{ text: 'Daily stretching 10 min', checked: false }, { text: 'Yoga class 1x per week', checked: false }] },
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// 13. PROJECT TIMELINE  (WEEKLY_VIEW + GOAL_SECTION)
// ---------------------------------------------------------------------------
const projectTimeline: ReferenceLayout = {
  id: 'project-timeline',
  source: 'Project management planner pattern',
  niche: 'productivity',
  style: 'weekly project milestones with goal tracking',
  aesthetic: 'minimalist',
  tags: [
    'project', 'timeline', 'goals', 'milestones', 'weekly',
    'productivity', 'professional', 'planning',
  ],
  paperType: 'grid',
  themeColor: 'indigo',
  title: 'Project Timeline',
  blocks: [
    {
      id: rid(), type: BlockType.HEADING, content: 'Project Timeline',
      side: 'left', alignment: 'center', emphasis: 'bold', color: 'indigo',
    },
    {
      id: rid(), type: BlockType.WEEKLY_VIEW, content: "This Week's Plan",
      side: 'left', alignment: 'left', emphasis: 'none', color: 'indigo',
      weeklyViewData: {
        days: [
          { label: 'Monday', content: 'Sprint planning, assign tasks' },
          { label: 'Tuesday', content: 'Backend API development' },
          { label: 'Wednesday', content: 'Frontend implementation' },
          { label: 'Thursday', content: 'Code review & testing' },
          { label: 'Friday', content: 'Integration testing' },
          { label: 'Saturday', content: 'Documentation & cleanup' },
          { label: 'Sunday', content: 'Sprint retrospective prep' },
        ],
      },
    },
    {
      id: rid(), type: BlockType.DIVIDER, content: '',
      side: 'left', alignment: 'left', emphasis: 'none',
    },
    {
      id: rid(), type: BlockType.GOAL_SECTION, content: 'Project Milestones',
      side: 'right', alignment: 'left', emphasis: 'none', color: 'indigo',
      goalSectionData: {
        goals: [
          { text: 'MVP Launch', subItems: [{ text: 'Core features complete', checked: false }, { text: 'QA sign-off', checked: false }, { text: 'Deploy to staging', checked: false }] },
          { text: 'User Testing', subItems: [{ text: 'Recruit 10 testers', checked: false }, { text: 'Collect feedback', checked: false }] },
          { text: 'Marketing Prep', subItems: [{ text: 'Landing page live', checked: false }, { text: 'Email list setup', checked: false }] },
          { text: 'Production Release', subItems: [{ text: 'Performance audit', checked: false }, { text: 'Security review', checked: false }, { text: 'Go/no-go decision', checked: false }] },
        ],
      },
    },
    {
      id: rid(), type: BlockType.CALLOUT,
      content: 'Tip: Break large milestones into tasks that take 2 hours or less. Ship small, ship often.',
      side: 'right', alignment: 'left', emphasis: 'italic', color: 'indigo',
    },
    {
      id: rid(), type: BlockType.QUOTE,
      content: '"Plans are useless, but planning is indispensable." - Dwight D. Eisenhower',
      side: 'right', alignment: 'center', emphasis: 'italic', color: 'slate',
    },
  ],
};

// ---------------------------------------------------------------------------
// 14. SELF-CARE PLANNER  (MOOD_TRACKER + HABIT_TRACKER + DAILY_SECTION)
// ---------------------------------------------------------------------------
const selfCarePlanner: ReferenceLayout = {
  id: 'self-care-planner',
  source: 'Self-care and wellness journal pattern',
  niche: 'self-care',
  style: 'daily self-care routine with mood and habit tracking',
  aesthetic: 'pastel',
  tags: [
    'self-care', 'wellness', 'mental health', 'mindfulness', 'habits',
    'mood', 'gratitude', 'relaxation', 'daily', 'pastel',
  ],
  paperType: 'dotted',
  themeColor: 'rose',
  title: 'Self-Care Day',
  blocks: [
    {
      id: rid(), type: BlockType.HEADING, content: 'Self-Care Day',
      side: 'left', alignment: 'center', emphasis: 'bold', color: 'rose',
    },
    {
      id: rid(), type: BlockType.DAILY_SECTION, content: 'Daily Routine',
      side: 'left', alignment: 'left', emphasis: 'none', color: 'rose',
      dailySectionData: {
        dayLabel: 'Today',
        sections: [
          { label: 'Morning Routine', content: 'Skincare, journaling, light yoga' },
          { label: 'Afternoon', content: 'Creative time, walk in nature, nourishing lunch' },
          { label: 'Evening', content: 'Digital detox, warm bath, gratitude reflection' },
        ],
      },
    },
    {
      id: rid(), type: BlockType.MOOD_TRACKER, content: 'How am I feeling right now?',
      side: 'left', alignment: 'center', emphasis: 'none', color: 'rose',
      moodValue: 3,
    },
    {
      id: rid(), type: BlockType.HABIT_TRACKER, content: 'Self-Care Habits',
      side: 'right', alignment: 'left', emphasis: 'none', color: 'rose',
      habitTrackerData: {
        habits: ['Drank enough water', 'Moved my body', 'Journaled', 'Screen-free hour', 'Kind to myself'],
        days: 7,
        checked: Array.from({ length: 5 }, () => new Array(7).fill(false)),
      },
    },
    {
      id: rid(), type: BlockType.QUOTE,
      content: '"Almost everything will work again if you unplug it for a few minutes, including you." - Anne Lamott',
      side: 'right', alignment: 'center', emphasis: 'italic', color: 'rose',
    },
    {
      id: rid(), type: BlockType.CALLOUT,
      content: 'Reminder: Self-care is not selfish. You cannot pour from an empty cup.',
      side: 'right', alignment: 'left', emphasis: 'italic', color: 'rose',
    },
  ],
};

// ---------------------------------------------------------------------------
// 15. MEETING AGENDA  (TIME_BLOCK + CHECKBOX + CALLOUT)
// ---------------------------------------------------------------------------
const meetingAgenda: ReferenceLayout = {
  id: 'meeting-agenda',
  source: 'Professional meeting agenda pattern',
  niche: 'productivity',
  style: 'structured meeting agenda with time blocks and action items',
  aesthetic: 'minimalist',
  tags: [
    'meeting', 'agenda', 'notes', 'action items', 'minutes',
    'professional', 'business', 'time',
  ],
  paperType: 'lined',
  themeColor: 'slate',
  title: 'Meeting Agenda',
  blocks: [
    {
      id: rid(), type: BlockType.HEADING, content: 'Meeting Agenda',
      side: 'left', alignment: 'center', emphasis: 'bold', color: 'slate',
    },
    {
      id: rid(), type: BlockType.TIME_BLOCK, content: 'Agenda Timeline',
      side: 'left', alignment: 'left', emphasis: 'none', color: 'slate',
      timeBlockData: {
        startHour: 9, endHour: 12, interval: 30,
        entries: [
          { time: '9:00 AM', content: 'Welcome & introductions' },
          { time: '9:30 AM', content: 'Review previous action items' },
          { time: '10:00 AM', content: 'Main topic: Q2 planning' },
          { time: '10:30 AM', content: 'Discussion & feedback' },
          { time: '11:00 AM', content: 'Budget review' },
          { time: '11:30 AM', content: 'Action items & next steps' },
        ],
      },
    },
    {
      id: rid(), type: BlockType.DIVIDER, content: '',
      side: 'left', alignment: 'left', emphasis: 'none',
    },
    {
      id: rid(), type: BlockType.TEXT, content: 'Meeting Notes:\n\n\n\n',
      side: 'left', alignment: 'left', emphasis: 'none', color: 'gray',
    },
    {
      id: rid(), type: BlockType.HEADING, content: 'Action Items',
      side: 'right', alignment: 'left', emphasis: 'bold', color: 'slate',
    },
    {
      id: rid(), type: BlockType.CHECKBOX, content: 'Send meeting summary to team',
      side: 'right', alignment: 'left', emphasis: 'none', checked: false,
    },
    {
      id: rid(), type: BlockType.CHECKBOX, content: 'Update project timeline',
      side: 'right', alignment: 'left', emphasis: 'none', checked: false,
    },
    {
      id: rid(), type: BlockType.CHECKBOX, content: 'Schedule follow-up with stakeholders',
      side: 'right', alignment: 'left', emphasis: 'none', checked: false,
    },
    {
      id: rid(), type: BlockType.CHECKBOX, content: 'Prepare Q2 budget proposal',
      side: 'right', alignment: 'left', emphasis: 'none', checked: false,
    },
    {
      id: rid(), type: BlockType.CHECKBOX, content: 'Share slides with attendees',
      side: 'right', alignment: 'left', emphasis: 'none', checked: false,
    },
    {
      id: rid(), type: BlockType.DIVIDER, content: '',
      side: 'right', alignment: 'left', emphasis: 'none',
    },
    {
      id: rid(), type: BlockType.CALLOUT,
      content: 'Follow-up: Send action items within 24 hours. Next meeting scheduled for ___.',
      side: 'right', alignment: 'left', emphasis: 'bold', color: 'slate',
    },
  ],
};

// ---------------------------------------------------------------------------
// 16. MONTHLY PLANNER (clean calendar grid)
// ---------------------------------------------------------------------------
const monthlyPlanner: ReferenceLayout = {
  id: 'monthly-planner',
  source: 'Standard Monthly Calendar',
  niche: 'productivity',
  style: 'full page monthly calendar grid with daily typable boxes',
  aesthetic: 'clean',
  tags: ['monthly', 'planner', 'calendar', 'month', 'grid', 'planning', 'schedule', 'typable', 'dates'],
  paperType: 'grid',
  themeColor: 'indigo',
  title: 'Monthly Calendar Planner',
  blocks: [
    {
      id: rid(), type: BlockType.HEADING, content: 'Month: ___________',
      side: 'left', alignment: 'center', emphasis: 'bold', color: 'indigo',
    },
    {
      id: rid(), type: BlockType.GRID, content: '',
      side: 'left', alignment: 'center', emphasis: 'none', color: 'indigo',
      gridData: {
        columns: ['Sun', 'Mon', 'Tue', 'Wed'],
        rows: [
          [cell(''), cell(''), cell(''), cell('')],
          [cell(''), cell(''), cell(''), cell('')],
          [cell(''), cell(''), cell(''), cell('')],
          [cell(''), cell(''), cell(''), cell('')],
          [cell(''), cell(''), cell(''), cell('')],
        ],
      },
    },
    {
      id: rid(), type: BlockType.HEADING, content: 'Monthly Focus',
      side: 'right', alignment: 'center', emphasis: 'bold', color: 'indigo',
    },
    {
      id: rid(), type: BlockType.GRID, content: '',
      side: 'right', alignment: 'center', emphasis: 'none', color: 'indigo',
      gridData: {
        columns: ['Thu', 'Fri', 'Sat'],
        rows: [
          [cell(''), cell(''), cell('')],
          [cell(''), cell(''), cell('')],
          [cell(''), cell(''), cell('')],
          [cell(''), cell(''), cell('')],
          [cell(''), cell(''), cell('')],
        ],
      },
    },
    {
      id: rid(), type: BlockType.GOAL_SECTION, content: 'Goals',
      side: 'right', alignment: 'left', emphasis: 'none', color: 'indigo',
      goalSectionData: {
        goals: [
          { text: 'Main Goal 1', subItems: [{ text: 'Action step', checked: false }] },
          { text: 'Main Goal 2', subItems: [{ text: 'Action step', checked: false }] },
        ],
      },
    },
    {
      id: rid(), type: BlockType.HABIT_TRACKER, content: 'Key Habits',
      side: 'right', alignment: 'left', emphasis: 'none', color: 'emerald',
      habitTrackerData: {
        habits: ['Workout', 'Read', 'Meditate'],
        days: 30,
        checked: [[false], [false], [false]],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Master collection
// ---------------------------------------------------------------------------
export const REFERENCE_LAYOUTS: readonly ReferenceLayout[] = [
  weeklyPlanner,
  dailyPlanner,
  studentStudyPlanner,
  adhdPlanner,
  habitTracker,
  monthlyOverview,
  mealPlanner,
  fitnessTracker,
  budgetTracker,
  bulletJournalLog,
  studySchedule,
  fitnessHabitTracker,
  projectTimeline,
  selfCarePlanner,
  meetingAgenda,
  monthlyPlanner,
] as const;

// ---------------------------------------------------------------------------
// matchReferences  --  scores each reference layout against a user prompt and
// returns the top N best-matching layouts.  Used to select few-shot examples
// for the Gemini AI generation prompt.
//
// Scoring:
//   - tag match:      3 points per matching tag
//   - niche match:    5 points
//   - aesthetic match: 2 points
//   - style keyword:  2 points per matching word in the style description
// ---------------------------------------------------------------------------

export interface MatchResult {
  layout: ReferenceLayout;
  score: number;
}

export function matchReferences(
  prompt: string,
  aesthetic?: string,
  maxResults = 3,
): MatchResult[] {
  const lowerPrompt = prompt.toLowerCase();
  const promptWords = lowerPrompt.split(/\s+/);
  const lowerAesthetic = aesthetic?.toLowerCase();

  const scored: MatchResult[] = REFERENCE_LAYOUTS.map((layout) => {
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
      // Skip very short / common words to avoid noise
      if (word.length <= 2) continue;
      if (promptWords.includes(word)) {
        score += 2;
      }
    }

    return { layout, score };
  });

  // Sort descending by score, then by layout id for deterministic ordering
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.layout.id.localeCompare(b.layout.id);
  });

  return scored.slice(0, maxResults);
}
