import React, { useEffect, useRef, useState } from 'react';
import { Book, ArrowRight } from 'lucide-react';

interface NavBarProps {
  onLaunch: () => void;
}

export const NavBar: React.FC<NavBarProps> = ({ onLaunch }) => {
  const [scrolled, setScrolled] = useState(false);

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
          <a href="#paper-styles" className="hover:text-indigo-600 transition-colors">Paper Styles</a>
          <a href="#ai-feature" className="hover:text-indigo-600 transition-colors">AI Magic</a>
          <a href="#how-it-works" className="hover:text-indigo-600 transition-colors">How It Works</a>
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
