import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function geminiProxyPlugin(apiKey: string): Plugin {
  // Generate a procedural gradient SVG cover as fallback
  function generateFallbackCover(prompt: string, aesthetic?: string): string {
    // Hash prompt to derive consistent colors
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
      hash = ((hash << 5) - hash) + prompt.charCodeAt(i);
      hash |= 0;
    }
    const hue1 = Math.abs(hash % 360);
    const hue2 = (hue1 + 40 + Math.abs((hash >> 8) % 60)) % 360;

    // Aesthetic-based saturation and lightness
    const isMinimal = aesthetic?.includes('e-ink') || aesthetic?.includes('minimal');
    const sat = isMinimal ? '10%' : '45%';
    const light1 = isMinimal ? '20%' : '25%';
    const light2 = isMinimal ? '35%' : '40%';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="1280" viewBox="0 0 960 1280">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="hsl(${hue1}, ${sat}, ${light1})"/>
        <stop offset="100%" stop-color="hsl(${hue2}, ${sat}, ${light2})"/>
      </linearGradient>
      <filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feBlend in="SourceGraphic" mode="multiply" result="blend"/></filter>
      <pattern id="leather" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
        <rect width="200" height="200" fill="transparent"/>
        <circle cx="50" cy="50" r="0.5" fill="rgba(255,255,255,0.03)"/>
        <circle cx="150" cy="100" r="0.4" fill="rgba(255,255,255,0.02)"/>
        <circle cx="100" cy="150" r="0.6" fill="rgba(255,255,255,0.025)"/>
      </pattern>
    </defs>
    <rect width="960" height="1280" fill="url(#bg)"/>
    <rect width="960" height="1280" fill="url(#leather)" opacity="0.5"/>
    <rect width="960" height="1280" filter="url(#noise)" opacity="0.08"/>
    <rect x="60" y="60" width="840" height="1160" rx="8" fill="none" stroke="rgba(212,165,116,0.15)" stroke-width="2"/>
    <rect x="84" y="84" width="792" height="1112" rx="4" fill="none" stroke="rgba(212,165,116,0.08)" stroke-width="1"/>
    <line x1="480" y1="140" x2="480" y2="184" stroke="rgba(212,165,116,0.25)" stroke-width="2"/>
    <line x1="480" y1="1096" x2="480" y2="1140" stroke="rgba(212,165,116,0.25)" stroke-width="2"/>
  </svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  }

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
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
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

      // ── /api/generate-cover — AI Cover Image Generation ──────────
      server.middlewares.use('/api/generate-cover', async (req, res) => {
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
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(chunk as Buffer);
          }
          const body = JSON.parse(Buffer.concat(chunks).toString());
          const { prompt, aesthetic } = body as { prompt: string; aesthetic?: string };

          if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'prompt is required' }));
            return;
          }

          if (!apiKey) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'GEMINI_API_KEY is not configured' }));
            return;
          }

          const styleContext = aesthetic || 'premium leather journal';
          const imagePrompt = `Generate a flat, front-facing notebook cover artwork for a realistic 3D journal model. Design brief: ${prompt}. Style: ${styleContext}. Important: this is a cover texture, not a product mockup. Show only the cover surface artwork with no perspective, no angled book, no visible spine, no desk, no background scene, and no camera tilt. Keep the composition vertically centered with a safe margin so important details do not touch the edges. Use rich material cues like leather, linen, foil, embossing, debossing, fabric grain, ink, or ornamental pattern, but keep everything perfectly flat and printable. The design must not look empty: include a clear focal composition such as a centered emblem, medallion, geometric motif, botanical cluster, or framed ornamental border, with visible contrast against the base material. Avoid plain blank covers, large empty areas, or nearly-solid textures unless the prompt explicitly asks for minimalism. Portrait composition, roughly 3:4 ratio, premium craftsmanship, elegant lighting baked into the artwork only. Do not include text, letters, logos, or words unless the prompt explicitly asks for them.`;

          // Use the current Gemini native image generation model
          const geminiPayload = {
            contents: [{
              parts: [{ text: imagePrompt }],
            }],
            generationConfig: {
              responseModalities: ['TEXT', 'IMAGE'],
            },
          };

          const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(geminiPayload),
            }
          );

          if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error('Gemini image gen error:', geminiResponse.status, errorText);
            // Fallback: generate a procedural gradient cover
            const fallbackUrl = generateFallbackCover(prompt, aesthetic);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ imageUrl: fallbackUrl, fallback: true }));
            return;
          }

          const geminiData = await geminiResponse.json();
          const parts = geminiData?.candidates?.[0]?.content?.parts || [];

          // Find the image part
          const imagePart = parts.find((p: Record<string, unknown>) => p.inlineData);
          if (imagePart?.inlineData) {
            const { mimeType, data } = imagePart.inlineData as { mimeType: string; data: string };
            const dataUrl = `data:${mimeType};base64,${data}`;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ imageUrl: dataUrl }));
            return;
          }

          // No image returned — use fallback
          console.warn('Gemini returned no image, using fallback');
          const fallbackUrl = generateFallbackCover(prompt, aesthetic);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ imageUrl: fallbackUrl, fallback: true }));
        } catch (error) {
          console.error('Cover generation error:', error);
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
