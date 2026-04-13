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
    tagline: 'For thoughts that flow linearly.',
    bestFor: 'Journaling · letters · reflection',
    accent: '#4f46e5',
    content: (
      <div className="px-8 pt-5 text-gray-800" style={{ lineHeight: '32px', fontSize: '16px' }}>
        {/* HEADING block */}
        <div className="font-sans font-extrabold text-2xl text-indigo-700" style={{ lineHeight: '28px', marginBottom: '4px' }}>Weekly Review</div>
        <div className="font-sans text-[9px] font-bold uppercase tracking-widest text-indigo-300 mb-0.5">Heading · AI generated</div>
        {/* MOOD TRACKER block */}
        <div className="flex items-center gap-2" style={{ height: '32px' }}>
          <span className="font-sans text-[9px] font-bold uppercase tracking-wider text-gray-400">Mood</span>
          {['😢','😕','😐','🙂','😄'].map((e, i) => (
            <span key={i} style={{ fontSize: i === 3 ? '18px' : '14px', opacity: i === 3 ? 1 : 0.2, filter: i === 3 ? 'none' : 'grayscale(1)' }}>{e}</span>
          ))}
        </div>
        {/* CHECKBOX blocks */}
        {[
          { text: 'Ship landing page redesign', done: true },
          { text: 'Close Series A term sheet', done: true },
          { text: 'Record product demo video', done: false },
          { text: 'Follow up: 3 warm leads', done: false },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-2 font-hand" style={{ height: '32px', fontSize: '15px' }}>
            <div
              className="w-3.5 h-3.5 rounded border-2 shrink-0 flex items-center justify-center"
              style={{ borderColor: item.done ? '#818cf8' : '#d1d5db', background: item.done ? '#818cf8' : 'transparent' }}
            >
              {item.done && <span className="text-white" style={{ fontSize: '8px', fontWeight: 'bold' }}>✓</span>}
            </div>
            <span className={item.done ? 'line-through text-gray-400' : 'text-gray-700'}>{item.text}</span>
          </div>
        ))}
        {/* QUOTE block */}
        <div className="border-l-4 border-indigo-300 pl-3 flex items-center" style={{ height: '32px' }}>
          <span className="font-serif italic text-indigo-600" style={{ fontSize: '13px' }}>"Ship small, learn fast, iterate daily."</span>
        </div>
        {/* CALLOUT block */}
        <div className="rounded-lg flex items-center gap-2 px-3" style={{ background: 'rgba(254,243,199,0.9)', height: '32px' }}>
          <span>📌</span>
          <span className="font-hand text-amber-800" style={{ fontSize: '13px' }}>Friday: team retro + velocity review</span>
        </div>
      </div>
    ),
  },
  {
    id: 'grid',
    label: 'Grid',
    cssClass: 'paper-grid',
    tagline: 'For minds that organize in grids.',
    bestFor: 'Planning · engineering · sketching',
    accent: '#0ea5e9',
    content: (
      <div className="px-5 pt-5">
        {/* HEADING block */}
        <div className="font-sans font-extrabold text-xl text-sky-700">Q2 Sprint Tracker</div>
        <div className="font-sans text-[9px] font-bold uppercase tracking-widest text-sky-400 mb-3">Heading · Data Grid · AI Layout</div>
        {/* DATA GRID block */}
        <div className="rounded-xl border-2 border-sky-200 overflow-hidden mb-3" style={{ background: 'rgba(255,255,255,0.65)' }}>
          <table className="w-full">
            <thead>
              <tr style={{ background: 'rgba(186,230,253,0.7)' }}>
                {['Feature', 'Sprint', 'Status'].map((h) => (
                  <th key={h} className="px-3 py-1.5 text-left font-sans text-[9px] font-bold uppercase tracking-wider text-sky-700 border-r border-sky-200 last:border-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['AI Layout Engine', 'S-24', '🟢 Done'],
                ['Mobile App Beta', 'S-25', '🟡 Active'],
                ['Stripe Billing', 'S-25', '🔵 Review'],
                ['Analytics Board', 'S-26', '⚪ Planned'],
              ].map((row, i) => (
                <tr key={i} className="border-t border-sky-100">
                  <td className="px-3 py-1 font-hand text-[11px] font-bold text-gray-700">{row[0]}</td>
                  <td className="px-3 py-1 font-mono text-[10px] text-sky-600">{row[1]}</td>
                  <td className="px-3 py-1 font-hand text-[10px] text-gray-600">{row[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* PROGRESS BAR block */}
        <div className="flex items-center gap-2 mb-3">
          <span className="font-sans text-[9px] font-bold uppercase tracking-wider text-sky-600 whitespace-nowrap">Sprint 25: 22/34 pts</span>
          <div className="flex-1 h-2 rounded-full bg-sky-100">
            <div className="h-2 rounded-full bg-sky-500" style={{ width: '65%' }} />
          </div>
          <span className="font-hand text-[10px] font-bold text-sky-600">65%</span>
        </div>
        {/* Velocity sparkline */}
        <div>
          <div className="font-sans text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Velocity (7 sprints)</div>
          <div className="flex items-end gap-1" style={{ height: '36px' }}>
            {[28, 32, 26, 34, 30, 36, 33].map((h, i) => (
              <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${(h / 36) * 100}%`, background: i === 5 ? '#0ea5e9' : 'rgba(14,165,233,0.45)' }} />
            ))}
          </div>
          <div className="font-hand text-[9px] text-gray-400 mt-1">avg: 31.3 pts · peak: S-22 (36)</div>
        </div>
      </div>
    ),
  },
  {
    id: 'dotted',
    label: 'Dotted',
    cssClass: 'paper-dots',
    tagline: 'For ideas that don\'t fit boxes.',
    bestFor: 'Bullet journaling · sketching',
    accent: '#d97706',
    content: (
      <div className="px-7 pt-6">
        <div className="flex items-center justify-between mb-0.5">
          <div className="font-hand text-amber-800 font-bold text-2xl">January 2026 ✦</div>
          <div className="text-xs text-amber-500 font-hand">habit tracker</div>
        </div>
        <div className="font-hand text-amber-500 text-[11px] mb-3">~ your month at a glance ~</div>
        <div className="space-y-1.5 mb-4">
          {[
            { habit: '💧 Water', days: [1,1,1,0,1,1,1,1,1,0,1,1,1,1] },
            { habit: '📖 Read', days: [1,1,0,1,1,0,1,1,0,1,1,1,0,1] },
            { habit: '🚶 Walk', days: [1,1,1,1,1,1,0,1,1,1,1,0,1,1] },
            { habit: '🧘 Meditate', days: [0,1,1,0,1,1,1,0,1,1,0,1,1,1] },
            { habit: '✍️ Write', days: [1,0,1,1,1,0,1,1,1,0,1,1,1,0] },
          ].map((h) => (
            <div key={h.habit} className="flex items-center gap-1.5">
              <span className="font-hand text-[11px] text-amber-700 shrink-0" style={{ width: '72px' }}>{h.habit}</span>
              <div className="flex gap-0.5 flex-1">
                {h.days.map((d, j) => (
                  <div
                    key={j}
                    className="flex-1 h-3 rounded-sm border border-amber-300"
                    style={{ background: d ? '#d97706' : 'transparent', minWidth: 0 }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-amber-200 pt-2">
          <div className="font-hand text-[12px] text-gray-700 mb-0.5 font-bold text-amber-700">January goals</div>
          <div className="font-hand text-[12px] text-gray-700">• Read 20 pages daily</div>
          <div className="font-hand text-[12px] text-gray-600">○ Learn watercolor painting</div>
          <div className="font-hand text-[12px] text-amber-600">→ Sunday evening reflection</div>
          <div className="font-hand text-[12px] text-gray-500 line-through">○ Wake 5am every day</div>
        </div>
      </div>
    ),
  },
  {
    id: 'music',
    label: 'Music',
    cssClass: 'paper-music',
    tagline: 'For notes you hum before you write.',
    bestFor: 'Songwriting · music education',
    accent: '#8b6f4e',
    content: (
      <div className="px-6 pt-5">
        <div className="flex items-baseline justify-between mb-0.5">
          <div className="font-serif text-stone-800 font-bold text-base">Étude No. 3</div>
          <div className="font-serif text-stone-500 text-[10px]">A. Laurent, 2026</div>
        </div>
        <div className="font-serif text-stone-600 italic text-[10px] mb-3">in C major · ♩ = 96 · Andante con moto</div>
        <div className="space-y-2">
          {/* Staff 1 */}
          <svg viewBox="0 0 280 54" className="w-full">
            <text x="3" y="36" fontSize="34" fill="#1e293b" fontFamily="serif">𝄞</text>
            <text x="33" y="24" fontSize="12" fontWeight="bold" fill="#1e293b">4</text>
            <text x="33" y="37" fontSize="12" fontWeight="bold" fill="#1e293b">4</text>
            {[
              { x: 52, y: 32 }, { x: 68, y: 28 }, { x: 84, y: 24 }, { x: 100, y: 28 },
              { x: 122, y: 32 }, { x: 138, y: 36 }, { x: 154, y: 32 }, { x: 170, y: 28 },
              { x: 192, y: 24 }, { x: 208, y: 20 }, { x: 224, y: 24 }, { x: 240, y: 28 }, { x: 258, y: 32 },
            ].map((n, i) => (
              <g key={i}>
                <ellipse cx={n.x} cy={n.y} rx="3.5" ry="2.8" fill="#1e293b" transform={`rotate(-20 ${n.x} ${n.y})`} />
                <line x1={n.x + 3} y1={n.y} x2={n.x + 3} y2={n.y - 16} stroke="#1e293b" strokeWidth="1" />
              </g>
            ))}
            <line x1="116" y1="6" x2="116" y2="44" stroke="#1e293b" strokeWidth="0.8" />
            <line x1="186" y1="6" x2="186" y2="44" stroke="#1e293b" strokeWidth="0.8" />
            <line x1="275" y1="6" x2="275" y2="44" stroke="#1e293b" strokeWidth="0.8" />
            <text x="54" y="14" fontSize="9" fill="#7c6348" fontFamily="serif" fontStyle="italic">p</text>
          </svg>
          {/* Lyrics line 1 */}
          <div className="font-hand text-[11px] text-stone-500 italic pl-4 -mt-1">
            "Slow and still, the morning breaks—"
          </div>
          {/* Staff 2 */}
          <svg viewBox="0 0 280 54" className="w-full">
            <text x="3" y="36" fontSize="34" fill="#1e293b" fontFamily="serif">𝄞</text>
            {[
              { x: 38, y: 24 }, { x: 54, y: 28 }, { x: 70, y: 32 }, { x: 86, y: 28 },
              { x: 108, y: 24 }, { x: 124, y: 20 }, { x: 140, y: 24 }, { x: 156, y: 28 },
              { x: 178, y: 32 }, { x: 194, y: 28 }, { x: 210, y: 24 }, { x: 226, y: 20 }, { x: 244, y: 24 },
            ].map((n, i) => (
              <g key={i}>
                <ellipse cx={n.x} cy={n.y} rx="3.5" ry="2.8" fill="#1e293b" transform={`rotate(-20 ${n.x} ${n.y})`} />
                <line x1={n.x + 3} y1={n.y} x2={n.x + 3} y2={n.y - 16} stroke="#1e293b" strokeWidth="1" />
              </g>
            ))}
            <line x1="102" y1="6" x2="102" y2="44" stroke="#1e293b" strokeWidth="0.8" />
            <line x1="172" y1="6" x2="172" y2="44" stroke="#1e293b" strokeWidth="0.8" />
            <line x1="272" y1="6" x2="272" y2="44" stroke="#1e293b" strokeWidth="1.5" />
            <line x1="275" y1="6" x2="275" y2="44" stroke="#1e293b" strokeWidth="3" />
            <text x="40" y="14" fontSize="9" fill="#7c6348" fontFamily="serif" fontStyle="italic">mf</text>
          </svg>
          {/* Lyrics line 2 */}
          <div className="font-hand text-[11px] text-stone-500 italic pl-4 -mt-1">
            "light through curtains, dust awakes."
          </div>
        </div>
        <div className="flex items-center justify-between mt-2 pt-1 border-t border-stone-200">
          <div className="font-serif italic text-[10px] text-stone-500">— con espressione</div>
          <div className="font-serif text-[10px] text-stone-400">D.C. al Fine</div>
        </div>
      </div>
    ),
  },
  {
    id: 'legal',
    label: 'Legal Pad',
    cssClass: 'paper-legal',
    tagline: 'For thinking that needs a margin.',
    bestFor: 'Legal notes · meetings',
    accent: '#92400e',
    content: (
      <div className="font-hand text-amber-900 pt-5" style={{ paddingLeft: '68px', paddingRight: '20px', fontSize: '16px', lineHeight: '32px' }}>
        <div className="font-bold text-lg">Case 2026-CV-042</div>
        <div className="text-sm text-amber-700 mb-1">Smith v. Johnson Co. · Hearing: Apr 22</div>
        <div className="font-bold">Key arguments:</div>
        <div>1. Breach of contract §4.2</div>
        <div>2. Failed delivery — Mar 15</div>
        <div>3. Economic damages: $47,500</div>
        <div>4. Consequential losses TBD</div>
        <div className="font-bold mt-1">Witnesses:</div>
        <div>• Dr. A. Patel (expert, damages)</div>
        <div>• R. Chen (logistics mgr)</div>
        <div className="font-bold mt-1">Action items:</div>
        <div>☐ File motion by Friday</div>
        <div>☑ Email witness list to opp.</div>
        <div>☐ Subpoena delivery records</div>
        <div className="text-amber-600 text-sm mt-1">★ Confirm venue 48hrs before</div>
      </div>
    ),
  },
  {
    id: 'blank',
    label: 'Blank',
    cssClass: 'bg-paper',
    tagline: 'For starting from nothing.',
    bestFor: 'Sketching · mind mapping',
    accent: '#64748b',
    content: (
      <div className="px-5 pt-5">
        <div className="flex items-baseline justify-between mb-0.5">
          <div className="font-hand text-slate-700 font-bold text-base">Product Launch Map</div>
          <div className="font-hand text-[10px] text-slate-400">Apr 2026</div>
        </div>
        <svg viewBox="0 0 280 265" className="w-full">
          {/* Center node */}
          <circle cx="140" cy="132" r="34" fill="rgba(79,70,229,0.1)" stroke="#4f46e5" strokeWidth="1.8" />
          <text x="140" y="128" fontSize="11" fill="#4f46e5" fontFamily="serif" fontWeight="bold" textAnchor="middle">Papera</text>
          <text x="140" y="143" fontSize="9" fill="#4f46e5" fontFamily="sans-serif" textAnchor="middle">Launch</text>

          {/* Branch: Marketing */}
          <line x1="140" y1="132" x2="46" y2="42" stroke="#d97706" strokeWidth="1.4" strokeDasharray="5,3" />
          <circle cx="46" cy="42" r="28" fill="rgba(217,119,6,0.08)" stroke="#d97706" strokeWidth="1.4" />
          <text x="46" y="38" fontSize="9" fill="#d97706" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">Marketing</text>
          <text x="46" y="51" fontSize="7.5" fill="#92400e" fontFamily="sans-serif" textAnchor="middle">landing · ads</text>
          {/* Sub-nodes: Marketing */}
          <line x1="28" y1="20" x2="14" y2="10" stroke="#d97706" strokeWidth="0.8" strokeDasharray="3,2" />
          <text x="8" y="9" fontSize="7" fill="#d97706" fontFamily="sans-serif">SEO</text>
          <line x1="64" y1="22" x2="76" y2="10" stroke="#d97706" strokeWidth="0.8" strokeDasharray="3,2" />
          <text x="72" y="9" fontSize="7" fill="#d97706" fontFamily="sans-serif">Ads</text>

          {/* Branch: Product */}
          <line x1="140" y1="132" x2="234" y2="42" stroke="#059669" strokeWidth="1.4" strokeDasharray="5,3" />
          <circle cx="234" cy="42" r="28" fill="rgba(5,150,105,0.08)" stroke="#059669" strokeWidth="1.4" />
          <text x="234" y="38" fontSize="9" fill="#059669" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">Product</text>
          <text x="234" y="51" fontSize="7.5" fill="#065f46" fontFamily="sans-serif" textAnchor="middle">iOS · web</text>
          {/* Sub-nodes: Product */}
          <line x1="216" y1="22" x2="204" y2="10" stroke="#059669" strokeWidth="0.8" strokeDasharray="3,2" />
          <text x="192" y="9" fontSize="7" fill="#059669" fontFamily="sans-serif">v2.0</text>
          <line x1="252" y1="22" x2="264" y2="10" stroke="#059669" strokeWidth="0.8" strokeDasharray="3,2" />
          <text x="260" y="9" fontSize="7" fill="#059669" fontFamily="sans-serif">iOS</text>

          {/* Branch: Growth */}
          <line x1="140" y1="132" x2="46" y2="222" stroke="#0ea5e9" strokeWidth="1.4" strokeDasharray="5,3" />
          <circle cx="46" cy="222" r="28" fill="rgba(14,165,233,0.08)" stroke="#0ea5e9" strokeWidth="1.4" />
          <text x="46" y="218" fontSize="9" fill="#0ea5e9" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">Growth</text>
          <text x="46" y="231" fontSize="7.5" fill="#075985" fontFamily="sans-serif" textAnchor="middle">referral · PR</text>

          {/* Branch: Legal */}
          <line x1="140" y1="132" x2="234" y2="222" stroke="#7c3aed" strokeWidth="1.4" strokeDasharray="5,3" />
          <circle cx="234" cy="222" r="28" fill="rgba(124,58,237,0.08)" stroke="#7c3aed" strokeWidth="1.4" />
          <text x="234" y="218" fontSize="9" fill="#7c3aed" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">Launch</text>
          <text x="234" y="231" fontSize="7.5" fill="#4c1d95" fontFamily="sans-serif" textAnchor="middle">Apr 28 🚀</text>

          {/* Center connection dots */}
          <circle cx="140" cy="132" r="4" fill="#4f46e5" />
        </svg>
        <div className="font-hand text-[11px] text-slate-500 text-center -mt-1">tap any node to expand →</div>
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
        {/* Section header — visible on mobile above the two columns */}
        <div className="lg:hidden text-center mb-10">
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--color-indigo-brand)', letterSpacing: '0.14em' }}>
            6 Paper Textures
          </p>
          <h2
            className="font-serif font-bold mb-4"
            style={{ fontSize: 'clamp(2.2rem, 4vw, 3.8rem)', color: 'var(--color-ink)', lineHeight: 1.1 }}
          >
            Pick the paper.{' '}
            <span className="italic" style={{ color: 'var(--color-indigo-brand)' }}>Set the mood.</span>
          </h2>
          <p className="max-w-xl mx-auto text-lg" style={{ color: '#64748b', lineHeight: 1.7 }}>
            The paper you write on shapes how you think. Six textures, six moods — real textures rendered in your browser.
          </p>
        </div>

        {/* Two-column sticky layout */}
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-start">

          {/* LEFT column: header + selector cards + CTA */}
          <div className="w-full lg:w-[45%] flex flex-col gap-8">

            {/* Section header — desktop only */}
            <div className="hidden lg:block">
              <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--color-indigo-brand)', letterSpacing: '0.14em' }}>
                6 Paper Textures
              </p>
              <h2
                className="font-serif font-bold mb-4"
                style={{ fontSize: 'clamp(2.2rem, 4vw, 3.8rem)', color: 'var(--color-ink)', lineHeight: 1.1 }}
              >
                Pick the paper.{' '}
                <span className="italic" style={{ color: 'var(--color-indigo-brand)' }}>Set the mood.</span>
              </h2>
              <p className="text-lg" style={{ color: '#64748b', lineHeight: 1.7 }}>
                The paper you write on shapes how you think. Six textures, six moods — not screenshots, not PDFs. Real textures rendered in your browser, exactly as they appear inside the app.
              </p>
            </div>

            {/* Mobile: horizontal scrollable chip row */}
            <div className="lg:hidden relative">
            <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
              {paperStyles.map((style) => {
                const isActive = selected === style.id;
                return (
                  <button
                    key={style.id}
                    onClick={() => handleSelect(style.id)}
                    className="paper-tile flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl transition-all"
                    style={{
                      background: isActive ? 'rgba(79,70,229,0.08)' : '#ffffff',
                      border: isActive
                        ? `2px solid ${style.accent}`
                        : '1px solid rgba(0,0,0,0.1)',
                    }}
                  >
                    <div
                      className={`w-7 h-7 rounded-md shrink-0 ${style.cssClass}`}
                      style={{ backgroundAttachment: 'local' }}
                    />
                    <span
                      className="text-xs font-bold whitespace-nowrap"
                      style={{ color: isActive ? style.accent : '#64748b' }}
                    >
                      {style.label}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* Scroll fade hint */}
            <div
              className="absolute right-0 top-0 bottom-2 w-10 pointer-events-none"
              style={{ background: 'linear-gradient(to left, #f8f6f3, transparent)' }}
            />
            </div>

            {/* Desktop: vertical selector card stack */}
            <div className="hidden lg:flex flex-col gap-2">
              {paperStyles.map((style) => {
                const isActive = selected === style.id;
                return (
                  <button
                    key={style.id}
                    onClick={() => handleSelect(style.id)}
                    className="paper-tile w-full flex items-center gap-4 px-4 py-3 rounded-xl text-left transition-all"
                    style={{
                      background: isActive
                        ? `rgba(${hexToRgb(style.accent)}, 0.05)`
                        : 'transparent',
                      border: isActive
                        ? `1px solid transparent`
                        : '1px solid transparent',
                      borderLeft: isActive
                        ? `3px solid ${style.accent}`
                        : '3px solid transparent',
                      transform: isActive ? 'translateX(0px)' : undefined,
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLButtonElement).style.transform = 'translateX(4px)';
                        (e.currentTarget as HTMLButtonElement).style.borderLeftColor = 'rgba(0,0,0,0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLButtonElement).style.transform = 'translateX(0px)';
                        (e.currentTarget as HTMLButtonElement).style.borderLeftColor = 'transparent';
                      }
                    }}
                  >
                    {/* Texture swatch */}
                    <div
                      className={`w-10 h-10 rounded-lg shrink-0 ${style.cssClass}`}
                      style={{
                        backgroundAttachment: 'local',
                        border: '1px solid rgba(0,0,0,0.08)',
                      }}
                    />
                    {/* Label + tagline */}
                    <div className="flex-1 min-w-0">
                      <div
                        className="font-serif font-bold text-base leading-tight"
                        style={{ color: 'var(--color-ink)' }}
                      >
                        {style.label}
                      </div>
                      <div
                        className="italic text-sm leading-snug mt-0.5"
                        style={{ color: style.accent }}
                      >
                        {style.tagline}
                      </div>
                    </div>
                    {/* bestFor pill */}
                    <div
                      className="shrink-0 px-2 py-1 rounded-full"
                      style={{
                        background: 'rgba(148,163,184,0.1)',
                        color: '#94a3b8',
                        fontSize: '10px',
                        fontWeight: 600,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                        maxWidth: '120px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {style.bestFor.split(' · ')[0]}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* CTA */}
            <div>
              <button
                onClick={onLaunch}
                className="px-8 py-4 font-bold text-white rounded-2xl transition-all hover:scale-[1.03] active:scale-[0.98] shadow-xl"
                style={{
                  background: `linear-gradient(135deg, ${selectedStyle.accent} 0%, ${selectedStyle.accent}cc 100%)`,
                  boxShadow: `0 8px 32px ${selectedStyle.accent}55`,
                  transition: 'background 0.3s ease, box-shadow 0.3s ease, transform 0.15s ease',
                }}
              >
                Start writing on {selectedStyle.label} paper →
              </button>
              <p className="text-sm mt-3" style={{ color: '#64748b' }}>
                All 6 textures free. No credit card.
              </p>
            </div>
          </div>

          {/* RIGHT column: sticky notebook preview */}
          <div
            className="w-full lg:w-[55%]"
            style={{ perspective: '1500px' }}
          >
            <div style={{ position: 'sticky', top: '120px' }}>
              <div
                ref={pageRef}
                className="relative mx-auto rounded-2xl overflow-hidden"
                style={{
                  maxWidth: '420px',
                  aspectRatio: '3/4',
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

              {/* Paper name + tagline below preview — mobile only (desktop shows in selector) */}
              <div className="lg:hidden text-center mt-6">
                <p className="font-serif text-2xl font-bold mb-1" style={{ color: 'var(--color-ink)' }}>
                  {selectedStyle.label}
                </p>
                <p className="font-serif italic text-base mb-1" style={{ color: selectedStyle.accent }}>
                  {selectedStyle.tagline}
                </p>
                <p className="text-xs font-medium uppercase tracking-widest" style={{ color: '#94a3b8' }}>
                  {selectedStyle.bestFor}
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

/** Converts a hex color string to "r, g, b" for use in rgba(). */
function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}
