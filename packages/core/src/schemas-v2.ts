import { z } from 'zod';
import type {
  Element,
  ElementKind,
  ElementStyle,
} from './types-v2';

// =============================================================================
// PaperGrid v2 Zod Schemas — Validation for the data-driven element system
//
// Mirrors every interface in types-v2.ts with runtime validation, sensible
// bounds, and auto-repair helpers for AI-generated output.
// =============================================================================

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Accepts a single number or a tuple of 1-4 numbers (CSS shorthand style). */
const PaddingMarginSchema = z.union([
  z.number().min(0).max(500),
  z
    .array(z.number().min(0).max(500))
    .min(1)
    .max(4),
]);

/** Dimension value: a number (px) or CSS string like "100%", "auto", "50vh". */
const DimensionSchema = z.union([
  z.number().min(0),
  z.string().min(1).max(100),
]);

// ---------------------------------------------------------------------------
// ElementKind
// ---------------------------------------------------------------------------

export const ELEMENT_KINDS: readonly ElementKind[] = [
  'container',
  'text',
  'input',
  'checkbox',
  'table',
  'divider',
  'image',
  'widget',
] as const;

export const ElementKindSchema = z.enum([
  'container',
  'text',
  'input',
  'checkbox',
  'table',
  'divider',
  'image',
  'widget',
]);

// ---------------------------------------------------------------------------
// ElementStyle
// ---------------------------------------------------------------------------

/**
 * The core ElementStyle object schema (non-optional).
 * Use this when you need to validate style objects directly.
 */
export const ElementStyleObjectSchema = z.object({
  // Colors — any string (hex, rgb, CSS named, $token references)
  color: z.string().max(200).optional(),
  backgroundColor: z.string().max(200).optional(),

  // Typography
  fontFamily: z.string().max(200).optional(),
  fontSize: z.number().min(1).max(200).optional(),
  fontWeight: z
    .union([
      z.number().min(100).max(900),
      z.string().max(50),
    ])
    .optional(),
  fontStyle: z.enum(['normal', 'italic']).optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  textDecoration: z.string().max(100).optional(),
  textTransform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).optional(),
  letterSpacing: z.number().min(-10).max(50).optional(),
  lineHeight: z.number().min(0.5).max(5).optional(),

  // Spacing
  padding: PaddingMarginSchema.optional(),
  margin: PaddingMarginSchema.optional(),
  gap: z.number().min(0).max(200).optional(),

  // Border
  borderWidth: z.number().min(0).max(50).optional(),
  borderRadius: z.number().min(0).max(500).optional(),
  borderStyle: z.enum(['solid', 'dashed', 'dotted', 'double', 'none']).optional(),
  borderColor: z.string().max(200).optional(),

  // Visual effects
  shadow: z.string().max(500).optional(),
  opacity: z.number().min(0).max(1).optional(),

  // Dimensions
  width: DimensionSchema.optional(),
  height: DimensionSchema.optional(),
  minHeight: DimensionSchema.optional(),

  // Container-specific layout
  direction: z.enum(['vertical', 'horizontal', 'grid']).optional(),
  columns: z.number().int().min(1).max(24).optional(),
  alignItems: z.enum(['start', 'center', 'end', 'stretch']).optional(),
  justifyContent: z
    .enum(['start', 'center', 'end', 'space-between', 'space-around'])
    .optional(),
  flex: z.union([z.string().max(50), z.number()]).optional(),
});

/**
 * Optional wrapper — use on Element.style and similar optional style fields.
 */
export const ElementStyleSchema = ElementStyleObjectSchema.optional();

// ---------------------------------------------------------------------------
// StyleTheme
// ---------------------------------------------------------------------------

export const StyleThemeSchema = z.object({
  name: z.string().min(1).max(200),
  colors: z.object({
    primary: z.string().min(1).max(200),
    secondary: z.string().min(1).max(200),
    background: z.string().min(1).max(200),
    surface: z.string().min(1).max(200),
    text: z.string().min(1).max(200),
    textMuted: z.string().min(1).max(200),
    border: z.string().min(1).max(200),
    highlight: z.string().min(1).max(200),
  }),
  fonts: z.object({
    heading: z.string().min(1).max(200),
    body: z.string().min(1).max(200),
    accent: z.string().max(200).optional(),
  }),
  spacing: z.object({
    unit: z.number().min(1).max(100),
    lineHeight: z.number().min(0.5).max(5),
    blockGap: z.number().min(0).max(200),
    pagePadding: z.number().min(0).max(200),
  }),
  paper: z.object({
    type: z.string().min(1).max(100),
    color: z.string().min(1).max(200),
    lineColor: z.string().max(200).optional(),
    lineSpacing: z.number().min(1).max(200).optional(),
  }),
  decorations: z
    .object({
      borderRadius: z.number().min(0).max(500).optional(),
      shadowStrength: z.enum(['none', 'subtle', 'medium', 'strong']).optional(),
      dividerStyle: z.enum(['solid', 'dashed', 'dotted', 'double']).optional(),
    })
    .optional(),
});

// ---------------------------------------------------------------------------
// Table structures
// ---------------------------------------------------------------------------

export const TableColumnSchema = z.object({
  id: z.string().min(1),
  header: z.string(),
  width: DimensionSchema.optional(),
});

export const TableCellSchema = z.object({
  id: z.string().min(1),
  content: z.string(),
});

export const TableDataSchema = z.object({
  columns: z.array(TableColumnSchema).min(1).max(50),
  rows: z.array(z.array(TableCellSchema)).max(500),
});

// ---------------------------------------------------------------------------
// InputConfig
// ---------------------------------------------------------------------------

export const InputConfigSchema = z.object({
  inputType: z.enum(['text', 'date', 'time', 'number']),
  placeholder: z.string().max(500).optional(),
  label: z.string().max(500).optional(),
  value: z.string().max(5000).optional(),
});

// ---------------------------------------------------------------------------
// ImageConfig
// ---------------------------------------------------------------------------

export const ImageConfigSchema = z.object({
  src: z.string().max(2000).optional(),
  storageId: z.string().max(500).optional(),
  alt: z.string().max(500).optional(),
  fit: z.enum(['cover', 'contain', 'fill']).optional(),
  aiPrompt: z.string().max(2000).optional(),
});

// ---------------------------------------------------------------------------
// WidgetConfig
// ---------------------------------------------------------------------------

export const WidgetConfigSchema = z.object({
  widgetType: z.string().min(1).max(200),
  props: z.record(z.string(), z.unknown()),
});

// ---------------------------------------------------------------------------
// Element — recursive schema using z.lazy()
// ---------------------------------------------------------------------------

/**
 * Recursive Element schema. Uses z.lazy() for the `children` field since
 * containers can nest arbitrary elements. The explicit ZodType<Element>
 * annotation ensures correct recursive type inference.
 */
export const ElementSchema: z.ZodType<Element> = z.lazy(() => {
  const schema = z.object({
    id: z.string().min(1),
    kind: ElementKindSchema,
    style: ElementStyleObjectSchema.optional(),
    label: z.string().max(1000).optional(),

    // Text content
    content: z.string().max(50_000).optional(),

    // Checkbox state
    checked: z.boolean().optional(),

    // Container children (recursive)
    children: z.array(ElementSchema).optional(),

    // Kind-specific data
    tableData: TableDataSchema.optional(),
    inputConfig: InputConfigSchema.optional(),
    imageConfig: ImageConfigSchema.optional(),
    widgetConfig: WidgetConfigSchema.optional(),
  });

  return schema as unknown as z.ZodType<Element>;
});

// ---------------------------------------------------------------------------
// CoverData
// ---------------------------------------------------------------------------

export const CoverDataSchema = z.object({
  type: z.enum(['solid', 'gradient', 'image', 'ai-generated']),
  color: z.string().max(200).optional(),
  gradient: z.string().max(500).optional(),
  imageUrl: z.string().max(2000).optional(),
  imageStorageId: z.string().max(500).optional(),
  material: z.enum(['leather', 'velvet', 'canvas', 'linen', 'kraft']).optional(),
  titleStyle: ElementStyleObjectSchema.partial().optional(),
  aiPrompt: z.string().max(2000).optional(),
});

// ---------------------------------------------------------------------------
// PageLayout
// ---------------------------------------------------------------------------

export const PageLayoutSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(500),
  createdAt: z.string().min(1),
  version: z.literal(2),

  // Content
  elements: z.array(ElementSchema),

  // Styling
  theme: StyleThemeSchema,

  // Cover
  cover: CoverDataSchema.optional(),

  // Metadata
  aiGenerated: z.boolean().optional(),
  aiPrompt: z.string().max(5000).optional(),
  tags: z.array(z.string().max(100)).max(50).optional(),
});

// ---------------------------------------------------------------------------
// AI Response Schemas — intentionally lenient for AI output tolerance
// ---------------------------------------------------------------------------

/**
 * Validates AI-generated layout responses.
 * More lenient than the full ElementSchema:
 * - id is optional (auto-generated if missing)
 * - kind defaults to 'text' if invalid
 * - style is passthrough (no strict validation on AI output)
 */
const AIElementSchema: z.ZodType<Record<string, unknown>> = z.lazy(() =>
  z
    .object({
      id: z.string().optional(),
      kind: z.string().min(1),
      style: z.record(z.string(), z.unknown()).optional(),
      label: z.string().optional(),
      content: z.string().optional(),
      checked: z.boolean().optional(),
      children: z.array(z.lazy(() => AIElementSchema)).optional(),
      tableData: z
        .object({
          columns: z.array(z.record(z.string(), z.unknown())),
          rows: z.array(z.array(z.record(z.string(), z.unknown()))),
        })
        .optional(),
      inputConfig: z.record(z.string(), z.unknown()).optional(),
      imageConfig: z.record(z.string(), z.unknown()).optional(),
      widgetConfig: z.record(z.string(), z.unknown()).optional(),
    })
    .passthrough(),
);

export const AILayoutV2ResponseSchema = z.object({
  title: z.string().min(1).max(1000),
  elements: z.array(AIElementSchema).min(1).max(200),
});

export const AIStyleResponseSchema = z.object({
  theme: z.object({
    name: z.string().min(1),
    colors: z.object({
      primary: z.string().min(1),
      secondary: z.string().min(1),
      background: z.string().min(1),
      surface: z.string().min(1),
      text: z.string().min(1),
      textMuted: z.string().min(1),
      border: z.string().min(1),
      highlight: z.string().min(1),
    }),
    fonts: z.object({
      heading: z.string().min(1),
      body: z.string().min(1),
      accent: z.string().optional(),
    }),
    spacing: z
      .object({
        unit: z.number().optional().default(8),
        lineHeight: z.number().optional().default(1.5),
        blockGap: z.number().optional().default(16),
        pagePadding: z.number().optional().default(24),
      })
      .optional()
      .default({}),
    paper: z
      .object({
        type: z.string().optional().default('blank'),
        color: z.string().optional().default('#ffffff'),
        lineColor: z.string().optional(),
        lineSpacing: z.number().optional(),
      })
      .optional()
      .default({}),
    decorations: z
      .object({
        borderRadius: z.number().optional(),
        shadowStrength: z.enum(['none', 'subtle', 'medium', 'strong']).optional(),
        dividerStyle: z.enum(['solid', 'dashed', 'dotted', 'double']).optional(),
      })
      .optional(),
  }),
});

// ---------------------------------------------------------------------------
// Inferred types from Zod schemas
// ---------------------------------------------------------------------------

export type ElementKindZ = z.infer<typeof ElementKindSchema>;
export type ElementStyleZ = z.infer<typeof ElementStyleObjectSchema>;
export type StyleThemeZ = z.infer<typeof StyleThemeSchema>;
export type TableColumnZ = z.infer<typeof TableColumnSchema>;
export type TableCellZ = z.infer<typeof TableCellSchema>;
export type TableDataZ = z.infer<typeof TableDataSchema>;
export type InputConfigZ = z.infer<typeof InputConfigSchema>;
export type ImageConfigZ = z.infer<typeof ImageConfigSchema>;
export type WidgetConfigZ = z.infer<typeof WidgetConfigSchema>;
export type ElementZ = z.infer<typeof ElementSchema>;
export type CoverDataZ = z.infer<typeof CoverDataSchema>;
export type PageLayoutZ = z.infer<typeof PageLayoutSchema>;
export type AILayoutV2ResponseZ = z.infer<typeof AILayoutV2ResponseSchema>;
export type AIStyleResponseZ = z.infer<typeof AIStyleResponseSchema>;

// =============================================================================
// Auto-Repair Helpers
//
// AI models often produce slightly malformed output. These helpers attempt to
// coerce raw data into valid Element structures before giving up and returning
// errors.
// =============================================================================

/**
 * Generates a UUID-like string. Uses crypto.randomUUID() when available,
 * falls back to a simple random hex string.
 */
function generateId(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  const hex = () =>
    Math.floor(Math.random() * 0x10000)
      .toString(16)
      .padStart(4, '0');
  return `${hex()}${hex()}-${hex()}-${hex()}-${hex()}-${hex()}${hex()}${hex()}`;
}

/**
 * Checks whether a string is a valid ElementKind.
 */
function isValidKind(value: unknown): value is ElementKind {
  return (
    typeof value === 'string' &&
    (ELEMENT_KINDS as readonly string[]).includes(value)
  );
}

/**
 * Repairs a single element by filling in missing/invalid fields.
 *
 * - Missing `id` is replaced with a random UUID.
 * - Invalid `kind` is defaulted to `'text'`.
 * - `children` are recursively repaired.
 * - Kind-specific data is preserved but not deeply validated (use Zod for that).
 */
export function repairElement(raw: unknown): Element {
  if (raw === null || raw === undefined || typeof raw !== 'object') {
    return {
      id: generateId(),
      kind: 'text',
      content: String(raw ?? ''),
    };
  }

  const obj = raw as Record<string, unknown>;

  // Ensure id
  const id =
    typeof obj.id === 'string' && obj.id.length > 0 ? obj.id : generateId();

  // Ensure valid kind
  const kind: ElementKind = isValidKind(obj.kind) ? obj.kind : 'text';

  // Build repaired element
  const element: Element = { id, kind };

  // Preserve style if present (as-is, the renderer will handle unknowns)
  if (obj.style && typeof obj.style === 'object') {
    element.style = obj.style as ElementStyle;
  }

  // Preserve label
  if (typeof obj.label === 'string') {
    element.label = obj.label;
  }

  // Preserve content
  if (typeof obj.content === 'string') {
    element.content = obj.content;
  } else if (obj.content !== undefined && obj.content !== null) {
    // Coerce non-string content to string
    element.content = String(obj.content);
  }

  // Preserve checked
  if (typeof obj.checked === 'boolean') {
    element.checked = obj.checked;
  }

  // Recursively repair children
  if (Array.isArray(obj.children)) {
    element.children = obj.children.map((child: unknown) => repairElement(child));
  }

  // Preserve tableData
  if (obj.tableData && typeof obj.tableData === 'object') {
    const td = obj.tableData as Record<string, unknown>;
    const columns = Array.isArray(td.columns)
      ? td.columns.map((col: unknown, i: number) => {
          if (col && typeof col === 'object') {
            const c = col as Record<string, unknown>;
            return {
              id: typeof c.id === 'string' ? c.id : generateId(),
              header: typeof c.header === 'string' ? c.header : `Column ${i + 1}`,
              ...(c.width !== undefined ? { width: c.width as string | number } : {}),
            };
          }
          return { id: generateId(), header: `Column ${i + 1}` };
        })
      : [];

    const rows = Array.isArray(td.rows)
      ? td.rows.map((row: unknown) => {
          if (!Array.isArray(row)) return [];
          return row.map((cell: unknown) => {
            if (cell && typeof cell === 'object') {
              const c = cell as Record<string, unknown>;
              return {
                id: typeof c.id === 'string' ? c.id : generateId(),
                content: typeof c.content === 'string' ? c.content : String(c.content ?? ''),
              };
            }
            return { id: generateId(), content: String(cell ?? '') };
          });
        })
      : [];

    element.tableData = { columns, rows };
  }

  // Preserve inputConfig
  if (obj.inputConfig && typeof obj.inputConfig === 'object') {
    const ic = obj.inputConfig as Record<string, unknown>;
    const validInputTypes = ['text', 'date', 'time', 'number'] as const;
    const inputType = validInputTypes.includes(ic.inputType as typeof validInputTypes[number])
      ? (ic.inputType as typeof validInputTypes[number])
      : 'text';
    element.inputConfig = {
      inputType,
      ...(typeof ic.placeholder === 'string' ? { placeholder: ic.placeholder } : {}),
      ...(typeof ic.label === 'string' ? { label: ic.label } : {}),
      ...(typeof ic.value === 'string' ? { value: ic.value } : {}),
    };
  }

  // Preserve imageConfig
  if (obj.imageConfig && typeof obj.imageConfig === 'object') {
    const imgc = obj.imageConfig as Record<string, unknown>;
    const validFits = ['cover', 'contain', 'fill'] as const;
    element.imageConfig = {
      ...(typeof imgc.src === 'string' ? { src: imgc.src } : {}),
      ...(typeof imgc.storageId === 'string' ? { storageId: imgc.storageId } : {}),
      ...(typeof imgc.alt === 'string' ? { alt: imgc.alt } : {}),
      ...(validFits.includes(imgc.fit as typeof validFits[number])
        ? { fit: imgc.fit as typeof validFits[number] }
        : {}),
      ...(typeof imgc.aiPrompt === 'string' ? { aiPrompt: imgc.aiPrompt } : {}),
    };
  }

  // Preserve widgetConfig
  if (obj.widgetConfig && typeof obj.widgetConfig === 'object') {
    const wc = obj.widgetConfig as Record<string, unknown>;
    element.widgetConfig = {
      widgetType: typeof wc.widgetType === 'string' ? wc.widgetType : 'unknown',
      props:
        wc.props && typeof wc.props === 'object' && !Array.isArray(wc.props)
          ? (wc.props as Record<string, unknown>)
          : {},
    };
  }

  return element;
}

/**
 * Repairs an array of elements. Non-array input is coerced to an empty array.
 */
export function repairElements(raw: unknown[]): Element[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((item) => repairElement(item));
}

/**
 * Validates AI-generated layout data using Zod, then falls back to auto-repair
 * if strict validation fails.
 *
 * Returns a discriminated result:
 * - `success: true` with parsed `data` (title + elements)
 * - `success: false` with `errors` describing what went wrong
 *
 * The repair pipeline:
 * 1. Try strict parse with `ElementSchema` for each element.
 * 2. If that fails, run `repairElement` on each raw element.
 * 3. Re-validate the repaired elements.
 * 4. If still invalid, return collected error messages.
 */
export function validateAndRepairLayout(
  data: unknown,
): {
  success: boolean;
  data?: { title: string; elements: Element[] };
  errors?: string[];
} {
  // Step 0: Basic shape check
  if (data === null || data === undefined || typeof data !== 'object') {
    return {
      success: false,
      errors: ['Input must be a non-null object.'],
    };
  }

  const raw = data as Record<string, unknown>;

  // Extract title
  const title =
    typeof raw.title === 'string' && raw.title.length > 0
      ? raw.title
      : 'Untitled';

  // Extract elements array
  const rawElements = Array.isArray(raw.elements) ? raw.elements : [];

  if (rawElements.length === 0) {
    return {
      success: false,
      errors: ['Layout must contain at least one element.'],
    };
  }

  // Step 1: Try strict Zod validation on the entire response
  const strictResult = AILayoutV2ResponseSchema.safeParse(data);
  if (strictResult.success) {
    // Even though AILayoutV2ResponseSchema is lenient, try to parse each
    // element with the strict ElementSchema
    const strictElements: Element[] = [];
    let allStrict = true;

    for (const rawEl of rawElements) {
      const elResult = ElementSchema.safeParse(rawEl);
      if (elResult.success) {
        strictElements.push(elResult.data);
      } else {
        allStrict = false;
        break;
      }
    }

    if (allStrict) {
      return {
        success: true,
        data: { title, elements: strictElements },
      };
    }
  }

  // Step 2: Repair each element
  const repairedElements = repairElements(rawElements);

  // Step 3: Validate repaired elements
  const errors: string[] = [];
  const validElements: Element[] = [];

  for (let i = 0; i < repairedElements.length; i++) {
    const result = ElementSchema.safeParse(repairedElements[i]);
    if (result.success) {
      validElements.push(result.data);
    } else {
      // Collect errors but still include the repaired element
      // since it has the required shape even if some nested values are off
      const issues = result.error.issues.map(
        (issue) =>
          `Element[${i}] (kind: ${repairedElements[i].kind}): ${issue.path.join('.')} - ${issue.message}`,
      );
      errors.push(...issues);
      // Still include the repaired element since it has the minimum shape
      validElements.push(repairedElements[i]);
    }
  }

  if (validElements.length === 0) {
    return {
      success: false,
      errors: [
        'No elements could be recovered from the layout.',
        ...errors,
      ],
    };
  }

  // Return success with any warnings
  return {
    success: true,
    data: { title, elements: validElements },
    ...(errors.length > 0 ? { errors } : {}),
  };
}
