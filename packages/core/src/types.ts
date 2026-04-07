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
  PROGRESS_BAR = 'PROGRESS_BAR',
  RATING = 'RATING',
  WATER_TRACKER = 'WATER_TRACKER',
  SECTION_NAV = 'SECTION_NAV',
  KANBAN = 'KANBAN',
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

export interface ProgressBarData {
  label: string;
  current: number;       // 0-100
  target: string;        // e.g. "$5,000"
  color: string;         // theme color
}

export interface RatingData {
  label: string;
  max: number;           // 5 or 10
  value: number;         // current rating
  style: 'star' | 'circle' | 'heart';
}

export interface WaterTrackerData {
  goal: number;          // glasses per day (default 8)
  filled: number;        // how many filled
}

export interface SectionNavData {
  sections: Array<{ label: string; icon?: string; pageIndex?: number }>;
}

export interface KanbanCard {
  id: string;
  text: string;
  checked?: boolean;
}

export interface KanbanColumn {
  title: string;
  color: string;
  cards: KanbanCard[];
}

export interface KanbanData {
  columns: KanbanColumn[];
}

export interface HexNode {
  id: string;
  label: string;
  color: string;       // theme color name
  gridX: number;       // hex grid column
  gridY: number;       // hex grid row
}

export interface HexEdge {
  id: string;
  from: string;        // node id
  to: string;          // node id
  label?: string;
}

export interface HexMapData {
  nodes: HexNode[];
  edges: HexEdge[];
}

export type IsoStepType = 'process' | 'decision' | 'start' | 'end';

export interface IsoStep {
  id: string;
  label: string;
  type: IsoStepType;
  color: string;       // theme color name
}

export interface IsoConnection {
  id: string;
  from: string;        // step id
  to: string;          // step id
  label?: string;
}

export interface IsoFlowData {
  steps: IsoStep[];
  connections: IsoConnection[];
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
  progressBarData?: ProgressBarData;
  ratingData?: RatingData;
  waterTrackerData?: WaterTrackerData;
  sectionNavData?: SectionNavData;
  kanbanData?: KanbanData;
  /** @deprecated MathBlock-as-block-widget approach was rejected. Field kept
   *  optional so existing references in mathEngine.ts compile while we transition
   *  to the page-level GridPaperCanvas. Will be removed in a future cleanup. */
  mathBlockData?: { rows: number; cols: number; cells: string[] };

  // Visual styling (Etsy-quality planner design)
  containerStyle?: 'card' | 'banner' | 'accent-left' | 'none';
  icon?: string;         // emoji icon displayed before content
  groupId?: string;      // blocks with same groupId share a visual container
}

export interface LinedPaperSettings {
  showMargin: boolean;
  marginSide: 'left' | 'right';
  rowShading: boolean;
  legalPadMode: boolean;
  fontFamily: 'hand' | 'sans' | 'serif' | 'mono';
}

/**
 * Page-level data for Grid paper. Each printed grid cell can hold ONE
 * character. The grid is sparse — cells default to empty. Coordinates are
 * in cell units (not pixels), where (0,0) is the top-left cell of the
 * paper content area.
 */
export interface GridSheetData {
  /** Sparse map of "row,col" → single character. */
  cells: Record<string, string>;
}

export interface NotebookPage {
  id: string;
  title: string;
  createdAt: string;
  paperType: 'lined' | 'grid' | 'dotted' | 'blank' | 'music' | 'isometric' | 'hex';
  blocks: Block[];
  aesthetic?: string;
  themeColor?: string;
  aiGenerated?: boolean;
  linedSettings?: LinedPaperSettings;
  showMathResults?: boolean;
  hexMapData?: HexMapData;
  isoFlowData?: IsoFlowData;
  gridSheetData?: GridSheetData;
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