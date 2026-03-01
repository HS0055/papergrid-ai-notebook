import React from 'react';

const aesthetics = [
  {
    id: 'modern-planner',
    name: 'Modern Planner',
    tag: 'Best for daily planning',
    desc: 'Comprehensive dashboards with finance, wellness, and schedule sections. Clean and highly functional.',
    paperClass: 'paper-lines',
    bg: '#fdfbf7',
    accentColor: '#4f46e5',
    accentBg: '#eef2ff',
    preview: (
      <div className="space-y-2 opacity-90">
        <div className="h-5 w-2/3 rounded bg-indigo-100 border border-indigo-200" />
        <div className="h-4 w-full rounded bg-gray-50 border border-gray-200" />
        <div className="h-4 w-full rounded bg-gray-50 border border-gray-200" />
        <div className="grid grid-cols-3 gap-1.5 mt-3">
          {['💰 Finance', '💪 Health', '📅 Schedule'].map(l => (
            <div key={l} className="bg-indigo-50 border border-indigo-100 rounded p-1.5 text-center text-[9px] font-bold text-indigo-600 font-sans">{l}</div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'e-ink',
    name: 'E-Ink Minimal',
    tag: 'Best for deep focus',
    desc: 'High contrast minimalism optimized for focus and clarity. Inspired by reMarkable Pro.',
    paperClass: 'paper-grid',
    bg: '#fdfbf7',
    accentColor: '#475569',
    accentBg: '#f1f5f9',
    preview: (
      <div className="space-y-2 opacity-90">
        <div className="h-6 w-1/2 rounded-sm bg-slate-800" />
        {['9:00', '10:00', '11:00', '12:00'].map(t => (
          <div key={t} className="flex items-center gap-2">
            <span className="font-mono text-[9px] text-gray-400 w-8 shrink-0">{t}</span>
            <div className="flex-1 h-5 rounded-sm border border-slate-200 bg-slate-50" />
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'bujo',
    name: 'Bullet Journal',
    tag: 'Best for creativity',
    desc: 'Playful, freeform layouts with habit trackers and mood logs. Hand-drawn feel, digital speed.',
    paperClass: 'paper-dots',
    bg: '#fdfbf7',
    accentColor: '#d97706',
    accentBg: '#fffbeb',
    preview: (
      <div className="space-y-2 opacity-90">
        <div className="font-hand text-base font-bold text-amber-700">January Goals ✦</div>
        {['Read 20 pages', 'Meditate 10min', 'Workout', 'Journal'].map((h, i) => (
          <div key={h} className="flex items-center gap-2">
            <span className="text-amber-400 text-sm">{'●○○●'[i]}</span>
            <span className="font-hand text-sm text-gray-700">{h}</span>
          </div>
        ))}
        <div className="mt-2 bg-amber-50 border border-amber-200 rounded p-2 relative">
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 h-3 bg-amber-200/70 rounded-sm" />
          <p className="font-hand text-xs text-amber-700">Be consistent 🌱</p>
        </div>
      </div>
    ),
  },
  {
    id: 'cornell',
    name: 'Cornell Notes',
    tag: 'Best for studying',
    desc: 'The classic Cornell structure: cues, notes, and a summary. Perfect for students and researchers.',
    paperClass: 'paper-legal',
    bg: '#fbf0d9',
    accentColor: '#92400e',
    accentBg: '#fef3c7',
    preview: (
      <div className="flex gap-3 opacity-90 h-full">
        <div className="w-1/3 border-r border-red-300 pr-2">
          <div className="text-[9px] font-bold text-red-600 uppercase tracking-wide mb-2 font-sans">Cues</div>
          <div className="space-y-1.5">
            {['What is AI?', 'Use cases', 'Limitations'].map(q => (
              <div key={q} className="font-hand text-[10px] text-amber-800 bg-amber-100/60 rounded px-1.5 py-0.5">{q}</div>
            ))}
          </div>
        </div>
        <div className="flex-1">
          <div className="text-[9px] font-bold text-amber-700 uppercase tracking-wide mb-2 font-sans">Notes</div>
          <div className="space-y-1">
            {['Artificial Intelligence is...', 'Applications include...', 'Key limitation is...'].map(n => (
              <div key={n} className="font-hand text-[10px] text-amber-900">{n}</div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
];

interface AestheticsSectionProps {
  onLaunch: () => void;
}

export const AestheticsSection: React.FC<AestheticsSectionProps> = ({ onLaunch }) => {
  return (
    <section className="py-24 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="reveal text-center mb-16">
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--color-indigo-brand)' }}>
            Journal Modes
          </p>
          <h2
            className="font-serif font-bold mb-4"
            style={{ fontSize: 'clamp(2.2rem, 4vw, 3.5rem)', color: 'var(--color-ink)', lineHeight: 1.15 }}
          >
            Four ways to work.
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto text-lg">
            Each aesthetic mode changes paper style, layout, and typography to match how you think.
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {aesthetics.map((a, i) => (
            <div
              key={a.id}
              className="reveal-scale group relative rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
              style={{ transitionDelay: `${i * 100}ms` }}
              onClick={onLaunch}
            >
              <div className={`absolute inset-0 ${a.paperClass}`} style={{ background: a.bg, backgroundAttachment: 'local' }} />
              <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(to bottom, rgba(255,255,255,0) 40%, ${a.bg}ee 100%)` }} />

              <div className="relative z-10 p-8 flex flex-col h-full" style={{ minHeight: '280px' }}>
                <div
                  className="self-start px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-4 border"
                  style={{ background: a.accentBg, color: a.accentColor, borderColor: `${a.accentColor}30` }}
                >
                  {a.tag}
                </div>
                <div className="flex-1 mb-6">{a.preview}</div>
                <div>
                  <h3 className="font-serif font-bold text-2xl mb-1" style={{ color: a.accentColor }}>{a.name}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#64748b' }}>{a.desc}</p>
                </div>
                <div
                  className="absolute top-6 right-6 w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 text-white text-sm font-bold"
                  style={{ background: a.accentColor }}
                >→</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
