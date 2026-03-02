// =============================================================================
// PaperGrid v2 Type System — Data-Driven Elements
//
// Replaces the rigid BlockType enum + switch/case rendering with 8 composable
// primitives that the AI (or user) can style freely via inline properties.
// =============================================================================

// ---------------------------------------------------------------------------
// Element Kinds — the 8 universal primitives
// ---------------------------------------------------------------------------

export type ElementKind =
  | 'container'
  | 'text'
  | 'input'
  | 'checkbox'
  | 'table'
  | 'divider'
  | 'image'
  | 'widget';

// ---------------------------------------------------------------------------
// ElementStyle — inline visual properties the AI controls directly
// ---------------------------------------------------------------------------

export interface ElementStyle {
  color?: string;
  backgroundColor?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | string;
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right';
  textDecoration?: string;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  letterSpacing?: number;
  lineHeight?: number;
  padding?: number | number[];
  margin?: number | number[];
  gap?: number;
  borderWidth?: number;
  borderRadius?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'double' | 'none';
  borderColor?: string;
  shadow?: string;
  opacity?: number;
  width?: string | number;
  height?: string | number;
  minHeight?: string | number;

  // Container-specific layout
  direction?: 'vertical' | 'horizontal' | 'grid';
  columns?: number;
  alignItems?: 'start' | 'center' | 'end' | 'stretch';
  justifyContent?: 'start' | 'center' | 'end' | 'space-between' | 'space-around';
  flex?: string | number;
}

// ---------------------------------------------------------------------------
// StyleTheme — page-wide visual theme (full color freedom)
// ---------------------------------------------------------------------------

export interface StyleTheme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    border: string;
    highlight: string;
  };
  fonts: {
    heading: string;
    body: string;
    accent?: string;
  };
  spacing: {
    unit: number;
    lineHeight: number;
    blockGap: number;
    pagePadding: number;
  };
  paper: {
    type: string;
    color: string;
    lineColor?: string;
    lineSpacing?: number;
  };
  decorations?: {
    borderRadius?: number;
    shadowStrength?: 'none' | 'subtle' | 'medium' | 'strong';
    dividerStyle?: 'solid' | 'dashed' | 'dotted' | 'double';
  };
}

// ---------------------------------------------------------------------------
// Table data structures
// ---------------------------------------------------------------------------

export interface TableColumn {
  id: string;
  header: string;
  width?: string | number;
}

export interface TableCell {
  id: string;
  content: string;
}

export interface TableData {
  columns: TableColumn[];
  rows: TableCell[][];
}

// ---------------------------------------------------------------------------
// Input element configuration
// ---------------------------------------------------------------------------

export interface InputConfig {
  inputType: 'text' | 'date' | 'time' | 'number';
  placeholder?: string;
  label?: string;
  value?: string;
}

// ---------------------------------------------------------------------------
// Image element configuration
// ---------------------------------------------------------------------------

export interface ImageConfig {
  src?: string;
  storageId?: string;
  alt?: string;
  fit?: 'cover' | 'contain' | 'fill';
  aiPrompt?: string;
}

// ---------------------------------------------------------------------------
// Widget configuration
// ---------------------------------------------------------------------------

export interface WidgetConfig {
  widgetType: string;
  props: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Element — the universal building block
// ---------------------------------------------------------------------------

export interface Element {
  id: string;
  kind: ElementKind;
  style?: ElementStyle;
  label?: string;

  // Text content (for text, checkbox, divider labels)
  content?: string;

  // Checkbox state
  checked?: boolean;

  // Container children
  children?: Element[];

  // Table data
  tableData?: TableData;

  // Input configuration
  inputConfig?: InputConfig;

  // Image configuration
  imageConfig?: ImageConfig;

  // Widget configuration (mood-tracker, priority-matrix, habit-tracker, etc.)
  widgetConfig?: WidgetConfig;
}

// ---------------------------------------------------------------------------
// CoverData — AI-generated or manual cover configuration
// ---------------------------------------------------------------------------

export interface CoverData {
  type: 'solid' | 'gradient' | 'image' | 'ai-generated';
  color?: string;
  gradient?: string;
  imageUrl?: string;
  imageStorageId?: string;
  material?: 'leather' | 'velvet' | 'canvas' | 'linen' | 'kraft';
  titleStyle?: Partial<ElementStyle>;
  aiPrompt?: string;
}

// ---------------------------------------------------------------------------
// PageLayout — the v2 page format
// ---------------------------------------------------------------------------

export interface PageLayout {
  id: string;
  title: string;
  createdAt: string;
  version: 2;

  // Content
  elements: Element[];

  // Styling
  theme: StyleTheme;

  // Cover (optional — for notebook-level cover)
  cover?: CoverData;

  // Metadata
  aiGenerated?: boolean;
  aiPrompt?: string;
  tags?: string[];
}

// ---------------------------------------------------------------------------
// WidgetRegistryEntry — runtime widget registration
// ---------------------------------------------------------------------------

export interface WidgetRegistryEntry {
  type: string;
  displayName: string;
  icon?: string;
  defaultProps: Record<string, unknown>;
  defaultStyle?: ElementStyle;
}

// ---------------------------------------------------------------------------
// Token reference type — values like "$primary", "$border" resolved at render
// ---------------------------------------------------------------------------

export type ThemeToken =
  | '$primary'
  | '$secondary'
  | '$background'
  | '$surface'
  | '$text'
  | '$textMuted'
  | '$border'
  | '$highlight';

// ---------------------------------------------------------------------------
// AI Generation request/response types
// ---------------------------------------------------------------------------

export interface GenerateLayoutV2Request {
  prompt: string;
  stylePrompt?: string;
  industry?: string;
  referenceLayoutIds?: string[];
  referenceStyleIds?: string[];
}

export interface GenerateLayoutV2Response {
  title: string;
  elements: Element[];
}

export interface GenerateStyleResponse {
  theme: StyleTheme;
}

export interface GenerateCoverRequest {
  prompt: string;
  material?: CoverData['material'];
  palette?: string[];
}

export interface GenerateCoverResponse {
  cover: CoverData;
}
