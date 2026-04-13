import React from 'react';
import { PenLine, Sparkles, BookOpen } from 'lucide-react';

const steps = [
  {
    num: '01',
    icon: <PenLine size={28} />,
    title: 'Describe',
    desc: "Say it in plain English. 'Sprint planning with priorities' or 'gratitude journal for January.' No form to fill. No template to pick.",
    color: '#4f46e5',
    lightBg: '#eef2ff',
  },
  {
    num: '02',
    icon: <Sparkles size={28} />,
    title: 'Generate',
    desc: 'Papera reads your intent and builds a complete two-page spread — paper texture, headings, blocks, grids — everything in its right place.',
    color: '#d97706',
    lightBg: '#fffbeb',
  },
  {
    num: '03',
    icon: <BookOpen size={28} />,
    title: 'Write',
    desc: 'Every block is yours. Edit, reorder, recolor, change paper textures. When it feels right, it stays right.',
    color: '#059669',
    lightBg: '#ecfdf5',
  },
];

export const HowItWorksSection: React.FC = () => {
  return (
    <section id="how-it-works" className="py-24 px-6" style={{ background: 'var(--color-parchment)' }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="reveal text-center mb-20">
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--color-indigo-brand)' }}>
            How It Works
          </p>
          <h2
            className="font-serif font-bold"
            style={{ fontSize: 'clamp(2.2rem, 4vw, 3.5rem)', color: 'var(--color-ink)', lineHeight: 1.15 }}
          >
            Describe it once.{' '}
            <span className="italic" style={{ color: 'var(--color-indigo-brand)' }}>Never start from scratch again.</span>
          </h2>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          <div
            className="hidden md:block absolute top-12 left-1/4 right-1/4 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, var(--color-line), var(--color-line), transparent)' }}
          />

          {steps.map((step, i) => (
            <div key={i} className="reveal relative flex flex-col items-center text-center" style={{ transitionDelay: `${i * 150}ms` }}>
              <span
                className="absolute -top-4 left-1/2 -translate-x-1/2 font-serif font-bold pointer-events-none select-none"
                style={{ fontSize: '8rem', lineHeight: 1, color: 'rgba(203,213,225,0.35)', zIndex: 0 }}
              >
                {step.num}
              </span>
              <div
                className="relative z-10 w-20 h-20 rounded-2xl flex items-center justify-center mb-6 shadow-sm"
                style={{ background: step.lightBg, color: step.color }}
              >
                {step.icon}
              </div>
              <h3 className="relative z-10 font-serif font-bold text-2xl mb-3" style={{ color: 'var(--color-ink)' }}>{step.title}</h3>
              <p className="relative z-10 text-base leading-relaxed max-w-xs" style={{ color: '#64748b' }}>{step.desc}</p>
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-10 -right-4 z-20 text-gray-300 font-bold text-xl" style={{ fontSize: '1.5rem' }}>→</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
