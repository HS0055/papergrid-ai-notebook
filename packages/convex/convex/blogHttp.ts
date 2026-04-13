import type { HttpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "capacitor://localhost",
  "ionic://localhost",
  "https://papera.io",
  "https://www.papera.io",
  "https://papergrid.app",
  "https://www.papergrid.app",
  "https://papergrid-five.vercel.app",
];

const isAllowedVercelPreview = (origin: string): boolean => {
  if (!origin.startsWith("https://")) return false;
  const host = origin.slice("https://".length);
  return host.startsWith("papergrid-") && host.endsWith(".vercel.app");
};

const corsOrigin = (request: Request): string => {
  const origin = request.headers.get("origin") ?? "";
  if (!origin) return ALLOWED_ORIGINS[0];
  if (ALLOWED_ORIGINS.includes(origin) || isAllowedVercelPreview(origin)) return origin;
  return ALLOWED_ORIGINS[0];
};

const corsHeaders = (request: Request) => ({
  "Access-Control-Allow-Origin": corsOrigin(request),
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Session-Token",
});

const getSessionToken = (request: Request): string | null => {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }
  return request.headers.get("X-Session-Token");
};

const isPublicBlogEnabled = (): boolean =>
  (process.env.PUBLIC_BLOG_ENABLED || "").toLowerCase() === "true";

const json = (body: unknown, status: number, request: Request): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(request) },
  });

const errorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) {
    return error.message.replace(/^Uncaught Error:\s*/i, "").split("\n")[0].trim() || fallback;
  }
  return fallback;
};

const statusFromMessage = (message: string): number => {
  if (/not authenticated/i.test(message)) return 401;
  if (/forbidden|admin only/i.test(message)) return 403;
  if (/not found/i.test(message)) return 404;
  if (/required|invalid|too long|slug/i.test(message)) return 400;
  return 500;
};

const installPreflight = (http: HttpRouter, path: string): void => {
  http.route({
    path,
    method: "OPTIONS",
    handler: httpAction(async (_ctx, request) => (
      new Response(null, { status: 204, headers: corsHeaders(request) })
    )),
  });
};

export function registerBlogRoutes(http: HttpRouter): void {
  http.route({
    path: "/api/blog/posts",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      try {
        if (!isPublicBlogEnabled()) {
          return json({ error: "Blog is not available" }, 404, request);
        }
        const url = new URL(request.url);
        const category = url.searchParams.get("category") ?? undefined;
        const limitRaw = url.searchParams.get("limit");
        const limit = limitRaw ? Number(limitRaw) : undefined;
        const posts = await ctx.runQuery(api.blog.listPublished, { category, limit });
        return json({ posts }, 200, request);
      } catch (error) {
        const message = errorMessage(error, "Failed to load blog posts");
        return json({ error: message }, statusFromMessage(message), request);
      }
    }),
  });
  installPreflight(http, "/api/blog/posts");

  http.route({
    path: "/api/blog/post",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      try {
        if (!isPublicBlogEnabled()) {
          return json({ error: "Blog is not available" }, 404, request);
        }
        const url = new URL(request.url);
        const slug = url.searchParams.get("slug");
        if (!slug) return json({ error: "slug required" }, 400, request);
        const post = await ctx.runQuery(api.blog.getPublishedBySlug, { slug });
        return json({ post }, 200, request);
      } catch (error) {
        const message = errorMessage(error, "Failed to load blog post");
        return json({ error: message }, statusFromMessage(message), request);
      }
    }),
  });
  installPreflight(http, "/api/blog/post");

  http.route({
    path: "/api/blog/admin/posts",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      try {
        const url = new URL(request.url);
        const limitRaw = url.searchParams.get("limit");
        const limit = limitRaw ? Number(limitRaw) : undefined;
        const posts = await ctx.runQuery(api.blog.adminList, {
          sessionToken: getSessionToken(request) ?? undefined,
          limit,
        });
        return json({ posts }, 200, request);
      } catch (error) {
        const message = errorMessage(error, "Failed to load admin blog posts");
        return json({ error: message }, statusFromMessage(message), request);
      }
    }),
  });

  http.route({
    path: "/api/blog/admin/posts",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      try {
        const body = await request.json().catch(() => ({}));
        const post = await ctx.runMutation(api.blog.adminUpsert, {
          sessionToken: getSessionToken(request) ?? undefined,
          postId: body.postId ? (body.postId as Id<"blogPosts">) : undefined,
          post: body.post,
        });
        return json({ post }, 200, request);
      } catch (error) {
        const message = errorMessage(error, "Failed to save blog post");
        return json({ error: message }, statusFromMessage(message), request);
      }
    }),
  });
  installPreflight(http, "/api/blog/admin/posts");

  http.route({
    path: "/api/blog/admin/delete",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      try {
        const body = await request.json().catch(() => ({}));
        if (!body.postId) return json({ error: "postId required" }, 400, request);
        const result = await ctx.runMutation(api.blog.adminDelete, {
          sessionToken: getSessionToken(request) ?? undefined,
          postId: body.postId as Id<"blogPosts">,
        });
        return json(result, 200, request);
      } catch (error) {
        const message = errorMessage(error, "Failed to delete blog post");
        return json({ error: message }, statusFromMessage(message), request);
      }
    }),
  });
  installPreflight(http, "/api/blog/admin/delete");

  // Nano Banana Pro (gemini-3-pro-image-preview) — generates images via
  // generateContent, stores in Convex file storage, returns public URL.
  http.route({
    path: "/api/blog/admin/generate-image",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      try {
        const body = await request.json().catch(() => ({}));
        const { title = "", excerpt = "", section = "" } = body as {
          title?: string; excerpt?: string; section?: string;
        };

        const geminiKey = process.env.GEMINI_API_KEY;
        if (!geminiKey) {
          return json({ error: "GEMINI_API_KEY not configured in Convex env" }, 500, request);
        }

        const prompt =
          (section
            ? `Create a blog section image for: "${section.slice(0, 300)}". `
            : `Create a blog hero image for article: "${title}". ${excerpt ? `About: ${excerpt.slice(0, 200)}. ` : ""}`) +
          "Style: photorealistic, professional, warm paper and notebook tones, minimal composition. " +
          "No text, no watermarks, no UI elements. Suitable for a productivity and planning blog.";

        // Nano Banana Pro = gemini-3-pro-image-preview, uses generateContent
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
            }),
          },
        );

        if (!resp.ok) {
          const errText = await resp.text();
          return json({ error: `Nano Banana Pro error: ${errText.slice(0, 400)}` }, 500, request);
        }

        const data = await resp.json() as {
          candidates?: Array<{
            content?: { parts?: Array<{ inlineData?: { data: string; mimeType: string } }> };
          }>;
        };
        const parts = data?.candidates?.[0]?.content?.parts ?? [];
        const imagePart = parts.find((p) => p.inlineData?.data);

        if (!imagePart?.inlineData) {
          return json({ error: "Nano Banana Pro returned no image" }, 500, request);
        }

        const mimeType = imagePart.inlineData.mimeType ?? "image/png";
        const binaryStr = atob(imagePart.inlineData.data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        const blob = new Blob([bytes], { type: mimeType });

        const storageId = await ctx.storage.store(blob);
        const url = await ctx.storage.getUrl(storageId);

        return json({ url }, 200, request);
      } catch (error) {
        const message = errorMessage(error, "Failed to generate image");
        return json({ error: message }, 500, request);
      }
    }),
  });
  installPreflight(http, "/api/blog/admin/generate-image");
}
