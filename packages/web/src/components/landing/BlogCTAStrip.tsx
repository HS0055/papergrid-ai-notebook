import React from 'react';
import { BookOpen, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PUBLIC_BLOG_ENABLED } from '../../config/featureFlags';

export const BlogCTAStrip: React.FC = () => {
  if (!PUBLIC_BLOG_ENABLED) return null;

  return (
    <section className="relative py-16 px-6" style={{ background: '#fdfbf7', borderTop: '1px solid #e7e5e4' }}>
      <div className="mx-auto max-w-4xl text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold uppercase tracking-widest text-emerald-800">
          <BookOpen size={14} />
          Thinking Guides
        </div>
        <h2 className="font-serif text-3xl font-bold tracking-tight text-stone-950 md:text-4xl">
          Stuck? Read the guide. Then build the page.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-stone-500">
          Practical guides for procrastination, decision paralysis, planning overload, and more.
          Each one ends with a Papera page you can use right away.
        </p>
        <Link
          to="/blog"
          className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-stone-950 px-7 py-4 text-sm font-bold text-white transition-all hover:bg-emerald-900"
        >
          Read the guides
          <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </section>
  );
};
