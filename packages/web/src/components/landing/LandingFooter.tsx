import React from 'react';
import { Github } from 'lucide-react';
import { Logo } from './Logo';
import { PUBLIC_BLOG_ENABLED } from '../../config/featureFlags';

const EXPLORE_LINKS = [
  { label: 'Paper Styles', href: '#paper-styles' },
  { label: 'AI Magic', href: '#ai-feature' },
  { label: 'How It Works', href: '#how-it-works' },
  ...(PUBLIC_BLOG_ENABLED ? [{ label: 'Blog', href: '/blog' }] : []),
] as const;

export const LandingFooter: React.FC = () => {
  return (
    <footer style={{ background: '#0a0c14', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Main footer */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Brand */}
          <div>
            <div className="mb-4">
              <Logo variant="dark" size={36} />
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#475569' }}>
              The digital notebook that thinks with you.
              Beautifully crafted paper textures, AI-generated layouts, unlimited creative freedom.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <div className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: '#475569' }}>
              Explore
            </div>
            <nav className="flex flex-col gap-3">
              {EXPLORE_LINKS.map(link => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-sm font-medium transition-colors hover:text-indigo-400"
                  style={{ color: '#64748b' }}
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>

          {/* Links */}
          <div>
            <div className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: '#475569' }}>
              Resources
            </div>
            <nav className="flex flex-col gap-3">
              {[
                { label: 'Privacy Policy', href: '#' },
                { label: 'Terms of Service', href: '#' },
                { label: 'Support', href: '#' },
                { label: 'GitHub', href: 'https://github.com', icon: <Github size={13} /> },
              ].map(link => (
                <a
                  key={link.label}
                  href={link.href}
                  className="flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-indigo-400"
                  style={{ color: '#64748b' }}
                  target={link.href.startsWith('http') ? '_blank' : undefined}
                  rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                >
                  {link.icon}
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className="border-t px-6 py-5"
        style={{ borderColor: 'rgba(255,255,255,0.05)' }}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-xs" style={{ color: '#334155' }}>
            © 2026 Papera. All rights reserved.
          </p>
          <p className="text-xs" style={{ color: '#334155' }}>
            Built with ❤️ using React, Tailwind v4 & Gemini 2.5 Flash
          </p>
        </div>
      </div>
    </footer>
  );
};
