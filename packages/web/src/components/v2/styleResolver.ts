// =============================================================================
// styleResolver.ts — Converts v2 ElementStyle + StyleTheme to React.CSSProperties
//
// Handles theme token resolution ($primary, $border, etc.), spacing array
// conversion, layout direction mapping, and container defaults.
// =============================================================================

import { createContext, useContext } from 'react';
import type { CSSProperties } from 'react';
import type { ElementStyle, StyleTheme, ThemeToken } from '@papergrid/core/types-v2';

// ---------------------------------------------------------------------------
// DEFAULT_THEME — sensible neutral palette used when no theme is provided
// ---------------------------------------------------------------------------

export const DEFAULT_THEME: StyleTheme = {
  name: 'Default',
  colors: {
    primary: '#4f46e5',
    secondary: '#7c3aed',
    background: '#ffffff',
    surface: '#f9fafb',
    text: '#111827',
    textMuted: '#6b7280',
    border: '#e5e7eb',
    highlight: '#eef2ff',
  },
  fonts: {
    heading: 'Inter',
    body: 'Inter',
  },
  spacing: {
    unit: 32,
    lineHeight: 1.5,
    blockGap: 8,
    pagePadding: 24,
  },
  paper: {
    type: 'lined',
    color: '#fffef5',
    lineColor: '#e5e7eb',
  },
};

// ---------------------------------------------------------------------------
// THEME_TOKENS — maps "$token" strings to keys in StyleTheme.colors
// ---------------------------------------------------------------------------

export const THEME_TOKENS: Record<ThemeToken, keyof StyleTheme['colors']> = {
  $primary: 'primary',
  $secondary: 'secondary',
  $background: 'background',
  $surface: 'surface',
  $text: 'text',
  $textMuted: 'textMuted',
  $border: 'border',
  $highlight: 'highlight',
};

// ---------------------------------------------------------------------------
// resolveToken — resolves a "$token" string against theme.colors, or returns
//                the raw value if it is not a token reference.
// ---------------------------------------------------------------------------

export function resolveToken(value: string, theme: StyleTheme): string {
  if (value.startsWith('$')) {
    const colorKey = THEME_TOKENS[value as ThemeToken];
    if (colorKey !== undefined) {
      return theme.colors[colorKey];
    }
  }
  return value;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Converts a padding/margin value (number or number[]) to a CSS string.
 *
 * - Single number: "8px"
 * - [top, right]: "8px 16px"
 * - [top, right, bottom]: "8px 16px 24px"
 * - [top, right, bottom, left]: "8px 16px 24px 32px"
 */
function spacingToCss(value: number | number[]): string {
  if (typeof value === 'number') {
    return `${value}px`;
  }
  return value.map((v) => `${v}px`).join(' ');
}

/**
 * Converts a numeric or string dimension to a CSS-safe string.
 * Numbers get "px" appended; strings pass through as-is (e.g. "100%", "auto").
 */
function dimensionToCss(value: string | number): string {
  if (typeof value === 'number') {
    return `${value}px`;
  }
  return value;
}

// ---------------------------------------------------------------------------
// resolveStyle — converts ElementStyle to React.CSSProperties
// ---------------------------------------------------------------------------

export function resolveStyle(
  style: ElementStyle | undefined,
  theme: StyleTheme,
): CSSProperties {
  if (style === undefined) {
    return {};
  }

  const css: CSSProperties = {};

  // --- Color properties (token-resolved) ---
  if (style.color !== undefined) {
    css.color = resolveToken(style.color, theme);
  }
  if (style.backgroundColor !== undefined) {
    css.backgroundColor = resolveToken(style.backgroundColor, theme);
  }
  if (style.borderColor !== undefined) {
    css.borderColor = resolveToken(style.borderColor, theme);
  }

  // --- Typography ---
  if (style.fontFamily !== undefined) {
    css.fontFamily = style.fontFamily;
  }
  if (style.fontSize !== undefined) {
    css.fontSize = `${style.fontSize}px`;
  }
  if (style.fontWeight !== undefined) {
    css.fontWeight = style.fontWeight;
  }
  if (style.fontStyle !== undefined) {
    css.fontStyle = style.fontStyle;
  }
  if (style.textAlign !== undefined) {
    css.textAlign = style.textAlign;
  }
  if (style.textDecoration !== undefined) {
    css.textDecoration = style.textDecoration;
  }
  if (style.textTransform !== undefined) {
    css.textTransform = style.textTransform;
  }
  if (style.letterSpacing !== undefined) {
    css.letterSpacing = `${style.letterSpacing}px`;
  }
  if (style.lineHeight !== undefined) {
    css.lineHeight = style.lineHeight;
  }

  // --- Spacing (arrays -> CSS shorthand) ---
  if (style.padding !== undefined) {
    css.padding = spacingToCss(style.padding);
  }
  if (style.margin !== undefined) {
    css.margin = spacingToCss(style.margin);
  }
  if (style.gap !== undefined) {
    css.gap = `${style.gap}px`;
  }

  // --- Border ---
  if (style.borderWidth !== undefined) {
    css.borderWidth = `${style.borderWidth}px`;
  }
  if (style.borderRadius !== undefined) {
    css.borderRadius = `${style.borderRadius}px`;
  }
  if (style.borderStyle !== undefined) {
    css.borderStyle = style.borderStyle;
  }

  // --- Shadow & opacity ---
  if (style.shadow !== undefined) {
    css.boxShadow = style.shadow;
  }
  if (style.opacity !== undefined) {
    css.opacity = style.opacity;
  }

  // --- Dimensions ---
  if (style.width !== undefined) {
    css.width = dimensionToCss(style.width);
  }
  if (style.height !== undefined) {
    css.height = dimensionToCss(style.height);
  }
  if (style.minHeight !== undefined) {
    css.minHeight = dimensionToCss(style.minHeight);
  }

  // --- Layout / direction ---
  if (style.direction !== undefined) {
    if (style.direction === 'grid') {
      css.display = 'grid';
      if (style.columns !== undefined) {
        css.gridTemplateColumns = `repeat(${style.columns}, 1fr)`;
      }
    } else {
      css.display = 'flex';
      css.flexDirection = style.direction === 'horizontal' ? 'row' : 'column';
    }
  }

  // --- Flex/grid alignment ---
  if (style.alignItems !== undefined) {
    css.alignItems = style.alignItems === 'start'
      ? 'flex-start'
      : style.alignItems === 'end'
        ? 'flex-end'
        : style.alignItems;
  }
  if (style.justifyContent !== undefined) {
    css.justifyContent = style.justifyContent === 'start'
      ? 'flex-start'
      : style.justifyContent === 'end'
        ? 'flex-end'
        : style.justifyContent;
  }
  if (style.flex !== undefined) {
    css.flex = style.flex;
  }

  // --- Grid columns (when direction is not explicitly grid but columns is set) ---
  if (style.columns !== undefined && style.direction !== 'grid') {
    // If columns is specified without grid direction, still apply grid
    css.display = 'grid';
    css.gridTemplateColumns = `repeat(${style.columns}, 1fr)`;
  }

  return css;
}

// ---------------------------------------------------------------------------
// resolveContainerStyle — like resolveStyle but guarantees a display mode.
//
// Always sets display: flex (column) or display: grid depending on the
// element's direction property. Defaults to flex-direction: column when
// no direction is specified.
// ---------------------------------------------------------------------------

export function resolveContainerStyle(
  style: ElementStyle | undefined,
  theme: StyleTheme,
): CSSProperties {
  const css = resolveStyle(style, theme);

  // If resolveStyle already set display (from direction or columns), keep it.
  if (css.display !== undefined) {
    return css;
  }

  // Default container: vertical flex layout.
  css.display = 'flex';
  css.flexDirection = 'column';

  return css;
}

// ---------------------------------------------------------------------------
// ThemeContext — React context for the current StyleTheme
// ---------------------------------------------------------------------------

export const ThemeContext = createContext<StyleTheme>(DEFAULT_THEME);

/**
 * useTheme — returns the current StyleTheme from context.
 * Falls back to DEFAULT_THEME when no provider is present.
 */
export function useTheme(): StyleTheme {
  return useContext(ThemeContext);
}
