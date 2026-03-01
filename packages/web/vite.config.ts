import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function geminiProxyPlugin(apiKey: string): Plugin {
  return {
    name: 'gemini-proxy',
    configureServer(server) {
      server.middlewares.use('/api/generate-layout', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
          res.end();
          return;
        }

        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          // Read request body
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(chunk as Buffer);
          }
          const body = JSON.parse(Buffer.concat(chunks).toString());
          const { prompt, industry, aesthetic } = body;

          if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'prompt is required' }));
            return;
          }

          if (prompt.length > 2000) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'prompt exceeds 2000 character limit' }));
            return;
          }

          if (!apiKey) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'GEMINI_API_KEY is not configured' }));
            return;
          }

          const industryContext = industry ? `Industry/Context: ${industry}.` : '';
          const aestheticContext = aesthetic ? `Aesthetic Style: ${aesthetic}.` : '';

          const geminiPayload = {
            contents: [{
              parts: [{
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
   - Note on paper types: 'music' (for musical notes), 'rows' (alternating shaded rows), 'isometric' (3D drawing), 'hex' (chemistry/games), 'legal' (yellow pad with red margin), 'crumpled' (textured paper).
6. Assign appropriate alignments (left, center, right), emphasis (bold, italic, highlight), and colors to blocks to create visual hierarchy.
7. Design a 2-page spread. Assign 'left' or 'right' to the 'side' property of each block.
8. RECIPES for common pages:
   - Meeting Notes: GRID for metadata, HEADINGs for 'Agenda' and 'Action Items', CHECKBOXes for tasks.
   - Gratitude Journal: CALLOUTs for 'Today I am grateful for...', QUOTEs for daily affirmations, MOOD_TRACKER.
   - Daily Planner: Left: GRID for hourly schedule. Right: PRIORITY_MATRIX for tasks, CALLOUT for notes.
   - Sticky Notes Board: Multiple CALLOUT blocks with different colors on 'crumpled' background.

Return a JSON object matching the schema.`,
              }],
            }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                properties: {
                  title: { type: 'STRING' },
                  paperType: { type: 'STRING', enum: ['lined', 'grid', 'dotted', 'blank', 'music', 'rows', 'isometric', 'hex', 'legal', 'crumpled'] },
                  themeColor: { type: 'STRING', enum: ['rose', 'indigo', 'emerald', 'amber', 'slate', 'sky', 'gray'] },
                  blocks: {
                    type: 'ARRAY',
                    items: {
                      type: 'OBJECT',
                      properties: {
                        type: { type: 'STRING', enum: ['TEXT', 'HEADING', 'GRID', 'CHECKBOX', 'CALLOUT', 'QUOTE', 'DIVIDER', 'MOOD_TRACKER', 'PRIORITY_MATRIX', 'INDEX'] },
                        content: { type: 'STRING' },
                        alignment: { type: 'STRING', enum: ['left', 'center', 'right'] },
                        emphasis: { type: 'STRING', enum: ['bold', 'italic', 'highlight', 'none'] },
                        color: { type: 'STRING', enum: ['rose', 'indigo', 'emerald', 'amber', 'slate', 'sky', 'gray'] },
                        side: { type: 'STRING', enum: ['left', 'right'] },
                        gridData: {
                          type: 'OBJECT',
                          properties: {
                            columns: { type: 'ARRAY', items: { type: 'STRING' } },
                            rows: { type: 'ARRAY', items: { type: 'ARRAY', items: { type: 'STRING' } } },
                          },
                          nullable: true,
                        },
                      },
                      required: ['type', 'content'],
                    },
                  },
                },
                required: ['title', 'blocks', 'paperType', 'themeColor'],
              },
            },
            systemInstruction: {
              parts: [{ text: 'You are an expert workspace designer creating productivity layouts. You organize information into clear rows, grids, text sections, and visual callouts.' }],
            },
          };

          const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(geminiPayload),
            }
          );

          if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error('Gemini API error:', geminiResponse.status, errorText);
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'AI generation failed' }));
            return;
          }

          const geminiData: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> } = await geminiResponse.json();
          const generatedText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

          if (!generatedText) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No content generated' }));
            return;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(generatedText);
        } catch (error) {
          console.error('Gemini proxy error:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      port: 3000,
      host: 'localhost',
    },
    plugins: [
      react(),
      geminiProxyPlugin(env.GEMINI_API_KEY || ''),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@papergrid/core': path.resolve(__dirname, '../core/src'),
      },
    },
    css: {
      postcss: path.resolve(__dirname, 'postcss.config.js'),
    },
  };
});
