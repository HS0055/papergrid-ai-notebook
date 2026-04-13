import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface BlockTypesBentoProps {
  onLaunch: () => void;
}

export const BlockTypesBento: React.FC<BlockTypesBentoProps> = ({ onLaunch }) => {
  const sectionRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
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

    // Wrap in gsap.context so ctx.revert() kills both tweens AND ScrollTriggers
    // on unmount — prevents React StrictMode double-mount from leaving orphaned
    // ScrollTriggers that cause cards to stay stuck at opacity: 0.
    const ctx = gsap.context(() => {
      const cards = cardRefs.current.filter(Boolean) as HTMLElement[];
      if (cards.length && gridRef.current) {
        gsap.fromTo(
          cards,
          { opacity: 0, y: 28, scale: 0.96 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.55,
            ease: 'power2.out',
            stagger: 0.055,
            scrollTrigger: {
              trigger: gridRef.current,
              start: 'top 78%',
              once: true,
            },
          },
        );
      }
    }, sectionRef);

    return () => {
      ctx.revert();
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
    <section
      ref={sectionRef}
      className="relative py-24 px-6 overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #fdfbf7 0%, #f8f6f3 60%, #fdfbf7 100%)' }}
    >
      {/* Subtle ambient glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[400px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(79,70,229,0.04) 0%, transparent 65%)', filter: 'blur(60px)' }}
      />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="reveal text-center mb-16">
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--color-indigo-brand)', letterSpacing: '0.14em' }}>
            22+ Block Types
          </p>
          <h2
            className="font-serif font-bold mb-4"
            style={{ fontSize: 'clamp(2.2rem, 4vw, 3.5rem)', color: 'var(--color-ink)', lineHeight: 1.15 }}
          >
            Every block. Every thought.{' '}
            <span className="italic" style={{ color: 'var(--color-indigo-brand)' }}>Your way.</span>
          </h2>
          <p className="max-w-xl mx-auto text-lg" style={{ color: '#64748b', lineHeight: 1.7 }}>
            Mix and match content types to create the exact layout your mind needs.
          </p>
        </div>

        {/* Bento Grid */}
        <div ref={gridRef} className="grid grid-cols-2 md:grid-cols-4 gap-4" style={{ gridAutoRows: '1fr' }}>
          {/* Priority Matrix — large 2×2 */}
          <div
            ref={(el) => { cardRefs.current[0] = el; }}
            onMouseEnter={() => handleMouseEnter(0)}
            onMouseLeave={() => handleMouseLeave(0)}
            className="bento-card reveal-scale col-span-2 row-span-2 rounded-3xl overflow-hidden p-6 border border-gray-200/60 shadow-sm transition-shadow relative"
            style={{ background: '#fdfbf7', transitionDelay: '0ms' }}
          >
            <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 font-sans">Priority Matrix</div>
            <div className="grid grid-cols-2 gap-3 h-[calc(100%-40px)]">
              {[
                { label: 'Urgent & Important', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', items: ['Launch iOS beta', 'Fix payment bug', 'App Store response', 'Patch auth timeout'] },
                { label: 'Schedule', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', items: ['Referral program V1', 'Record demo video', 'Hiring spec draft', 'Expand prompt library'] },
                { label: 'Delegate', bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', items: ['Update help docs', 'Social media bio', 'Non-urgent support'] },
                { label: 'Eliminate', bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-500', items: ['Weekly status emails', 'Duplicate Notion pages', 'Legacy feature flags'] },
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
            className="bento-card reveal-scale rounded-3xl overflow-hidden p-5 border border-amber-200/80 shadow-sm transition-shadow relative"
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
            className="bento-card reveal-scale rounded-3xl p-5 border border-indigo-100 shadow-sm transition-shadow relative"
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
            className="bento-card reveal-scale col-span-2 rounded-3xl overflow-hidden border border-emerald-100 shadow-sm transition-shadow relative"
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
            className="bento-card reveal-scale rounded-3xl p-5 border border-indigo-100 shadow-sm transition-shadow relative"
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
            className="bento-card reveal-scale rounded-3xl p-5 border border-rose-100 shadow-sm transition-shadow relative"
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

          {/* Kanban Board — 2-col wide */}
          <div
            ref={(el) => { cardRefs.current[6] = el; }}
            onMouseEnter={() => handleMouseEnter(6)}
            onMouseLeave={() => handleMouseLeave(6)}
            className="bento-card reveal-scale col-span-2 rounded-3xl p-5 border border-violet-100 shadow-sm transition-shadow relative"
            style={{ background: '#faf5ff', transitionDelay: '480ms' }}
          >
            <div className="text-[9px] font-bold uppercase tracking-widest text-violet-500 mb-3 font-sans">Kanban Board</div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'To Do', color: 'bg-gray-100 border-gray-200 text-gray-600', items: ['Research', 'Wireframes'] },
                { label: 'Doing', color: 'bg-amber-100 border-amber-200 text-amber-700', items: ['UI polish'] },
                { label: 'Done', color: 'bg-emerald-100 border-emerald-200 text-emerald-700', items: ['API', 'Auth'] },
              ].map((col, i) => (
                <div key={i} className={`${col.color} border rounded-lg p-2`}>
                  <div className="text-[8px] font-bold uppercase tracking-wider mb-1.5">{col.label}</div>
                  {col.items.map((item, j) => (
                    <div key={j} className="bg-white/70 rounded text-[9px] font-hand text-gray-700 px-1.5 py-1 mb-1 last:mb-0">{item}</div>
                  ))}
                </div>
              ))}
            </div>
            {/* Hover content */}
            <div
              ref={(el) => { contentRefs.current[6] = el; }}
              className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-sm rounded-lg px-3 py-2 border border-violet-200 pointer-events-none"
              style={{ opacity: 0, transform: 'translateY(-10px)' }}
            >
              <div className="text-[10px] font-bold text-violet-600 mb-1" style={{ opacity: 0, transform: 'translateY(-10px)' }}>✓ Drag between columns</div>
              <div className="text-[10px] font-bold text-violet-600" style={{ opacity: 0, transform: 'translateY(-10px)' }}>✓ WIP limits</div>
            </div>
          </div>

          {/* Calendar */}
          <div
            ref={(el) => { cardRefs.current[7] = el; }}
            onMouseEnter={() => handleMouseEnter(7)}
            onMouseLeave={() => handleMouseLeave(7)}
            className="bento-card reveal-scale rounded-3xl p-5 border border-sky-100 shadow-sm transition-shadow relative"
            style={{ background: '#f0f9ff', transitionDelay: '560ms' }}
          >
            <div className="text-[9px] font-bold uppercase tracking-widest text-sky-500 mb-3 font-sans">Calendar</div>
            <div className="text-center mb-2">
              <div className="font-serif text-sm font-bold text-sky-700">March 2026</div>
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {['M','T','W','T','F','S','S'].map((d, i) => (
                <div key={i} className="text-center text-[8px] font-bold text-sky-400">{d}</div>
              ))}
              {Array.from({ length: 14 }).map((_, i) => {
                const hasEvent = [3, 7, 10].includes(i);
                return (
                  <div
                    key={i}
                    className={`text-center text-[8px] aspect-square flex items-center justify-center rounded ${
                      hasEvent ? 'bg-sky-500 text-white font-bold' : 'text-gray-500'
                    }`}
                  >
                    {i + 1}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Habit Tracker */}
          <div
            ref={(el) => { cardRefs.current[8] = el; }}
            onMouseEnter={() => handleMouseEnter(8)}
            onMouseLeave={() => handleMouseLeave(8)}
            className="bento-card reveal-scale rounded-3xl p-5 border border-emerald-100 shadow-sm transition-shadow relative"
            style={{ background: '#f0fdf4', transitionDelay: '640ms' }}
          >
            <div className="text-[9px] font-bold uppercase tracking-widest text-emerald-500 mb-3 font-sans">Habit Tracker</div>
            <div className="space-y-2">
              {[
                { habit: 'Meditate', days: [1, 1, 0, 1, 1, 1, 0] },
                { habit: 'Read', days: [1, 0, 1, 1, 0, 1, 1] },
                { habit: 'Workout', days: [1, 1, 1, 0, 1, 0, 1] },
              ].map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="font-hand text-[10px] text-emerald-700 w-14">{h.habit}</span>
                  <div className="flex gap-0.5 flex-1">
                    {h.days.map((d, j) => (
                      <div
                        key={j}
                        className="flex-1 aspect-square rounded-sm"
                        style={{ background: d ? '#10b981' : 'rgba(16,185,129,0.15)' }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Weekly View — 2-col wide */}
          <div
            ref={(el) => { cardRefs.current[9] = el; }}
            onMouseEnter={() => handleMouseEnter(9)}
            onMouseLeave={() => handleMouseLeave(9)}
            className="bento-card reveal-scale col-span-2 rounded-3xl p-5 border border-indigo-100 shadow-sm transition-shadow relative"
            style={{ background: '#eef2ff', transitionDelay: '720ms' }}
          >
            <div className="text-[9px] font-bold uppercase tracking-widest text-indigo-500 mb-3 font-sans">Weekly View</div>
            <div className="grid grid-cols-7 gap-1.5">
              {[
                { day: 'Mon', blocks: [{ color: '#818cf8', h: 18 }, { color: '#fbbf24', h: 10 }] },
                { day: 'Tue', blocks: [{ color: '#34d399', h: 12 }, { color: '#818cf8', h: 20 }] },
                { day: 'Wed', blocks: [{ color: '#818cf8', h: 28 }] },
                { day: 'Thu', blocks: [{ color: '#f87171', h: 10 }, { color: '#34d399', h: 14 }] },
                { day: 'Fri', blocks: [{ color: '#818cf8', h: 18 }, { color: '#fbbf24', h: 8 }] },
                { day: 'Sat', blocks: [{ color: '#c4b5fd', h: 8 }] },
                { day: 'Sun', blocks: [] },
              ].map(({ day, blocks }, i) => (
                <div
                  key={i}
                  className="rounded-lg p-1.5 min-h-[60px]"
                  style={{
                    background: i < 5 ? 'rgba(255,255,255,0.8)' : 'rgba(79,70,229,0.05)',
                    border: '1px solid rgba(79,70,229,0.1)',
                  }}
                >
                  <div className="text-[7px] font-bold text-indigo-400 uppercase tracking-wider mb-1">{day}</div>
                  <div className="flex flex-col gap-0.5">
                    {blocks.map((b, j) => (
                      <div key={j} className="w-full rounded-sm" style={{ background: b.color, height: `${b.h / 2}px`, opacity: 0.75 }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {/* Hover content */}
            <div
              ref={(el) => { contentRefs.current[9] = el; }}
              className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-sm rounded-lg px-3 py-2 border border-indigo-200 pointer-events-none"
              style={{ opacity: 0, transform: 'translateY(-10px)' }}
            >
              <div className="text-[10px] font-bold text-indigo-600 mb-1" style={{ opacity: 0, transform: 'translateY(-10px)' }}>✓ Color-coded time blocks</div>
              <div className="text-[10px] font-bold text-indigo-600" style={{ opacity: 0, transform: 'translateY(-10px)' }}>✓ Time estimates</div>
            </div>
          </div>

          {/* Music Staff */}
          <div
            ref={(el) => { cardRefs.current[10] = el; }}
            onMouseEnter={() => handleMouseEnter(10)}
            onMouseLeave={() => handleMouseLeave(10)}
            className="bento-card reveal-scale rounded-3xl p-5 border border-slate-200 shadow-sm transition-shadow relative"
            style={{ background: '#fdfbf7', transitionDelay: '800ms' }}
          >
            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-3 font-sans">Music Staff</div>
            <svg viewBox="0 0 200 60" className="w-full h-16">
              {[0, 1, 2, 3, 4].map((i) => (
                <line key={i} x1="0" y1={10 + i * 10} x2="200" y2={10 + i * 10} stroke="#1e293b" strokeWidth="0.8" />
              ))}
              <text x="4" y="38" fontSize="32" fill="#1e293b" fontFamily="serif">𝄞</text>
              {[
                { x: 50, y: 30 },
                { x: 75, y: 20 },
                { x: 100, y: 25 },
                { x: 125, y: 15 },
                { x: 150, y: 30 },
              ].map((n, i) => (
                <ellipse key={i} cx={n.x} cy={n.y} rx="4" ry="3" fill="#1e293b" />
              ))}
            </svg>
          </div>

          {/* Time Block */}
          <div
            ref={(el) => { cardRefs.current[11] = el; }}
            onMouseEnter={() => handleMouseEnter(11)}
            onMouseLeave={() => handleMouseLeave(11)}
            className="bento-card reveal-scale rounded-3xl p-5 border border-amber-100 shadow-sm transition-shadow relative"
            style={{ background: '#fffbeb', transitionDelay: '880ms' }}
          >
            <div className="text-[9px] font-bold uppercase tracking-widest text-amber-500 mb-3 font-sans">Time Blocks</div>
            <div className="space-y-1">
              {[
                { time: '9:00', block: 'Deep work', color: 'bg-indigo-200' },
                { time: '11:00', block: 'Meetings', color: 'bg-amber-200' },
                { time: '14:00', block: 'Writing', color: 'bg-emerald-200' },
                { time: '16:00', block: 'Email', color: 'bg-slate-200' },
              ].map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="font-mono text-[9px] text-amber-700 w-8">{b.time}</span>
                  <div className={`flex-1 h-4 rounded ${b.color} flex items-center px-2`}>
                    <span className="font-hand text-[9px] text-gray-700">{b.block}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Water Tracker */}
          <div
            ref={(el) => { cardRefs.current[12] = el; }}
            onMouseEnter={() => handleMouseEnter(12)}
            onMouseLeave={() => handleMouseLeave(12)}
            className="bento-card reveal-scale rounded-3xl p-5 border border-cyan-100 shadow-sm transition-shadow relative"
            style={{ background: '#ecfeff', transitionDelay: '960ms' }}
          >
            <div className="text-[9px] font-bold uppercase tracking-widest text-cyan-500 mb-3 font-sans">Water Tracker</div>
            <div className="flex justify-between items-end">
              {[1, 1, 1, 1, 1, 0, 0, 0].map((filled, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div
                    className="w-4 h-6 rounded-sm border-2"
                    style={{
                      borderColor: '#06b6d4',
                      background: filled ? 'linear-gradient(to top, #06b6d4 60%, #67e8f9 100%)' : 'transparent',
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="text-[10px] text-cyan-700 font-hand mt-2 text-center">5 of 8 glasses</div>
          </div>

          {/* Goal Section */}
          <div
            ref={(el) => { cardRefs.current[13] = el; }}
            onMouseEnter={() => handleMouseEnter(13)}
            onMouseLeave={() => handleMouseLeave(13)}
            className="bento-card reveal-scale rounded-3xl p-5 border border-pink-100 shadow-sm transition-shadow relative"
            style={{ background: '#fdf2f8', transitionDelay: '1040ms' }}
          >
            <div className="text-[9px] font-bold uppercase tracking-widest text-pink-500 mb-3 font-sans">Goals</div>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-hand text-xs text-pink-800 font-bold">Read 20 books</span>
                  <span className="text-[9px] text-pink-600">12/20</span>
                </div>
                <div className="h-1.5 bg-pink-100 rounded-full overflow-hidden">
                  <div className="h-full bg-pink-500 rounded-full" style={{ width: '60%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-hand text-xs text-pink-800 font-bold">Run 500 miles</span>
                  <span className="text-[9px] text-pink-600">340/500</span>
                </div>
                <div className="h-1.5 bg-pink-100 rounded-full overflow-hidden">
                  <div className="h-full bg-pink-500 rounded-full" style={{ width: '68%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* More blocks note */}
        <div className="text-center mt-8 mb-4">
          <p className="text-sm font-medium" style={{ color: '#64748b' }}>
            Plus 8 more: Cornell Notes · Index · Rating · Progress Bar · Divider · Section Nav · Daily Sections · Sketch
          </p>
        </div>

        {/* CTA */}
        <div className="reveal text-center mt-12">
          <button
            onClick={onLaunch}
            className="inline-flex items-center gap-2 px-8 py-3.5 font-bold text-white rounded-xl transition-all hover:opacity-90"
            style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              boxShadow: '0 8px 28px rgba(79,70,229,0.3)',
            }}
          >
            Start building — it's free →
          </button>
        </div>
      </div>
    </section>
  );
};
