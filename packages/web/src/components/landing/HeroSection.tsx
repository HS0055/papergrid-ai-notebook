import React, { useRef, useEffect, Suspense, lazy, useState } from 'react';
import { Sparkles, ChevronRight, Github } from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Lazy-load entire 3D scene (Three.js + R3F + postprocessing in one chunk)
const HeroScene = lazy(() => import('../three/landing/HeroScene'));

interface HeroSectionProps {
  onLaunch: () => void;
}

/**
 * Scroll-driven hero with 3 phases driven entirely by GSAP (no React state in scroll loop).
 * The 3D scene reads scroll progress from a shared ref inside useFrame — zero React re-renders.
 */
export const HeroSection: React.FC<HeroSectionProps> = ({ onLaunch }) => {
  const sectionRef = useRef<HTMLElement>(null);
  const pinContainerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  // Shared mutable ref — 3D scene reads this in useFrame, no React re-render needed
  const scrollRef = useRef({ progress: 0 });

  // DOM refs for GSAP-direct animation (no React state)
  const phase1Ref = useRef<HTMLDivElement>(null);
  const phase2Ref = useRef<HTMLDivElement>(null);
  const phase3Ref = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current || !pinContainerRef.current) return;

    const ctx = gsap.context(() => {
      // Master ScrollTrigger: pins the hero and drives all animations
      const masterTl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current!,
          start: 'top top',
          end: '+=250%',
          pin: pinContainerRef.current!,
          scrub: 0.3,
          onUpdate: (self) => {
            // Only write to ref — NO setState
            scrollRef.current.progress = self.progress;

            // Update progress bar directly via DOM
            if (progressBarRef.current) {
              progressBarRef.current.style.width = `${self.progress * 100}%`;
              progressBarRef.current.style.opacity =
                self.progress > 0 && self.progress < 1 ? '0.8' : '0';
            }
          },
        },
      });

      // Phase 1: visible 0%–25%, fades out 25%–35%
      masterTl.to(
        phase1Ref.current,
        { opacity: 0, y: -60, duration: 0.15, ease: 'power2.in' },
        0.2, // starts at 20% of scroll
      );

      // Phase 2: fades in 25%–32%, visible until 55%, fades out 55%–65%
      masterTl
        .fromTo(
          phase2Ref.current,
          { opacity: 0, y: 40 },
          { opacity: 1, y: 0, duration: 0.1, ease: 'power2.out' },
          0.25,
        )
        .to(
          phase2Ref.current,
          { opacity: 0, y: -40, duration: 0.1, ease: 'power2.in' },
          0.55,
        );

      // Phase 3: fades in 55%–70%, stays visible
      masterTl.fromTo(
        phase3Ref.current,
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 0.15, ease: 'power2.out' },
        0.55,
      );

      // Force timeline total duration to 1.0 so positions map exactly to scroll %
      masterTl.totalDuration(1.0);
    }, sectionRef);

    // Refresh ScrollTrigger after all contexts are initialized
    ScrollTrigger.refresh();

    return () => {
      ctx.revert();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="hero-section relative"
      style={{ minHeight: '350vh' }}
    >
      {/* Scroll progress indicator — outside pin container to avoid jump */}
      <div
        ref={progressBarRef}
        className="fixed top-0 left-0 h-[3px] z-50"
        style={{
          width: '0%',
          background: 'linear-gradient(90deg, #4f46e5, #7c3aed)',
          opacity: 0,
        }}
      />

      <div
        ref={pinContainerRef}
        className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6 pt-24 pb-16"
        style={{
          background: 'linear-gradient(160deg, #0f111a 0%, #1a1c23 45%, #2a1f3d 70%, #0f111a 100%)',
        }}
      >
        {/* Ambient glow blobs */}
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse, rgba(79,70,229,0.18) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
        <div
          className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse, rgba(217,119,6,0.12) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />

        {/* ── 3D Canvas: overlays entire section ── */}
        <div
          className="absolute inset-0"
          style={{ zIndex: 5, pointerEvents: 'none' }}
        >
          <Suspense fallback={null}>
            <HeroScene scrollRef={scrollRef} hovered={hovered} />
          </Suspense>
        </div>

        {/* ── Phase 1: Main headline ── */}
        <div
          ref={phase1Ref}
          className="relative text-center max-w-5xl mx-auto"
          style={{ zIndex: 20 }}
        >
          {/* Badge */}
          <div className="hero-badge inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-8 border"
            style={{
              background: 'rgba(79,70,229,0.15)',
              borderColor: 'rgba(79,70,229,0.4)',
              color: '#a5b4fc',
            }}
          >
            <Sparkles size={14} />
            <span>Powered by Gemini 2.5 Flash</span>
          </div>

          {/* Headline */}
          <h1
            className="font-serif font-bold tracking-tight mb-6 leading-[1.05] text-white"
            style={{ fontSize: 'clamp(3.5rem, 9vw, 7.5rem)' }}
          >
            <span className="hero-word block">The notebook</span>
            <span className="hero-word block" style={{ color: '#818cf8' }}>that thinks</span>
            <span className="hero-word block italic" style={{ color: '#F4F0EC' }}>with you.</span>
          </h1>

          {/* Subheadline */}
          <p className="hero-desc max-w-2xl mx-auto text-lg md:text-xl mb-10 leading-relaxed" style={{ color: '#94a3b8' }}>
            Describe your day, task, or idea — AI generates the perfect notebook layout instantly.
          </p>

          {/* CTAs */}
          <div className="hero-btns flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
            <button
              onClick={onLaunch}
              className="w-full sm:w-auto flex items-center justify-center gap-3 px-9 py-4 text-white font-bold text-lg rounded-2xl transition-all hover:scale-[1.03] active:scale-[0.98] shadow-2xl"
              style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                boxShadow: '0 20px 60px rgba(79,70,229,0.4)',
              }}
            >
              Start Writing Now
              <ChevronRight size={20} />
            </button>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto flex items-center justify-center gap-3 px-9 py-4 font-bold text-lg rounded-2xl border transition-all hover:bg-white/5"
              style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.7)' }}
            >
              <Github size={20} />
              View on GitHub
            </a>
          </div>

          <p className="text-xs font-medium tracking-widest uppercase" style={{ color: 'rgba(148,163,184,0.6)' }}>
            Free · AI-Powered · No credit card needed
          </p>
        </div>

        {/* ── Phase 2: Feature callout (starts hidden) ── */}
        <div
          ref={phase2Ref}
          className="absolute inset-0 flex items-center justify-center px-6"
          style={{ zIndex: 20, opacity: 0 }}
        >
          <div className="text-center max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-6 border"
              style={{
                background: 'rgba(217,119,6,0.15)',
                borderColor: 'rgba(217,119,6,0.4)',
                color: '#fbbf24',
              }}
            >
              <Sparkles size={14} />
              <span>10 Paper Textures · 12 Block Types</span>
            </div>
            <h2
              className="font-serif font-bold text-white mb-4"
              style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)', lineHeight: 1.1 }}
            >
              Open the cover.
              <br />
              <span className="italic" style={{ color: '#818cf8' }}>Discover the pages.</span>
            </h2>
            <p className="text-lg" style={{ color: '#94a3b8' }}>
              Scroll to watch the notebook unfold with real paper textures and AI-generated content.
            </p>
          </div>
        </div>

        {/* ── Phase 3: Final CTA (starts hidden) ── */}
        <div
          ref={phase3Ref}
          className="absolute inset-0 flex items-center justify-center px-6"
          style={{ zIndex: 20, opacity: 0 }}
        >
          <div className="text-center max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-6 border"
              style={{
                background: 'rgba(16,185,129,0.15)',
                borderColor: 'rgba(16,185,129,0.4)',
                color: '#6ee7b7',
              }}
            >
              <Sparkles size={14} />
              <span>Lined · Grid · Dotted · Music · Legal & More</span>
            </div>
            <h2
              className="font-serif font-bold text-white mb-6"
              style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)', lineHeight: 1.1 }}
            >
              Your pages.
              <br />
              <span className="italic" style={{ color: '#818cf8' }}>Your story.</span>
            </h2>
            <button
              onClick={onLaunch}
              className="inline-flex items-center justify-center gap-3 px-10 py-5 text-white font-bold text-lg rounded-2xl transition-all hover:scale-[1.03] active:scale-[0.98] shadow-2xl"
              style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                boxShadow: '0 20px 60px rgba(79,70,229,0.4)',
              }}
            >
              Start Writing Now
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* ── Notebook hover target ── */}
        <div
          className="relative w-full max-w-5xl mx-auto mt-16"
          style={{ height: '420px', zIndex: 15 }}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
        />
      </div>
    </section>
  );
};
