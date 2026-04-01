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

export const generateLayout = async (prompt: string, industry?: string, aesthetic?: string): Promise<GeneratedPage[]> => {
  try {
    const sessionToken = localStorage.getItem('papergrid_session');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    const response = await fetch(`${API_BASE}/api/generate-layout`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt, industry, aesthetic }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `API error: ${response.status}`);
    }

    const data = await response.json();

    // Backend returns { pages: [...] } — each page already hydrated with IDs
    const rawPages: GeneratedPage[] = Array.isArray(data.pages)
      ? data.pages
      : [data]; // backward compat: single-page response

    if (rawPages.length === 0) {
      throw new Error('AI generated an empty response. Please try again.');
    }

    return rawPages.map((page) => ({
      title: page.title || 'Untitled',
      paperType: page.paperType || 'lined',
      themeColor: page.themeColor || 'slate',
      blocks: (page.blocks || []) as Block[],
    }));
  } catch (error) {
    console.error("Layout generation failed:", error);
    throw error;
  }
};

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
