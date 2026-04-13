import React, { useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { NavBar } from './landing/NavBar';
import { ReferralBanner } from './landing/ReferralBanner';
import { HeroSection } from './landing/HeroSection';
import { StatsStrip } from './landing/StatsStrip';
import { HowItWorksSection } from './landing/HowItWorksSection';
import { PaperStylesSection } from './landing/PaperStylesSection';
import { AIFeatureSection } from './landing/AIFeatureSection';
import { DemoVideoSection } from './landing/DemoVideoSection';
import { BlockTypesBento } from './landing/BlockTypesBento';
import { AestheticsSection } from './landing/AestheticsSection';
import { PricingSection } from './landing/PricingSection';
import { RoadmapSection } from './landing/RoadmapSection';
import { ComparisonTable } from './landing/ComparisonTable';
import { FAQSection } from './landing/FAQSection';
import { IOSWaitlistSection } from './landing/IOSWaitlistSection';
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

      // ── Staggered children for bento grids and card layouts ──
      // Only run on desktop — on mobile the cards are already visible (no hover state).
      // Use .bento-card selector instead of [class*="rounded"] to avoid
      // matching 100+ nested elements and creating excessive tweens.
      if (!isMobile) {
        gsap.utils.toArray<HTMLElement>('.reveal-scale').forEach((el) => {
          const cards = el.querySelectorAll('.bento-card');
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
      <NavBar onLaunch={handleLaunch} />
      <ReferralBanner />
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
          <HowItWorksSection />
          <AIFeatureSection onLaunch={handleLaunch} />
          <DemoVideoSection />
          <BlockTypesBento onLaunch={handleLaunch} />
          <PaperStylesSection onLaunch={handleLaunch} />
          <AestheticsSection onLaunch={handleLaunch} />
          <PricingSection onLaunch={handleLaunch} />
          <RoadmapSection />
          <ComparisonTable />
          <InlineTestimonials />
          <FAQSection />
          <IOSWaitlistSection />
        </div>
      </div>

      <FinalCTA onLaunch={handleLaunch} />

      {/* Subtle gradient transition: FinalCTA (#0f111a) → Footer (#0a0c14) */}
      <div style={{ height: '20px', background: 'linear-gradient(to bottom, #0f111a, #0a0c14)' }} />

      <LandingFooter />

      {/* Floating CTA Bar (fixed position, outside content flow) */}
      <FloatingCTABar onLaunch={handleLaunch} />
    </div>
  );
};
