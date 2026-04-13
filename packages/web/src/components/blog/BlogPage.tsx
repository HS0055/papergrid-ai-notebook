import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Search, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../services/apiClient';
import { BLOG_IMAGES, BlogPost, DEFAULT_BLOG_POSTS, formatDate } from './blogData';
import { Logo } from '../landing/Logo';

interface BlogListResponse {
  posts: BlogPost[];
}

const uniqueCategories = (posts: BlogPost[]): string[] =>
  Array.from(new Set(posts.map((post) => post.category).filter(Boolean)));

export const BlogPage: React.FC = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [query, setQuery] = useState('');

  useEffect(() => {
    document.title = 'Thinking Guides — Papera AI Notebook';
    const setMeta = (name: string, content: string, prop = false) => {
      const attr = prop ? 'property' : 'name';
      let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
      el.setAttribute('content', content);
    };
    setMeta('description', 'Practical thinking guides for writers, students, and knowledge workers. Learn to structure thoughts, beat procrastination, and make clearer decisions.');
    setMeta('og:title', 'Thinking Guides — Papera AI Notebook', true);
    setMeta('og:description', 'Practical thinking guides for writers, students, and knowledge workers.', true);
    setMeta('og:type', 'website', true);
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', 'Thinking Guides — Papera AI Notebook');
    setMeta('twitter:description', 'Practical thinking guides for writers, students, and knowledge workers.');
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await api.get<BlogListResponse>('/api/blog/posts?limit=36');
        if (!cancelled) {
          // Convex is source of truth — use whatever it returns (even empty)
          setPosts(data.posts);
        }
      } catch {
        // True network failure only — fall back to static seed posts
        if (!cancelled) setPosts(DEFAULT_BLOG_POSTS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => ['All', ...uniqueCategories(posts)], [posts]);
  const filteredPosts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return posts.filter((post) => {
      const categoryMatch = activeCategory === 'All' || post.category === activeCategory;
      const queryMatch = !needle || [
        post.title,
        post.excerpt,
        post.mentalState,
        post.category,
        post.tags.join(' '),
      ].join(' ').toLowerCase().includes(needle);
      return categoryMatch && queryMatch;
    });
  }, [activeCategory, posts, query]);

  return (
    <main className="min-h-screen bg-[#f7f2ea] text-stone-950">
      <header className="sticky top-0 z-50 border-b border-stone-200 bg-[#fdfbf7]/[0.92] backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link to="/" aria-label="Papera home">
            <Logo variant="light" size={36} />
          </Link>
          <nav className="flex items-center gap-4 text-sm font-semibold text-stone-600">
            <Link to="/" className="hover:text-emerald-800">Home</Link>
            <Link to="/pricing" className="hidden hover:text-emerald-800 sm:inline">Pricing</Link>
            <Link
              to="/app"
              className="rounded-lg bg-stone-950 px-4 py-2 text-white transition hover:bg-emerald-900"
            >
              Open App
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative border-b border-[#27222a] bg-[#10121b] text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              'radial-gradient(circle at 22% 18%, rgba(217,119,6,0.16), transparent 28%), radial-gradient(circle at 82% 16%, rgba(79,70,229,0.22), transparent 30%), linear-gradient(145deg, #10121b 0%, #181a22 48%, #271d2f 100%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />

        <div className="relative mx-auto max-w-7xl px-5 py-12 lg:py-16">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-indigo-300/25 bg-white/[0.08] px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-indigo-100 backdrop-blur">
              <BookOpen size={14} />
              Papera Blog
            </div>
            <h1 className="font-serif text-5xl font-bold leading-[1.02] tracking-tight text-white md:text-7xl">
              Every idea deserves a page.
              <span className="block italic text-[#d6b17a]">Not a chat window.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Read the guide. Turn the page. Open Papera and keep going — on real paper that thinks back.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <a
                href="#blog-guides"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-bold text-[#10121b] transition hover:bg-[#fdfbf7]"
              >
                Open the book ↓
              </a>
              <Link
                to="/app"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/[0.18] bg-white/[0.08] px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/[0.12]"
              >
                <Sparkles size={16} />
                Start your notebook →
              </Link>
            </div>
            <div className="mx-auto mt-8 grid max-w-xl grid-cols-3 gap-px overflow-hidden rounded-lg border border-white/[0.12] bg-white/[0.12] text-sm">
              {[
                ['Read', 'the guide'],
                ['Turn', 'every page'],
                ['Own', 'your notebook'],
              ].map(([label, value]) => (
                <div key={label} className="bg-[#10121b]/72 p-4 backdrop-blur">
                  <div className="font-semibold text-white">{label}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-slate-400">{value}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      <section id="blog-guides" className="border-y border-stone-200 bg-[#fdfbf7]">
        <div className="mx-auto max-w-7xl px-5 py-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-stone-950">What are you stuck on?</h2>
              <p className="mt-1 text-sm text-stone-600">
                Pick a mental state. Read the guide. Then open Papera and turn the thought into a page.
              </p>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search guides"
                className="w-full rounded-lg border border-stone-300 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100"
              />
            </div>
          </div>

          <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`shrink-0 rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                  activeCategory === category
                    ? 'border-stone-950 bg-stone-950 text-white'
                    : 'border-stone-200 bg-white text-stone-600 hover:border-emerald-700 hover:text-emerald-800'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-4">
            <div>
              <p className="text-sm font-bold text-indigo-900">Every guide has a Papera page waiting.</p>
              <p className="mt-0.5 text-xs text-indigo-600">Read the article. Then open Papera and build the actual structure.</p>
            </div>
            <Link
              to="/app"
              className="shrink-0 rounded-lg bg-indigo-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-indigo-800"
            >
              Open Papera free →
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12">
        {loading && (
          <div className="mb-5 text-sm font-semibold text-stone-500">Loading latest posts...</div>
        )}
        {!loading && filteredPosts.length === 0 && (
          <p className="py-10 text-center text-stone-500">
            {query || activeCategory !== 'All' ? 'No guides match your search.' : 'No guides published yet.'}
          </p>
        )}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredPosts.map((post, index) => (
            <Link
              key={post.slug}
              to={`/blog/${post.slug}`}
              className="group overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-emerald-700 hover:shadow-md"
            >
              <img
                src={post.featuredImageUrl || BLOG_IMAGES[index % BLOG_IMAGES.length]}
                alt=""
                className="h-48 w-full object-cover"
                loading="lazy"
              />
              <div className="p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">
                  <span>{post.category}</span>
                  <span className="text-stone-300">/</span>
                  <span>{post.mentalState}</span>
                </div>
                <h3 className="mt-3 text-2xl font-semibold leading-tight text-stone-950 group-hover:text-emerald-900">
                  {post.title}
                </h3>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-stone-600">{post.excerpt}</p>
                <div className="mt-5 flex items-center justify-between text-sm">
                  <span className="text-stone-500">
                    {formatDate(post.publishedAt)} / {post.readingTimeMinutes} min
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-800">
                    Try in Papera →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
};
