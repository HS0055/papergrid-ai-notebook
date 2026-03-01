import React from 'react';
import { ArrowRight } from 'lucide-react';

interface FinalCTAProps {
  onLaunch: () => void;
}

export const FinalCTA: React.FC<FinalCTAProps> = ({ onLaunch }) => {
  return (
    <section className="relative py-40 px-6 overflow-hidden paper-lines" style={{ backgroundAttachment: 'local' }}>
      {/* Margin line */}
      <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: '80px', width: '1px', background: 'rgba(248,113,113,0.25)' }} />

      {/* Vignette overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(253,251,247,0) 30%, rgba(253,251,247,0.6) 100%)' }} />

      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] pointer-events-none" style={{ background: 'radial-gradient(ellipse, rgba(79,70,229,0.08) 0%, transparent 70%)', filter: 'blur(40px)' }} />

      {/* Content */}
      <div className="reveal relative z-10 text-center max-w-3xl mx-auto">
        <p className="text-xs font-bold uppercase tracking-widest mb-6" style={{ color: 'var(--color-indigo-brand)' }}>
          Start your first spread
        </p>

        <h2
          className="font-serif font-bold mb-8 leading-[1.05]"
          style={{ fontSize: 'clamp(3.5rem, 8vw, 6.5rem)', color: 'var(--color-ink)', letterSpacing: '-0.02em' }}
        >
          Write your<br />
          <span className="italic" style={{ color: '#4f46e5' }}>first page.</span>
        </h2>

        <p className="text-lg mb-10 max-w-md mx-auto" style={{ color: '#64748b', lineHeight: 1.7 }}>
          Your digital notebook is waiting. No setup, no subscriptions — just open it and start writing.
        </p>

        <button
          onClick={onLaunch}
          className="group inline-flex items-center gap-3 px-10 py-5 font-bold text-lg text-white rounded-2xl transition-all hover:scale-[1.03] active:scale-[0.98] shadow-2xl"
          style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', boxShadow: '0 20px 60px rgba(79,70,229,0.35)' }}
        >
          Create Your Notebook
          <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
        </button>

        <p className="mt-6 text-xs font-medium uppercase tracking-widest" style={{ color: '#94a3b8' }}>
          Free · AI-Powered · No credit card needed
        </p>
      </div>
    </section>
  );
};
