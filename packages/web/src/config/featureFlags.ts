/**
 * Feature flags — single source of truth for which paper types are
 * production-ready vs. "coming soon".
 *
 * Driven by the env var `VITE_COMING_SOON_PAPERS` which is a comma-separated
 * list of paperType values to mark as not-yet-shipped.
 *
 *   .env.production → VITE_COMING_SOON_PAPERS=hex,isometric,music
 *   .env.development → (unset, all paper types fully enabled)
 *
 * Behavior when a paper type is marked coming-soon:
 *   - Paper picker shows a "SOON" badge and the tile is non-clickable
 *   - Existing pages of that type render a friendly placeholder, not the
 *     real (broken/unfinished) UI
 *   - AI layout generator must not emit pages of that paper type
 */

import type { NotebookPage } from '@papergrid/core';

export type PaperType = NotebookPage['paperType'];

const RAW = (import.meta.env.VITE_COMING_SOON_PAPERS as string | undefined) ?? '';
const PUBLIC_BLOG_RAW = (import.meta.env.VITE_PUBLIC_BLOG_ENABLED as string | undefined) ?? '';

const COMING_SOON_SET: ReadonlySet<PaperType> = new Set(
  RAW.split(',')
    .map((s) => s.trim())
    .filter((s): s is PaperType =>
      ['lined', 'grid', 'dotted', 'blank', 'music', 'isometric', 'hex'].includes(s),
    ),
);

export function isPaperTypeComingSoon(paperType: PaperType): boolean {
  return COMING_SOON_SET.has(paperType);
}

export function isPaperTypeReady(paperType: PaperType): boolean {
  return !COMING_SOON_SET.has(paperType);
}

/** Returns the list of paper types that are NOT coming soon (i.e. user-selectable). */
export function getReadyPaperTypes(): readonly PaperType[] {
  const all: PaperType[] = ['lined', 'grid', 'dotted', 'blank', 'music', 'isometric', 'hex'];
  return all.filter((t) => !COMING_SOON_SET.has(t));
}

/** Snapshot of the coming-soon set for telemetry / debug. */
export function getComingSoonPapers(): readonly PaperType[] {
  return Array.from(COMING_SOON_SET);
}

export const PUBLIC_BLOG_ENABLED = PUBLIC_BLOG_RAW.toLowerCase() === 'true';
