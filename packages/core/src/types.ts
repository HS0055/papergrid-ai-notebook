export enum BlockType {
  TEXT = 'TEXT',
  HEADING = 'HEADING',
  GRID = 'GRID', // For structured data like planners
  CHECKBOX = 'CHECKBOX',
  CALLOUT = 'CALLOUT',
  QUOTE = 'QUOTE',
  DIVIDER = 'DIVIDER',
  MOOD_TRACKER = 'MOOD_TRACKER',
  PRIORITY_MATRIX = 'PRIORITY_MATRIX',
  INDEX = 'INDEX',
  MUSIC_STAFF = 'MUSIC_STAFF',
  CALENDAR = 'CALENDAR',
  WEEKLY_VIEW = 'WEEKLY_VIEW',
  HABIT_TRACKER = 'HABIT_TRACKER',
  GOAL_SECTION = 'GOAL_SECTION',
  TIME_BLOCK = 'TIME_BLOCK',
  DAILY_SECTION = 'DAILY_SECTION',
}

export interface GridCell {
  id: string;
  content: string;
}

export interface MusicNote {
  id: string;
  pitch: string;       // 'C','D','E','F','G','A','B'
  octave: number;      // 3-5
  duration: 'whole' | 'half' | 'quarter' | 'eighth';
  position: number;    // horizontal % (0-100)
  accidental?: 'sharp' | 'flat';
}

export interface MusicStaffData {
  clef: 'treble' | 'bass';
  timeSignature: string;
  notes: MusicNote[];
}

export interface CalendarEvent {
  day: number;           // 1-31
  title: string;
  color?: string;        // theme color name
}

export interface CalendarData {
  month: number;         // 1-12
  year: number;          // e.g., 2026
  highlights?: number[]; // highlighted date numbers
  events?: CalendarEvent[]; // per-day events
}

export interface WeeklyViewTask {
  text: string;
  checked: boolean;
}

export interface WeeklyViewDay {
  label: string;         // "Monday", "Tue", etc.
  content: string;
  tasks?: WeeklyViewTask[];
}

export interface WeeklyViewData {
  startDate?: string;    // ISO date string
  days: WeeklyViewDay[];
}

export interface HabitTrackerData {
  habits: string[];      // habit names
  days: number;          // 7, 14, 28, 30, 31
  checked: boolean[][];  // habits.length x days matrix
}

export interface GoalItem {
  text: string;
  subItems: Array<{ text: string; checked: boolean }>;
  progress?: number;     // 0-100
}

export interface GoalSectionData {
  goals: GoalItem[];
}

export interface TimeBlockEntry {
  time: string;          // "8:00 AM"
  content: string;
  color?: string;
}

export interface TimeBlockData {
  startHour: number;     // 0-23
  endHour: number;       // 0-23
  interval: 30 | 60;     // minutes
  entries: TimeBlockEntry[];
}

export interface DailySectionEntry {
  label: string;         // "Morning", "Afternoon", etc.
  content: string;
}

export interface DailySectionData {
  date?: string;         // ISO date
  dayLabel?: string;     // "Monday, March 2"
  sections: DailySectionEntry[];
}

export interface Block {
  id: string;
  type: BlockType;
  content: string; // Used for TEXT, HEADING, CALLOUT, QUOTE
  gridData?: {
    columns: string[]; // Headers for the grid
    rows: GridCell[][]; // Row data
  };
  checked?: boolean; // For CHECKBOX
  alignment?: 'left' | 'center' | 'right';
  emphasis?: 'bold' | 'italic' | 'highlight' | 'none';
  color?: string; // 'rose', 'indigo', 'emerald', 'amber', 'slate', 'sky', 'gray'
  side?: 'left' | 'right'; // Which page of the spread this block is on
  moodValue?: number; // 0-4 for mood tracker
  matrixData?: {
    q1: string;
    q2: string;
    q3: string;
    q4: string;
  };
  musicData?: MusicStaffData;
  calendarData?: CalendarData;
  weeklyViewData?: WeeklyViewData;
  habitTrackerData?: HabitTrackerData;
  goalSectionData?: GoalSectionData;
  timeBlockData?: TimeBlockData;
  dailySectionData?: DailySectionData;
}

export interface NotebookPage {
  id: string;
  title: string;
  createdAt: string;
  paperType: 'lined' | 'grid' | 'dotted' | 'blank' | 'music' | 'rows' | 'isometric' | 'hex' | 'legal' | 'crumpled';
  blocks: Block[];
  aesthetic?: string;
  themeColor?: string;
  aiGenerated?: boolean;
}

export interface Notebook {
  id: string;
  title: string;
  coverColor: string;
  coverImageUrl?: string;
  createdAt: string;
  pages: NotebookPage[];
  bookmarks: string[]; // Array of page IDs that are bookmarked
}

export interface LayoutGenerationRequest {
  prompt: string;
  industry?: string;
}