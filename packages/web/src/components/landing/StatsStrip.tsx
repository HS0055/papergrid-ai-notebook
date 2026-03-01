import React, { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface StatDef {
  target: number | null;
  display: string;
  suffix: string;
  label: string;
}

const stats: StatDef[] = [
  { target: 10, display: '10', suffix: '+', label: 'Paper Styles' },
  { target: null, display: '\u221E', suffix: '', label: 'Notebooks' },
  { target: 12, display: '12', suffix: '', label: 'Block Types' },
  { target: 4, display: '4', suffix: '', label: 'Journal Modes' },
];

// Generate deterministic particle positions (no Math.random in render)
const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  left: `${(i * 37 + 13) % 100}%`,
  delay: `${(i * 1.7) % 10}s`,
  duration: `${8 + (i * 3.1) % 7}s`,
  size: 1.5 + (i % 3) * 0.5,
}));

export const StatsStrip: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const valueRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const dividerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const ruleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current || !contentRef.current) return;

    const values = valueRefs.current.filter(Boolean) as HTMLSpanElement[];
    const labels = labelRefs.current.filter(Boolean) as HTMLSpanElement[];
    const dividers = dividerRefs.current.filter(Boolean) as HTMLDivElement[];

    const ctx = gsap.context(() => {
      // Initial states
      gsap.set(values, { y: 50, opacity: 0, filter: 'blur(6px)' });
      gsap.set(labels, { y: 20, opacity: 0 });
      gsap.set(dividers, { scaleY: 0, opacity: 0 });
      if (ruleRef.current) gsap.set(ruleRef.current, { scaleX: 0 });

      // Scrub-driven timeline: stats reveal AS user scrolls through the gradient
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 70%',
          end: 'center 40%',
          scrub: 0.4,
        },
      });

      // Numbers emerge from blur — staggered from center outward
      tl.to(values, {
        y: 0,
        opacity: 1,
        filter: 'blur(0px)',
        stagger: { each: 0.06, from: 'center' },
        ease: 'power2.out',
      }, 0);

      // Scrub-driven count-up (numbers climb as you scroll)
      stats.forEach((stat, i) => {
        if (stat.target === null) return;
        const counter = { val: 0 };
        tl.to(counter, {
          val: stat.target,
          ease: 'power2.out',
          onUpdate: () => {
            const el = valueRefs.current[i];
            if (el) el.textContent = Math.round(counter.val) + stat.suffix;
          },
        }, 0);
      });

      // Dividers draw in
      tl.to(dividers, {
        scaleY: 1,
        opacity: 1,
        stagger: 0.05,
        ease: 'power2.out',
      }, 0.15);

      // Labels follow
      tl.to(labels, {
        y: 0,
        opacity: 1,
        stagger: { each: 0.06, from: 'center' },
        ease: 'power2.out',
      }, 0.25);

      // Horizontal rule draws in
      if (ruleRef.current) {
        tl.to(ruleRef.current, {
          scaleX: 1,
          ease: 'power2.out',
        }, 0.4);
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={sectionRef}
      className="relative overflow-hidden"
      style={{
        // Warm twilight gradient: hold dark, snap through mid-tones, settle parchment
        background: `linear-gradient(
          to bottom,
          #0f111a 0%,
          #0f111a 18%,
          #18161f 28%,
          #2a2233 38%,
          #3d3040 48%,
          #5c4a42 56%,
          #8b7768 65%,
          #b8a898 74%,
          #d4ccc4 83%,
          #F4F0EC 92%,
          #F4F0EC 100%
        )`,
        paddingTop: 'clamp(100px, 18vh, 180px)',
        paddingBottom: 'clamp(80px, 14vh, 140px)',
      }}
    >
      {/* Vignette overlay — adds depth to the transition zone */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 70% 50% at 50% 35%, transparent 0%, rgba(15,17,26,0.12) 100%)',
        }}
      />

      {/* Paper dust particles — ambient motion in the dark zone */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {PARTICLES.map((p, i) => (
          <div
            key={i}
            className="dust-particle"
            style={{
              left: p.left,
              top: '10%',
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDelay: p.delay,
              animationDuration: p.duration,
            }}
          />
        ))}
      </div>

      {/* Stats content */}
      <div ref={contentRef} className="relative px-6" style={{ zIndex: 2 }}>
        <div className="max-w-4xl mx-auto">
          {/* Stats grid — no divide-x, custom animated dividers */}
          <div className="grid grid-cols-2 md:grid-cols-4">
            {stats.map((stat, i) => (
              <div key={i} className="relative flex flex-col items-center justify-center py-8 px-4 text-center">
                {/* Animated vertical divider (between items, not on first) */}
                {i > 0 && (
                  <div
                    ref={(el) => { dividerRefs.current[i - 1] = el; }}
                    className="absolute left-0 top-1/2 -translate-y-1/2 hidden md:block"
                    style={{
                      width: '1px',
                      height: '48px',
                      background: 'linear-gradient(to bottom, transparent, rgba(79,70,229,0.25), transparent)',
                      transformOrigin: 'center',
                    }}
                  />
                )}

                {/* Number */}
                <span
                  ref={(el) => { valueRefs.current[i] = el; }}
                  className="stat-item font-serif leading-none"
                  style={{
                    fontSize: 'clamp(3.5rem, 8vw, 6rem)',
                    fontWeight: 800,
                    color: '#ffffff',
                    letterSpacing: '-0.04em',
                    lineHeight: 0.9,
                    marginBottom: '1rem',
                    textShadow: '0 0 40px rgba(79,70,229,0.12), 0 0 80px rgba(79,70,229,0.06)',
                  }}
                >
                  {stat.target === null ? stat.display : `0${stat.suffix}`}
                </span>

                {/* Label */}
                <span
                  ref={(el) => { labelRefs.current[i] = el; }}
                  className="font-sans uppercase"
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    letterSpacing: '0.15em',
                    color: '#64748b',
                  }}
                >
                  {stat.label}
                </span>
              </div>
            ))}
          </div>

          {/* Decorative horizontal rule — draws in from center */}
          <div className="flex justify-center mt-8">
            <div
              ref={ruleRef}
              style={{
                width: '180px',
                height: '1.5px',
                background: 'linear-gradient(90deg, transparent, #926644, transparent)',
                transformOrigin: 'center',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
