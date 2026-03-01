import React, { useRef } from 'react';
import { Sparkles, ChevronRight, Github } from 'lucide-react';

interface HeroSectionProps {
  onLaunch: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onLaunch }) => {
  const sectionRef = useRef<HTMLElement>(null);

  return (
    <section
      ref={sectionRef}
      className="hero-section relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6 pt-24 pb-16"
      style={{
        background: 'linear-gradient(160deg, #0f111a 0%, #1a1c23 45%, #2a1f3d 70%, #F4F0EC 100%)',
      }}
    >
      {/* Ambient glow blobs */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse, rgba(79,70,229,0.18) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
      <div
        className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse, rgba(217,119,6,0.12) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />

      {/* Floating Paper Cards */}
      <div
        className="floating-paper absolute hidden lg:block"
        style={{
          top: '18%',
          left: '4%',
          width: '160px',
          height: '200px',
          transform: 'rotate(-14deg)',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          opacity: 0.55,
          border: '1px solid rgba(203,213,225,0.3)',
        }}
      >
        <div
          className="w-full h-full paper-lines"
          style={{ backgroundAttachment: 'local' }}
        />
      </div>

      <div
        className="floating-paper absolute hidden lg:block"
        style={{
          top: '14%',
          right: '5%',
          width: '140px',
          height: '175px',
          transform: 'rotate(10deg)',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          opacity: 0.45,
          border: '1px solid rgba(203,213,225,0.3)',
        }}
      >
        <div className="w-full h-full paper-grid" style={{ backgroundAttachment: 'local' }} />
      </div>

      <div
        className="floating-paper absolute hidden lg:block"
        style={{
          bottom: '30%',
          left: '7%',
          width: '110px',
          height: '140px',
          transform: 'rotate(-6deg)',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          opacity: 0.35,
          border: '1px solid rgba(203,213,225,0.3)',
        }}
      >
        <div className="w-full h-full paper-dots" style={{ backgroundAttachment: 'local' }} />
      </div>

      {/* Floating Sticky Note */}
      <div
        className="floating-paper absolute hidden xl:block"
        style={{
          top: '32%',
          right: '7%',
          width: '130px',
          padding: '12px',
          background: '#fef3c7',
          borderRadius: '4px',
          boxShadow: '4px 8px 24px rgba(0,0,0,0.3)',
          opacity: 0.7,
          transform: 'rotate(3deg)',
        }}
      >
        {/* Washi tape */}
        <div
          style={{
            position: 'absolute',
            top: '-10px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '48px',
            height: '20px',
            background: 'rgba(217,119,6,0.4)',
            borderRadius: '2px',
          }}
        />
        <p className="font-hand text-amber-800 text-xs leading-relaxed">
          Today's focus: ship something meaningful ✨
        </p>
      </div>

      {/* Main Content */}
      <div className="relative z-10 text-center max-w-5xl mx-auto">
        {/* Badge */}
        <div className="hero-badge inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-8 border"
          style={{
            background: 'rgba(79,70,229,0.15)',
            borderColor: 'rgba(79,70,229,0.4)',
            color: '#a5b4fc',
          }}
        >
          <Sparkles size={14} />
          <span>Powered by Gemini 2.5 Flash</span>
        </div>

        {/* Headline */}
        <h1
          className="font-serif font-bold tracking-tight mb-6 leading-[1.05] text-white"
          style={{ fontSize: 'clamp(3.5rem, 9vw, 7.5rem)' }}
        >
          <span className="hero-word block">The notebook</span>
          <span className="hero-word block" style={{ color: '#818cf8' }}>that thinks</span>
          <span className="hero-word block italic" style={{ color: '#F4F0EC' }}>with you.</span>
        </h1>

        {/* Subheadline */}
        <p className="hero-desc max-w-2xl mx-auto text-lg md:text-xl mb-10 leading-relaxed" style={{ color: '#94a3b8' }}>
          Describe your day, task, or idea — AI generates the perfect notebook layout instantly. 
          Beautifully crafted paper textures, infinite notebooks.
        </p>

        {/* CTAs */}
        <div className="hero-btns flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
          <button
            onClick={onLaunch}
            className="w-full sm:w-auto flex items-center justify-center gap-3 px-9 py-4 text-white font-bold text-lg rounded-2xl transition-all hover:scale-[1.03] active:scale-[0.98] shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              boxShadow: '0 20px 60px rgba(79,70,229,0.4)',
            }}
          >
            Start Writing Now
            <ChevronRight size={20} />
          </button>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto flex items-center justify-center gap-3 px-9 py-4 font-bold text-lg rounded-2xl border transition-all hover:bg-white/5"
            style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.7)' }}
          >
            <Github size={20} />
            View on GitHub
          </a>
        </div>

        {/* Trust line */}
        <p className="text-xs font-medium tracking-widest uppercase" style={{ color: 'rgba(148,163,184,0.6)' }}>
          Free · AI-Powered · No credit card needed
        </p>
      </div>

      {/* Open Book Mockup */}
      <div className="hero-mockup relative z-10 w-full max-w-5xl mx-auto mt-16">
        {/* Glow behind book */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 50% 60%, rgba(79,70,229,0.25) 0%, transparent 65%)',
            filter: 'blur(30px)',
          }}
        />

        {/* Notebook Cover */}
        <div
          className="relative rounded-2xl overflow-hidden shadow-[0_40px_120px_rgba(0,0,0,0.6)]"
          style={{ background: '#1e1b2e', padding: '6px' }}
        >
          {/* Inner book spread */}
          <div className="flex rounded-xl overflow-hidden" style={{ minHeight: '340px' }}>
            {/* Left Page */}
            <div className="flex-1 paper-lines flex flex-col p-6 md:p-8" style={{ backgroundAttachment: 'local' }}>
              {/* Red margin line */}
              <div className="absolute top-0 bottom-0" style={{ left: '52px', width: '1px', background: 'rgba(248,113,113,0.4)' }} />

              <div className="relative z-10">
                <div className="font-hand text-2xl font-bold text-gray-700 mb-2">Daily Planning</div>
                <div className="text-xs uppercase tracking-widest text-gray-400 mb-6 font-sans">March 1, 2026</div>

                {/* Mini grid table */}
                <div className="border border-indigo-200 rounded-lg overflow-hidden bg-white/60 mb-4">
                  <div className="grid grid-cols-3 bg-indigo-50 border-b border-indigo-200">
                    {['Time', 'Task', 'Status'].map(h => (
                      <div key={h} className="px-2 py-1 text-xs font-bold text-indigo-600 uppercase tracking-wide">{h}</div>
                    ))}
                  </div>
                  {[['9:00 AM', 'Design review', '✓'], ['11:00 AM', 'Team standup', '→'], ['2:00 PM', 'Write proposal', '○']].map((row, i) => (
                    <div key={i} className="grid grid-cols-3 border-b border-indigo-100 last:border-none">
                      {row.map((cell, j) => (
                        <div key={j} className="px-2 py-1.5 font-hand text-sm text-gray-700">{cell}</div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Callout sticky */}
                <div className="relative bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-10 h-4 bg-amber-200/80 rounded-sm" />
                  <p className="font-hand text-amber-800 text-sm">Focus: Launch the new landing page 🚀</p>
                </div>
              </div>
            </div>

            {/* Spine */}
            <div className="w-3 shrink-0 bg-gradient-to-r from-black/30 to-black/10 shadow-[inset_-4px_0_12px_rgba(0,0,0,0.3)]" />

            {/* Right Page */}
            <div className="flex-1 paper-dots flex flex-col p-6 md:p-8" style={{ backgroundAttachment: 'local' }}>
              <div className="font-hand text-xl font-bold text-gray-700 mb-4">Priority Matrix</div>

              {/* Priority Matrix */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {[
                  { label: 'Do First', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', items: ['Ship landing page', 'Fix auth bug'] },
                  { label: 'Schedule', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', items: ['Write blog post'] },
                  { label: 'Delegate', bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', items: ['Update docs'] },
                  { label: 'Eliminate', bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600', items: ['Old meeting'] },
                ].map(q => (
                  <div key={q.label} className={`${q.bg} border ${q.border} rounded-lg p-2`}>
                    <div className={`text-[9px] font-bold uppercase ${q.text} mb-1`}>{q.label}</div>
                    {q.items.map(item => (
                      <div key={item} className="font-hand text-xs text-gray-700">• {item}</div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Mood Tracker */}
              <div className="flex items-center gap-2 bg-white/60 rounded-lg p-2 border border-gray-200">
                <span className="font-sans text-xs font-bold text-gray-400 uppercase tracking-wide">Mood</span>
                {['😢', '😕', '😐', '🙂', '😄'].map((e, i) => (
                  <span key={i} className={`text-lg ${i === 3 ? 'scale-125' : 'grayscale opacity-50'} transition-all`}>{e}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
