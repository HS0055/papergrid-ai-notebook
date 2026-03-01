import React from 'react';

const stats = [
  { value: '10+', label: 'Paper Styles' },
  { value: '∞', label: 'Notebooks' },
  { value: '12', label: 'Block Types' },
  { value: '4', label: 'Journal Modes' },
];

export const StatsStrip: React.FC = () => {
  return (
    <div className="relative py-16 px-6" style={{ background: 'var(--color-parchment)' }}>
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'rgba(203,213,225,0.6)' }} />
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: 'rgba(203,213,225,0.6)' }} />

      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-200/70">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="reveal flex flex-col items-center justify-center py-6 px-4 text-center"
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <span
                className="font-serif font-bold leading-none mb-2"
                style={{
                  fontSize: 'clamp(2.8rem, 5vw, 4rem)',
                  color: 'var(--color-ink)',
                  letterSpacing: '-0.02em',
                }}
              >
                {stat.value}
              </span>
              <span
                className="font-sans text-sm font-medium uppercase tracking-widest"
                style={{ color: '#94a3b8' }}
              >
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
