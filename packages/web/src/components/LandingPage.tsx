import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';


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

interface LandingPageProps {
  onLaunch: () => void;
  isExiting?: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLaunch, isExiting }) => {
  const rootRef = useRef<HTMLDivElement>(null);

  // ─── Exit Animation ─────────────────────────────────────
  useEffect(() => {
    if (isExiting && rootRef.current) {
      gsap.to(rootRef.current, {
        opacity: 0,
        scale: 0.97,
        y: -20,
        duration: 0.5,
        ease: 'power3.inOut',
      });
    }
  }, [isExiting]);

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
        }, '-=0.6')
        .from('.hero-mockup', {
          y: 60,
          opacity: 0,
          scale: 0.95,
          duration: 1.2,
          ease: 'power2.out',
        }, '-=0.8');

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
    }, rootRef);

    // ── IntersectionObserver for scroll reveals ──────────────
    const revealElements = rootRef.current?.querySelectorAll(
      '.reveal, .reveal-scale, .reveal-left, .reveal-right'
    );

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.setAttribute('data-revealed', 'true');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );

    revealElements?.forEach((el) => observer.observe(el));

    return () => {
      ctx.revert();
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="min-h-screen font-sans overflow-x-hidden"
      style={{ color: 'var(--color-ink)' }}
    >
      <NavBar onLaunch={onLaunch} />
      <HeroSection onLaunch={onLaunch} />
      <StatsStrip />
      <PaperStylesSection onLaunch={onLaunch} />
      <AIFeatureSection onLaunch={onLaunch} />
      <BlockTypesBento onLaunch={onLaunch} />
      <AestheticsSection onLaunch={onLaunch} />
      <HowItWorksSection />
      <TestimonialsSection />
      <FinalCTA onLaunch={onLaunch} />
      <LandingFooter />
    </div>
  );
};
