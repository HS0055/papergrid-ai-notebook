import { GoogleGenAI, Type, Schema } from "@google/genai";
import { BlockType, Block } from "@papergrid/core";

const generateId = () => crypto.randomUUID();

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

const layoutSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "The title of the generated page" },
    paperType: { type: Type.STRING, enum: ["lined", "grid", "dotted", "blank", "music", "rows", "isometric", "hex", "legal", "crumpled"], description: "The best paper background for this layout" },
    themeColor: { type: Type.STRING, enum: ["rose", "indigo", "emerald", "amber", "slate", "sky", "gray"], description: "Primary accent color for the page" },
    blocks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ["TEXT", "HEADING", "GRID", "CHECKBOX", "CALLOUT", "QUOTE", "DIVIDER", "MOOD_TRACKER", "PRIORITY_MATRIX", "INDEX"] },
          content: { type: Type.STRING, description: "Text content for headings, paragraphs, checkboxes, quotes, callouts, or Table Title. Empty for DIVIDER, MOOD_TRACKER, PRIORITY_MATRIX, INDEX." },
          alignment: { type: Type.STRING, enum: ["left", "center", "right"], description: "Text alignment" },
          emphasis: { type: Type.STRING, enum: ["bold", "italic", "highlight", "none"], description: "Text emphasis" },
          color: { type: Type.STRING, enum: ["rose", "indigo", "emerald", "amber", "slate", "sky", "gray"], description: "Specific color for this block, if it needs to stand out" },
          side: { type: Type.STRING, enum: ["left", "right"], description: "Which page this block belongs to in the 2-page spread" },
          gridData: {
            type: Type.OBJECT,
            description: "Only for GRID type. Define structure for planners/tables/trackers.",
            properties: {
              columns: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Column headers e.g. ['Date', 'Item', 'Cost']" },
              rows: {
                 type: Type.ARRAY,
                 items: {
                   type: Type.ARRAY,
                   items: { type: Type.STRING, description: "Initial cell content (often empty)" }
                 }
              }
            },
            nullable: true
          }
        },
        required: ["type", "content"]
      }
    }
  },
  required: ["title", "blocks", "paperType", "themeColor"]
};

export const generateLayout = async (prompt: string, industry?: string, aesthetic?: string): Promise<{ title: string; paperType: 'lined'|'grid'|'dotted'|'blank'|'music'|'rows'|'isometric'|'hex'|'legal'|'crumpled'; themeColor: string; blocks: Block[] }> => {
  try {
    const industryContext = industry ? `Industry/Context: ${industry}.` : "";
    const aestheticContext = aesthetic ? `Aesthetic Style: ${aesthetic}.` : "";
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Generate a structured notebook layout. ${industryContext} ${aestheticContext}
      User Request: "${prompt}". 
      
      Design rules:
      1. Act as a world-class editorial designer. Use "layers" of content. Mix TEXT blocks with structured GRID blocks (tables), CALLOUTs, QUOTEs, DIVIDERs, MOOD_TRACKERs, PRIORITY_MATRIXes, and INDEXes.
      2. For "planners", "trackers", or "logs", heavily favor GRID type with specific columns relevant to the industry. Use MOOD_TRACKER for daily journals or wellness logs. Use PRIORITY_MATRIX for task management and Eisenhower matrices.
      3. Use CALLOUT blocks for tips, warnings, or daily focus (they look like sticky notes with washi tape!). Use QUOTE for inspirational or important text. Use DIVIDER to separate major sections. Use INDEX to create a table of contents for the notebook.
      4. Ensure the structure mimics a real paper worksheet, Notion template, or magazine layout.
      5. Adhere to the requested aesthetic (inspired by top-tier digital planners):
         - 'modern-planner' (Ultimate Digital Planner): Comprehensive dashboards, finance/wellness/schedule sections separated by DIVIDERs. Use 'blank' or 'lined' paper, 'indigo' or 'rose' theme. Clean, structured, highly functional.
         - 'e-ink' (reMarkable Pro): High contrast, minimalist, optimized for focus. Use 'grid' or 'dotted' paper, 'slate' or 'gray' theme. Heavy use of time-blocking grids (e.g., 6AM-10PM) and simple checkboxes.
         - 'bujo' (Doodle Bullet Journal): Playful, freeform, hand-drawn feel. Use 'dotted' or 'crumpled' paper, 'amber' or 'sky' theme. Include habit trackers (grids), MOOD_TRACKERs, and CALLOUTs for doodles or quotes. Use 'highlight' emphasis.
         - 'cornell' (Printable Notebook): Academic and structured. Use 'legal' or 'lined' paper, 'slate' theme. Create a layout with a section for 'Cues/Keywords', a main 'Notes' section, and a 'Summary' at the bottom.
         - Note on paper types: You can also use 'music' (for musical notes), 'rows' (alternating shaded rows), 'isometric' (3D drawing), 'hex' (chemistry/games), 'legal' (yellow pad with red margin), or 'crumpled' (textured paper) if the user's prompt suggests it.
      6. Assign appropriate alignments (left, center, right), emphasis (bold, italic, highlight), and colors to blocks to create visual hierarchy.
      7. You are designing a 2-page spread (an open notebook). Assign 'left' or 'right' to the 'side' property of each block to balance the content across both pages. For example, put the schedule on the 'left' and the to-do list on the 'right'.
      8. RECIPES for common pages (use these as inspiration):
         - Meeting Notes: Use a GRID for metadata (Date, Attendees), HEADINGs for 'Agenda' and 'Action Items', and CHECKBOXes for tasks.
         - Gratitude Journal: Use CALLOUTs for 'Today I am grateful for...', QUOTEs for daily affirmations, and a MOOD_TRACKER.
         - Daily Planner: Left side: GRID for hourly schedule. Right side: PRIORITY_MATRIX for tasks, CALLOUT for notes.
         - Sticky Notes Board: Use multiple CALLOUT blocks with different colors to simulate a board of sticky notes on a 'crumpled' background.
      
      Return a JSON object matching the schema.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: layoutSchema,
        systemInstruction: "You are an expert workspace designer creating productivity layouts. You organize information into clear rows, grids, text sections, and visual callouts."
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    const data = JSON.parse(text);

    // Hydrate with IDs
    const blocks: Block[] = data.blocks.map((b: any) => ({
      id: generateId(),
      type: b.type as BlockType,
      content: b.content || "",
      checked: false,
      alignment: b.alignment || 'left',
      emphasis: b.emphasis || 'none',
      color: b.color || data.themeColor || 'slate',
      side: b.side || 'left',
      moodValue: b.type === 'MOOD_TRACKER' ? 2 : undefined,
      matrixData: b.type === 'PRIORITY_MATRIX' ? { q1: '', q2: '', q3: '', q4: '' } : undefined,
      gridData: b.gridData ? {
        columns: b.gridData.columns || [],
        rows: b.gridData.rows?.map((row: string[]) => 
          row.map((cellText: string) => ({ id: generateId(), content: cellText || "" }))
        ) || []
      } : undefined
    }));

    return {
      title: data.title,
      paperType: data.paperType,
      themeColor: data.themeColor,
      blocks
    };

  } catch (error) {
    console.error("Layout generation failed:", error);
    throw error;
  }
};