import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Book, ArrowRight } from 'lucide-react';
import { useScrollSpy } from '../../hooks/useScrollSpy';

interface NavBarProps {
  onLaunch: () => void;
}

const NAV_LINKS = [
  { id: 'paper-styles', label: 'Paper Styles' },
  { id: 'ai-feature', label: 'AI Magic' },
  { id: 'how-it-works', label: 'How It Works' },
] as const;

export const NavBar: React.FC<NavBarProps> = ({ onLaunch }) => {
  const [scrolled, setScrolled] = useState(false);
  const sectionIds = useMemo(() => NAV_LINKS.map((l) => l.id), []);
  const activeSection = useScrollSpy(sectionIds);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/80 backdrop-blur-xl border-b border-gray-200/60 shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <Book className="text-white" size={18} />
          </div>
          <span className="font-serif font-bold text-xl tracking-tight text-gray-900">PaperGrid AI</span>
        </div>

        {/* Links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-500">
          {NAV_LINKS.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              className="hover:text-indigo-600 transition-colors pb-1"
              style={{
                borderBottom: activeSection === id
                  ? '2px solid var(--color-indigo-brand)'
                  : '2px solid transparent',
                color: activeSection === id ? 'var(--color-indigo-brand)' : undefined,
                transition: 'border-color 0.3s ease, color 0.3s ease',
              }}
            >
              {label}
            </a>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={onLaunch}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#1a1c23] hover:bg-black text-white text-sm font-semibold rounded-full transition-all group"
        >
          Open App
          <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </nav>
  );
};
