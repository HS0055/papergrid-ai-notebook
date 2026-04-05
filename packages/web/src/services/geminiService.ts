import { Block } from "@papergrid/core";

const API_BASE = import.meta.env.VITE_API_URL || '';

export interface GeneratedPage {
  title: string;
  paperType: 'lined' | 'grid' | 'dotted' | 'blank' | 'music' | 'rows' | 'isometric' | 'hex' | 'legal' | 'crumpled';
  themeColor: string;
  blocks: Block[];
}

const normalizeGeneratedCover = async (imageUrl: string): Promise<string> => {
  if (
    typeof window === 'undefined' ||
    !imageUrl.startsWith('data:image/') ||
    imageUrl.startsWith('data:image/svg+xml')
  ) {
    return imageUrl;
  }

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.decoding = 'async';
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Failed to decode generated cover image.'));
      element.src = imageUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return imageUrl;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', 0.92);
  } catch (error) {
    console.warn('Failed to normalize generated cover image:', error);
    return imageUrl;
  }
};

export interface ExistingPageContext {
  title: string;
  paperType: string;
  themeColor: string;
  blockSummary: string;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 90000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export const generateLayout = async (
  prompt: string,
  industry?: string,
  aesthetic?: string,
  existingPages?: ExistingPageContext[],
  pageCount?: string,
): Promise<GeneratedPage[]> => {
  const sessionToken = localStorage.getItem('papergrid_session');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`;
  }
  const payload: Record<string, unknown> = { prompt, industry, aesthetic };
  if (existingPages && existingPages.length > 0) {
    payload.existingPages = existingPages;
  }
  if (pageCount) {
    payload.pageCount = pageCount;
  }

  const doFetch = async (): Promise<GeneratedPage[]> => {
    const response = await fetchWithTimeout(`${API_BASE}/api/generate-layout`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    }, 90000);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `API error: ${response.status}`);
    }

    const data = await response.json();

    const rawPages: GeneratedPage[] = Array.isArray(data.pages)
      ? data.pages
      : [data];

    if (rawPages.length === 0) {
      throw new Error('AI generated an empty response. Please try again.');
    }

    // Filter out pages with no real blocks
    const validPages = rawPages
      .map((page) => ({
        title: page.title || 'Untitled',
        paperType: page.paperType || 'lined',
        themeColor: page.themeColor || 'slate',
        blocks: ((page.blocks || []) as Block[]).filter(
          (b) => b.type === 'DIVIDER' || b.type === 'MOOD_TRACKER' || b.type === 'PRIORITY_MATRIX' || b.type === 'CALENDAR' || b.type === 'WEEKLY_VIEW' || b.type === 'HABIT_TRACKER' || b.type === 'GOAL_SECTION' || b.type === 'TIME_BLOCK' || b.type === 'DAILY_SECTION' || b.type === 'PROGRESS_BAR' || b.type === 'RATING' || b.type === 'WATER_TRACKER' || b.type === 'SECTION_NAV' || b.type === 'KANBAN' || (b.content && b.content.trim().length > 0) || b.gridData
        ),
      }))
      .filter((p) => p.blocks.length > 0);

    if (validPages.length === 0) {
      throw new Error('AI returned empty pages. Please try again with a different prompt.');
    }

    return validPages;
  };

  // Try once, auto-retry on network/timeout errors
  try {
    return await doFetch();
  } catch (error) {
    const isRetryable = error instanceof Error && (
      error.name === 'AbortError' ||
      error.message.includes('Failed to fetch') ||
      error.message.includes('network') ||
      error.message.includes('timeout')
    );
    if (isRetryable) {
      // One retry
      try {
        return await doFetch();
      } catch (retryError) {
        const msg = retryError instanceof Error ? retryError.message : 'Generation failed';
        throw new Error(
          retryError instanceof Error && retryError.name === 'AbortError'
            ? 'Generation timed out. Try a simpler prompt or try again.'
            : msg
        );
      }
    }
    throw error;
  }
};

export async function previewInkCost(action: string = 'layout'): Promise<{ cost: number; balance: number; canAfford: boolean }> {
  const token = localStorage.getItem('papergrid_session');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}/api/ink/preview`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action }),
    });
    if (!res.ok) return { cost: 1, balance: 0, canAfford: false };
    return await res.json();
  } catch {
    return { cost: 1, balance: 0, canAfford: false };
  }
}

export const generateCover = async (prompt: string, aesthetic?: string): Promise<{ imageUrl: string }> => {
  try {
    const response = await fetch(`${API_BASE}/api/generate-cover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, aesthetic }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data?.imageUrl) {
      throw new Error('No image returned');
    }

    return {
      ...data,
      imageUrl: await normalizeGeneratedCover(data.imageUrl),
    };
  } catch (error) {
    console.error("Cover generation failed:", error);
    throw error;
  }
};
