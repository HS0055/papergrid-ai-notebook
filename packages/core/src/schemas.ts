import { z } from 'zod';

// Block types enum - mirrors BlockType from types.ts
export const BlockTypeSchema = z.enum([
  'TEXT', 'HEADING', 'GRID', 'CHECKBOX', 'CALLOUT',
  'QUOTE', 'DIVIDER', 'MOOD_TRACKER', 'PRIORITY_MATRIX', 'INDEX',
]);

// Paper types - mirrors NotebookPage.paperType union
export const PaperTypeSchema = z.enum([
  'lined', 'grid', 'dotted', 'blank', 'music',
  'rows', 'isometric', 'hex', 'legal', 'crumpled',
]);

// Theme colors used across the application
export const ThemeColorSchema = z.enum([
  'rose', 'indigo', 'emerald', 'amber', 'slate', 'sky', 'gray',
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
      rows: z.array(z.array(z.string())),
    }).optional().nullable(),
    moodValue: z.number().min(0).max(4).optional(),
    matrixData: MatrixDataSchema.optional(),
    checked: z.boolean().optional(),
  })),
});

// Inferred types from Zod schemas
export type BlockTypeZ = z.infer<typeof BlockTypeSchema>;
export type PaperTypeZ = z.infer<typeof PaperTypeSchema>;
export type ThemeColorZ = z.infer<typeof ThemeColorSchema>;
export type GridCellZ = z.infer<typeof GridCellSchema>;
export type GridDataZ = z.infer<typeof GridDataSchema>;
export type MatrixDataZ = z.infer<typeof MatrixDataSchema>;
export type BlockZ = z.infer<typeof BlockSchema>;
export type NotebookPageZ = z.infer<typeof NotebookPageSchema>;
export type NotebookZ = z.infer<typeof NotebookSchema>;
export type LayoutGenerationRequestZ = z.infer<typeof LayoutGenerationRequestSchema>;
export type AILayoutResponseZ = z.infer<typeof AILayoutResponseSchema>;
