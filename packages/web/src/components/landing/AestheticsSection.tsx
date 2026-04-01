import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

const aesthetics = [
  {
    id: 'modern-planner',
    name: 'Modern Planner',
    tag: 'Best for daily planning',
    desc: 'Comprehensive dashboards with finance, wellness, and schedule sections. Clean and highly functional.',
    paperClass: 'paper-lines',
    bg: '#fdfbf7',
    accentColor: '#4f46e5',
    accentBg: '#eef2ff',
    preview: (
      <div className="space-y-2 opacity-90">
        <div className="h-5 w-2/3 rounded bg-indigo-100 border border-indigo-200" />
        <div className="h-4 w-full rounded bg-gray-50 border border-gray-200" />
        <div className="h-4 w-full rounded bg-gray-50 border border-gray-200" />
        <div className="grid grid-cols-3 gap-1.5 mt-3">
          {['💰 Finance', '💪 Health', '📅 Schedule'].map(l => (
            <div key={l} className="bg-indigo-50 border border-indigo-100 rounded p-1.5 text-center text-[9px] font-bold text-indigo-600 font-sans">{l}</div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'e-ink',
    name: 'E-Ink Minimal',
    tag: 'Best for deep focus',
    desc: 'High contrast minimalism optimized for focus and clarity. Inspired by reMarkable Pro.',
    paperClass: 'paper-grid',
    bg: '#fdfbf7',
    accentColor: '#475569',
    accentBg: '#f1f5f9',
    preview: (
      <div className="space-y-2 opacity-90">
        <div className="h-6 w-1/2 rounded-sm bg-slate-800" />
        {['9:00', '10:00', '11:00', '12:00'].map(t => (
          <div key={t} className="flex items-center gap-2">
            <span className="font-mono text-[9px] text-gray-400 w-8 shrink-0">{t}</span>
            <div className="flex-1 h-5 rounded-sm border border-slate-200 bg-slate-50" />
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'bujo',
    name: 'Bullet Journal',
    tag: 'Best for creativity',
    desc: 'Playful, freeform layouts with habit trackers and mood logs. Hand-drawn feel, digital speed.',
    paperClass: 'paper-dots',
    bg: '#fdfbf7',
    accentColor: '#d97706',
    accentBg: '#fffbeb',
    preview: (
      <div className="space-y-2 opacity-90">
        <div className="font-hand text-base font-bold text-amber-700">January Goals ✦</div>
        {['Read 20 pages', 'Meditate 10min', 'Workout', 'Journal'].map((h, i) => (
          <div key={h} className="flex items-center gap-2">
            <span className="text-amber-400 text-sm">{'●○○●'[i]}</span>
            <span className="font-hand text-sm text-gray-700">{h}</span>
          </div>
        ))}
        <div className="mt-2 bg-amber-50 border border-amber-200 rounded p-2 relative">
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 h-3 bg-amber-200/70 rounded-sm" />
          <p className="font-hand text-xs text-amber-700">Be consistent 🌱</p>
        </div>
      </div>
    ),
  },
  {
    id: 'cornell',
    name: 'Cornell Notes',
    tag: 'Best for studying',
    desc: 'The classic Cornell structure: cues, notes, and a summary. Perfect for students and researchers.',
    paperClass: 'paper-legal',
    bg: '#fbf0d9',
    accentColor: '#92400e',
    accentBg: '#fef3c7',
    preview: (
      <div className="flex gap-3 opacity-90 h-full">
        <div className="w-1/3 border-r border-red-300 pr-2">
          <div className="text-[9px] font-bold text-red-600 uppercase tracking-wide mb-2 font-sans">Cues</div>
          <div className="space-y-1.5">
            {['What is AI?', 'Use cases', 'Limitations'].map(q => (
              <div key={q} className="font-hand text-[10px] text-amber-800 bg-amber-100/60 rounded px-1.5 py-0.5">{q}</div>
            ))}
          </div>
        </div>
        <div className="flex-1">
          <div className="text-[9px] font-bold text-amber-700 uppercase tracking-wide mb-2 font-sans">Notes</div>
          <div className="space-y-1">
            {['Artificial Intelligence is...', 'Applications include...', 'Key limitation is...'].map(n => (
              <div key={n} className="font-hand text-[10px] text-amber-900">{n}</div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
];

interface AestheticsSectionProps {
  onLaunch: () => void;
}

export const AestheticsSection: React.FC<AestheticsSectionProps> = ({ onLaunch }) => {
  const carouselRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const bgRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hasShownHintRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // Auto-scroll hint animation on first viewport entry
  useEffect(() => {
    if (!carouselRef.current || hasShownHintRef.current) return;

    const carousel = carouselRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasShownHintRef.current) {
          hasShownHintRef.current = true;

          const ctx = gsap.context(() => {
            gsap.timeline()
              .to(carousel, {
                scrollLeft: 60,
                duration: 0.5,
                ease: 'power2.out',
              })
              .to(carousel, {
                scrollLeft: 0,
                duration: 0.6,
                ease: 'power2.inOut',
                delay: 0.3,
              });
          }, carousel);

          return () => ctx.revert();
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(carousel);

    return () => observer.disconnect();
  }, []);

  // Track active card via IntersectionObserver
  useEffect(() => {
    if (!carouselRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = cardRefs.current.indexOf(entry.target as HTMLDivElement);
            if (index !== -1) {
              setActiveIndex(index);
            }
          }
        });
      },
      {
        root: carouselRef.current,
        threshold: 0.6,
      }
    );

    cardRefs.current.forEach((card) => {
      if (card) observer.observe(card);
    });

    return () => observer.disconnect();
  }, []);

  // Parallax effect on scroll — RAF-throttled to avoid layout thrashing
  useEffect(() => {
    if (!carouselRef.current) return;

    let rafId = 0;
    const updateParallax = () => {
      rafId = 0;
      const carouselEl = carouselRef.current;
      if (!carouselEl) return;
      const carouselRect = carouselEl.getBoundingClientRect();
      const carouselCenter = carouselRect.left + carouselRect.width / 2;

      cardRefs.current.forEach((card, i) => {
        if (!card || !bgRefs.current[i]) return;
        const cardRect = card.getBoundingClientRect();
        const cardCenter = cardRect.left + cardRect.width / 2;
        const offset = (cardCenter - carouselCenter) / carouselRect.width;

        // Kill previous tween before creating new one
        gsap.killTweensOf(bgRefs.current[i]);
        gsap.to(bgRefs.current[i], {
          x: offset * -20,
          duration: 0.3,
          ease: 'power1.out',
        });
      });
    };

    const handleScroll = () => {
      if (rafId === 0) {
        rafId = requestAnimationFrame(updateParallax);
      }
    };

    const carousel = carouselRef.current;
    carousel.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      carousel.removeEventListener('scroll', handleScroll);
      if (rafId !== 0) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <section className="py-24 px-6" style={{ background: '#F4F0EC' }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="reveal text-center mb-16">
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--color-indigo-brand)' }}>
            Journal Modes
          </p>
          <h2
            className="font-serif font-bold mb-4"
            style={{ fontSize: 'clamp(2.2rem, 4vw, 3.5rem)', color: 'var(--color-ink)', lineHeight: 1.15 }}
          >
            Four ways to work.
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto text-lg">
            Each aesthetic mode changes paper style, layout, and typography to match how you think.
          </p>
        </div>

        {/* Horizontal Carousel */}
        <div
          ref={carouselRef}
          className="carousel-container flex gap-6 overflow-x-auto pb-4 mb-8 snap-x snap-mandatory scroll-smooth"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'var(--color-line) transparent',
          }}
        >
          {aesthetics.map((a, i) => (
            <div
              key={a.id}
              ref={(el) => { cardRefs.current[i] = el; }}
              className="carousel-card group relative rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer snap-center shrink-0"
              style={{
                width: 'min(85vw, 420px)',
                minHeight: '480px',
              }}
              onClick={onLaunch}
            >
              <div
                ref={(el) => { bgRefs.current[i] = el; }}
                className={`absolute inset-0 ${a.paperClass}`}
                style={{ background: a.bg, backgroundAttachment: 'local' }}
              />
              <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(to bottom, rgba(255,255,255,0) 40%, ${a.bg}ee 100%)` }} />

              <div className="relative z-10 p-8 flex flex-col h-full justify-between">
                <div>
                  <div
                    className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-6 border"
                    style={{ background: a.accentBg, color: a.accentColor, borderColor: `${a.accentColor}30` }}
                  >
                    {a.tag}
                  </div>
                  <div className="mb-8">{a.preview}</div>
                </div>
                <div>
                  <h3 className="font-serif font-bold text-2xl mb-2" style={{ color: a.accentColor }}>{a.name}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#64748b' }}>{a.desc}</p>
                </div>
                <div
                  className="absolute top-6 right-6 w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 text-white text-sm font-bold"
                  style={{ background: a.accentColor }}
                >→</div>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation Dots */}
        <div className="flex justify-center gap-2">
          {aesthetics.map((a, i) => (
            <button
              key={a.id}
              onClick={() => {
                cardRefs.current[i]?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'nearest',
                  inline: 'center',
                });
              }}
              className="transition-all duration-300"
              style={{
                width: activeIndex === i ? '32px' : '8px',
                height: '8px',
                borderRadius: '4px',
                background: activeIndex === i ? 'var(--color-indigo-brand)' : 'var(--color-line)',
              }}
              aria-label={`Go to ${a.name}`}
            />
          ))}
        </div>
      </div>
      {/* Seamless gradient into dark FinalCTA — no separate divider needed */}
      <div
        style={{
          height: '120px',
          marginTop: '4rem',
          marginLeft: '-1.5rem',
          marginRight: '-1.5rem',
          marginBottom: '-1px',
          background: 'linear-gradient(to bottom, #F4F0EC 0%, #2a1f3d 55%, #0f111a 100%)',
        }}
      />
    </section>
  );
};
