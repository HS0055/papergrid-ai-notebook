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

  useEffect(() => {
    if (!sectionRef.current || !pinContainerRef.current) return;

    const ctx = gsap.context(() => {
      // Mobile and desktop share the same 3-phase scroll narrative
      // (Phase 1 → fade → Phase 2 → fade → Phase 3), but mobile uses
      // a shorter pin duration since the mobile layout is denser.
      const scrollEnd = isMobile ? '+=130%' : '+=150%';

      const masterTl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: scrollEnd,
          pin: pinContainerRef.current,
          scrub: true,
          onUpdate: (self) => {
            // Only write to ref — NO setState
            scrollRef.current.progress = self.progress;
          },
        },
      });

      // Phase 1: visible 0-18%, fades out 18-26%
      masterTl.to(
        phase1Ref.current,
        { opacity: 0, y: -50, pointerEvents: 'none', duration: 0.08, ease: 'power2.in' },
        0.18,
      );

      // Phase 2: fades in 24-32%, visible until 48%, fades out 48-56%
      masterTl
        .fromTo(
          phase2Ref.current,
          { opacity: 0, y: 30, pointerEvents: 'none' },
          { opacity: 1, y: 0, pointerEvents: 'auto', duration: 0.08, ease: 'power2.out' },
          0.24,
        )
        .to(
          phase2Ref.current,
          { opacity: 0, y: -30, pointerEvents: 'none', duration: 0.08, ease: 'power2.in' },
          0.48,
        );

      // Phase 3: fades in 54-62%, stays visible until end (no fade-out)
      masterTl.fromTo(
        phase3Ref.current,
        { opacity: 0, y: 30, pointerEvents: 'none' },
        { opacity: 1, y: 0, pointerEvents: 'auto', duration: 0.10, ease: 'power2.out' },
        0.54,
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
      style={{ minHeight: isMobile ? '200vh' : '250vh', background: '#0f111a' }}
    >
      <div
        ref={pinContainerRef}
        className={`relative flex flex-col items-center overflow-hidden px-5 sm:px-6 ${isMobile ? 'justify-start min-h-[100svh] pt-16 pb-8' : 'justify-center min-h-screen pt-24 pb-16'}`}
        style={{
          background: 'linear-gradient(160deg, #0f111a 0%, #1a1c23 45%, #2a1f3d 70%, #0f111a 100%)',
        }}
        onMouseMove={isMobile ? undefined : (e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          cursorRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          cursorRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        }}
        onMouseLeave={isMobile ? undefined : () => {
          cursorRef.current.x = 0;
          cursorRef.current.y = 0;
        }}
      >
        {/* Ambient glow blobs — centered to frame notebook */}
        {!isMobile && (
          <>
            <div
              className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse, rgba(79,70,229,0.2) 0%, transparent 65%)',
                filter: 'blur(50px)',
              }}
            />
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse, rgba(124,58,237,0.1) 0%, transparent 70%)',
                filter: 'blur(80px)',
              }}
            />
            <div
              className="absolute bottom-1/4 right-1/3 w-[350px] h-[350px] rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse, rgba(217,119,6,0.1) 0%, transparent 70%)',
                filter: 'blur(60px)',
              }}
            />
          </>
        )}

        {/* ── 3D Canvas: overlays entire section ── */}
        <div
          className="absolute inset-0"
          style={{ zIndex: 5, pointerEvents: 'none', touchAction: 'auto' }}
        >
          <Canvas3DErrorBoundary>
            <Suspense fallback={null}>
              <HeroScene scrollRef={scrollRef} hovered={hovered} cursorRef={cursorRef} isMobile={isMobile} />
            </Suspense>
          </Canvas3DErrorBoundary>
        </div>

        {/* ── Phase 1: Main headline ── */}
        <div
          ref={phase1Ref}
          className="relative w-full max-w-6xl mx-auto text-center"
          style={{
            zIndex: 20,
            paddingTop: isMobile ? 'max(2.75rem, calc(env(safe-area-inset-top) + 1.75rem))' : '1rem',
            paddingBottom: isMobile ? '1.5rem' : '10rem',
          }}
        >
          {/* Badge */}
          <div className="hero-badge inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-4 md:mb-8 border"
            style={{
              background: 'rgba(79,70,229,0.15)',
              borderColor: 'rgba(79,70,229,0.4)',
              color: '#a5b4fc',
            }}
          >
            <Sparkles size={14} />
            <span>{isMobile ? 'Powered by AI' : 'Powered by Advanced AI'}</span>
          </div>

          {/* Headline */}
          <h1
            className="font-serif font-bold tracking-tight mb-3 md:mb-6 leading-[1.05] text-white"
            style={{
              fontSize: isMobile ? 'clamp(2.5rem, 10vw, 3.5rem)' : 'clamp(3.5rem, 9vw, 7.5rem)',
              maxWidth: isMobile ? undefined : '11ch',
              marginInline: 'auto',
            }}
          >
            <span className="hero-word block">The notebook</span>
            <span className="hero-word block" style={{ color: '#818cf8' }}>that thinks</span>
            <span className="hero-word block italic" style={{ color: '#F4F0EC' }}>with you.</span>
          </h1>

          {/* Subheadline */}
          <p
            className="hero-desc max-w-2xl mx-auto text-sm md:text-xl mb-5 md:mb-10 leading-relaxed"
            style={{ color: '#94a3b8', maxWidth: isMobile ? '22rem' : undefined }}
          >
            Describe your day, task, or idea — AI generates the perfect notebook layout instantly.
          </p>

          {/* CTAs */}
          <div className="hero-btns flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4 mb-4 md:mb-6">
            <button
              onClick={onLaunch}
              className="w-full sm:w-auto flex items-center justify-center gap-3 px-9 py-3 md:py-4 text-white font-bold text-base md:text-lg rounded-2xl transition-all hover:scale-[1.03] active:scale-[0.98] shadow-2xl"
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
              className="w-full sm:w-auto flex items-center justify-center gap-3 px-9 py-3 md:py-4 font-bold text-base md:text-lg rounded-2xl border transition-all hover:bg-white/5"
              style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.7)' }}
            >
              <Github size={20} />
              View on GitHub
            </a>
          </div>

          <p
            className="text-[10px] md:text-xs font-medium tracking-widest uppercase"
            style={{ color: 'rgba(148,163,184,0.6)', marginTop: isMobile ? '0.25rem' : undefined }}
          >
            Free · AI-Powered · No credit card needed
          </p>
        </div>

        {/* ── Phase 2: Feature callout ── */}
        <div
          ref={phase2Ref}
          className="absolute inset-0 flex items-center justify-center px-4 md:px-6"
          style={{ zIndex: 20, opacity: 0, pointerEvents: 'none' }}
        >
          <div
            className="text-center max-w-3xl rounded-3xl px-5 py-7 md:px-10 md:py-12"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(15,17,26,0.92) 0%, rgba(15,17,26,0.75) 70%, transparent 100%)',
            }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-semibold mb-3 md:mb-6 border"
              style={{
                background: 'rgba(217,119,6,0.15)',
                borderColor: 'rgba(217,119,6,0.4)',
                color: '#fbbf24',
              }}
            >
              <Sparkles size={14} />
              <span>10 Paper Textures · 22+ Block Types</span>
            </div>
            <h2
              className="font-serif font-bold text-white mb-3 md:mb-4"
              style={{ fontSize: 'clamp(2rem, 7vw, 5rem)', lineHeight: 1.1 }}
            >
              Open the cover.
              <br />
              <span className="italic" style={{ color: '#818cf8' }}>Discover the pages.</span>
            </h2>
            <p className="text-sm md:text-lg" style={{ color: '#94a3b8' }}>
              Scroll to watch the notebook unfold with real paper textures and AI-generated content.
            </p>
          </div>
        </div>

        {/* ── Phase 3: Final CTA ── */}
        <div
          ref={phase3Ref}
          className="absolute inset-0 flex items-center justify-center px-4 md:px-6"
          style={{ zIndex: 20, opacity: 0, pointerEvents: 'none' }}
        >
          <div
            className="text-center max-w-3xl rounded-3xl px-5 py-7 md:px-10 md:py-12"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(15,17,26,0.92) 0%, rgba(15,17,26,0.75) 70%, transparent 100%)',
            }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-semibold mb-3 md:mb-6 border"
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
              className="font-serif font-bold text-white mb-4 md:mb-6"
              style={{ fontSize: 'clamp(2rem, 7vw, 5rem)', lineHeight: 1.1 }}
            >
              Your pages.
              <br />
              <span className="italic" style={{ color: '#818cf8' }}>Your story.</span>
            </h2>
            <button
              onClick={onLaunch}
              className="inline-flex items-center justify-center gap-3 px-7 py-3 md:px-10 md:py-5 text-white font-bold text-base md:text-lg rounded-2xl transition-all hover:scale-[1.03] active:scale-[0.98] shadow-2xl"
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

        {/* ── Notebook hover target (desktop only) — centered ── */}
        {!isMobile && (
          <div
            className="absolute inset-x-0 bottom-0 top-[26%]"
            style={{ zIndex: 15 }}
            onPointerEnter={() => setHovered(true)}
            onPointerLeave={() => setHovered(false)}
          />
        )}
      </div>
    </section>
  );
};
