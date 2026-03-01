import React, { useState } from 'react';

const paperStyles = [
  { id: 'lined', label: 'Lined', cssClass: 'paper-lines', desc: 'Classic ruled lines for writing', bg: '#fdfbf7' },
  { id: 'grid', label: 'Grid', cssClass: 'paper-grid', desc: 'Perfect squares for planning', bg: '#fdfbf7' },
  { id: 'dotted', label: 'Dotted', cssClass: 'paper-dots', desc: 'Subtle dots for freedom', bg: '#fdfbf7' },
  { id: 'music', label: 'Music Staff', cssClass: 'paper-music', desc: 'Staff lines for composition', bg: '#fdfbf7' },
  { id: 'isometric', label: 'Isometric', cssClass: 'paper-isometric', desc: '3D drawing & diagrams', bg: '#fdfbf7' },
  { id: 'hex', label: 'Hexagonal', cssClass: 'paper-hex', desc: 'Hexagons for games & science', bg: '#fdfbf7' },
  { id: 'legal', label: 'Legal Pad', cssClass: 'paper-legal', desc: 'Yellow pad with red margin', bg: '#fbf0d9' },
  { id: 'rows', label: 'Shaded Rows', cssClass: 'paper-rows', desc: 'Alternating rows for tables', bg: '#fdfbf7' },
  { id: 'crumpled', label: 'Crumpled', cssClass: 'paper-crumpled', desc: 'Textured worn paper', bg: '#fdfbf7' },
  { id: 'blank', label: 'Blank', cssClass: 'bg-paper', desc: 'Clean slate, pure freedom', bg: '#fdfbf7' },
];

interface PaperStylesSectionProps {
  onLaunch: () => void;
}

export const PaperStylesSection: React.FC<PaperStylesSectionProps> = ({ onLaunch }) => {
  const [selected, setSelected] = useState('lined');
  const selectedStyle = paperStyles.find(p => p.id === selected);

  return (
    <section id="paper-styles" className="py-24 px-6 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="reveal text-center mb-16">
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--color-indigo-brand)' }}>
            10 Paper Textures
          </p>
          <h2
            className="font-serif font-bold mb-4"
            style={{ fontSize: 'clamp(2.2rem, 4vw, 3.5rem)', color: 'var(--color-ink)', lineHeight: 1.15 }}
          >
            Pick your paper, set the mood.
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto text-lg">
            Every paper style is crafted with real CSS textures — exactly how it feels in the app.
          </p>
        </div>

        {/* Grid of paper tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-8">
          {paperStyles.map((style, i) => (
            <button
              key={style.id}
              className={`reveal-scale group relative rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-1 ${
                selected === style.id
                  ? 'ring-2 ring-indigo-500 ring-offset-2 shadow-xl scale-[1.02]'
                  : 'ring-1 ring-gray-200 hover:ring-indigo-300 hover:shadow-md'
              }`}
              style={{ aspectRatio: '3/4', background: style.bg, transitionDelay: `${i * 60}ms` }}
              onClick={() => setSelected(style.id)}
              title={style.label}
            >
              <div className={`absolute inset-0 ${style.cssClass}`} style={{ backgroundAttachment: 'local' }} />
              <div
                className="absolute bottom-0 left-0 right-0 p-3 transition-all duration-200"
                style={{
                  background: selected === style.id ? 'rgba(79,70,229,0.85)' : 'rgba(26,28,35,0.55)',
                }}
              >
                <span className="text-xs font-bold uppercase tracking-widest text-white block">{style.label}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Selected style info + CTA */}
        <div
          className="reveal flex flex-col md:flex-row items-center justify-between gap-6 p-6 rounded-2xl border"
          style={{ background: 'rgba(79,70,229,0.04)', borderColor: 'rgba(79,70,229,0.2)' }}
        >
          <div>
            <span className="font-serif text-xl font-bold text-gray-800">{selectedStyle?.label}</span>
            <span className="mx-3 text-gray-300">—</span>
            <span className="text-gray-500">{selectedStyle?.desc}</span>
          </div>
          <button
            onClick={onLaunch}
            className="shrink-0 px-6 py-3 font-bold text-sm rounded-xl text-white transition-all hover:opacity-90"
            style={{ background: 'var(--color-indigo-brand)' }}
          >
            Try all styles in the app →
          </button>
        </div>
      </div>
    </section>
  );
};
