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
  MUSIC_STAFF = 'MUSIC_STAFF'
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
  createdAt: string;
  pages: NotebookPage[];
  bookmarks: string[]; // Array of page IDs that are bookmarked
}

export interface LayoutGenerationRequest {
  prompt: string;
  industry?: string;
}