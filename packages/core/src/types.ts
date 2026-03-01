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
  INDEX = 'INDEX'
}

export interface GridCell {
  id: string;
  content: string;
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
}

export interface NotebookPage {
  id: string;
  title: string;
  createdAt: string;
  paperType: 'lined' | 'grid' | 'dotted' | 'blank' | 'music' | 'rows' | 'isometric' | 'hex' | 'legal' | 'crumpled';
  blocks: Block[];
  aesthetic?: string;
  themeColor?: string;
}

export interface Notebook {
  id: string;
  title: string;
  coverColor: string;
  createdAt: string;
  pages: NotebookPage[];
  bookmarks: string[]; // Array of page IDs that are bookmarked
}

export interface LayoutGenerationRequest {
  prompt: string;
  industry?: string;
}