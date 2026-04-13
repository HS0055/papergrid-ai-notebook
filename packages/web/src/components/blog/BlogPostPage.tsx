import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Clock, Tag } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../services/apiClient';
import { BLOG_IMAGES, BlogPost, DEFAULT_BLOG_POSTS, formatDate } from './blogData';
import { Logo } from '../landing/Logo';

interface BlogPostResponse {
  post: BlogPost | null;
}

// ─── Reading progress bar ───────────────────────────────────────────────────

function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0);
    };
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  return (
    <div
      className="fixed top-0 left-0 z-[60] h-[3px] bg-emerald-600 transition-[width] duration-100"
      style={{ width: `${progress}%` }}
      aria-hidden="true"
    />
  );
}

// ─── Markdown body renderer ─────────────────────────────────────────────────

const renderBody = (body: string): React.ReactNode[] => {
  const lines = body.split('\n');
  const output: React.ReactNode[] = [];
  let bulletList: string[] = [];
  let numberedList: string[] = [];
  let orderedIndex = 1;

  const flushBullets = () => {
    if (!bulletList.length) return;
    output.push(
      <ul key={`ul-${output.length}`} className="my-6 space-y-2.5 pl-6">
        {bulletList.map((item, i) => (
          <li key={i} className="list-disc text-lg leading-8 text-stone-700">{item}</li>
        ))}
      </ul>,
    );
    bulletList = [];
  };

  const flushNumbered = () => {
    if (!numberedList.length) return;
    output.push(
      <ol key={`ol-${output.length}`} className="my-6 space-y-2.5 pl-6">
        {numberedList.map((item, i) => (
          <li key={i} className="list-decimal text-lg leading-8 text-stone-700">{item}</li>
        ))}
      </ol>,
    );
    numberedList = [];
    orderedIndex = 1;
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      flushBullets();
      flushNumbered();
      return;
    }

    if (line.startsWith('- ')) {
      flushNumbered();
      bulletList.push(line.slice(2));
      return;
    }

    const numberedMatch = line.match(/^\d+\.\s+(.*)/);
    if (numberedMatch) {
      flushBullets();
      numberedList.push(numberedMatch[1]);
      orderedIndex++;
      return;
    }

    flushBullets();
    flushNumbered();

    if (line.startsWith('> ')) {
      output.push(
        <blockquote
          key={`bq-${output.length}`}
          className="my-8 border-l-4 border-emerald-500 bg-emerald-50 py-4 pl-5 pr-4"
        >
          <p className="text-lg font-medium leading-8 text-emerald-900">{line.slice(2)}</p>
        </blockquote>,
      );
      return;
    }

    if (line.startsWith('# ')) {
      output.push(
        <h2
          key={`h2-${output.length}`}
          className="mb-4 mt-12 font-serif text-4xl font-bold leading-tight tracking-tight text-stone-950"
        >
          {line.slice(2)}
        </h2>,
      );
      return;
    }

    if (line.startsWith('## ')) {
      output.push(
        <h3
          key={`h3-${output.length}`}
          className="mb-3 mt-10 text-2xl font-semibold text-stone-950"
        >
          {line.slice(3)}
        </h3>,
      );
      return;
    }

    if (line.startsWith('### ')) {
      output.push(
        <h4
          key={`h4-${output.length}`}
          className="mb-2 mt-8 text-xl font-semibold text-stone-800"
        >
          {line.slice(4)}
        </h4>,
      );
      return;
    }

    output.push(
      <p key={`p-${output.length}`} className="my-5 text-lg leading-9 text-stone-700">
        {line}
      </p>,
    );
  });

  flushBullets();
  flushNumbered();
  return output;
};

// ─── SEO head helper ─────────────────────────────────────────────────────────

function usePostSEO(post: BlogPost | null) {
  useEffect(() => {
    if (!post) return;
    const title = post.seoTitle || post.title;
    const description = post.seoDescription || post.excerpt;
    document.title = `${title} — Papera Blog`;

    const setMeta = (name: string, content: string, prop = false) => {
      const attr = prop ? 'property' : 'name';
      let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    setMeta('description', description);
    setMeta('og:title', title, true);
    setMeta('og:description', description, true);
    setMeta('og:type', 'article', true);
    if (post.featuredImageUrl) setMeta('og:image', post.featuredImageUrl, true);
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', title);
    setMeta('twitter:description', description);
    if (post.featuredImageUrl) setMeta('twitter:image', post.featuredImageUrl);
  }, [post]);
}

// ─── Page component ──────────────────────────────────────────────────────────

export const BlogPostPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const articleRef = useRef<HTMLDivElement>(null);
  const [post, setPost] = useState<BlogPost | null>(() =>
    DEFAULT_BLOG_POSTS.find((item) => item.slug === slug) ?? null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await api.get<BlogPostResponse>(`/api/blog/post?slug=${encodeURIComponent(slug)}`);
        if (!cancelled) {
          setPost(data.post ?? DEFAULT_BLOG_POSTS.find((item) => item.slug === slug) ?? null);
        }
      } catch {
        if (!cancelled) {
          setPost(DEFAULT_BLOG_POSTS.find((item) => item.slug === slug) ?? null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [slug]);

  usePostSEO(post);

  const relatedPosts = useMemo(
    () => DEFAULT_BLOG_POSTS.filter((item) => item.slug !== post?.slug).slice(0, 3),
    [post?.slug],
  );

  if (!post) {
    return (
      <main className="min-h-screen bg-[#f7f2ea] px-5 py-10 text-stone-950">
        <div className="mx-auto max-w-2xl rounded-lg border border-stone-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-3xl font-semibold">Article not found</h1>
          <p className="mt-3 text-stone-600">This guide is not published yet.</p>
          <Link to="/blog" className="mt-6 inline-flex rounded-lg bg-stone-950 px-5 py-3 text-white">
            Back to blog
          </Link>
        </div>
      </main>
    );
  }

  const imageUrl = post.featuredImageUrl || BLOG_IMAGES[0];

  return (
    <main className="min-h-screen bg-[#f7f2ea] text-stone-950">
      <ReadingProgress />

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-stone-200 bg-[#fdfbf7]/92 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link to="/" aria-label="Papera home">
            <Logo variant="light" size={36} />
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              to="/blog"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-600 hover:text-emerald-800"
            >
              <ArrowLeft size={15} />
              All guides
            </Link>
            <a
              href="/app"
              className="rounded-lg bg-stone-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-900"
            >
              Open Papera
            </a>
          </nav>
        </div>
      </header>

      <article>
        {/* Hero */}
        <section className="bg-[#fdfbf7] border-b border-stone-200">
          <div className="mx-auto max-w-7xl px-5 py-10 lg:py-14">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">
                {post.category}
              </span>
              <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-violet-800">
                {post.mentalState}
              </span>
            </div>
            <h1 className="mt-5 max-w-4xl font-serif text-5xl font-bold leading-[1.04] tracking-tight md:text-6xl lg:text-7xl">
              {post.title}
            </h1>
            <p className="mt-5 max-w-2xl text-xl leading-8 text-stone-600">{post.excerpt}</p>
            <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-stone-500">
              <span className="font-medium">{post.authorName || 'Papera'}</span>
              <span>·</span>
              <span>{formatDate(post.publishedAt)}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Clock size={13} />
                {post.readingTimeMinutes} min read
              </span>
              {loading && <span className="text-stone-400">Refreshing…</span>}
            </div>
          </div>
        </section>

        {/* Featured image full-width */}
        <div className="relative h-72 w-full overflow-hidden bg-stone-200 md:h-96 lg:h-[440px]">
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#f7f2ea]/60 to-transparent" />
        </div>

        {/* Body + sidebar */}
        <section className="border-b border-stone-200 bg-[#fdfbf7]">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-5 py-12 lg:grid-cols-[minmax(0,1fr)_300px]">

            {/* Article body */}
            <div ref={articleRef} className="min-w-0">
              <div className="prose-blog">
                {renderBody(post.body || '')}
              </div>

              {/* Tags */}
              {post.tags.length > 0 && (
                <div className="mt-10 flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-semibold text-stone-600"
                    >
                      <Tag size={13} />
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Bottom CTA */}
              <div className="mt-12 rounded-xl border border-emerald-200 bg-emerald-50 p-6">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
                  Ready to apply this?
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-stone-950">
                  Turn this guide into a real page.
                </h3>
                <p className="mt-2 text-stone-600">
                  Open Papera, describe what you're working through, and get a structured notebook page in seconds — on real paper that thinks back.
                </p>
                <a
                  href="/app"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-stone-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-900"
                >
                  Open Papera — free
                  <ArrowRight size={15} />
                </a>
                <p className="mt-3 text-xs text-stone-400">No card needed · 10 Ink free every month</p>
              </div>
            </div>

            {/* Sidebar */}
            <aside className="lg:sticky lg:top-[72px] lg:self-start space-y-4">
              {/* CTA card */}
              <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">Try Papera free</p>
                <h3 className="mt-2 text-lg font-semibold text-stone-950">Turn this into a real page.</h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  Read the guide. Then open Papera and build the structure on actual paper that thinks back.
                </p>
                <a
                  href="/app"
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-stone-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-900"
                >
                  Open Papera — free
                </a>
                <p className="mt-3 text-center text-xs text-stone-400">No card needed · 10 Ink free every month</p>
              </div>

              {/* Mental state badge */}
              <div className="rounded-xl border border-violet-100 bg-violet-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-700">You feel</p>
                <p className="mt-1 text-lg font-semibold text-violet-900">{post.mentalState}</p>
                <p className="mt-2 text-xs text-violet-600">
                  Papera is built for exactly this state. Describe it — Papera builds the page.
                </p>
              </div>

              {/* Related posts */}
              {relatedPosts.length > 0 && (
                <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-stone-500">More guides</p>
                  <div className="space-y-3">
                    {relatedPosts.map((item) => (
                      <Link
                        key={item.slug}
                        to={`/blog/${item.slug}`}
                        className="block rounded-lg border border-stone-100 p-3 transition hover:border-emerald-300 hover:bg-emerald-50"
                      >
                        <span className="text-xs font-bold uppercase tracking-[0.1em] text-emerald-700">
                          {item.mentalState}
                        </span>
                        <p className="mt-1 text-sm font-semibold leading-snug text-stone-950">
                          {item.title}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        </section>
      </article>

      {/* Keep reading grid at bottom */}
      {relatedPosts.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 py-12">
          <h2 className="text-2xl font-semibold">Keep going</h2>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            {relatedPosts.map((item, index) => (
              <Link
                key={item.slug}
                to={`/blog/${item.slug}`}
                className="group overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-600 hover:shadow-md"
              >
                <img
                  src={item.featuredImageUrl || BLOG_IMAGES[index % BLOG_IMAGES.length]}
                  alt=""
                  className="h-40 w-full object-cover"
                  loading="lazy"
                />
                <div className="p-4">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">
                    {item.mentalState}
                  </span>
                  <h3 className="mt-2 text-lg font-semibold leading-tight group-hover:text-emerald-900">
                    {item.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone-600">{item.excerpt}</p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-stone-500">
                    <Clock size={12} />
                    {item.readingTimeMinutes} min read
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
};
