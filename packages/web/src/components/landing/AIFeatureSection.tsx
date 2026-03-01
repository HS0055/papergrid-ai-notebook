import React, { useEffect, useState } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';

const steps = [
  {
    num: '01',
    title: 'Describe your need',
    desc: 'Type anything — "daily planner for a freelancer" or "gratitude journal with habit tracker."',
  },
  {
    num: '02',
    title: 'AI designs the layout',
    desc: 'Gemini 2.5 Flash generates a full notebook spread — headings, grids, matrices, callouts, and more.',
  },
  {
    num: '03',
    title: 'Write & customize',
    desc: 'Every block is editable. Move them, recolor, restyle. Your layout, your rules.',
  },
];

const prompts = [
  'Weekly planner for a startup founder',
  'Cornell notes for biology class',
  'Bullet journal for January goals',
  'Meeting notes with action items',
  'Gratitude journal with mood tracker',
  'Time-blocking schedule for deep work',
];

interface AIFeatureSectionProps {
  onLaunch: () => void;
}

export const AIFeatureSection: React.FC<AIFeatureSectionProps> = ({ onLaunch }) => {
  const [activePromptIdx, setActivePromptIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActivePromptIdx(i => (i + 1) % prompts.length);
    }, 2400);
    return () => clearInterval(timer);
  }, []);

  return (
    <section
      id="ai-feature"
      className="relative py-28 px-6 overflow-hidden"
      style={{ background: 'var(--color-ink)' }}
    >
      {/* Ambient glows */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(79,70,229,0.12) 0%, transparent 70%)', filter: 'blur(40px)' }}
      />
      <div
        className="absolute bottom-0 right-1/4 w-[350px] h-[350px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(217,119,6,0.08) 0%, transparent 70%)', filter: 'blur(60px)' }}
      />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Section title */}
        <div className="reveal text-center mb-20">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest mb-6 border"
            style={{ background: 'rgba(79,70,229,0.15)', borderColor: 'rgba(79,70,229,0.4)', color: '#a5b4fc' }}
          >
            <Sparkles size={13} />
            Gemini 2.5 Flash
          </div>
          <h2 className="font-serif font-bold text-white" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', lineHeight: 1.1 }}>
            Describe it.{' '}<span className="italic" style={{ color: '#818cf8' }}>Get a layout</span>{' '}instantly.
          </h2>
        </div>

        <div className="flex flex-col lg:flex-row items-center gap-16">
          {/* Left: Steps */}
          <div className="flex-1 space-y-10">
            {steps.map((step, i) => (
              <div key={step.num} className="reveal-left flex items-start gap-6" style={{ transitionDelay: `${i * 150}ms` }}>
                <span className="font-serif font-bold shrink-0 leading-none" style={{ fontSize: '3rem', color: 'rgba(79,70,229,0.4)' }}>
                  {step.num}
                </span>
                <div className="pt-2">
                  <h3 className="font-serif font-bold text-xl mb-2" style={{ color: 'rgba(248,250,252,0.95)' }}>{step.title}</h3>
                  <p style={{ color: '#64748b', lineHeight: 1.7 }}>{step.desc}</p>
                </div>
              </div>
            ))}

            <button
              onClick={onLaunch}
              className="reveal-left flex items-center gap-2 px-7 py-3.5 font-bold text-white rounded-xl transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', transitionDelay: '450ms' }}
            >
              Try it now <ArrowRight size={16} />
            </button>
          </div>

          {/* Right: Mockup terminal */}
          <div className="reveal-right flex-1 w-full max-w-lg" style={{ transitionDelay: '200ms' }}>
            <div
              className="rounded-2xl overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.5)]"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)' }}
            >
              {/* Terminal titlebar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.2)' }}>
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-amber-400/70" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
                <span className="ml-2 text-xs" style={{ color: 'rgba(148,163,184,0.6)' }}>AI Layout Generator</span>
              </div>

              {/* Prompt area */}
              <div className="p-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#4f46e5' }}>Your prompt</div>
                <div className="font-hand text-lg transition-all duration-500" style={{ color: 'rgba(248,250,252,0.9)', minHeight: '32px' }}>
                  {prompts[activePromptIdx]}
                  <span className="inline-block w-0.5 h-5 ml-0.5 align-middle animate-pulse" style={{ background: '#818cf8' }} />
                </div>
              </div>

              {/* Generated layout preview */}
              <div className="p-5">
                <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(148,163,184,0.7)' }}>✦ Generated Layout</div>
                <div className="flex gap-3">
                  <div className="flex-1 rounded-lg p-3 paper-lines" style={{ backgroundAttachment: 'local', minHeight: '120px' }}>
                    <div className="font-hand text-sm font-bold text-gray-700 mb-2">Monday</div>
                    {['9AM Team sync', '11AM Deep work', '2PM Review'].map((t, i) => (
                      <div key={i} className="flex items-center gap-1.5 mb-1">
                        <div className="w-2.5 h-2.5 rounded-full border border-indigo-400 shrink-0" />
                        <span className="font-hand text-xs text-gray-600">{t}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 rounded-lg p-3 paper-dots" style={{ backgroundAttachment: 'local', minHeight: '120px' }}>
                    <div className="font-hand text-sm font-bold text-gray-700 mb-2">Priorities</div>
                    <div className="grid grid-cols-2 gap-1 h-16">
                      {['🔴 Urgent', '🟡 Plan', '🔵 Delegate', '⚪ Drop'].map((q, i) => (
                        <div key={i} className="rounded text-center flex items-center justify-center" style={{ background: ['rgba(251,113,133,0.15)', 'rgba(251,191,36,0.15)', 'rgba(56,189,248,0.15)', 'rgba(148,163,184,0.1)'][i], fontSize: '9px' }}>
                          <span className="font-hand text-gray-700 text-[9px]">{q}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Prompt chips */}
            <div className="mt-5 flex flex-wrap gap-2">
              {prompts.slice(0, 4).map((p, i) => (
                <button
                  key={i}
                  onClick={() => setActivePromptIdx(i)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                  style={{
                    background: activePromptIdx === i ? 'rgba(79,70,229,0.3)' : 'rgba(255,255,255,0.06)',
                    color: activePromptIdx === i ? '#a5b4fc' : 'rgba(148,163,184,0.7)',
                    border: `1px solid ${activePromptIdx === i ? 'rgba(79,70,229,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
