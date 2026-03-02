import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';

interface BlockTypesBentoProps {
  onLaunch: () => void;
}

export const BlockTypesBento: React.FC<BlockTypesBentoProps> = ({ onLaunch }) => {
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const contentRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Detect if device supports hover
  const supportsHover = useRef(true);

  useEffect(() => {
    supportsHover.current = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    // Show content always on touch devices
    if (!supportsHover.current) {
      contentRefs.current.forEach((content) => {
        if (content) {
          gsap.set(content, { opacity: 1, y: 0 });
        }
      });
    }

    return () => {
      // Kill all tweens on unmount
      cardRefs.current.forEach((card) => {
        if (card) gsap.killTweensOf(card);
      });
      contentRefs.current.forEach((content) => {
        if (content) gsap.killTweensOf(content);
      });
    };
  }, []);

  const handleMouseEnter = (cardIndex: number) => {
    if (!supportsHover.current) return;

    const card = cardRefs.current[cardIndex];
    const content = contentRefs.current[cardIndex];

    if (card) {
      gsap.killTweensOf(card);
      gsap.to(card, {
        scale: 1.02,
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        duration: 0.3,
        ease: 'power2.out'
      });
    }

    if (content) {
      const children = content.children;
      gsap.killTweensOf(content);
      gsap.killTweensOf(children);
      gsap.to(content, {
        opacity: 1,
        y: 0,
        duration: 0.3,
        ease: 'power2.out'
      });
      gsap.to(children, {
        opacity: 1,
        y: 0,
        stagger: 0.05,
        duration: 0.4,
        ease: 'power2.out'
      });
    }
  };

  const handleMouseLeave = (cardIndex: number) => {
    if (!supportsHover.current) return;

    const card = cardRefs.current[cardIndex];
    const content = contentRefs.current[cardIndex];

    if (card) {
      gsap.killTweensOf(card);
      gsap.to(card, {
        scale: 1,
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        duration: 0.3,
        ease: 'power2.out'
      });
    }

    if (content) {
      const children = content.children;
      gsap.killTweensOf(content);
      gsap.killTweensOf(children);
      gsap.to(children, {
        opacity: 0,
        y: -10,
        stagger: 0.02,
        duration: 0.2,
        ease: 'power2.in'
      });
      gsap.to(content, {
        opacity: 0,
        y: -10,
        duration: 0.2,
        delay: 0.1,
        ease: 'power2.in'
      });
    }
  };

  return (
    <section className="py-24 px-6" style={{ background: '#ffffff' }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="reveal text-center mb-16">
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--color-indigo-brand)' }}>
            12 Block Types
          </p>
          <h2
            className="font-serif font-bold mb-4"
            style={{ fontSize: 'clamp(2.2rem, 4vw, 3.5rem)', color: 'var(--color-ink)', lineHeight: 1.15 }}
          >
            Every block. Every thought.{' '}
            <span className="italic" style={{ color: 'var(--color-indigo-brand)' }}>Your way.</span>
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto text-lg">
            Mix and match content types to create the exact layout your mind needs.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 auto-rows-min">
          {/* Priority Matrix — large 2×2 */}
          <div
            ref={(el) => { cardRefs.current[0] = el; }}
            onMouseEnter={() => handleMouseEnter(0)}
            onMouseLeave={() => handleMouseLeave(0)}
            className="reveal-scale col-span-2 row-span-2 rounded-3xl overflow-hidden p-6 border border-gray-200/60 shadow-sm transition-shadow relative"
            style={{ background: '#fdfbf7', transitionDelay: '0ms' }}
          >
            <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 font-sans">Priority Matrix</div>
            <div className="grid grid-cols-2 gap-3 h-[calc(100%-40px)]">
              {[
                { label: 'Urgent & Important', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', items: ['Launch MVP', 'Fix critical bug'] },
                { label: 'Schedule', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', items: ['Write blog post', 'Update roadmap'] },
                { label: 'Delegate', bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', items: ['Update docs'] },
                { label: 'Eliminate', bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-500', items: ['Old meeting notes'] },
              ].map((q, i) => (
                <div key={i} className={`${q.bg} border ${q.border} rounded-xl p-3 flex flex-col`}>
                  <div className={`text-[9px] font-bold uppercase tracking-widest ${q.text} mb-2`}>{q.label}</div>
                  {q.items.map(item => (
                    <div key={item} className="font-hand text-sm text-gray-700">• {item}</div>
                  ))}
                </div>
              ))}
            </div>
            {/* Hover content */}
            <div
              ref={(el) => { contentRefs.current[0] = el; }}
              className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg px-3 py-2 border border-gray-200 pointer-events-none"
              style={{ opacity: 0, transform: 'translateY(-10px)' }}
            >
              <div className="text-[10px] font-bold text-indigo-600 mb-1" style={{ opacity: 0, transform: 'translateY(-10px)' }}>✓ Drag & drop tasks</div>
              <div className="text-[10px] font-bold text-indigo-600" style={{ opacity: 0, transform: 'translateY(-10px)' }}>✓ Auto-prioritize</div>
            </div>
          </div>

          {/* Callout Sticky */}
          <div
            ref={(el) => { cardRefs.current[1] = el; }}
            onMouseEnter={() => handleMouseEnter(1)}
            onMouseLeave={() => handleMouseLeave(1)}
            className="reveal-scale rounded-3xl overflow-hidden p-5 border border-amber-200/80 shadow-sm transition-shadow relative"
            style={{ background: '#fef3c7', transitionDelay: '80ms' }}
          >
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-12 h-5 rounded-sm" style={{ background: 'rgba(217,119,6,0.45)' }} />
            <div className="absolute bottom-0 right-0 w-6 h-6 bg-amber-100 rounded-tl-xl" />
            <div className="text-[9px] font-bold uppercase tracking-widest text-amber-600 mb-3 font-sans">Sticky Callout</div>
            <p className="font-hand text-base text-amber-800 leading-relaxed">
              "Don't forget to review the design system before the sprint review!"
            </p>
            {/* Hover content */}
            <div
              ref={(el) => { contentRefs.current[1] = el; }}
              className="mt-3 space-y-1 pointer-events-none"
              style={{ opacity: 0, transform: 'translateY(-10px)' }}
            >
              <div className="text-[10px] text-amber-700 font-hand" style={{ opacity: 0, transform: 'translateY(-10px)' }}>📌 Pin to top</div>
              <div className="text-[10px] text-amber-700 font-hand" style={{ opacity: 0, transform: 'translateY(-10px)' }}>🎨 6 sticky colors</div>
              <div className="text-[10px] text-amber-700 font-hand" style={{ opacity: 0, transform: 'translateY(-10px)' }}>✏️ Quick capture</div>
            </div>
          </div>

          {/* Mood Tracker */}
          <div
            ref={(el) => { cardRefs.current[2] = el; }}
            onMouseEnter={() => handleMouseEnter(2)}
            onMouseLeave={() => handleMouseLeave(2)}
            className="reveal-scale rounded-3xl p-5 border border-indigo-100 shadow-sm transition-shadow relative"
            style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #fdf4ff 100%)', transitionDelay: '160ms' }}
          >
            <div className="text-[9px] font-bold uppercase tracking-widest text-indigo-500 mb-4 font-sans">Mood Tracker</div>
            <div className="flex justify-between items-center">
              {['😢', '😕', '😐', '🙂', '😄'].map((e, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span className={`text-2xl transition-all ${i === 3 ? 'scale-130 drop-shadow-sm' : 'opacity-40 grayscale'}`}>{e}</span>
                  <div className="w-1 h-1 rounded-full" style={{ background: i === 3 ? '#818cf8' : 'transparent' }} />
                </div>
              ))}
            </div>
            {/* Hover content */}
            <div
              ref={(el) => { contentRefs.current[2] = el; }}
              className="mt-4 space-y-1 pointer-events-none"
              style={{ opacity: 0, transform: 'translateY(-10px)' }}
            >
              <div className="text-[9px] text-indigo-600 font-sans" style={{ opacity: 0, transform: 'translateY(-10px)' }}>✓ Track daily moods</div>
              <div className="text-[9px] text-indigo-600 font-sans" style={{ opacity: 0, transform: 'translateY(-10px)' }}>✓ Visualize patterns</div>
              <div className="text-[9px] text-indigo-600 font-sans" style={{ opacity: 0, transform: 'translateY(-10px)' }}>✓ Add journal notes</div>
            </div>
          </div>

          {/* Data Grid / Table */}
          <div
            ref={(el) => { cardRefs.current[3] = el; }}
            onMouseEnter={() => handleMouseEnter(3)}
            onMouseLeave={() => handleMouseLeave(3)}
            className="reveal-scale col-span-2 rounded-3xl overflow-hidden border border-emerald-100 shadow-sm transition-shadow relative"
            style={{ background: '#f0fdf4', transitionDelay: '240ms' }}
          >
            <div className="px-5 pt-5 pb-2">
              <div className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 mb-3 font-sans">Data Grid</div>
            </div>
            <div className="overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-emerald-100/80 border-y border-emerald-200">
                    {['Project', 'Deadline', 'Status'].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-bold text-emerald-700 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Landing Page Redesign', 'Mar 5', '🟢 Active'],
                    ['API Integration', 'Mar 12', '🟡 In Progress'],
                    ['User Research', 'Mar 20', '⚪ Planned'],
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-emerald-100 last:border-none">
                      {row.map((cell, j) => (
                        <td key={j} className="px-4 py-2 font-hand text-gray-700 text-sm">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Hover content */}
            <div
              ref={(el) => { contentRefs.current[3] = el; }}
              className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-sm rounded-lg px-3 py-2 border border-emerald-200 pointer-events-none"
              style={{ opacity: 0, transform: 'translateY(-10px)' }}
            >
              <div className="text-[10px] font-bold text-emerald-600 mb-1" style={{ opacity: 0, transform: 'translateY(-10px)' }}>✓ Sort & filter</div>
              <div className="text-[10px] font-bold text-emerald-600 mb-1" style={{ opacity: 0, transform: 'translateY(-10px)' }}>✓ Export to CSV</div>
              <div className="text-[10px] font-bold text-emerald-600" style={{ opacity: 0, transform: 'translateY(-10px)' }}>✓ Add formulas</div>
            </div>
          </div>

          {/* Pull Quote */}
          <div
            ref={(el) => { cardRefs.current[4] = el; }}
            onMouseEnter={() => handleMouseEnter(4)}
            onMouseLeave={() => handleMouseLeave(4)}
            className="reveal-scale rounded-3xl p-5 border border-indigo-100 shadow-sm transition-shadow relative"
            style={{ background: '#fdfbf7', transitionDelay: '320ms' }}
          >
            <div className="text-[9px] font-bold uppercase tracking-widest text-indigo-400 mb-3 font-sans">Pull Quote</div>
            <div className="border-l-4 border-indigo-300 pl-4">
              <p className="font-serif text-lg italic text-gray-700 leading-relaxed">"Clarity of thought begins with clarity of page."</p>
            </div>
            {/* Hover content */}
            <div
              ref={(el) => { contentRefs.current[4] = el; }}
              className="mt-4 space-y-1 pointer-events-none"
              style={{ opacity: 0, transform: 'translateY(-10px)' }}
            >
              <div className="text-[9px] text-indigo-500 font-sans italic" style={{ opacity: 0, transform: 'translateY(-10px)' }}>✓ Highlight key insights</div>
              <div className="text-[9px] text-indigo-500 font-sans italic" style={{ opacity: 0, transform: 'translateY(-10px)' }}>✓ Custom border styles</div>
              <div className="text-[9px] text-indigo-500 font-sans italic" style={{ opacity: 0, transform: 'translateY(-10px)' }}>✓ Attribution support</div>
            </div>
          </div>

          {/* Task List */}
          <div
            ref={(el) => { cardRefs.current[5] = el; }}
            onMouseEnter={() => handleMouseEnter(5)}
            onMouseLeave={() => handleMouseLeave(5)}
            className="reveal-scale rounded-3xl p-5 border border-rose-100 shadow-sm transition-shadow relative"
            style={{ background: '#fff7f7', transitionDelay: '400ms' }}
          >
            <div className="text-[9px] font-bold uppercase tracking-widest text-rose-400 mb-3 font-sans">Task List</div>
            <div className="space-y-2">
              {[
                { text: 'Review mockups', done: true },
                { text: 'Push to staging', done: true },
                { text: 'Write release notes', done: false },
                { text: 'Ship to production', done: false },
              ].map((task, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center"
                    style={{ borderColor: task.done ? '#f87171' : '#fca5a5', background: task.done ? '#f87171' : 'transparent' }}
                  >
                    {task.done && <span className="text-white text-[9px] font-bold">✓</span>}
                  </div>
                  <span className={`font-hand text-sm ${task.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>{task.text}</span>
                </div>
              ))}
            </div>
            {/* Hover content */}
            <div
              ref={(el) => { contentRefs.current[5] = el; }}
              className="mt-3 space-y-1 pointer-events-none"
              style={{ opacity: 0, transform: 'translateY(-10px)' }}
            >
              <div className="text-[9px] text-rose-500 font-sans" style={{ opacity: 0, transform: 'translateY(-10px)' }}>✓ Nested subtasks</div>
              <div className="text-[9px] text-rose-500 font-sans" style={{ opacity: 0, transform: 'translateY(-10px)' }}>✓ Due dates & reminders</div>
              <div className="text-[9px] text-rose-500 font-sans" style={{ opacity: 0, transform: 'translateY(-10px)' }}>✓ Priority levels</div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="reveal text-center mt-12">
          <button
            onClick={onLaunch}
            className="px-8 py-3.5 font-bold text-white rounded-xl transition-all hover:opacity-90"
            style={{ background: 'var(--color-indigo-brand)' }}
          >
            Build your own layout →
          </button>
        </div>
      </div>
    </section>
  );
};
