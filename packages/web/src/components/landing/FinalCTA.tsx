import React from 'react';
import { ArrowRight } from 'lucide-react';

interface FinalCTAProps {
  onLaunch: () => void;
}

export const FinalCTA: React.FC<FinalCTAProps> = ({ onLaunch }) => {
  return (
    <section className="relative py-40 px-6 overflow-hidden" style={{ background: '#0f111a' }}>
      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[500px] pointer-events-none" style={{ background: 'radial-gradient(ellipse, rgba(79,70,229,0.15) 0%, transparent 70%)', filter: 'blur(60px)' }} />

      {/* Content */}
      <div className="reveal relative z-10 text-center max-w-3xl mx-auto">
        <p className="text-xs font-bold uppercase tracking-widest mb-6" style={{ color: '#818cf8' }}>
          Start your first spread
        </p>

        <h2
          className="font-serif font-bold mb-8 leading-[1.05]"
          style={{ fontSize: 'clamp(3.5rem, 8vw, 6.5rem)', color: '#ffffff', letterSpacing: '-0.02em' }}
        >
          Write your<br />
          <span className="italic" style={{ color: '#818cf8' }}>first page.</span>
        </h2>

        <p className="text-lg mb-10 max-w-md mx-auto" style={{ color: '#94a3b8', lineHeight: 1.7 }}>
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
