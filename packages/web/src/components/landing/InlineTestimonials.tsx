import React, { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface Testimonial {
  name: string;
  role: string;
  quote: string;
  color: string;
}

const testimonials: Testimonial[] = [
  {
    name: 'Sarah Chen',
    role: 'Graduate Student',
    quote: 'Papera replaced three different apps for me. The AI layouts save me hours every week organizing my research notes.',
    color: '#4f46e5', // indigo
  },
  {
    name: 'Marcus Rivera',
    role: 'Product Designer',
    quote: 'The paper textures feel so real. I actually enjoy digital note-taking now — something I never thought I\'d say.',
    color: '#d97706', // amber
  },
  {
    name: 'Aiko Tanaka',
    role: 'Music Teacher',
    quote: 'The music staff paper type is a game-changer. My students love creating compositions right in their notebooks.',
    color: '#8b6f4e', // leather
  },
];

export const InlineTestimonials: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    const cards = cardRefs.current.filter(Boolean) as HTMLDivElement[];

    gsap.set(cards, { y: 40, opacity: 0, scale: 0.95 });

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: containerRef.current,
        start: 'top 85%',
        once: true,
        onEnter: () => {
          gsap.to(cards, {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.7,
            stagger: 0.1, // 0.1s between cards as per requirements
            ease: 'power2.out',
          });
        },
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="py-16 px-6" style={{ background: '#f8f6f3' }}>
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div
              key={i}
              ref={(el) => { cardRefs.current[i] = el; }}
              className="relative rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-300"
              style={{
                background: 'rgba(255,255,255,0.7)',
                // Masonry-style height variation: first card gets extra top padding
                paddingTop: i === 0 ? '2rem' : '1.5rem',
                paddingBottom: '1.5rem',
                paddingLeft: '1.5rem',
                paddingRight: '1.5rem',
              }}
            >
              {/* Decorative quotation mark - Caveat font, oversized, muted */}
              <span
                className="absolute left-6 font-marker leading-none select-none pointer-events-none"
                style={{
                  fontSize: '5rem', // text-6xl+ for oversized effect
                  color: t.color,
                  opacity: 0.15,
                  top: i === 0 ? '0.5rem' : '0rem', // Adjust for masonry padding
                }}
                aria-hidden="true"
              >
                &ldquo;
              </span>

              {/* Quote - larger, italic, serif */}
              <p className="relative text-lg italic font-serif leading-relaxed mb-6 pt-8" style={{ color: '#374151' }}>
                {t.quote}
              </p>

              {/* Author - smaller muted text */}
              <div className="flex items-center gap-3">
                {/* Monogram avatar - first letter in colored circle */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                  style={{ background: t.color }}
                >
                  {t.name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">{t.name}</div>
                  <div className="text-xs text-gray-500">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
