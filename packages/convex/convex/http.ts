import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

const http = httpRouter();

http.route({
  path: "/api/generate-layout",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      const body = await request.json();
      const { prompt, industry, aesthetic } = body as {
        prompt: string;
        industry?: string;
        aesthetic?: string;
      };

      if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: "prompt is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Rate limiting: max prompt length 2000 chars
      if (prompt.length > 2000) {
        return new Response(
          JSON.stringify({ error: "prompt exceeds 2000 character limit" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Retrieve server-side API key from environment variable
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error("GEMINI_API_KEY environment variable is not set");
        return new Response(
          JSON.stringify({ error: "AI service is not configured" }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const industryContext = industry ? `Industry/Context: ${industry}.` : "";
      const aestheticContext = aesthetic ? `Aesthetic Style: ${aesthetic}.` : "";

      const geminiPayload = {
        contents: [
          {
            parts: [
              {
                text: `Generate a structured notebook layout. ${industryContext} ${aestheticContext}
User Request: "${prompt}".

Design rules:
1. Act as a world-class editorial designer. Use "layers" of content. Mix TEXT blocks with structured GRID blocks (tables), CALLOUTs, QUOTEs, DIVIDERs, MOOD_TRACKERs, PRIORITY_MATRIXes, and INDEXes.
2. For "planners", "trackers", or "logs", heavily favor GRID type with specific columns relevant to the industry. Use MOOD_TRACKER for daily journals or wellness logs. Use PRIORITY_MATRIX for task management and Eisenhower matrices.
3. Use CALLOUT blocks for tips, warnings, or daily focus (they look like sticky notes with washi tape!). Use QUOTE for inspirational or important text. Use DIVIDER to separate major sections. Use INDEX to create a table of contents for the notebook.
4. Ensure the structure mimics a real paper worksheet, Notion template, or magazine layout.
5. Adhere to the requested aesthetic:
   - 'modern-planner': Comprehensive dashboards, finance/wellness/schedule sections. Use 'blank' or 'lined' paper, 'indigo' or 'rose' theme.
   - 'e-ink': High contrast, minimalist. Use 'grid' or 'dotted' paper, 'slate' or 'gray' theme.
   - 'bujo': Playful, freeform. Use 'dotted' or 'crumpled' paper, 'amber' or 'sky' theme.
   - 'cornell': Academic and structured. Use 'legal' or 'lined' paper, 'slate' theme.
6. Assign appropriate alignments, emphasis, and colors to blocks.
7. Design a 2-page spread. Assign 'left' or 'right' to the 'side' property of each block.

Return a JSON object with: title (string), paperType (enum), themeColor (enum), blocks (array of block objects with type, content, alignment, emphasis, color, side, gridData, moodValue, matrixData).`,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING" },
              paperType: {
                type: "STRING",
                enum: ["lined", "grid", "dotted", "blank", "music", "rows", "isometric", "hex", "legal", "crumpled"],
              },
              themeColor: {
                type: "STRING",
                enum: ["rose", "indigo", "emerald", "amber", "slate", "sky", "gray"],
              },
              blocks: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    type: {
                      type: "STRING",
                      enum: ["TEXT", "HEADING", "GRID", "CHECKBOX", "CALLOUT", "QUOTE", "DIVIDER", "MOOD_TRACKER", "PRIORITY_MATRIX", "INDEX"],
                    },
                    content: { type: "STRING" },
                    alignment: { type: "STRING", enum: ["left", "center", "right"] },
                    emphasis: { type: "STRING", enum: ["bold", "italic", "highlight", "none"] },
                    color: { type: "STRING", enum: ["rose", "indigo", "emerald", "amber", "slate", "sky", "gray"] },
                    side: { type: "STRING", enum: ["left", "right"] },
                    gridData: {
                      type: "OBJECT",
                      properties: {
                        columns: { type: "ARRAY", items: { type: "STRING" } },
                        rows: {
                          type: "ARRAY",
                          items: {
                            type: "ARRAY",
                            items: { type: "STRING" },
                          },
                        },
                      },
                      nullable: true,
                    },
                  },
                  required: ["type", "content"],
                },
              },
            },
            required: ["title", "blocks", "paperType", "themeColor"],
          },
        },
        systemInstruction: {
          parts: [
            {
              text: "You are an expert workspace designer creating productivity layouts. You organize information into clear rows, grids, text sections, and visual callouts.",
            },
          ],
        },
      };

      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geminiPayload),
        }
      );

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        console.error("Gemini API error:", geminiResponse.status, errorText);
        return new Response(
          JSON.stringify({ error: "AI generation failed" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const geminiData = await geminiResponse.json();

      // Extract the generated text from Gemini response
      const generatedText =
        geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!generatedText) {
        return new Response(
          JSON.stringify({ error: "No content generated" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Parse and validate the response
      const layoutData = JSON.parse(generatedText);

      // Hydrate blocks with IDs
      const generateId = () =>
        Math.random().toString(36).substring(2, 11);

      const blocks = (layoutData.blocks || []).map(
        (b: Record<string, unknown>, index: number) => ({
          id: generateId(),
          type: b.type || "TEXT",
          content: b.content || "",
          checked: false,
          alignment: b.alignment || "left",
          emphasis: b.emphasis || "none",
          color: b.color || layoutData.themeColor || "slate",
          side: b.side || "left",
          sortOrder: index,
          moodValue: b.type === "MOOD_TRACKER" ? 2 : undefined,
          matrixData:
            b.type === "PRIORITY_MATRIX"
              ? { q1: "", q2: "", q3: "", q4: "" }
              : undefined,
          gridData: b.gridData
            ? {
                columns:
                  (b.gridData as Record<string, unknown>).columns || [],
                rows: (
                  (b.gridData as Record<string, unknown>).rows as string[][] || []
                ).map((row: string[]) =>
                  row.map((cellText: string) => ({
                    id: generateId(),
                    content: cellText || "",
                  }))
                ),
              }
            : undefined,
        })
      );

      const result = {
        title: layoutData.title,
        paperType: layoutData.paperType,
        themeColor: layoutData.themeColor,
        blocks,
      };

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Generate layout error:", error);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

// Handle CORS preflight for all routes
http.route({
  path: "/api/generate-layout",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }),
});

export default http;
