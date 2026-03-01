import React, { useEffect, useRef, useState } from 'react';
import { X, ChevronRight } from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface FloatingCTABarProps {
  onLaunch: () => void;
}

/**
 * Floating CTA bar that appears after 60% scroll progress.
 * - Slides up from bottom (GSAP animation)
 * - Dismissible with X button
 * - Hides when FinalCTA section is visible
 * - Hides when scrolled back to top (hero area)
 */
export const FloatingCTABar: React.FC<FloatingCTABarProps> = ({ onLaunch }) => {
  const barRef = useRef<HTMLDivElement>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isFinalCTAVisible, setIsFinalCTAVisible] = useState(false);
  const scrollProgressRef = useRef(0);

  useEffect(() => {
    if (!barRef.current || isDismissed) return;

    // Set initial state (hidden below viewport)
    gsap.set(barRef.current, { y: '100%', opacity: 0 });

    // Track scroll progress (0 to 1)
    const updateScrollProgress = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrolled = window.scrollY;
      scrollProgressRef.current = scrolled / scrollHeight;
    };

    // Passive scroll listener for performance
    window.addEventListener('scroll', updateScrollProgress, { passive: true });
    updateScrollProgress(); // Initial calculation

    // ScrollTrigger for visibility based on scroll position
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        start: 'top top',
        end: 'max',
        onUpdate: () => {
          const progress = scrollProgressRef.current;
          const isInHeroArea = window.scrollY < window.innerHeight * 0.4; // Top 40% = hero area
          const shouldShow = progress >= 0.6 && !isInHeroArea && !isFinalCTAVisible;

          if (barRef.current) {
            if (shouldShow) {
              // Show bar with slide-up animation
              gsap.to(barRef.current, {
                y: '0%',
                opacity: 1,
                duration: 0.4,
                ease: 'power3.out',
              });
            } else {
              // Hide bar
              gsap.to(barRef.current, {
                y: '100%',
                opacity: 0,
                duration: 0.3,
                ease: 'power2.in',
              });
            }
          }
        },
      });
    }, barRef);

    // IntersectionObserver for FinalCTA section visibility
    const finalCTASection = document.querySelector('section:has([class*="Create Your Notebook"])') as HTMLElement;

    if (finalCTASection) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          setIsFinalCTAVisible(entry.isIntersecting);
        },
        {
          threshold: 0.1, // Trigger when 10% of FinalCTA is visible
          rootMargin: '0px 0px -100px 0px', // Trigger slightly before fully visible
        }
      );

      observer.observe(finalCTASection);

      return () => {
        observer.disconnect();
        window.removeEventListener('scroll', updateScrollProgress);
        ctx.revert();
      };
    }

    return () => {
      window.removeEventListener('scroll', updateScrollProgress);
      ctx.revert();
    };
  }, [isDismissed, isFinalCTAVisible]);

  const handleDismiss = () => {
    if (barRef.current) {
      gsap.to(barRef.current, {
        y: '100%',
        opacity: 0,
        duration: 0.3,
        ease: 'power2.in',
        onComplete: () => setIsDismissed(true),
      });
    }
  };

  if (isDismissed) return null;

  return (
    <div
      ref={barRef}
      data-floating-cta-bar
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{
        transform: 'translateY(100%)',
        opacity: 0,
      }}
    >
      {/* Backdrop blur container */}
      <div
        className="w-full backdrop-blur-md border-t"
        style={{
          background: 'rgba(15, 17, 26, 0.95)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Content wrapper */}
        <div className="max-w-7xl mx-auto px-6 h-12 flex items-center justify-between">
          {/* Left: Message */}
          <p className="text-sm font-semibold text-white">
            Start Creating — Free
          </p>

          {/* Right: CTA button + Dismiss */}
          <div className="flex items-center gap-3">
            <button
              onClick={onLaunch}
              className="flex items-center gap-2 px-5 py-2 text-white text-sm font-bold rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                boxShadow: '0 4px 16px rgba(79, 70, 229, 0.4)',
              }}
            >
              Launch App
              <ChevronRight size={16} />
            </button>

            {/* Dismiss button */}
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-md transition-colors hover:bg-white/10"
              aria-label="Dismiss"
            >
              <X size={18} className="text-white/60 hover:text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
