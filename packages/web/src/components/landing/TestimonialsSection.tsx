import React from 'react';

interface Testimonial {
  quote: string;
  name: string;
  role: string;
  photo: string;
  color: string;
}

const testimonials: Testimonial[] = [
  {
    quote: 'Papera AI completely replaced my physical notebook. The lined paper feels so real, and the AI generates layouts I never would have thought of.',
    name: 'Mira Chen',
    role: 'UX Designer, Figma',
    photo: '/testimonials/mira-chen.png',
    color: '#4f46e5',
  },
  {
    quote: 'I use the Cornell notes aesthetic every single day for my lectures. It\'s the only tool that actually respects the structure of academic notes.',
    name: 'James Osei',
    role: 'PhD Student, MIT',
    photo: '/testimonials/james-osei.png',
    color: '#d97706',
  },
  {
    quote: 'As a productivity coach, I\'ve tried everything. Papera\'s Priority Matrix + Mood Tracker combination is genuinely unlike anything else.',
    name: 'Sarah Okonkwo',
    role: 'Productivity Coach',
    photo: '/testimonials/sarah-okonkwo.png',
    color: '#059669',
  },
  {
    quote: 'The bullet journal mode with dotted paper and washi tape callouts is SO good. Finally a digital tool that actually gets the BuJo community.',
    name: 'Lea Rossi',
    role: 'Freelance Illustrator',
    photo: '/testimonials/lea-rossi.png',
    color: '#e11d48',
  },
  {
    quote: 'I described our sprint planning session and got a fully formatted notebook page in about 3 seconds. The AI layouts are seriously impressive.',
    name: 'Noah Park',
    role: 'Engineering Lead, Vercel',
    photo: '/testimonials/noah-park.png',
    color: '#0ea5e9',
  },
  {
    quote: 'My students love that I can share Cornell notes layouts with them directly. Papera has become a classroom staple.',
    name: 'Maria Santos',
    role: 'High School Teacher',
    photo: '/testimonials/maria-santos.png',
    color: '#7c3aed',
  },
];

export const TestimonialsSection: React.FC = () => {
  return (
    <section className="relative py-28 px-6 overflow-hidden" style={{ background: 'var(--color-ink)' }}>
      {/* Ambient glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(79,70,229,0.1) 0%, transparent 65%)', filter: 'blur(50px)' }}
      />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="reveal text-center mb-16">
          <h2 className="font-serif font-bold text-white" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', lineHeight: 1.2 }}>
            Loved by writers, planners, &{' '}
            <span className="italic" style={{ color: '#818cf8' }}>thinkers.</span>
          </h2>
        </div>

        {/* 3-col testimonials grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="reveal rounded-2xl p-6 transition-all duration-200 hover:-translate-y-1"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(10px)',
                marginTop: i % 3 === 1 ? '24px' : '0',
                transitionDelay: `${i * 80}ms`,
              }}
            >
              <div className="font-serif text-5xl leading-none mb-4" style={{ color: t.color, opacity: 0.6 }}>"</div>
              <p className="text-base leading-relaxed mb-6" style={{ color: 'rgba(248,250,252,0.8)' }}>{t.quote}</p>
              <div className="flex items-center gap-3">
                <img
                  src={t.photo}
                  alt={t.name}
                  loading="lazy"
                  decoding="async"
                  className="w-10 h-10 rounded-full object-cover shrink-0"
                  style={{ border: `1px solid ${t.color}40` }}
                />
                <div>
                  <div className="font-semibold text-sm text-white">{t.name}</div>
                  <div className="text-xs" style={{ color: '#64748b' }}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
