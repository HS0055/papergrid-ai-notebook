import React, { useEffect, useRef, useCallback } from 'react';
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
import { HowItWorksSection } from './landing/HowItWorksSection';
import { TestimonialsSection } from './landing/TestimonialsSection';
import { FinalCTA } from './landing/FinalCTA';
import { LandingFooter } from './landing/LandingFooter';

gsap.registerPlugin(ScrollTrigger);

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);

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

      // Floating paper cards idle animation
      gsap.to('.floating-paper', {
        y: 'random(-18, 18)',
        x: 'random(-8, 8)',
        rotation: 'random(-4, 4)',
        duration: 'random(2.5, 4.5)',
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        stagger: {
          each: 0.7,
          from: 'random',
        },
      });

      // ── ScrollTrigger reveals for sections below hero ──
      const revealSelectors = '.reveal, .reveal-scale, .reveal-left, .reveal-right';
      gsap.utils.toArray<HTMLElement>(revealSelectors).forEach((el) => {
        ScrollTrigger.create({
          trigger: el,
          start: 'top 92%',
          onEnter: () => el.setAttribute('data-revealed', 'true'),
          once: true,
        });
      });

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
      <NavBar onLaunch={handleLaunch} />
      <HeroSection onLaunch={handleLaunch} />
      <StatsStrip />
      <PaperStylesSection onLaunch={handleLaunch} />
      <AIFeatureSection onLaunch={handleLaunch} />
      <BlockTypesBento onLaunch={handleLaunch} />
      <AestheticsSection onLaunch={handleLaunch} />
      <HowItWorksSection />
      <TestimonialsSection />
      <FinalCTA onLaunch={handleLaunch} />
      <LandingFooter />
    </div>
  );
};
