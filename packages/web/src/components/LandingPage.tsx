import React, { useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { NavBar } from './landing/NavBar';
import { HeroSection } from './landing/HeroSection';
import { StatsStrip } from './landing/StatsStrip';
import { PaperStylesSection } from './landing/PaperStylesSection';
import { AIFeatureSection } from './landing/AIFeatureSection';
import { BlockTypesBento } from './landing/BlockTypesBento';
import { AestheticsSection } from './landing/AestheticsSection';
import { InlineTestimonials } from './landing/InlineTestimonials';
import { FinalCTA } from './landing/FinalCTA';
import { LandingFooter } from './landing/LandingFooter';
import { FloatingCTABar } from './landing/FloatingCTABar';
import { Canvas3DErrorBoundary } from './three/Canvas3DErrorBoundary';
import { useIsMobile } from '../hooks/useIsMobile';

// Lazy-load 3D components for code splitting
const AmbientCanvas = lazy(() => import('./three/canvas/AmbientCanvas'));
const FloatingPapers = lazy(() => import('./three/landing/FloatingPapers').then(m => ({ default: m.FloatingPapers })));

gsap.registerPlugin(ScrollTrigger);

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const inkLineRef = useRef<HTMLDivElement>(null);
  const contentSectionsRef = useRef<HTMLDivElement>(null);
  const scrollProgressRef = useRef(0);
  const isMobile = useIsMobile();

  const handleLaunch = useCallback(() => {
    if (rootRef.current) {
      gsap.to(rootRef.current, {
        opacity: 0,
        scale: 0.97,
        y: -20,
        duration: 0.4,
        ease: 'power3.inOut',
        onComplete: () => { navigate('/app'); },
      });
    } else {
      navigate('/app');
    }
  }, [navigate]);

  useEffect(() => {
    let rafId = 0;

    const updateScrollProgress = () => {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      const denom = Math.max(1, docHeight - windowHeight);
      const progress = scrollY / denom;
      scrollProgressRef.current = progress;
      rafId = 0;
    };

    const handleScroll = () => {
      if (rafId === 0) {
        rafId = window.requestAnimationFrame(updateScrollProgress);
      }
    };

    updateScrollProgress();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  useEffect(() => {
    // ── Hero GSAP animations (timeline + floating) ───────────
    const ctx = gsap.context(() => {
      // Use fromTo (not from) to guarantee both start AND end states.
      // gsap.from() can leave elements at opacity:0 after HMR reloads.
      const heroTl = gsap.timeline({ delay: 0.1 });

      heroTl
        .fromTo('.hero-badge', {
          y: -20,
          opacity: 0,
        }, {
          y: 0,
          opacity: 1,
          duration: 0.6,
          ease: 'power3.out',
        })
        .fromTo('.hero-word', {
          y: 80,
          opacity: 0,
        }, {
          y: 0,
          opacity: 1,
          duration: 1,
          stagger: 0.15,
          ease: 'power4.out',
        }, '-=0.3')
        .fromTo('.hero-desc', {
          y: 20,
          opacity: 0,
        }, {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: 'power3.out',
        }, '-=0.5')
        .fromTo('.hero-btns', {
          y: 20,
          opacity: 0,
        }, {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: 'power3.out',
        }, '-=0.6');

      // ── ScrollTrigger reveals for sections below hero ──
      // Enhanced: GSAP-driven reveals with stagger for richer scroll experience
      const revealSelectors = '.reveal, .reveal-scale, .reveal-left, .reveal-right';
      gsap.utils.toArray<HTMLElement>(revealSelectors).forEach((el) => {
        ScrollTrigger.create({
          trigger: el,
          start: 'top 92%',
          onEnter: () => el.setAttribute('data-revealed', 'true'),
          once: true,
        });
      });

      // ── Section-level scroll animations (continuous scroll narrative) ──
      // Each major section slides up with parallax as it enters
      // Skip hero-section (already has its own scroll animation)
      // Mobile: reduced travel distance for subtler effect
      const sectionTravel = isMobile ? 30 : 60;
      gsap.utils.toArray<HTMLElement>('section:not(.hero-section)').forEach((section) => {
        gsap.fromTo(
          section.querySelector('.max-w-7xl, .max-w-5xl, .max-w-6xl') || section,
          { y: sectionTravel },
          {
            y: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: section,
              start: 'top bottom',
              end: isMobile ? 'top 40%' : 'top 20%',
              scrub: 0.5,
            },
          },
        );
      });

      // ── Staggered children for bento grids and card layouts ──
      gsap.utils.toArray<HTMLElement>('.reveal-scale').forEach((el) => {
        const cards = el.querySelectorAll('[class*="rounded"]');
        if (cards.length > 1) {
          gsap.fromTo(
            Array.from(cards),
            { y: 30, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.5,
              stagger: 0.08,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: el,
                start: 'top 85%',
                once: true,
              },
            },
          );
        }
      });

      // ── Continuous ink progress line ──
      // Draws from top of StatsStrip to bottom of page, controlled by scroll
      if (inkLineRef.current) {
        gsap.fromTo(
          inkLineRef.current,
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: 'body',
              start: 'top top',
              end: 'bottom bottom',
              scrub: 0.3,
            },
          },
        );
      }

      // Ensure all ScrollTrigger positions are recalculated after pin spacers
      ScrollTrigger.refresh();
    }, rootRef);

    return () => {
      ctx.revert();
    };
  }, [isMobile]);

  return (
    <div
      ref={rootRef}
      className="min-h-screen font-sans overflow-x-hidden"
      style={{ color: 'var(--color-ink)' }}
    >
      {/* Continuous ink progress line */}
      <div ref={inkLineRef} className="ink-progress-line">
        <div className="ink-progress-dot" />
      </div>

      <NavBar onLaunch={handleLaunch} />
      <HeroSection onLaunch={handleLaunch} />
      <StatsStrip />

      {/* Content sections with ambient 3D background */}
      <div ref={contentSectionsRef} className="relative">
        {/* Ambient 3D Canvas with floating papers (behind content, desktop only) */}
        {!isMobile && (
          <Canvas3DErrorBoundary>
            <Suspense fallback={null}>
              <AmbientCanvas
                style={{
                  zIndex: 0,
                  top: 0,
                  height: '100%',
                }}
              >
                <FloatingPapers scrollProgressRef={scrollProgressRef} />
              </AmbientCanvas>
            </Suspense>
          </Canvas3DErrorBoundary>
        )}

        {/* Content sections (above 3D canvas) */}
        <div className="relative z-10">
          <PaperStylesSection onLaunch={handleLaunch} />

          {/* Gradient transition: PaperStyles (#fdfbf7) → AIFeature (#f8f6f3) */}
          <div style={{ height: '40px', background: 'linear-gradient(to bottom, #fdfbf7, #f8f6f3)' }} />

          <AIFeatureSection onLaunch={handleLaunch} />
          <InlineTestimonials />

          {/* Gradient transition: AIFeature/Testimonials → BlockTypesBento (#ffffff) */}
          <div style={{ height: '40px', background: 'linear-gradient(to bottom, #f8f6f3, #ffffff)' }} />

          <BlockTypesBento onLaunch={handleLaunch} />

          {/* Gradient transition: BlockTypesBento (#ffffff) → AestheticsSection (#F4F0EC) */}
          <div style={{ height: '40px', background: 'linear-gradient(to bottom, #ffffff, #F4F0EC)' }} />

          <AestheticsSection onLaunch={handleLaunch} />
        </div>
      </div>

      {/* Gradient transition: AestheticsSection (#F4F0EC) → FinalCTA (#0f111a) */}
      <div style={{ height: '60px', background: 'linear-gradient(to bottom, #F4F0EC, #0f111a)' }} />

      <FinalCTA onLaunch={handleLaunch} />

      {/* Subtle gradient transition: FinalCTA (#0f111a) → Footer (#0a0c14) */}
      <div style={{ height: '20px', background: 'linear-gradient(to bottom, #0f111a, #0a0c14)' }} />

      <LandingFooter />

      {/* Floating CTA Bar (fixed position, outside content flow) */}
      <FloatingCTABar onLaunch={handleLaunch} />
    </div>
  );
};
