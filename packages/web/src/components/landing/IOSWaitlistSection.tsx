import React, { useState, useRef, useEffect } from 'react';
import { Apple, Check, Bell, Droplet } from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const IOSWaitlistSection: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        sectionRef.current!.querySelector('.waitlist-card'),
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 80%',
            once: true,
          },
        },
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    const apiBase = import.meta.env.VITE_API_URL || '';
    if (!apiBase) {
      setError('Waitlist is offline. Please try again later.');
      return;
    }

    try {
      const res = await fetch(`${apiBase}/api/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), source: 'ios-landing' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }));
        setError(data?.error || 'Something went wrong. Please try again.');
        return;
      }
      setSubmitted(true);
    } catch {
      setError('Unable to reach the server. Please try again.');
    }
  };

  return (
    <section
      ref={sectionRef}
      className="relative py-28 px-6 overflow-hidden"
      style={{ background: '#fdfbf7' }}
    >
      {/* Ambient glows */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(79,70,229,0.05) 0%, transparent 70%)', filter: 'blur(60px)' }}
      />

      <div className="max-w-4xl mx-auto relative z-10">
        <div
          className="waitlist-card rounded-3xl overflow-hidden relative"
          style={{
            background: 'linear-gradient(180deg, #0f111a 0%, #1a1c23 50%, #2a1f3d 100%)',
            boxShadow: '0 30px 80px rgba(79,70,229,0.2)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* Ambient glow inside card */}
          <div
            className="absolute top-0 right-0 w-[400px] h-[400px] pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse, rgba(124,58,237,0.2) 0%, transparent 70%)',
              filter: 'blur(40px)',
            }}
          />

          <div className="relative p-10 md:p-16 text-center">
            {/* Apple icon badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 border"
              style={{
                background: 'rgba(255,255,255,0.05)',
                borderColor: 'rgba(255,255,255,0.1)',
              }}
            >
              <Apple size={14} style={{ color: '#fff' }} />
              <span className="text-xs font-bold uppercase tracking-widest text-white">iOS App — Coming Soon</span>
            </div>

            <h2
              className="font-serif font-bold text-white mb-6"
              style={{ fontSize: 'clamp(2.2rem, 5vw, 4rem)', lineHeight: 1.1 }}
            >
              Be first on{' '}
              <span className="italic" style={{ color: '#a5b4fc' }}>iPhone & iPad.</span>
            </h2>

            <p className="text-lg mb-10 max-w-xl mx-auto" style={{ color: '#94a3b8', lineHeight: 1.7 }}>
              Join the waitlist to get early access, a bonus 25 Ink on launch day, and a 20% lifetime discount on Pro.
            </p>

            {!submitted ? (
              <form onSubmit={handleSubmit} className="max-w-md mx-auto">
                <div
                  className="flex flex-col sm:flex-row gap-2 p-2 rounded-2xl border"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    borderColor: 'rgba(255,255,255,0.1)',
                  }}
                >
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="flex-1 px-4 py-3 bg-transparent text-white placeholder:text-white/40 outline-none text-base"
                    required
                  />
                  <button
                    type="submit"
                    className="px-6 py-3 rounded-xl font-bold text-sm text-white transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
                    style={{
                      background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                      boxShadow: '0 10px 30px rgba(79,70,229,0.4)',
                    }}
                  >
                    Join Waitlist
                  </button>
                </div>
                {error && (
                  <p className="mt-3 text-sm" style={{ color: '#f43f5e' }}>
                    {error}
                  </p>
                )}
              </form>
            ) : (
              <div
                className="max-w-md mx-auto p-6 rounded-2xl border text-center"
                style={{
                  background: 'rgba(16,185,129,0.1)',
                  borderColor: 'rgba(16,185,129,0.3)',
                }}
              >
                <div
                  className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3"
                  style={{ background: 'rgba(16,185,129,0.2)' }}
                >
                  <Check size={24} strokeWidth={3} style={{ color: '#10b981' }} />
                </div>
                <p className="font-serif text-xl font-bold text-white mb-1">You're on the list!</p>
                <p className="text-sm" style={{ color: '#94a3b8' }}>
                  We'll email you the moment Papera launches on iOS.
                </p>
              </div>
            )}

            {/* Benefits */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 max-w-2xl mx-auto">
              {[
                { icon: <Bell size={16} />, title: 'Early Access', desc: 'Get notified the day we launch' },
                { icon: <Droplet size={16} />, title: '25 Bonus Ink', desc: 'On launch day, free for you' },
                { icon: <Apple size={16} />, title: '20% Off Pro', desc: 'Lifetime discount for waitlist' },
              ].map((benefit, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl border"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    borderColor: 'rgba(255,255,255,0.06)',
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(79,70,229,0.2)', color: '#a5b4fc' }}
                  >
                    {benefit.icon}
                  </div>
                  <p className="font-serif font-bold text-sm text-white">{benefit.title}</p>
                  <p className="text-xs text-center" style={{ color: '#64748b' }}>
                    {benefit.desc}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-10 text-xs font-medium uppercase tracking-widest" style={{ color: '#64748b' }}>
              No spam. Unsubscribe anytime. We respect your inbox.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
