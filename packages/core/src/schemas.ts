import { z } from 'zod';

// Block types enum - mirrors BlockType from types.ts
export const BlockTypeSchema = z.enum([
  'TEXT', 'HEADING', 'GRID', 'CHECKBOX', 'CALLOUT',
  'QUOTE', 'DIVIDER', 'MOOD_TRACKER', 'PRIORITY_MATRIX', 'INDEX', 'MUSIC_STAFF',
  'CALENDAR', 'WEEKLY_VIEW', 'HABIT_TRACKER', 'GOAL_SECTION', 'TIME_BLOCK', 'DAILY_SECTION',
  'PROGRESS_BAR', 'RATING', 'WATER_TRACKER', 'SECTION_NAV', 'KANBAN',
]);

// Paper types - mirrors NotebookPage.paperType union
export const PaperTypeSchema = z.enum([
  'lined', 'grid', 'dotted', 'blank', 'music',
  'rows', 'isometric', 'hex', 'legal', 'crumpled',
]);

// Theme colors used across the application
export const ThemeColorSchema = z.enum([
  'rose', 'indigo', 'emerald', 'amber', 'slate', 'sky', 'gray', 'violet', 'pink',
]);

// GridCell - mirrors GridCell interface
export const GridCellSchema = z.object({
  id: z.string(),
  content: z.string(),
});

// GridData - mirrors Block.gridData inline type
export const GridDataSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.array(GridCellSchema)),
});

// MatrixData - mirrors Block.matrixData inline type
export const MatrixDataSchema = z.object({
  q1: z.string(),
  q2: z.string(),
  q3: z.string(),
  q4: z.string(),
});

// MusicNote - mirrors MusicNote interface
export const MusicNoteSchema = z.object({
  id: z.string(),
  pitch: z.enum(['C', 'D', 'E', 'F', 'G', 'A', 'B']),
  octave: z.number().min(3).max(5),
  duration: z.enum(['whole', 'half', 'quarter', 'eighth']),
  position: z.number().min(0).max(100),
  accidental: z.enum(['sharp', 'flat']).optional(),
});

// MusicStaffData - mirrors MusicStaffData interface
export const MusicStaffDataSchema = z.object({
  clef: z.enum(['treble', 'bass']),
  timeSignature: z.string(),
  notes: z.array(MusicNoteSchema),
});

// CalendarEvent - mirrors CalendarEvent interface
export const CalendarEventSchema = z.object({
  day: z.number().min(1).max(31),
  title: z.string(),
  color: z.string().optional(),
});

// CalendarData - mirrors CalendarData interface
export const CalendarDataSchema = z.object({
  month: z.number().min(1).max(12),
  year: z.number().min(2020).max(2100),
  highlights: z.array(z.number().min(1).max(31)).optional(),
  events: z.array(CalendarEventSchema).optional(),
});

// WeeklyViewTask - mirrors WeeklyViewTask interface
export const WeeklyViewTaskSchema = z.object({
  text: z.string(),
  checked: z.boolean(),
});

// WeeklyViewDay - mirrors WeeklyViewDay interface
export const WeeklyViewDaySchema = z.object({
  label: z.string(),
  content: z.string(),
  tasks: z.array(WeeklyViewTaskSchema).optional(),
});

// WeeklyViewData - mirrors WeeklyViewData interface
export const WeeklyViewDataSchema = z.object({
  startDate: z.string().optional(),
  days: z.array(WeeklyViewDaySchema),
});

// HabitTrackerData - mirrors HabitTrackerData interface
export const HabitTrackerDataSchema = z.object({
  habits: z.array(z.string()),
  days: z.number().min(1).max(31),
  checked: z.array(z.array(z.boolean())),
});

// GoalItem - mirrors GoalItem interface
export const GoalItemSchema = z.object({
  text: z.string(),
  subItems: z.array(z.object({ text: z.string(), checked: z.boolean() })),
  progress: z.number().min(0).max(100).optional(),
});

// GoalSectionData - mirrors GoalSectionData interface
export const GoalSectionDataSchema = z.object({
  goals: z.array(GoalItemSchema),
});

// TimeBlockEntry - mirrors TimeBlockEntry interface
export const TimeBlockEntrySchema = z.object({
  time: z.string(),
  content: z.string(),
  color: z.string().optional(),
});

// TimeBlockData - mirrors TimeBlockData interface
export const TimeBlockDataSchema = z.object({
  startHour: z.number().min(0).max(23),
  endHour: z.number().min(0).max(23),
  interval: z.union([z.literal(30), z.literal(60)]),
  entries: z.array(TimeBlockEntrySchema),
});

// DailySectionEntry - mirrors DailySectionEntry interface
export const DailySectionEntrySchema = z.object({
  label: z.string(),
  content: z.string(),
});

// DailySectionData - mirrors DailySectionData interface
export const DailySectionDataSchema = z.object({
  date: z.string().optional(),
  dayLabel: z.string().optional(),
  sections: z.array(DailySectionEntrySchema),
});

// ProgressBarData
export const ProgressBarDataSchema = z.object({
  label: z.string(),
  current: z.number().min(0).max(100),
  target: z.string(),
  color: z.string(),
});

// RatingData
export const RatingDataSchema = z.object({
  label: z.string(),
  max: z.union([z.literal(5), z.literal(10)]),
  value: z.number().min(0),
  style: z.enum(['star', 'circle', 'heart']),
});

// WaterTrackerData
export const WaterTrackerDataSchema = z.object({
  goal: z.number().min(1).max(20).default(8),
  filled: z.number().min(0),
});

// SectionNavData
export const SectionNavDataSchema = z.object({
  sections: z.array(z.object({
    label: z.string(),
    icon: z.string().optional(),
    pageIndex: z.number().optional(),
  })),
});

// KanbanData
export const KanbanCardSchema = z.object({
  id: z.string(),
  text: z.string(),
  checked: z.boolean().optional(),
});

export const KanbanColumnSchema = z.object({
  title: z.string(),
  color: z.string(),
  cards: z.array(KanbanCardSchema),
});

export const KanbanDataSchema = z.object({
  columns: z.array(KanbanColumnSchema),
});

// Block - mirrors Block interface
export const BlockSchema = z.object({
  id: z.string(),
  type: BlockTypeSchema,
  content: z.string(),
  gridData: GridDataSchema.optional(),
  checked: z.boolean().optional(),
  alignment: z.enum(['left', 'center', 'right']).optional(),
  emphasis: z.enum(['bold', 'italic', 'highlight', 'none']).optional(),
  color: z.string().optional(),
  side: z.enum(['left', 'right']).optional(),
  moodValue: z.number().min(0).max(4).optional(),
  matrixData: MatrixDataSchema.optional(),
  musicData: MusicStaffDataSchema.optional(),
  calendarData: CalendarDataSchema.optional(),
  weeklyViewData: WeeklyViewDataSchema.optional(),
  habitTrackerData: HabitTrackerDataSchema.optional(),
  goalSectionData: GoalSectionDataSchema.optional(),
  timeBlockData: TimeBlockDataSchema.optional(),
  dailySectionData: DailySectionDataSchema.optional(),
  progressBarData: ProgressBarDataSchema.optional(),
  ratingData: RatingDataSchema.optional(),
  waterTrackerData: WaterTrackerDataSchema.optional(),
  sectionNavData: SectionNavDataSchema.optional(),
  kanbanData: KanbanDataSchema.optional(),
  containerStyle: z.enum(['card', 'banner', 'accent-left', 'none']).optional(),
  icon: z.string().optional(),
  groupId: z.string().optional(),
});

// NotebookPage - mirrors NotebookPage interface
export const NotebookPageSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.string(),
  paperType: PaperTypeSchema,
  blocks: z.array(BlockSchema),
  aesthetic: z.string().optional(),
  themeColor: z.string().optional(),
});

// Notebook - mirrors Notebook interface
export const NotebookSchema = z.object({
  id: z.string(),
  title: z.string(),
  coverColor: z.string(),
  createdAt: z.string(),
  pages: z.array(NotebookPageSchema),
  bookmarks: z.array(z.string()),
});

// AI Layout Generation Request - mirrors LayoutGenerationRequest with additional fields
export const LayoutGenerationRequestSchema = z.object({
  prompt: z.string().min(1).max(2000),
  industry: z.string().optional(),
  aesthetic: z.string().optional(),
});

// AI Layout Generation Response - validates AI output before rendering
export const AILayoutResponseSchema = z.object({
  title: z.string(),
  paperType: PaperTypeSchema,
  themeColor: ThemeColorSchema,
  blocks: z.array(z.object({
    type: BlockTypeSchema,
    content: z.string().default(''),
    alignment: z.enum(['left', 'center', 'right']).optional().default('left'),
    emphasis: z.enum(['bold', 'italic', 'highlight', 'none']).optional().default('none'),
    color: ThemeColorSchema.optional(),
    side: z.enum(['left', 'right']).optional().default('left'),
    gridData: z.object({
      columns: z.array(z.string()),
      rows: z.array(z.array(
        z.union([z.string(), z.object({ id: z.string(), content: z.string() })])
      )),
    }).optional().nullable(),
    moodValue: z.number().min(0).max(4).optional(),
    matrixData: MatrixDataSchema.optional(),
    checked: z.boolean().optional(),
    calendarData: CalendarDataSchema.optional().nullable(),
    weeklyViewData: WeeklyViewDataSchema.optional().nullable(),
    habitTrackerData: HabitTrackerDataSchema.optional().nullable(),
    goalSectionData: GoalSectionDataSchema.optional().nullable(),
    timeBlockData: TimeBlockDataSchema.optional().nullable(),
    dailySectionData: DailySectionDataSchema.optional().nullable(),
    progressBarData: ProgressBarDataSchema.optional().nullable(),
    ratingData: RatingDataSchema.optional().nullable(),
    waterTrackerData: WaterTrackerDataSchema.optional().nullable(),
    sectionNavData: SectionNavDataSchema.optional().nullable(),
    kanbanData: KanbanDataSchema.optional().nullable(),
    containerStyle: z.enum(['card', 'banner', 'accent-left', 'none']).optional().nullable(),
    icon: z.string().optional().nullable(),
    groupId: z.string().optional().nullable(),
  })),
});

// AI Single Page Schema (reusable in multi-page)
export const AIPageSchema = z.object({
  title: z.string(),
  paperType: PaperTypeSchema,
  themeColor: ThemeColorSchema,
  blocks: AILayoutResponseSchema.shape.blocks,
});

// AI Multi-Page Response - wraps multiple pages from a single prompt
export const AIMultiPageResponseSchema = z.object({
  pages: z.array(AIPageSchema).min(1),
});

// Combined validator: accepts either { pages: [...] } or { title, blocks, ... }
export function parseAIResponse(data: unknown): { pages: z.infer<typeof AIPageSchema>[] } {
  // Try multi-page first
  const multiResult = AIMultiPageResponseSchema.safeParse(data);
  if (multiResult.success) return multiResult.data;

  // Fall back to single-page
  const singleResult = AILayoutResponseSchema.safeParse(data);
  if (singleResult.success) return { pages: [singleResult.data] };

  // If neither works, throw with the single-page errors (more useful)
  throw singleResult.error;
}

// Inferred types from Zod schemas
export type BlockTypeZ = z.infer<typeof BlockTypeSchema>;
export type PaperTypeZ = z.infer<typeof PaperTypeSchema>;
export type ThemeColorZ = z.infer<typeof ThemeColorSchema>;
export type GridCellZ = z.infer<typeof GridCellSchema>;
export type GridDataZ = z.infer<typeof GridDataSchema>;
export type MatrixDataZ = z.infer<typeof MatrixDataSchema>;
export type MusicNoteZ = z.infer<typeof MusicNoteSchema>;
export type MusicStaffDataZ = z.infer<typeof MusicStaffDataSchema>;
export type BlockZ = z.infer<typeof BlockSchema>;
export type NotebookPageZ = z.infer<typeof NotebookPageSchema>;
export type NotebookZ = z.infer<typeof NotebookSchema>;
export type LayoutGenerationRequestZ = z.infer<typeof LayoutGenerationRequestSchema>;
export type AILayoutResponseZ = z.infer<typeof AILayoutResponseSchema>;
export type CalendarEventZ = z.infer<typeof CalendarEventSchema>;
export type CalendarDataZ = z.infer<typeof CalendarDataSchema>;
export type WeeklyViewDayZ = z.infer<typeof WeeklyViewDaySchema>;
export type WeeklyViewDataZ = z.infer<typeof WeeklyViewDataSchema>;
export type HabitTrackerDataZ = z.infer<typeof HabitTrackerDataSchema>;
export type GoalItemZ = z.infer<typeof GoalItemSchema>;
export type GoalSectionDataZ = z.infer<typeof GoalSectionDataSchema>;
export type TimeBlockEntryZ = z.infer<typeof TimeBlockEntrySchema>;
export type TimeBlockDataZ = z.infer<typeof TimeBlockDataSchema>;
export type DailySectionEntryZ = z.infer<typeof DailySectionEntrySchema>;
export type DailySectionDataZ = z.infer<typeof DailySectionDataSchema>;
export type AIPageZ = z.infer<typeof AIPageSchema>;
export type AIMultiPageResponseZ = z.infer<typeof AIMultiPageResponseSchema>;
export type ProgressBarDataZ = z.infer<typeof ProgressBarDataSchema>;
export type RatingDataZ = z.infer<typeof RatingDataSchema>;
export type WaterTrackerDataZ = z.infer<typeof WaterTrackerDataSchema>;
export type SectionNavDataZ = z.infer<typeof SectionNavDataSchema>;
export type KanbanCardZ = z.infer<typeof KanbanCardSchema>;
export type KanbanColumnZ = z.infer<typeof KanbanColumnSchema>;
export type KanbanDataZ = z.infer<typeof KanbanDataSchema>;
