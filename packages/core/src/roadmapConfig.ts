/**
 * Papera Roadmap Configuration -- Admin-Editable
 *
 * Single source of truth for what's live, in progress, and coming soon.
 * Edit this file (or via the admin panel later) to update the public roadmap
 * shown on the landing page.
 *
 * Honesty rules:
 * - "live" = the feature works in production NOW
 * - "in_progress" = active development, will ship within 4-6 weeks
 * - "coming_soon" = next on the roadmap, 1-3 months out
 * - "planned" = on the longer-term roadmap, no committed date
 *
 * Never mark something "live" unless a user can actually use it today.
 */

export type RoadmapStatus = 'live' | 'in_progress' | 'coming_soon' | 'planned';

export interface RoadmapItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /** Lucide icon name (e.g. 'Sparkles', 'Image', 'Users') */
  readonly icon: string;
  readonly status: RoadmapStatus;
  /** Optional target quarter, e.g. "Q2 2026" */
  readonly eta?: string;
  /** Show on landing page (false = internal only) */
  readonly publicVisible: boolean;
}

// ============================================================================
// CURRENT ROADMAP (edit me!)
// ============================================================================

export const ROADMAP: readonly RoadmapItem[] = [
  // ─── LIVE NOW ──────────────────────────────────────────────
  {
    id: 'ai-layouts',
    title: 'AI Layout Generation',
    description: 'Describe your need in plain language. AI generates a complete notebook spread instantly.',
    icon: 'Sparkles',
    status: 'live',
    publicVisible: true,
  },
  {
    id: 'ai-covers',
    title: 'AI Cover Designer',
    description: 'Generate beautiful book covers from a text prompt. Leather, watercolor, foil — your choice.',
    icon: 'Image',
    status: 'live',
    publicVisible: true,
  },
  {
    id: 'paper-textures',
    title: '10 Real Paper Textures',
    description: 'Lined, grid, dotted, music staff, legal pad, isometric, hex, and more — hand-crafted with CSS.',
    icon: 'FileText',
    status: 'live',
    publicVisible: true,
  },
  {
    id: 'sound-asmr',
    title: 'Writing Sounds (ASMR)',
    description: 'Pen scratches, page flips, and ambient sounds for an immersive writing experience.',
    icon: 'Volume2',
    status: 'live',
    publicVisible: true,
  },
  {
    id: 'block-types',
    title: '22+ Interactive Block Types',
    description: 'Kanban, habit tracker, mood tracker, time blocks, music notation, calendar, and more.',
    icon: 'LayoutGrid',
    status: 'live',
    publicVisible: true,
  },
  {
    id: 'cloud-sync',
    title: 'Cloud Sync',
    description: 'Your notebooks sync across devices in real time, powered by Convex.',
    icon: 'Cloud',
    status: 'live',
    publicVisible: true,
  },
  {
    id: 'pdf-export',
    title: 'PDF Export',
    description: 'Export any notebook as a high-quality PDF, ready to print or share.',
    icon: 'Download',
    status: 'live',
    publicVisible: true,
  },
  {
    id: 'ink-currency',
    title: 'Ink Credit System',
    description: 'Pay only for what you use. 1 Ink = 1 page layout. Free tier includes 12 Ink/month.',
    icon: 'Droplet',
    status: 'live',
    publicVisible: true,
  },

  // ─── IN PROGRESS ───────────────────────────────────────────
  {
    id: 'ios-app',
    title: 'iOS App',
    description: 'Native iOS experience with widgets, Spotlight search, and haptic feedback. App Store submission soon.',
    icon: 'Smartphone',
    status: 'in_progress',
    eta: 'Q2 2026',
    publicVisible: true,
  },
  {
    id: 'apple-pencil',
    title: 'Apple Pencil Support',
    description: 'Native handwriting and sketching on iPad with Pencil Pro features.',
    icon: 'PenTool',
    status: 'in_progress',
    eta: 'Q2 2026',
    publicVisible: true,
  },

  // ─── COMING SOON ───────────────────────────────────────────
  {
    id: 'template-marketplace',
    title: 'Template Marketplace',
    description: 'Browse and use beautiful notebook templates from creators worldwide. Free and paid.',
    icon: 'ShoppingBag',
    status: 'coming_soon',
    eta: 'Q3 2026',
    publicVisible: true,
  },
  {
    id: 'creator-publishing',
    title: 'Creator Publishing',
    description: 'Publish your best notebook layouts as templates. Set your price and earn 70% of every sale.',
    icon: 'Store',
    status: 'coming_soon',
    eta: 'Q3 2026',
    publicVisible: true,
  },
  {
    id: 'sticker-packs',
    title: 'Sticker & Washi Tape Packs',
    description: 'Decorate your notebooks with curated digital stickers and washi tape collections.',
    icon: 'Sticker',
    status: 'coming_soon',
    eta: 'Q3 2026',
    publicVisible: true,
  },
  {
    id: 'iso-hex-canvas',
    title: 'Isometric & Hex Canvas Drawing',
    description: 'Draw 3D diagrams on isometric paper and chemistry molecules on hex paper. Vector-based, snap-to-grid.',
    icon: 'PenTool',
    status: 'coming_soon',
    eta: 'Q3 2026',
    publicVisible: true,
  },
  {
    id: 'math-engine',
    title: 'Algorithmic Math in Grid Layouts',
    description: 'Type formulas anywhere in grid paper — they evaluate live. Spreadsheet-style references and functions.',
    icon: 'Calculator',
    status: 'coming_soon',
    eta: 'Q3 2026',
    publicVisible: true,
  },

  // ─── PLANNED ───────────────────────────────────────────────
  {
    id: 'team-education',
    title: 'Team & Education Plans',
    description: 'Shared collections, classroom distribution, admin controls, and pooled Ink budgets for teams.',
    icon: 'Users',
    status: 'planned',
    eta: 'Q4 2026',
    publicVisible: true,
  },
  {
    id: 'handwriting-ocr',
    title: 'Handwriting Recognition',
    description: 'Convert handwritten notes to searchable text. AI-powered OCR for journals and meeting notes.',
    icon: 'ScanLine',
    status: 'planned',
    eta: 'Q4 2026',
    publicVisible: true,
  },
  {
    id: 'voice-notes',
    title: 'Voice Notes & Transcription',
    description: 'Record voice notes that automatically transcribe and summarize into your notebook.',
    icon: 'Mic',
    status: 'planned',
    eta: 'Q4 2026',
    publicVisible: true,
  },
  {
    id: 'collaboration',
    title: 'Real-time Collaboration',
    description: 'Share notebooks with friends or coworkers. Edit together in real time.',
    icon: 'UsersRound',
    status: 'planned',
    publicVisible: true,
  },
] as const;

// ============================================================================
// HELPERS
// ============================================================================

export function getRoadmapByStatus(status: RoadmapStatus): readonly RoadmapItem[] {
  return ROADMAP.filter((i) => i.status === status && i.publicVisible);
}

export function getPublicRoadmap(): readonly RoadmapItem[] {
  return ROADMAP.filter((i) => i.publicVisible);
}

export const STATUS_LABELS: Record<RoadmapStatus, string> = {
  live: 'Live now',
  in_progress: 'In progress',
  coming_soon: 'Coming soon',
  planned: 'Planned',
};

export const STATUS_COLORS: Record<RoadmapStatus, { bg: string; text: string; border: string }> = {
  live: { bg: 'rgba(16,185,129,0.1)', text: '#059669', border: 'rgba(16,185,129,0.3)' },
  in_progress: { bg: 'rgba(79,70,229,0.1)', text: '#4f46e5', border: 'rgba(79,70,229,0.3)' },
  coming_soon: { bg: 'rgba(217,119,6,0.1)', text: '#d97706', border: 'rgba(217,119,6,0.3)' },
  planned: { bg: 'rgba(100,116,139,0.08)', text: '#64748b', border: 'rgba(100,116,139,0.2)' },
};
