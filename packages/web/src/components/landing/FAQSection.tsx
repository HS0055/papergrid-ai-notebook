import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Plus, Minus } from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { usePricingConfig } from '../../hooks/usePricingConfig';

gsap.registerPlugin(ScrollTrigger);

interface FAQItem {
  q: string;
  a: string;
}

/**
 * Build the FAQ item list from live pricing so admin edits to Ink
 * amounts or rollover caps propagate into the copy automatically.
 *
 * Each question that mentions a number pulls it from usePricingConfig
 * rather than hardcoding. That way "100 Ink/month" can never drift
 * from what the PricingSection grid or the backend enforcement says.
 */
function useFaqItems(): FAQItem[] {
  const pricing = usePricingConfig();

  return useMemo(() => {
    const free = pricing.getPlan('free');
    const pro = pricing.getPlan('pro');
    const creator = pricing.getPlan('creator');

    // Conservative fallbacks if the server hasn't loaded yet — match
    // the static defaults in packages/core/src/pricingConfig.ts so the
    // copy never shows "0 Ink" on first paint.
    const freeInk = free?.monthlyInk ?? 10;
    const freeNotebooks = free?.maxNotebooks ?? 1;
    const freeNotebooksLabel =
      freeNotebooks === -1
        ? 'unlimited notebooks'
        : `${freeNotebooks} notebook${freeNotebooks === 1 ? '' : 's'}`;
    const proInk = pro?.monthlyInk ?? 100;
    const proRollover = pro?.inkRolloverCap ?? 50;
    const creatorInk = creator?.monthlyInk ?? 250;
    const creatorRollover = creator?.inkRolloverCap ?? 125;
    const creatorRevShare = Math.round((creator?.marketplaceRevShare ?? 0.7) * 100);
    const creatorCut = 100 - creatorRevShare;

    return [
      {
        q: 'What is Ink?',
        a: "Ink is Papera's creative fuel. Each Ink drop powers one AI-generated notebook page. 1 Ink = 1 page layout. 4 Ink = 1 cover image. Simple and transparent.",
      },
      {
        q: 'What happens when I run out of Ink?',
        a: "Your notebooks and all your content remain fully accessible — always. You simply can't generate new AI layouts until your Ink refreshes next month or you purchase a top-up pack.",
      },
      {
        q: 'Do unused Ink drops roll over?',
        a: `Pro users roll over up to ${proRollover} Ink per month. Creator users roll over up to ${creatorRollover} Ink. Purchased Ink top-up packs never expire while your account is active.`,
      },
      {
        q: 'Can I use Papera without a subscription?',
        a: `Yes. The free plan includes ${freeInk} Ink/month and ${freeNotebooksLabel} forever. You can also buy Ink top-up packs anytime without subscribing. No credit card required to start.`,
      },
      {
        q: 'Is there a free trial?',
        a: `No trials. We believe in a genuine free tier instead. Start free forever with ${freeInk} Ink/month. Upgrade only when you need more. No credit card, no forgetting to cancel.`,
      },
      {
        q: "What's the difference between Pro and Creator?",
        a: `Pro is designed for personal use: unlimited notebooks, ${proInk} Ink/month, all features. Creator adds template marketplace publishing (keep ${creatorRevShare}% of every sale), branded exports, priority AI, and ${creatorInk} Ink/month.`,
      },
      {
        q: 'Can I cancel anytime?',
        a: 'Yes, cancel with one tap. Your benefits last until the end of your billing period. Your notebooks are always yours — we never lock away content you created, even after cancellation.',
      },
      {
        q: 'Is my data private?',
        a: "Absolutely. Your notebooks are encrypted and only accessible to you. We don't train AI models on your content. You can export everything as PDF at any time.",
      },
      {
        q: 'Do you offer refunds?',
        a: "Yes. Annual plans come with a 30-day money-back guarantee. If Papera isn't right for you in the first month, email support for a full refund — no questions asked.",
      },
      {
        q: 'How does the template marketplace work?',
        a: `Creator subscribers can publish their best notebook layouts as templates. Set your price, keep ${creatorRevShare}% of every sale. Papera takes ${creatorCut}% for payment processing and hosting.`,
      },
      {
        q: 'Does Papera work offline?',
        a: "You can view and edit your notebooks offline. AI layout generation requires an internet connection. Changes sync automatically when you're back online.",
      },
      {
        q: 'When is the iOS app coming?',
        a: 'The iOS app is launching soon. Join the waitlist below to get notified and receive a bonus 25 Ink on launch day.',
      },
    ];
  }, [pricing]);
}

export const FAQSection: React.FC = () => {
  const FAQ_ITEMS = useFaqItems();
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      const items = sectionRef.current!.querySelectorAll('.faq-item');
      gsap.fromTo(
        items,
        { y: 20, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.5,
          stagger: 0.05,
          ease: 'power2.out',
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

  return (
    <section
      id="faq"
      ref={sectionRef}
      className="relative py-28 px-6"
      style={{ background: '#fdfbf7' }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQ_ITEMS.map((item) => ({
              '@type': 'Question',
              name: item.q,
              acceptedAnswer: {
                '@type': 'Answer',
                text: item.a,
              },
            })),
          }),
        }}
      />

      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--color-indigo-brand)' }}>
            Questions & Answers
          </p>
          <h2
            className="font-serif font-bold mb-4"
            style={{ fontSize: 'clamp(2.2rem, 4vw, 3.5rem)', color: 'var(--color-ink)', lineHeight: 1.15 }}
          >
            Frequently Asked{' '}
            <span className="italic" style={{ color: 'var(--color-indigo-brand)' }}>Questions.</span>
          </h2>
          <p className="text-gray-500 text-lg">
            Everything you need to know about Papera and our honest pricing.
          </p>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
                className="faq-item rounded-2xl overflow-hidden border transition-all"
                style={{
                  background: '#fff',
                  borderColor: isOpen ? 'rgba(79,70,229,0.3)' : 'rgba(0,0,0,0.08)',
                  boxShadow: isOpen ? '0 4px 20px rgba(79,70,229,0.08)' : 'none',
                }}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-gray-50/50"
                >
                  <span
                    className="font-serif font-bold text-lg"
                    style={{ color: isOpen ? 'var(--color-indigo-brand)' : 'var(--color-ink)' }}
                  >
                    {item.q}
                  </span>
                  <div
                    className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all"
                    style={{
                      background: isOpen ? 'var(--color-indigo-brand)' : 'rgba(0,0,0,0.04)',
                      color: isOpen ? '#fff' : 'var(--color-ink)',
                    }}
                  >
                    {isOpen ? <Minus size={16} /> : <Plus size={16} />}
                  </div>
                </button>
                <div
                  className="overflow-hidden transition-all duration-300 ease-out"
                  style={{
                    maxHeight: isOpen ? '500px' : '0',
                    opacity: isOpen ? 1 : 0,
                  }}
                >
                  <div className="px-6 pb-6 pt-1 text-[15px] leading-relaxed" style={{ color: '#475569' }}>
                    {item.a}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-16 py-8 px-6 rounded-2xl border" style={{ background: '#fff', borderColor: 'rgba(0,0,0,0.06)' }}>
          <p className="font-serif text-xl font-bold mb-2" style={{ color: 'var(--color-ink)' }}>
            Still have questions?
          </p>
          <p className="text-sm mb-5" style={{ color: '#64748b' }}>
            Send us an email — we reply personally to every message.
          </p>
          <a
            href="mailto:hello@papera.app"
            className="inline-block px-6 py-3 font-bold text-sm rounded-xl text-white transition-all hover:opacity-90"
            style={{ background: 'var(--color-ink)' }}
          >
            hello@papera.app
          </a>
        </div>
      </div>
    </section>
  );
};
