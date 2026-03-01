import React, { useRef, useEffect, Suspense, lazy, useState } from 'react';
import { Sparkles, ChevronRight, Github } from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Canvas3DErrorBoundary } from '../three/Canvas3DErrorBoundary';
import { useIsMobile } from '../../hooks/useIsMobile';

gsap.registerPlugin(ScrollTrigger);

// Lazy-load entire 3D scene (Three.js + R3F + postprocessing in one chunk)
const HeroScene = lazy(() => import('../three/landing/HeroScene'));

interface HeroSectionProps {
  onLaunch: () => void;
}

/**
 * Scroll-driven hero with 3 phases driven entirely by GSAP (no React state in scroll loop).
 * The 3D scene reads scroll progress from a shared ref inside useFrame — zero React re-renders.
 * On mobile: disables 3D, shortens scroll, and uses simpler layout.
 */
export const HeroSection: React.FC<HeroSectionProps> = ({ onLaunch }) => {
  const sectionRef = useRef<HTMLElement>(null);
  const pinContainerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const isMobile = useIsMobile();

  // Shared mutable ref — 3D scene reads this in useFrame, no React re-render needed
  const scrollRef = useRef({ progress: 0 });
  const cursorRef = useRef({ x: 0, y: 0 });

  // DOM refs for GSAP-direct animation (no React state)
  const phase1Ref = useRef<HTMLDivElement>(null);
  const phase2Ref = useRef<HTMLDivElement>(null);
  const phase3Ref = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current || !pinContainerRef.current) return;

    // Mobile: simpler animation - just fade in Phase 1, no scroll-driven phases
    if (isMobile) {
      const ctx = gsap.context(() => {
        gsap.fromTo(
          phase1Ref.current,
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 0.2 },
        );
      }, sectionRef);
      return () => { ctx.revert(); };
    }

    const ctx = gsap.context(() => {
      // Master ScrollTrigger: pins the hero and drives all animations
      // +=200% gives 2 viewports of scroll — tighter timing with crossfade transitions
      const masterTl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: '+=200%',
          pin: pinContainerRef.current,
          scrub: 0.25,
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

      // Phase 1: visible 0-8%, fades out 8-14%
      masterTl.to(
        phase1Ref.current,
        { opacity: 0, y: -50, duration: 0.06, ease: 'power2.in' },
        0.08,
      );

      // Phase 2: fades in 12-18% (crossfades with Phase 1 exit), visible until 38%, fades out 38-46%
      masterTl
        .fromTo(
          phase2Ref.current,
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 0.08, ease: 'power2.out' },
          0.12,
        )
        .to(
          phase2Ref.current,
          { opacity: 0, y: -30, duration: 0.08, ease: 'power2.in' },
          0.38,
        );

      // Phase 3: fades in 44-52% (crossfades with Phase 2 exit), visible 52-72%, fades out 72-84%
      masterTl
        .fromTo(
          phase3Ref.current,
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 0.10, ease: 'power2.out' },
          0.44,
        )
        .to(
          phase3Ref.current,
          { opacity: 0, y: -25, scale: 0.97, duration: 0.12, ease: 'power2.in' },
          0.72,
        );
    }, sectionRef);

    // Refresh ScrollTrigger after all contexts are initialized
    ScrollTrigger.refresh();

    return () => {
      ctx.revert();
    };
  }, [isMobile]);

  return (
    <section
      ref={sectionRef}
      className="hero-section relative"
      style={{ minHeight: isMobile ? '100vh' : '300vh' }}
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
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          cursorRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          cursorRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        }}
        onMouseLeave={() => {
          cursorRef.current.x = 0;
          cursorRef.current.y = 0;
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

        {/* ── 3D Canvas: overlays entire section (desktop only) ── */}
        {!isMobile && (
          <div
            className="absolute inset-0"
            style={{ zIndex: 5, pointerEvents: 'none' }}
          >
            <Canvas3DErrorBoundary>
              <Suspense fallback={null}>
                <HeroScene scrollRef={scrollRef} hovered={hovered} cursorRef={cursorRef} />
              </Suspense>
            </Canvas3DErrorBoundary>
          </div>
        )}

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

        {/* ── Phase 2: Feature callout (starts hidden, desktop only) ── */}
        <div
          ref={phase2Ref}
          className="absolute inset-0 flex items-center justify-center px-6"
          style={{ zIndex: 20, opacity: 0, display: isMobile ? 'none' : undefined }}
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

        {/* ── Phase 3: Final CTA (starts hidden, desktop only) ── */}
        <div
          ref={phase3Ref}
          className="absolute inset-0 flex items-center justify-center px-6"
          style={{ zIndex: 20, opacity: 0, display: isMobile ? 'none' : undefined }}
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

        {/* ── Notebook hover target (desktop only) ── */}
        {!isMobile && (
          <div
            className="relative w-full max-w-5xl mx-auto mt-16"
            style={{ height: '420px', zIndex: 15 }}
            onPointerEnter={() => setHovered(true)}
            onPointerLeave={() => setHovered(false)}
          />
        )}
      </div>
    </section>
  );
};
