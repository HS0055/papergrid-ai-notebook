// =============================================================================
// PaperGrid v1 -> v2 Migration — Pure render-time conversion functions
//
// Converts legacy Block/NotebookPage types to v2 Element/PageLayout types
// without mutating source data. No persistent data migration required.
// =============================================================================

import type { Block, BlockType, NotebookPage } from './types';
import type {
  Element,
  ElementStyle,
  PageLayout,
  StyleTheme,
  TableColumn,
  TableCell,
} from './types-v2';

// ---------------------------------------------------------------------------
// Color mapping helpers
// ---------------------------------------------------------------------------

const LEGACY_COLOR_HEX: Record<string, string> = {
  rose: '#e11d48',
  indigo: '#4f46e5',
  emerald: '#059669',
  amber: '#d97706',
  sky: '#0284c7',
  slate: '#475569',
  gray: '#6b7280',
};

const LEGACY_COLOR_BACKGROUND: Record<string, string> = {
  rose: '#fff1f2',
  indigo: '#eef2ff',
  emerald: '#ecfdf5',
  amber: '#fffbeb',
  sky: '#e0f2fe',
  slate: '#f1f5f9',
  gray: '#f3f4f6',
};

/** Maps a legacy color name (e.g. 'rose', 'indigo') to its hex foreground value. */
export function legacyColorToHex(color?: string): string {
  if (!color) return '#6b7280';
  return LEGACY_COLOR_HEX[color] ?? '#6b7280';
}

/** Maps a legacy color name to a light background tint. */
export function legacyColorToBackground(color?: string): string {
  if (!color) return '#f3f4f6';
  return LEGACY_COLOR_BACKGROUND[color] ?? '#f3f4f6';
}

// ---------------------------------------------------------------------------
// ID generation helper
// ---------------------------------------------------------------------------

let _idCounter = 0;

function generateId(prefix: string): string {
  _idCounter += 1;
  return `${prefix}-${Date.now()}-${_idCounter}`;
}

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

function buildBaseTextStyle(block: Block): ElementStyle {
  const style: ElementStyle = {};

  if (block.color) {
    style.color = legacyColorToHex(block.color);
  }

  if (block.alignment) {
    style.textAlign = block.alignment;
  }

  if (block.emphasis) {
    switch (block.emphasis) {
      case 'bold':
        style.fontWeight = 'bold';
        break;
      case 'italic':
        style.fontStyle = 'italic';
        break;
      case 'highlight':
        style.backgroundColor = legacyColorToBackground(block.color);
        break;
      case 'none':
        break;
    }
  }

  return style;
}

// ---------------------------------------------------------------------------
// Individual block type converters
// ---------------------------------------------------------------------------

function convertText(block: Block): Element {
  return {
    id: block.id,
    kind: 'text',
    content: block.content,
    style: buildBaseTextStyle(block),
  };
}

function convertHeading(block: Block): Element {
  const style = buildBaseTextStyle(block);
  style.fontSize = 28;
  style.fontWeight = 'bold';

  return {
    id: block.id,
    kind: 'text',
    content: block.content,
    style,
  };
}

function convertQuote(block: Block): Element {
  const style = buildBaseTextStyle(block);
  style.fontStyle = 'italic';
  style.borderStyle = 'solid';
  style.borderColor = legacyColorToHex(block.color);
  // Left-only border: width 3, with left padding for visual offset
  style.borderWidth = 3;
  style.padding = [8, 8, 8, 16];

  return {
    id: block.id,
    kind: 'text',
    content: block.content,
    style,
  };
}

function convertCallout(block: Block): Element {
  const childElement: Element = {
    id: generateId('callout-text'),
    kind: 'text',
    content: block.content,
    style: {
      color: legacyColorToHex(block.color),
    },
  };

  return {
    id: block.id,
    kind: 'container',
    style: {
      backgroundColor: legacyColorToBackground(block.color),
      borderRadius: 8,
      padding: 12,
    },
    children: [childElement],
  };
}

function convertCheckbox(block: Block): Element {
  return {
    id: block.id,
    kind: 'checkbox',
    content: block.content,
    checked: block.checked ?? false,
    style: buildBaseTextStyle(block),
  };
}

function convertGrid(block: Block): Element {
  const columns: TableColumn[] = (block.gridData?.columns ?? []).map(
    (header, index) => ({
      id: generateId(`col-${index}`),
      header,
    })
  );

  const rows: TableCell[][] = (block.gridData?.rows ?? []).map((row) =>
    row.map((cell) => ({
      id: cell.id,
      content: cell.content,
    }))
  );

  return {
    id: block.id,
    kind: 'table',
    tableData: { columns, rows },
    style: buildBaseTextStyle(block),
  };
}

function convertDivider(block: Block): Element {
  const style: ElementStyle = {};

  if (block.emphasis) {
    switch (block.emphasis) {
      case 'bold':
        style.borderWidth = 4;
        style.borderStyle = 'solid';
        break;
      case 'italic':
        style.borderStyle = 'dashed';
        style.borderWidth = 1;
        break;
      case 'highlight':
        style.borderStyle = 'double';
        style.borderWidth = 3;
        break;
      case 'none':
      default:
        style.borderStyle = 'solid';
        style.borderWidth = 1;
        break;
    }
  } else {
    style.borderStyle = 'solid';
    style.borderWidth = 1;
  }

  if (block.color) {
    style.borderColor = legacyColorToHex(block.color);
  }

  return {
    id: block.id,
    kind: 'divider',
    style,
  };
}

function convertMoodTracker(block: Block): Element {
  return {
    id: block.id,
    kind: 'widget',
    widgetConfig: {
      widgetType: 'mood-tracker',
      props: {
        value: block.moodValue ?? 0,
        label: block.content,
      },
    },
  };
}

function convertPriorityMatrix(block: Block): Element {
  return {
    id: block.id,
    kind: 'widget',
    widgetConfig: {
      widgetType: 'priority-matrix',
      props: {
        q1: block.matrixData?.q1 ?? '',
        q2: block.matrixData?.q2 ?? '',
        q3: block.matrixData?.q3 ?? '',
        q4: block.matrixData?.q4 ?? '',
      },
    },
  };
}

function convertHabitTracker(block: Block): Element {
  return {
    id: block.id,
    kind: 'widget',
    widgetConfig: {
      widgetType: 'habit-tracker',
      props: (block.habitTrackerData ?? { habits: [], days: 7, checked: [] }) as any,
    },
  };
}

function convertCalendar(block: Block): Element {
  return {
    id: block.id,
    kind: 'widget',
    widgetConfig: {
      widgetType: 'calendar',
      props: (block.calendarData ?? { month: 1, year: 2026 }) as any,
    },
  };
}

function convertWeeklyView(block: Block): Element {
  return {
    id: block.id,
    kind: 'widget',
    widgetConfig: {
      widgetType: 'weekly-view',
      props: (block.weeklyViewData ?? { days: [] }) as any,
    },
  };
}

function convertGoalSection(block: Block): Element {
  return {
    id: block.id,
    kind: 'widget',
    widgetConfig: {
      widgetType: 'goal-section',
      props: (block.goalSectionData ?? { goals: [] }) as any,
    },
  };
}

function convertTimeBlock(block: Block): Element {
  return {
    id: block.id,
    kind: 'widget',
    widgetConfig: {
      widgetType: 'time-block',
      props: (block.timeBlockData ?? {
        startHour: 8,
        endHour: 17,
        interval: 60,
        entries: [],
      }) as any,
    },
  };
}

function convertDailySection(block: Block): Element {
  return {
    id: block.id,
    kind: 'widget',
    widgetConfig: {
      widgetType: 'daily-section',
      props: (block.dailySectionData ?? { sections: [] }) as any,
    },
  };
}

function convertIndex(_block: Block): Element {
  return {
    id: _block.id,
    kind: 'widget',
    widgetConfig: {
      widgetType: 'index',
      props: {},
    },
  };
}

function convertMusicStaff(block: Block): Element {
  return {
    id: block.id,
    kind: 'widget',
    widgetConfig: {
      widgetType: 'music-staff',
      props: (block.musicData ?? {
        clef: 'treble',
        timeSignature: '4/4',
        notes: [],
      }) as any,
    },
  };
}

// ---------------------------------------------------------------------------
// Converter dispatch map
// ---------------------------------------------------------------------------

type BlockConverter = (block: Block) => Element;

const BLOCK_CONVERTERS: Record<string, BlockConverter> = {
  TEXT: convertText,
  HEADING: convertHeading,
  QUOTE: convertQuote,
  CALLOUT: convertCallout,
  CHECKBOX: convertCheckbox,
  GRID: convertGrid,
  DIVIDER: convertDivider,
  MOOD_TRACKER: convertMoodTracker,
  PRIORITY_MATRIX: convertPriorityMatrix,
  HABIT_TRACKER: convertHabitTracker,
  CALENDAR: convertCalendar,
  WEEKLY_VIEW: convertWeeklyView,
  GOAL_SECTION: convertGoalSection,
  TIME_BLOCK: convertTimeBlock,
  DAILY_SECTION: convertDailySection,
  INDEX: convertIndex,
  MUSIC_STAFF: convertMusicStaff,
};

// ---------------------------------------------------------------------------
// blockToElement — primary block conversion function
// ---------------------------------------------------------------------------

/**
 * Converts a single legacy v1 Block to a v2 Element.
 *
 * Pure function: does not mutate the source block. Falls back to a plain
 * text element for any unrecognized block type.
 */
export function blockToElement(block: Block): Element {
  const converter = BLOCK_CONVERTERS[block.type as string];

  if (converter) {
    return converter(block);
  }

  // Fallback: render unknown block types as text
  return {
    id: block.id,
    kind: 'text',
    content: block.content,
    style: buildBaseTextStyle(block),
  };
}

// ---------------------------------------------------------------------------
// legacyAestheticToTheme — aesthetic string to full StyleTheme
// ---------------------------------------------------------------------------

/**
 * Maps a legacy aesthetic name and optional 7-color enum to a full v2 StyleTheme.
 *
 * Recognized aesthetics: 'modern-planner', 'e-ink', 'bujo', 'cornell',
 * 'pastel', 'adhd-rainbow'. Unknown or absent values produce a neutral theme
 * tinted by the provided themeColor.
 */
export function legacyAestheticToTheme(
  aesthetic?: string,
  themeColor?: string
): StyleTheme {
  const primary = legacyColorToHex(themeColor);

  switch (aesthetic) {
    case 'modern-planner':
      return {
        name: 'Modern Planner',
        colors: {
          primary: '#1e293b',
          secondary: '#3b82f6',
          background: '#ffffff',
          surface: '#f8fafc',
          text: '#0f172a',
          textMuted: '#64748b',
          border: '#e2e8f0',
          highlight: '#dbeafe',
        },
        fonts: {
          heading: 'Inter',
          body: 'Inter',
        },
        spacing: {
          unit: 4,
          lineHeight: 1.5,
          blockGap: 12,
          pagePadding: 24,
        },
        paper: {
          type: 'grid',
          color: '#ffffff',
          lineColor: '#e2e8f0',
          lineSpacing: 20,
        },
        decorations: {
          borderRadius: 2,
          shadowStrength: 'subtle',
          dividerStyle: 'solid',
        },
      };

    case 'e-ink':
      return {
        name: 'E-Ink',
        colors: {
          primary: '#374151',
          secondary: '#6b7280',
          background: '#f9fafb',
          surface: '#f3f4f6',
          text: '#1f2937',
          textMuted: '#9ca3af',
          border: '#d1d5db',
          highlight: '#e5e7eb',
        },
        fonts: {
          heading: 'Georgia',
          body: 'Georgia',
          accent: 'Georgia',
        },
        spacing: {
          unit: 6,
          lineHeight: 1.8,
          blockGap: 20,
          pagePadding: 32,
        },
        paper: {
          type: 'lined',
          color: '#f9fafb',
          lineColor: '#d1d5db',
          lineSpacing: 28,
        },
        decorations: {
          borderRadius: 0,
          shadowStrength: 'none',
          dividerStyle: 'solid',
        },
      };

    case 'bujo':
      return {
        name: 'Bullet Journal',
        colors: {
          primary: '#78350f',
          secondary: '#a16207',
          background: '#fefce8',
          surface: '#fef9c3',
          text: '#422006',
          textMuted: '#92400e',
          border: '#d97706',
          highlight: '#fde68a',
        },
        fonts: {
          heading: 'Caveat',
          body: 'Caveat',
          accent: 'Caveat',
        },
        spacing: {
          unit: 5,
          lineHeight: 1.6,
          blockGap: 16,
          pagePadding: 20,
        },
        paper: {
          type: 'dotted',
          color: '#fefce8',
          lineColor: '#d4d4d8',
          lineSpacing: 20,
        },
        decorations: {
          borderRadius: 4,
          shadowStrength: 'none',
          dividerStyle: 'dashed',
        },
      };

    case 'cornell':
      return {
        name: 'Cornell Notes',
        colors: {
          primary: '#1e3a5f',
          secondary: '#b91c1c',
          background: '#ffffff',
          surface: '#fef2f2',
          text: '#1e293b',
          textMuted: '#64748b',
          border: '#b91c1c',
          highlight: '#fecaca',
        },
        fonts: {
          heading: 'Georgia',
          body: 'Georgia',
          accent: 'Georgia',
        },
        spacing: {
          unit: 4,
          lineHeight: 1.6,
          blockGap: 14,
          pagePadding: 28,
        },
        paper: {
          type: 'grid',
          color: '#ffffff',
          lineColor: '#cbd5e1',
          lineSpacing: 22,
        },
        decorations: {
          borderRadius: 0,
          shadowStrength: 'subtle',
          dividerStyle: 'solid',
        },
      };

    case 'pastel':
      return {
        name: 'Pastel',
        colors: {
          primary: '#8b5cf6',
          secondary: '#ec4899',
          background: '#fdf4ff',
          surface: '#fce7f3',
          text: '#4c1d95',
          textMuted: '#a78bfa',
          border: '#e9d5ff',
          highlight: '#f5d0fe',
        },
        fonts: {
          heading: 'Inter',
          body: 'Inter',
        },
        spacing: {
          unit: 5,
          lineHeight: 1.6,
          blockGap: 16,
          pagePadding: 24,
        },
        paper: {
          type: 'dotted',
          color: '#fdf4ff',
          lineColor: '#e9d5ff',
          lineSpacing: 22,
        },
        decorations: {
          borderRadius: 12,
          shadowStrength: 'subtle',
          dividerStyle: 'dashed',
        },
      };

    case 'adhd-rainbow':
      return {
        name: 'ADHD Rainbow',
        colors: {
          primary: '#dc2626',
          secondary: '#2563eb',
          background: '#fffbeb',
          surface: '#fef3c7',
          text: '#1c1917',
          textMuted: '#78716c',
          border: '#f59e0b',
          highlight: '#fde047',
        },
        fonts: {
          heading: 'Inter',
          body: 'Inter',
          accent: 'Caveat',
        },
        spacing: {
          unit: 6,
          lineHeight: 1.7,
          blockGap: 20,
          pagePadding: 24,
        },
        paper: {
          type: 'dotted',
          color: '#fffbeb',
          lineColor: '#fbbf24',
          lineSpacing: 24,
        },
        decorations: {
          borderRadius: 8,
          shadowStrength: 'medium',
          dividerStyle: 'dotted',
        },
      };

    default: {
      // Neutral theme, tinted by themeColor if provided
      return {
        name: themeColor ? `Custom (${themeColor})` : 'Default',
        colors: {
          primary,
          secondary: '#6b7280',
          background: '#ffffff',
          surface: '#f9fafb',
          text: '#111827',
          textMuted: '#6b7280',
          border: '#e5e7eb',
          highlight: legacyColorToBackground(themeColor),
        },
        fonts: {
          heading: 'Inter',
          body: 'Inter',
        },
        spacing: {
          unit: 4,
          lineHeight: 1.5,
          blockGap: 14,
          pagePadding: 24,
        },
        paper: {
          type: 'lined',
          color: '#ffffff',
          lineColor: '#e5e7eb',
          lineSpacing: 24,
        },
        decorations: {
          borderRadius: 4,
          shadowStrength: 'subtle',
          dividerStyle: 'solid',
        },
      };
    }
  }
}

// ---------------------------------------------------------------------------
// legacyPageToLayout — full page conversion
// ---------------------------------------------------------------------------

/**
 * Converts a legacy v1 NotebookPage to a v2 PageLayout.
 *
 * Blocks are split by their `side` property into left and right groups.
 * Blocks without a `side` default to left. The resulting layout is a single
 * root container with horizontal direction holding two vertical child
 * containers (left and right columns).
 *
 * Pure function: does not mutate the source page.
 */
export function legacyPageToLayout(page: NotebookPage): PageLayout {
  const leftBlocks: Block[] = [];
  const rightBlocks: Block[] = [];

  for (const block of page.blocks) {
    if (block.side === 'right') {
      rightBlocks.push(block);
    } else {
      leftBlocks.push(block);
    }
  }

  const leftContainer: Element = {
    id: generateId('left'),
    kind: 'container',
    style: {
      direction: 'vertical',
      flex: 1,
      gap: 14,
    },
    children: leftBlocks.map(blockToElement),
  };

  const rightContainer: Element = {
    id: generateId('right'),
    kind: 'container',
    style: {
      direction: 'vertical',
      flex: 1,
      gap: 14,
    },
    children: rightBlocks.map(blockToElement),
  };

  const rootContainer: Element = {
    id: generateId('root'),
    kind: 'container',
    style: {
      direction: 'horizontal',
      gap: 24,
    },
    children: [leftContainer, rightContainer],
  };

  return {
    id: page.id,
    title: page.title,
    createdAt: page.createdAt,
    version: 2,
    elements: [rootContainer],
    theme: legacyAestheticToTheme(page.aesthetic, page.themeColor),
    aiGenerated: page.aiGenerated,
  };
}
