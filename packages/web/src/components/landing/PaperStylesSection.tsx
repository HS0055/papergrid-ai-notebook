import React, { useState, useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

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
  const gridRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Grid animation on scroll
  useEffect(() => {
    if (!gridRef.current) return;

    const tiles = gridRef.current.children;
    const count = tiles.length;
    const center = (count - 1) / 2;

    // Set initial state: subtle rotation outward from center
    gsap.set(Array.from(tiles), {
      opacity: 0,
      y: 30,
      scale: 0.93,
      rotateY: (i: number) => {
        const offset = (i - center) / center; // -1 to +1
        return -offset * 8; // max 8deg, proportional to distance from center
      },
    });

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: gridRef.current,
        start: 'top 88%',
        once: true,
        onEnter: () => {
          gsap.to(Array.from(tiles), {
            opacity: 1,
            y: 0,
            scale: 1,
            rotateY: 0,
            duration: 0.85,
            stagger: { each: 0.05, from: 'center' },
            ease: 'power2.out',
          });
        },
      });
    }, gridRef);

    return () => ctx.revert();
  }, []);

  // Preview panel crossfade animation on paper change
  useEffect(() => {
    if (!previewRef.current || !contentRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline();

      // Crossfade animation: scale + opacity
      tl.fromTo(
        previewRef.current,
        { scale: 0.98, opacity: 0 },
        { scale: 1.0, opacity: 1, duration: 0.6, ease: 'power2.out' }
      );

      // Animate handwriting lines with stagger
      if (contentRef.current) {
        const lines = contentRef.current.querySelectorAll('.handwriting-line');
        tl.fromTo(
          lines,
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: 'power1.out' },
          '-=0.3'
        );
      }
    }, previewRef);

    return () => ctx.revert();
  }, [selected]);

  return (
    <section id="paper-styles" className="py-24 px-6 overflow-hidden" style={{ background: '#fdfbf7' }}>
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

        {/* 2-column layout: Grid left, Preview right (stacked on mobile) */}
        <div className="flex flex-col lg:flex-row gap-8 mb-8">
          {/* Grid of paper tiles */}
          <div className="flex-1">
            <div ref={gridRef} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-2 xl:grid-cols-3 gap-4" style={{ perspective: '1000px' }}>
              {paperStyles.map((style, i) => (
                <button
                  key={style.id}
                  className={`group relative rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-1 ${selected === style.id
                      ? 'ring-2 ring-indigo-500 ring-offset-2 shadow-xl scale-[1.02]'
                      : 'ring-1 ring-gray-200 hover:ring-indigo-300 hover:shadow-md'
                    }`}
                  style={{ aspectRatio: '3/4', background: style.bg }}
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
          </div>

          {/* Large Preview Panel */}
          <div className="flex-1 lg:max-w-md">
            <div
              ref={previewRef}
              className={`relative rounded-2xl overflow-hidden shadow-2xl ${selectedStyle?.cssClass}`}
              style={{
                height: '400px',
                background: selectedStyle?.bg,
                backgroundAttachment: 'local',
              }}
            >
              {/* Animated handwriting content */}
              <div
                ref={contentRef}
                className="absolute inset-0 p-8 flex flex-col justify-center"
                style={{ fontFamily: 'var(--font-hand)', fontSize: '1.5rem', lineHeight: 1.8 }}
              >
                <p className="handwriting-line text-gray-700">Every paper tells a story.</p>
                <p className="handwriting-line text-gray-700">Choose the texture that</p>
                <p className="handwriting-line text-gray-700">matches your mood and</p>
                <p className="handwriting-line text-gray-700">watch your ideas come alive.</p>
              </div>
            </div>
          </div>
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
