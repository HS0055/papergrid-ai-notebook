import React, { useState, useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface PaperStyle {
  id: string;
  label: string;
  cssClass: string;
  tagline: string;
  bestFor: string;
  accent: string;
  /** Real planner content overlaid on the actual paper texture */
  content: React.ReactNode;
}

/**
 * 6 essential paper textures showcased on the landing page.
 * (Isometric, Hex, Shaded Rows, Crumpled exist in-app but are not surfaced here.)
 */
const paperStyles: PaperStyle[] = [
  {
    id: 'lined',
    label: 'Lined',
    cssClass: 'paper-lines',
    tagline: 'Classic ruled lines',
    bestFor: 'Journaling · letters · reflection',
    accent: '#4f46e5',
    content: (
      <div className="font-hand text-gray-800 px-8 pt-8" style={{ fontSize: '18px', lineHeight: '32px' }}>
        <div><span className="font-bold text-indigo-700">March 28, 2026</span></div>
        <div>Today I'm grateful for —</div>
        <div>1. Quiet morning coffee ☕</div>
        <div>2. The sprint review went well</div>
        <div>3. Rain on the window</div>
        <div>4. Mom's phone call</div>
        <div className="italic text-indigo-600">"Small things, big heart."</div>
        <div>Tomorrow: walk at 6am.</div>
      </div>
    ),
  },
  {
    id: 'grid',
    label: 'Grid',
    cssClass: 'paper-grid',
    tagline: 'Squares for structure',
    bestFor: 'Planning · engineering · sketching',
    accent: '#0ea5e9',
    content: (
      <div className="px-6 pt-6">
        <div className="font-hand text-sky-700 font-bold text-xl mb-1">Sprint 24</div>
        <div className="font-hand text-xs text-gray-500 mb-3">Week of March 25</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="border-2 border-rose-400 rounded p-2 bg-white/50">
            <div className="text-[9px] font-bold text-rose-600 uppercase mb-1">Urgent · Important</div>
            <div className="font-hand text-[12px] text-gray-700">· Ship landing v2</div>
            <div className="font-hand text-[12px] text-gray-700">· Fix auth bug</div>
          </div>
          <div className="border-2 border-amber-400 rounded p-2 bg-white/50">
            <div className="text-[9px] font-bold text-amber-600 uppercase mb-1">Schedule</div>
            <div className="font-hand text-[12px] text-gray-700">· API refactor</div>
            <div className="font-hand text-[12px] text-gray-700">· Doc rewrite</div>
          </div>
          <div className="border-2 border-sky-400 rounded p-2 bg-white/50">
            <div className="text-[9px] font-bold text-sky-600 uppercase mb-1">Delegate</div>
            <div className="font-hand text-[12px] text-gray-700">· Icons → design</div>
          </div>
          <div className="border-2 border-gray-300 rounded p-2 bg-white/50">
            <div className="text-[9px] font-bold text-gray-500 uppercase mb-1">Drop</div>
            <div className="font-hand text-[12px] text-gray-500 line-through">Legacy tests</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'dotted',
    label: 'Dotted',
    cssClass: 'paper-dots',
    tagline: 'Subtle dots for freedom',
    bestFor: 'Bullet journaling · sketching',
    accent: '#d97706',
    content: (
      <div className="px-8 pt-6">
        <div className="font-hand text-amber-800 font-bold text-2xl mb-1">January Goals ✦</div>
        <div className="font-hand text-amber-600 text-xs mb-3">~ habits & vibes ~</div>
        <div className="space-y-1.5 mb-3">
          {[
            { habit: '💧 Water', days: [1, 1, 1, 0, 1, 1, 1] },
            { habit: '📖 Read', days: [1, 1, 0, 1, 1, 0, 1] },
            { habit: '🚶 Walk', days: [1, 1, 1, 1, 1, 1, 0] },
            { habit: '🧘 Meditate', days: [0, 1, 1, 0, 1, 1, 1] },
          ].map((h) => (
            <div key={h.habit} className="flex items-center gap-2">
              <span className="font-hand text-[12px] text-amber-700 w-16 shrink-0">{h.habit}</span>
              <div className="flex gap-1 flex-1">
                {h.days.map((d, j) => (
                  <div
                    key={j}
                    className="flex-1 h-3 rounded-sm border border-amber-400"
                    style={{ background: d ? '#d97706' : 'transparent' }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="font-hand text-[13px] text-gray-700">
          <div>• Read 20 pages daily</div>
          <div>○ Learn watercolor</div>
          <div className="text-amber-600">→ Sunday reflection</div>
        </div>
      </div>
    ),
  },
  {
    id: 'music',
    label: 'Music',
    cssClass: 'paper-music',
    tagline: 'Staff lines for composition',
    bestFor: 'Songwriting · music education',
    accent: '#8b6f4e',
    content: (
      <div className="px-6 pt-6">
        <div className="font-serif text-stone-800 font-bold text-base mb-0.5">Étude No. 3</div>
        <div className="font-serif text-stone-600 italic text-[10px] mb-4">in C major · ♩ = 96</div>
        <div className="space-y-3">
          <svg viewBox="0 0 280 50" className="w-full">
            <text x="3" y="34" fontSize="32" fill="#1e293b" fontFamily="serif">𝄞</text>
            <text x="32" y="22" fontSize="13" fontWeight="bold" fill="#1e293b">4</text>
            <text x="32" y="36" fontSize="13" fontWeight="bold" fill="#1e293b">4</text>
            {[
              { x: 50, y: 32 }, { x: 68, y: 28 }, { x: 86, y: 24 }, { x: 104, y: 28 },
              { x: 128, y: 32 }, { x: 146, y: 36 }, { x: 164, y: 32 }, { x: 182, y: 28 },
              { x: 206, y: 24 }, { x: 224, y: 20 }, { x: 242, y: 24 }, { x: 260, y: 28 },
            ].map((n, i) => (
              <g key={i}>
                <ellipse cx={n.x} cy={n.y} rx="3.5" ry="2.8" fill="#1e293b" transform={`rotate(-20 ${n.x} ${n.y})`} />
                <line x1={n.x + 3} y1={n.y} x2={n.x + 3} y2={n.y - 16} stroke="#1e293b" strokeWidth="1" />
              </g>
            ))}
            <line x1="120" y1="6" x2="120" y2="40" stroke="#1e293b" strokeWidth="0.8" />
            <line x1="200" y1="6" x2="200" y2="40" stroke="#1e293b" strokeWidth="0.8" />
          </svg>
          <svg viewBox="0 0 280 50" className="w-full">
            <text x="3" y="34" fontSize="32" fill="#1e293b" fontFamily="serif">𝄞</text>
            {[
              { x: 40, y: 24 }, { x: 58, y: 28 }, { x: 76, y: 32 }, { x: 94, y: 28 },
              { x: 118, y: 24 }, { x: 136, y: 20 }, { x: 154, y: 24 }, { x: 172, y: 28 },
              { x: 196, y: 32 }, { x: 214, y: 28 }, { x: 232, y: 24 }, { x: 250, y: 28 },
            ].map((n, i) => (
              <g key={i}>
                <ellipse cx={n.x} cy={n.y} rx="3.5" ry="2.8" fill="#1e293b" transform={`rotate(-20 ${n.x} ${n.y})`} />
                <line x1={n.x + 3} y1={n.y} x2={n.x + 3} y2={n.y - 16} stroke="#1e293b" strokeWidth="1" />
              </g>
            ))}
            <line x1="110" y1="6" x2="110" y2="40" stroke="#1e293b" strokeWidth="0.8" />
            <line x1="275" y1="6" x2="275" y2="40" stroke="#1e293b" strokeWidth="2" />
          </svg>
        </div>
        <div className="font-serif italic text-[10px] text-stone-600 mt-3">— con espressione</div>
      </div>
    ),
  },
  {
    id: 'legal',
    label: 'Legal Pad',
    cssClass: 'paper-legal',
    tagline: 'Yellow pad with red margin',
    bestFor: 'Legal notes · meetings',
    accent: '#92400e',
    content: (
      <div className="font-hand text-amber-900 pt-6" style={{ paddingLeft: '70px', paddingRight: '24px', fontSize: '17px', lineHeight: '32px' }}>
        <div className="font-bold">Case 2026-CV-042</div>
        <div className="text-sm">Smith v. Johnson Co.</div>
        <div className="font-bold">Key arguments:</div>
        <div>1. Breach §4.2</div>
        <div>2. Failed delivery 3/15</div>
        <div>3. Damages $47,500</div>
        <div className="font-bold">Action items:</div>
        <div>☐ File motion Fri</div>
        <div>☑ Email witness list</div>
      </div>
    ),
  },
  {
    id: 'blank',
    label: 'Blank',
    cssClass: 'bg-paper',
    tagline: 'Clean slate',
    bestFor: 'Sketching · mind mapping',
    accent: '#64748b',
    content: (
      <div className="px-6 pt-6">
        <div className="font-hand text-slate-700 font-bold text-base mb-2">Mind map · Launch</div>
        <svg viewBox="0 0 280 230" className="w-full">
          <circle cx="140" cy="115" r="32" fill="rgba(79,70,229,0.12)" stroke="#4f46e5" strokeWidth="1.6" />
          <text x="140" y="120" fontSize="13" fill="#4f46e5" fontFamily="serif" fontWeight="bold" textAnchor="middle">Launch</text>
          {[
            { x: 50, y: 35, label: 'Marketing', color: '#d97706' },
            { x: 230, y: 35, label: 'Product', color: '#059669' },
            { x: 50, y: 195, label: 'Support', color: '#0ea5e9' },
            { x: 230, y: 195, label: 'Legal', color: '#7c3aed' },
          ].map((b, i) => (
            <g key={i}>
              <line x1="140" y1="115" x2={b.x} y2={b.y} stroke={b.color} strokeWidth="1.5" strokeDasharray="4,3" />
              <circle cx={b.x} cy={b.y} r="26" fill={`${b.color}1a`} stroke={b.color} strokeWidth="1.5" />
              <text x={b.x} y={b.y + 3} fontSize="10" fill={b.color} fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">{b.label}</text>
            </g>
          ))}
        </svg>
      </div>
    ),
  },
];

interface PaperStylesSectionProps {
  onLaunch: () => void;
}

export const PaperStylesSection: React.FC<PaperStylesSectionProps> = ({ onLaunch }) => {
  const [selected, setSelected] = useState('lined');
  const [isFlipping, setIsFlipping] = useState(false);
  const selectedStyle = paperStyles.find((p) => p.id === selected)!;
  const sectionRef = useRef<HTMLElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      const tiles = sectionRef.current!.querySelectorAll('.paper-tile');
      gsap.fromTo(
        Array.from(tiles),
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          stagger: 0.05,
          ease: 'power2.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 80%', once: true },
        },
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  const handleSelect = (id: string) => {
    if (id === selected || isFlipping) return;
    setIsFlipping(true);
    if (pageRef.current) {
      gsap
        .timeline({ onComplete: () => setIsFlipping(false) })
        .to(pageRef.current, { rotateY: -8, scale: 0.97, opacity: 0.3, duration: 0.25, ease: 'power2.in' })
        .call(() => setSelected(id))
        .set(pageRef.current, { rotateY: 8 })
        .to(pageRef.current, { rotateY: 0, scale: 1, opacity: 1, duration: 0.4, ease: 'power3.out' });
    } else {
      setSelected(id);
      setIsFlipping(false);
    }
  };

  return (
    <section
      id="paper-styles"
      ref={sectionRef}
      className="relative py-28 px-6 overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #f8f6f3 0%, #fdfbf7 50%, #f4f0ec 100%)' }}
    >
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[500px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(79,70,229,0.06) 0%, transparent 70%)', filter: 'blur(60px)' }}
      />

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-14">
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--color-indigo-brand)' }}>
            6 Paper Textures
          </p>
          <h2
            className="font-serif font-bold mb-4"
            style={{ fontSize: 'clamp(2.2rem, 4vw, 3.8rem)', color: 'var(--color-ink)', lineHeight: 1.1 }}
          >
            Pick the paper.{' '}
            <span className="italic" style={{ color: 'var(--color-indigo-brand)' }}>Set the mood.</span>
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto text-lg">
            Real CSS textures with the exact same lines, dots, and grids you get inside the app.
          </p>
        </div>

        {/* Notebook page preview */}
        <div className="mb-10" style={{ perspective: '1500px' }}>
          <div
            ref={pageRef}
            className="relative mx-auto rounded-2xl overflow-hidden"
            style={{
              maxWidth: '720px',
              aspectRatio: '4/3',
              boxShadow: '0 30px 80px rgba(0,0,0,0.18), 0 10px 30px rgba(0,0,0,0.08)',
              transformStyle: 'preserve-3d',
              transition: 'transform 0.3s ease-out',
            }}
          >
            <div
              className={selectedStyle.cssClass}
              style={{
                position: 'absolute',
                inset: 0,
                backgroundAttachment: 'local',
                border: '1px solid rgba(0,0,0,0.06)',
                borderRadius: '16px',
              }}
            >
              {selectedStyle.content}
            </div>
            {/* Bookmark ribbon */}
            <div
              className="absolute top-0 right-10 w-2.5 z-10 pointer-events-none"
              style={{
                height: '70%',
                background: `linear-gradient(180deg, ${selectedStyle.accent} 0%, ${selectedStyle.accent}cc 100%)`,
                boxShadow: '1px 0 3px rgba(0,0,0,0.25)',
                clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 88%, 0 100%)',
              }}
            />
          </div>

          <div className="text-center mt-6">
            <p className="font-serif text-2xl font-bold mb-1" style={{ color: 'var(--color-ink)' }}>
              {selectedStyle.label}
            </p>
            <p className="text-sm" style={{ color: '#64748b' }}>
              {selectedStyle.tagline} · <span style={{ color: selectedStyle.accent }}>{selectedStyle.bestFor}</span>
            </p>
          </div>
        </div>

        {/* Paper tile selectors */}
        <div className="flex flex-wrap justify-center gap-3 mb-12 max-w-3xl mx-auto">
          {paperStyles.map((style) => {
            const isActive = selected === style.id;
            return (
              <button
                key={style.id}
                onClick={() => handleSelect(style.id)}
                className={`paper-tile group relative rounded-xl overflow-hidden transition-all duration-300 ${
                  isActive
                    ? 'ring-2 ring-offset-2 shadow-xl scale-105'
                    : 'ring-1 ring-gray-200 hover:-translate-y-1 hover:shadow-md'
                }`}
                style={{
                  width: '110px',
                  height: '140px',
                  ...(isActive && {
                    '--tw-ring-color': style.accent,
                    '--tw-ring-offset-color': '#fdfbf7',
                  } as React.CSSProperties),
                }}
                title={style.label}
              >
                <div className={`absolute inset-0 ${style.cssClass}`} style={{ backgroundAttachment: 'local' }} />
                <div
                  className="absolute bottom-0 left-0 right-0 px-2 py-2 transition-all"
                  style={{
                    background: isActive
                      ? `linear-gradient(180deg, transparent 0%, ${style.accent}ee 100%)`
                      : 'linear-gradient(180deg, transparent 0%, rgba(26,28,35,0.78) 100%)',
                  }}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white block">
                    {style.label}
                  </span>
                </div>
                {isActive && (
                  <div
                    className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ background: style.accent, boxShadow: `0 0 8px ${style.accent}` }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onLaunch}
            className="px-8 py-4 font-bold text-white rounded-2xl transition-all hover:scale-[1.03] active:scale-[0.98] shadow-xl"
            style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              boxShadow: '0 15px 40px rgba(79,70,229,0.35)',
            }}
          >
            Try all paper styles →
          </button>
          <p className="text-sm" style={{ color: '#64748b' }}>
            Free forever. No credit card.
          </p>
        </div>
      </div>
    </section>
  );
};
