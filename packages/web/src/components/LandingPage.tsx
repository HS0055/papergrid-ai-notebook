import React, { useEffect, useRef, useCallback, Suspense, lazy, useState } from 'react';
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

// Lazy-load 3D components for code splitting
const AmbientCanvas = lazy(() => import('./three/canvas/AmbientCanvas'));
const FloatingPapers = lazy(() => import('./three/landing/FloatingPapers').then(m => ({ default: m.FloatingPapers })));

gsap.registerPlugin(ScrollTrigger);

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const inkLineRef = useRef<HTMLDivElement>(null);
  const contentSectionsRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

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
    // Track scroll progress for FloatingPapers parallax
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      const progress = scrollY / (docHeight - windowHeight);
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // ── Hero GSAP animations (timeline + floating) ───────────
    const ctx = gsap.context(() => {
      const heroTl = gsap.timeline({ delay: 0.1 });

      heroTl
        .from('.hero-badge', {
          y: -20,
          opacity: 0,
          duration: 0.6,
          ease: 'power3.out',
        })
        .from('.hero-word', {
          y: 80,
          opacity: 0,
          duration: 1,
          stagger: 0.15,
          ease: 'power4.out',
        }, '-=0.3')
        .from('.hero-desc', {
          y: 20,
          opacity: 0,
          duration: 0.8,
          ease: 'power3.out',
        }, '-=0.5')
        .from('.hero-btns', {
          y: 20,
          opacity: 0,
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
      gsap.utils.toArray<HTMLElement>('section:not(.hero-section)').forEach((section) => {
        // Parallax: section content moves slightly slower than scroll
        gsap.fromTo(
          section.querySelector('.max-w-7xl, .max-w-5xl, .max-w-6xl') || section,
          { y: 60 },
          {
            y: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: section,
              start: 'top bottom',
              end: 'top 20%',
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
  }, []);

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
        {/* Ambient 3D Canvas with floating papers (behind content) */}
        <Suspense fallback={null}>
          <AmbientCanvas
            style={{
              zIndex: 0,
              top: 0,
              height: '100%',
            }}
          >
            <FloatingPapers scrollProgress={scrollProgress} />
          </AmbientCanvas>
        </Suspense>

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
