import { BlockType, Block } from "@papergrid/core";
import { validateAIOutput } from "@papergrid/core";

const generateId = () => crypto.randomUUID();

const VALID_BLOCK_TYPES = new Set<string>(Object.values(BlockType));

const API_BASE = import.meta.env.VITE_API_URL || '';

interface GeneratedLayout {
  title: string;
  paperType: 'lined' | 'grid' | 'dotted' | 'blank' | 'music' | 'rows' | 'isometric' | 'hex' | 'legal' | 'crumpled';
  themeColor: string;
  blocks: Block[];
}

export const generateLayout = async (prompt: string, industry?: string, aesthetic?: string): Promise<GeneratedLayout> => {
  try {
    const response = await fetch(`${API_BASE}/api/generate-layout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, industry, aesthetic }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `API error: ${response.status}`);
    }

    const data = await response.json();

    // Validate AI output with Zod schema
    const validation = validateAIOutput(data);
    if (!validation.success) {
      console.error('AI output validation failed:', validation.errors);
      throw new Error('AI generated an invalid layout. Please try again.');
    }

    const validated = validation.data;

    // Hydrate with IDs
    const blocks: Block[] = validated.blocks.map((b) => ({
      id: generateId(),
      type: VALID_BLOCK_TYPES.has(b.type) ? (b.type as BlockType) : BlockType.TEXT,
      content: b.content || "",
      checked: b.checked ?? false,
      alignment: b.alignment || 'left',
      emphasis: b.emphasis || 'none',
      color: b.color || validated.themeColor || 'slate',
      side: b.side || 'left',
      moodValue: b.type === 'MOOD_TRACKER' ? (b.moodValue ?? 2) : undefined,
      matrixData: b.type === 'PRIORITY_MATRIX' ? (b.matrixData || { q1: '', q2: '', q3: '', q4: '' }) : undefined,
      gridData: b.gridData ? {
        columns: b.gridData.columns || [],
        rows: b.gridData.rows?.map((row: string[]) =>
          row.map((cellText: string) => ({ id: generateId(), content: cellText || "" }))
        ) || []
      } : undefined
    }));

    return {
      title: validated.title,
      paperType: validated.paperType,
      themeColor: validated.themeColor,
      blocks
    };

  } catch (error) {
    console.error("Layout generation failed:", error);
    throw error;
  }
};
