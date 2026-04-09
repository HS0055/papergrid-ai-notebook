import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Logo } from './Logo';
import { useScrollSpy } from '../../hooks/useScrollSpy';
import { useIsMobile } from '../../hooks/useIsMobile';

interface NavBarProps {
  onLaunch: () => void;
}

const NAV_LINKS = [
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'paper-styles', label: 'Paper' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'faq', label: 'FAQ' },
] as const;

export const NavBar: React.FC<NavBarProps> = ({ onLaunch }) => {
  const [scrolled, setScrolled] = useState(false);
  const sectionIds = useMemo(() => NAV_LINKS.map((l) => l.id), []);
  const activeSection = useScrollSpy(sectionIds);
  const isMobile = useIsMobile();

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
      <div
        className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center"
        style={{
          paddingTop: isMobile ? 'max(0.75rem, env(safe-area-inset-top))' : undefined,
        }}
      >
        {/* Logo — adapts to scroll state for readability */}
        <Logo variant={scrolled ? 'light' : 'dark'} size={isMobile ? 32 : 36} />

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
          className={`flex items-center gap-2 bg-[#1a1c23] hover:bg-black text-white font-semibold rounded-full transition-all group ${
            isMobile ? 'px-4 py-2 text-xs' : 'px-5 py-2.5 text-sm'
          }`}
        >
          Open App
          <ArrowRight size={isMobile ? 13 : 15} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </nav>
  );
};
