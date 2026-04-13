import React, { useEffect, useState, useRef } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const steps = [
  {
    num: '01',
    title: 'No templates. No drag-and-drop.',
    desc: 'Just describe what you need — Papera handles the structure. No blank page, no format hunting.',
  },
  {
    num: '02',
    title: 'Papera builds the spread',
    desc: 'Reads your intent. Builds a complete two-page spread — paper texture, headings, blocks, grids — everything in its right place.',
  },
  {
    num: '03',
    title: 'Every block is yours',
    desc: 'Edit, reorder, recolor, switch paper textures. When a layout is right, it stays right — no rebuilding it again next week.',
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

interface PromptOutput {
  heading: string;
  tasks: string[];
  grid: { label: string; sub: string }[];
}

const promptOutputs: PromptOutput[] = [
  {
    heading: "Founder's Week — Apr 2026",
    tasks: [
      'Mon: Investor deck review + email outreach',
      'Tue: Team standup, 1:1s, async sprint review',
      'Wed: Customer discovery calls (3×)',
      'Thu: Product roadmap deep-dive (2h block)',
      'Fri: Changelog draft + Product Hunt prep',
      'Sat: Weekly reflection + OKR check-in',
    ],
    grid: [
      { label: 'Focus', sub: '8–10am' },
      { label: 'Meetings', sub: '11–1pm' },
      { label: 'Growth', sub: '3–5pm' },
    ],
  },
  {
    heading: 'Biology 301 — Cell Division',
    tasks: [
      'Mitosis: 4 phases (PMAT)',
      'Meiosis → 4 haploid cells',
      'Checkpoints: G1, G2, M',
    ],
    grid: [
      { label: 'Cue', sub: 'Notes' },
      { label: 'Key Q', sub: 'Answer' },
      { label: 'Summary', sub: '↓' },
    ],
  },
  {
    heading: 'January 2026 ✦',
    tasks: [
      '○ Read 2 books this month',
      '• Morning pages daily',
      '✓ Gym 4× / week habit',
    ],
    grid: [
      { label: 'Habit', sub: 'Streak' },
      { label: 'Goal', sub: '% Done' },
      { label: 'Mood', sub: 'Avg ⭐' },
    ],
  },
  {
    heading: 'Product Sync — Apr 14',
    tasks: [
      '@alex: Ship v2 by Friday',
      '@sam: Update onboarding flow',
      '@team: Review Q2 roadmap',
    ],
    grid: [
      { label: 'Owner', sub: '@alex' },
      { label: 'Due', sub: 'Apr 18' },
      { label: 'Status', sub: '🔴 In prog' },
    ],
  },
  {
    heading: "Today I'm grateful for…",
    tasks: [
      '☀️ Quiet morning coffee',
      '💙 Team support at review',
      '🌧 Rain on the window',
    ],
    grid: [
      { label: '😊', sub: 'Energy 8' },
      { label: '☁️', sub: 'Stress 3' },
      { label: '✨', sub: 'Focus 9' },
    ],
  },
  {
    heading: 'Deep Work — Thursday',
    tasks: [
      '8–10am: Writing (no meetings)',
      '11–1pm: Code review + PRs',
      '2–4pm: Strategic planning',
    ],
    grid: [
      { label: 'AM', sub: 'Deep' },
      { label: 'PM', sub: 'Shallow' },
      { label: 'Eve', sub: 'Rest' },
    ],
  },
];

interface AIFeatureSectionProps {
  onLaunch: () => void;
}

export const AIFeatureSection: React.FC<AIFeatureSectionProps> = ({ onLaunch }) => {
  const [activePromptIdx, setActivePromptIdx] = useState(0);
  const [displayedIdx, setDisplayedIdx] = useState(0);
  const demoRef = useRef<HTMLDivElement>(null);
  const typingTextRef = useRef<HTMLSpanElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const thinkingRef = useRef<HTMLDivElement>(null);
  const headingBlockRef = useRef<HTMLDivElement>(null);
  const checklistBlockRef = useRef<HTMLDivElement>(null);
  const gridBlockRef = useRef<HTMLDivElement>(null);
  const hasInitAnimated = useRef(false);
  const isAnimatingRef = useRef(false);

  // Auto-cycle chips
  useEffect(() => {
    const timer = setInterval(() => {
      setActivePromptIdx(i => (i + 1) % prompts.length);
    }, 2400);
    return () => clearInterval(timer);
  }, []);

  // Initial scroll-triggered animation (runs once)
  useEffect(() => {
    if (!demoRef.current || !typingTextRef.current) return;

    const ctx = gsap.context(() => {
      gsap.set(thinkingRef.current, { opacity: 0, scale: 0.8 });
      gsap.set([headingBlockRef.current, checklistBlockRef.current, gridBlockRef.current], {
        opacity: 0,
        y: 20,
        scale: 0.95,
      });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: demoRef.current,
          start: 'top 70%',
          once: true,
        },
      });

      const promptText = prompts[0];
      const charCount = { val: 0 };

      tl.to(charCount, {
        val: promptText.length,
        duration: 2,
        ease: 'none',
        onUpdate: () => {
          const currentLength = Math.floor(charCount.val);
          if (typingTextRef.current) {
            typingTextRef.current.textContent = promptText.substring(0, currentLength);
          }
          if (cursorRef.current) {
            cursorRef.current.style.opacity = Math.random() > 0.3 ? '1' : '0';
          }
        },
      });

      tl.to(cursorRef.current, { duration: 0.1, opacity: 1 });

      tl.to(cursorRef.current, { opacity: 0, duration: 0.3 }, '+=0.3');
      tl.to(thinkingRef.current, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.7)' }, '-=0.1');
      tl.to({}, { duration: 1.8 });

      tl.to(thinkingRef.current, { opacity: 0, scale: 0.8, duration: 0.3 });
      tl.to(headingBlockRef.current, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(1.7)' }, '+=0.2');
      tl.to(checklistBlockRef.current, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(1.7)' }, '-=0.2');
      tl.to(gridBlockRef.current, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(1.7)' }, '-=0.2');

      tl.call(() => {
        hasInitAnimated.current = true;
      });
    }, demoRef);

    return () => ctx.revert();
  }, []);

  // Chip-click animation: re-type prompt + swap output content
  useEffect(() => {
    if (!hasInitAnimated.current) return;
    if (isAnimatingRef.current) return;

    const blocks = [
      headingBlockRef.current,
      checklistBlockRef.current,
      gridBlockRef.current,
    ].filter(Boolean) as HTMLElement[];
    if (!blocks.length) return;

    isAnimatingRef.current = true;

    const promptText = prompts[activePromptIdx];

    // Clear typing area immediately
    if (typingTextRef.current) typingTextRef.current.textContent = '';
    if (cursorRef.current) cursorRef.current.style.opacity = '1';

    const tl = gsap.timeline({
      onComplete: () => {
        isAnimatingRef.current = false;
      },
    });

    // Fade out existing blocks
    tl.to(blocks, {
      opacity: 0,
      y: 8,
      scale: 0.97,
      duration: 0.2,
      ease: 'power2.in',
      stagger: 0.04,
    });

    // Quick re-type of the new prompt
    const charCount = { val: 0 };
    tl.to(
      charCount,
      {
        val: promptText.length,
        duration: Math.min(1.4, promptText.length * 0.042),
        ease: 'none',
        onUpdate: () => {
          const currentLength = Math.floor(charCount.val);
          if (typingTextRef.current) {
            typingTextRef.current.textContent = promptText.substring(0, currentLength);
          }
        },
        onComplete: () => {
          if (cursorRef.current) cursorRef.current.style.opacity = '0';
        },
      },
      '-=0.1',
    );

    // Show thinking dots while "generating"
    tl.to(thinkingRef.current, { opacity: 1, scale: 1, duration: 0.25, ease: 'back.out(1.7)' }, '+=0.05');
    tl.to(thinkingRef.current, { opacity: 0, scale: 0.8, duration: 0.2 }, '+=0.65');

    // Swap content then reveal
    tl.call(() => setDisplayedIdx(activePromptIdx));
    tl.to(blocks, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.4,
      ease: 'back.out(1.7)',
      stagger: 0.07,
    }, '+=0.05');
  }, [activePromptIdx]);

  const output = promptOutputs[displayedIdx];

  return (
    <section
      id="ai-feature"
      className="relative py-28 px-6 overflow-hidden"
      style={{ background: '#f8f6f3' }}
    >
      {/* Ambient glows */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(79,70,229,0.06) 0%, transparent 70%)', filter: 'blur(40px)' }}
      />
      <div
        className="absolute bottom-0 right-1/4 w-[350px] h-[350px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(217,119,6,0.04) 0%, transparent 70%)', filter: 'blur(60px)' }}
      />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Section title */}
        <div className="reveal text-center mb-14">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest mb-6 border"
            style={{ background: 'rgba(79,70,229,0.08)', borderColor: 'rgba(79,70,229,0.2)', color: '#4f46e5' }}
          >
            <Sparkles size={13} />
            The AI Layout Engine
          </div>
          <h2 className="font-serif font-bold mb-4" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', lineHeight: 1.1, color: 'var(--color-ink)' }}>
            Say it.{' '}<span className="italic" style={{ color: '#4f46e5' }}>Papera builds it.</span>
          </h2>
          <p className="max-w-xl mx-auto text-lg" style={{ color: '#64748b', lineHeight: 1.7 }}>
            Describe your week in one sentence. Papera builds a complete notebook layout — paper texture, headings, interactive blocks — in seconds.
          </p>
        </div>

        {/* Unified demo panel */}
        <div
          ref={demoRef}
          className="reveal rounded-3xl overflow-hidden mb-12"
          style={{
            background: '#ffffff',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.1), 0 4px 20px rgba(0,0,0,0.05)',
          }}
        >
          <div className="flex flex-col lg:flex-row">
            {/* Left column: prompt input (~40%) */}
            <div
              className="lg:w-2/5 p-8 flex flex-col gap-6"
              style={{ borderRight: '1px solid rgba(0,0,0,0.07)', background: '#fafafa' }}
            >
              {/* Prompt label */}
              <div>
                <div
                  className="text-xs font-bold uppercase tracking-widest mb-3"
                  style={{ color: '#4f46e5' }}
                >
                  Your prompt
                </div>
                {/* Animated typewriter prompt */}
                <div
                  className="font-hand text-lg rounded-xl p-4"
                  style={{
                    color: '#1a1c23',
                    minHeight: '64px',
                    background: 'rgba(79,70,229,0.04)',
                    border: '1px solid rgba(79,70,229,0.12)',
                  }}
                >
                  <span ref={typingTextRef}></span>
                  <span
                    ref={cursorRef}
                    className="inline-block w-0.5 h-5 ml-0.5 align-middle"
                    style={{ background: '#4f46e5', opacity: 0 }}
                  />
                </div>
              </div>

              {/* Prompt chip buttons */}
              <div>
                <div className="text-xs font-medium mb-2" style={{ color: '#94a3b8' }}>
                  Pick a prompt to see it live:
                </div>
                <div className="flex flex-col gap-1.5">
                  {prompts.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => setActivePromptIdx(i)}
                      className="text-left px-3 py-2 rounded-lg text-sm font-medium transition-all"
                      style={{
                        background: activePromptIdx === i ? 'rgba(79,70,229,0.1)' : 'transparent',
                        color: activePromptIdx === i ? '#4f46e5' : '#64748b',
                        border: `1px solid ${activePromptIdx === i ? 'rgba(79,70,229,0.25)' : 'rgba(0,0,0,0.07)'}`,
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right column: generated output (~60%) */}
            <div className="lg:w-3/5 relative" style={{ minHeight: '380px' }}>
              <div
                className="absolute inset-0 paper-lines"
                style={{ backgroundAttachment: 'local' }}
              />
              <div className="relative z-10 p-8" style={{ minHeight: '380px' }}>
                {/* Thinking indicator */}
                <div
                  ref={thinkingRef}
                  className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full z-20"
                  style={{ background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.2)' }}
                >
                  <span className="text-xs font-medium" style={{ color: '#4f46e5' }}>AI thinking</span>
                  <div className="flex gap-1">
                    <div className="thinking-dot"></div>
                    <div className="thinking-dot"></div>
                    <div className="thinking-dot"></div>
                  </div>
                </div>

                {/* Generated blocks — content driven by displayedIdx */}
                <div className="space-y-4">
                  {/* Heading block */}
                  <div
                    ref={headingBlockRef}
                    className="p-4 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(79,70,229,0.2)' }}
                  >
                    <h4 className="font-hand font-bold text-xl text-gray-800">{output.heading}</h4>
                  </div>

                  {/* Checklist block */}
                  <div
                    ref={checklistBlockRef}
                    className="p-4 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(148,163,184,0.2)' }}
                  >
                    <div className="space-y-2">
                      {output.tasks.map((task, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded border-2 border-gray-400 shrink-0"></div>
                          <span className="font-hand text-sm text-gray-700">{task}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Grid/table block */}
                  <div
                    ref={gridBlockRef}
                    className="p-4 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(148,163,184,0.2)' }}
                  >
                    <div className="grid grid-cols-3 gap-2">
                      {output.grid.map((cell, i) => (
                        <div
                          key={i}
                          className="text-center p-2 rounded"
                          style={{ background: 'rgba(79,70,229,0.08)' }}
                        >
                          <div className="font-hand text-xs font-bold text-gray-600">{cell.label}</div>
                          <div className="font-hand text-[10px] text-gray-500 mt-1">{cell.sub}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step callout strips */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-12">
          {steps.map((step, i) => (
            <div
              key={step.num}
              className="reveal rounded-2xl px-6 py-5"
              style={{
                background: 'rgba(79,70,229,0.05)',
                border: '1px solid rgba(79,70,229,0.12)',
                transitionDelay: `${i * 100}ms`,
              }}
            >
              <div className="flex items-start gap-4">
                <span
                  className="font-serif font-bold shrink-0 leading-none mt-0.5"
                  style={{ fontSize: '1.75rem', color: 'rgba(79,70,229,0.3)' }}
                >
                  {step.num}
                </span>
                <div>
                  <h3 className="font-serif font-bold text-base mb-1" style={{ color: 'var(--color-ink)' }}>
                    {step.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#64748b' }}>
                    {step.desc}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="reveal text-center">
          <button
            onClick={onLaunch}
            className="inline-flex items-center gap-2 font-bold text-white transition-all hover:opacity-90"
            style={{
              background: '#4f46e5',
              borderRadius: '10px',
              padding: '11px 28px',
              boxShadow: '0 4px 16px rgba(79,70,229,0.28)',
            }}
          >
            Build my first layout <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
};
