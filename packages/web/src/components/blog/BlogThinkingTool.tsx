import React, { useMemo, useState } from 'react';
import { ArrowRight, Gauge, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { analyzeThoughts, BlogPost } from './blogData';

interface BlogThinkingToolProps {
  post?: Pick<
    BlogPost,
    | 'category'
    | 'mentalState'
    | 'interactivePrompt'
    | 'interactivePlaceholder'
    | 'interactiveOutputTitle'
    | 'productCtaLabel'
    | 'productCtaUrl'
  >;
  compact?: boolean;
}

const DEFAULT_POST = {
  category: 'Thinking',
  mentalState: 'Scattered',
  interactivePrompt: 'Type the thought you want to make visible.',
  interactivePlaceholder:
    "I know what I want to say, but it feels scattered. I keep adding context and I don't know what matters first...",
  interactiveOutputTitle: 'Your thinking structure',
  productCtaLabel: 'Open Papera',
  productCtaUrl: '/app',
};

export const BlogThinkingTool: React.FC<BlogThinkingToolProps> = ({ post, compact = false }) => {
  const resolvedPost = { ...DEFAULT_POST, ...post };
  const [thoughts, setThoughts] = useState('');
  const analysis = useMemo(
    () => analyzeThoughts(thoughts, resolvedPost),
    [thoughts, resolvedPost.category, resolvedPost.mentalState],
  );

  return (
    <section
      className="rounded-lg border border-stone-200 bg-white shadow-sm"
      aria-label="Interactive thinking preview"
    >
      <div className={`grid ${compact ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-[1fr_1.05fr]'} gap-0`}>
        <div className="border-b border-stone-200 p-5 lg:border-b-0 lg:border-r">
          <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
            <Sparkles size={14} />
            Blog as product preview
          </div>
          <label className="block text-xl font-semibold text-stone-950">
            {resolvedPost.interactivePrompt}
          </label>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Content is manual thinking. Papera is automated thinking.
          </p>
          <textarea
            value={thoughts}
            onChange={(event) => setThoughts(event.target.value)}
            placeholder={resolvedPost.interactivePlaceholder}
            className="mt-5 min-h-[190px] w-full resize-y rounded-lg border border-stone-300 bg-[#fdfbf7] p-4 text-base leading-7 text-stone-900 outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div className="p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
                {resolvedPost.interactiveOutputTitle}
              </div>
              <h3 className="mt-1 text-2xl font-semibold text-stone-950">Input to structure</h3>
            </div>
            <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900">
              <Gauge size={17} />
              <span className="text-sm font-bold">{analysis.clarityScore}</span>
            </div>
          </div>

          <div className="space-y-3">
            {analysis.structure.map((item) => (
              <div key={item} className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                <p className="text-sm leading-6 text-stone-800">{item}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-amber-800">
              Next move
            </div>
            <p className="mt-2 text-sm leading-6 text-stone-800">{analysis.nextMove}</p>
          </div>

          <Link
            to={resolvedPost.productCtaUrl}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900"
          >
            {resolvedPost.productCtaLabel}
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
};
