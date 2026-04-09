import React, { useMemo, useRef, useEffect } from 'react';
import { Check, X, Info } from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { formatPrice } from '@papergrid/core';
import { usePricingConfig } from '../../hooks/usePricingConfig';

gsap.registerPlugin(ScrollTrigger);

// Data verified April 2026 from official sources (goodnotes.com, notability.com, notion.com, bear.app).
// Claims use "native" qualifier because users can import 3rd-party PDF templates into any app.
// The real differentiator is INTERACTIVE BLOCKS vs static PDF templates.

interface CompetitorRow {
  feature: string;
  papera: string | boolean;
  goodnotes: string | boolean;
  notability: string | boolean;
  notion: string | boolean;
  /** optional source note shown on hover for transparency */
  note?: string;
}

/**
 * Competitor data is hardcoded because it's verified externally and
 * shouldn't drift with admin edits. But the Papera row's price/Ink/block
 * numbers come from usePricingConfig so an admin change in /admin → Plans
 * propagates here automatically. That's what buildRows(paperaAnnual, ...)
 * is for: the shape of the table is constant, only Papera's numbers are
 * live-wired.
 */
function buildRows(paperaPro: {
  annualPrice: string;
  totalWithAi: string;
}): CompetitorRow[] {
  return [
  {
    feature: 'Base annual price',
    papera: paperaPro.annualPrice,
    goodnotes: '$35.99',
    notability: '$14.99',
    notion: '$120',
    note: 'Goodnotes Pro, Notability Plus, Notion Plus (per user)',
  },
  {
    feature: 'AI included in base price',
    papera: true,
    goodnotes: false,
    notability: 'Limited',
    notion: false,
    note: 'Notability Plus has AI summaries. Goodnotes & Notion require add-on/upgrade.',
  },
  {
    feature: 'AI add-on cost per year',
    papera: '$0',
    goodnotes: '+$119.88',
    notability: '$0',
    notion: 'Business tier only',
    note: 'Goodnotes AI Pass: $9.99/mo. Notion AI discontinued for Plus in May 2025.',
  },
  {
    feature: 'Total annual with full AI',
    papera: paperaPro.totalWithAi,
    goodnotes: '$155.87',
    notability: '$14.99',
    notion: '$180+',
    note: 'Notion: must upgrade to Business tier (~$15/user/mo)',
  },
  {
    feature: 'Interactive Kanban block',
    papera: true,
    goodnotes: false,
    notability: false,
    notion: true,
    note: 'Goodnotes/Notability only offer static PDF templates, not drag-and-drop blocks',
  },
  {
    feature: 'Interactive habit tracker',
    papera: true,
    goodnotes: false,
    notability: false,
    notion: 'Manual',
    note: 'Goodnotes & Notability: static PDF imports only. Notion: build your own.',
  },
  {
    feature: 'Interactive mood tracker',
    papera: true,
    goodnotes: false,
    notability: false,
    notion: 'Manual',
  },
  {
    feature: 'Interactive priority matrix',
    papera: true,
    goodnotes: false,
    notability: false,
    notion: 'Manual',
  },
  {
    feature: 'Music staff paper',
    papera: true,
    goodnotes: false,
    notability: 'Gallery',
    notion: false,
    note: 'Notability offers it as a template in their Gallery',
  },
  {
    feature: 'Real paper textures',
    papera: '10 native',
    goodnotes: '20+ templates',
    notability: '3+ templates',
    notion: false,
    note: 'Papera: CSS-rendered textures. Competitors: PDF backgrounds.',
  },
  {
    feature: 'AI layout from text prompt',
    papera: 'Full notebook',
    goodnotes: 'Templates only',
    notability: false,
    notion: 'Text only',
    note: 'Goodnotes AI generates templates. Papera generates complete interactive spreads.',
  },
  {
    feature: 'Content block types',
    papera: '22+ native',
    goodnotes: 'N/A (PDF-based)',
    notability: 'N/A (PDF-based)',
    notion: '30+',
  },
  {
    feature: 'Cross-platform',
    papera: 'Web + iOS',
    goodnotes: 'All platforms',
    notability: 'Apple only',
    notion: 'All platforms',
  },
  {
    feature: 'Free tier available',
    papera: true,
    goodnotes: true,
    notability: true,
    notion: true,
    note: 'All apps offer a free tier with limitations',
  },
  ];
}

const renderCell = (value: string | boolean, isHighlight: boolean) => {
  if (typeof value === 'boolean') {
    if (value) {
      return (
        <div
          className="inline-flex items-center justify-center w-6 h-6 rounded-full"
          style={{
            background: isHighlight ? 'rgba(79,70,229,0.15)' : 'rgba(16,185,129,0.12)',
            color: isHighlight ? 'var(--color-indigo-brand)' : '#10b981',
          }}
        >
          <Check size={14} strokeWidth={3} />
        </div>
      );
    }
    return (
      <div
        className="inline-flex items-center justify-center w-6 h-6 rounded-full"
        style={{ background: 'rgba(0,0,0,0.04)', color: '#94a3b8' }}
      >
        <X size={14} strokeWidth={2.5} />
      </div>
    );
  }
  return (
    <span
      className={`text-[13px] ${isHighlight ? 'font-bold' : 'font-medium'}`}
      style={{ color: isHighlight ? 'var(--color-indigo-brand)' : '#475569' }}
    >
      {value}
    </span>
  );
};

export const ComparisonTable: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const pricing = usePricingConfig();

  // Derive Papera's live numbers from the single source of truth.
  // If the hook hasn't loaded yet (or the server is offline), fall
  // back to the static defaults that match pricingConfig.ts so the
  // table renders immediately.
  const { paperaAnnualLabel, paperaTotalLabel, goodnotesSavings } = useMemo(() => {
    const pro = pricing.getPlan('pro');
    const annual = pro?.annualPrice ?? 89;
    const annualLabel = formatPrice(annual);
    // Papera bundles AI — there's no "with AI" upcharge, so the total
    // equals the base annual price.
    return {
      paperaAnnualLabel: annualLabel,
      paperaTotalLabel: annualLabel,
      // Competitor total vs Papera. Goodnotes Pro + AI Pass = $155.87.
      goodnotesSavings: Math.max(0, 155.87 - annual),
    };
  }, [pricing]);

  const ROWS = useMemo(
    () => buildRows({ annualPrice: paperaAnnualLabel, totalWithAi: paperaTotalLabel }),
    [paperaAnnualLabel, paperaTotalLabel],
  );

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      const rows = sectionRef.current!.querySelectorAll('.comparison-row');
      gsap.fromTo(
        rows,
        { x: -20, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.4,
          stagger: 0.04,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 75%',
            once: true,
          },
        },
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative py-28 px-6"
      style={{ background: '#ffffff' }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--color-indigo-brand)' }}>
            Honest Comparison
          </p>
          <h2
            className="font-serif font-bold mb-4"
            style={{ fontSize: 'clamp(2.2rem, 4vw, 3.5rem)', color: 'var(--color-ink)', lineHeight: 1.15 }}
          >
            Why Papera{' '}
            <span className="italic" style={{ color: 'var(--color-indigo-brand)' }}>is different.</span>
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto text-lg">
            Everyone has good paper apps. What makes Papera different is <strong>native interactive blocks</strong>.
            Others give you static PDF templates — we give you living, editable layouts.
          </p>
        </div>

        {/* Hero callout — verified total cost comparison */}
        <div
          className="rounded-3xl p-8 mb-10"
          style={{
            background: 'linear-gradient(135deg, rgba(79,70,229,0.06) 0%, rgba(124,58,237,0.04) 100%)',
            border: '1px solid rgba(79,70,229,0.15)',
          }}
        >
          <p className="text-center text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#64748b' }}>
            Total annual cost with AI
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#94a3b8' }}>
                Goodnotes Pro + AI Pass
              </p>
              <p className="font-serif font-bold text-3xl mb-1" style={{ color: '#94a3b8' }}>
                <span className="line-through">$155.87</span>
              </p>
              <p className="text-xs" style={{ color: '#94a3b8' }}>
                $35.99 + $119.88 AI Pass
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#94a3b8' }}>
                Notion Business (with AI)
              </p>
              <p className="font-serif font-bold text-3xl mb-1" style={{ color: '#94a3b8' }}>
                <span className="line-through">$180+</span>
              </p>
              <p className="text-xs" style={{ color: '#94a3b8' }}>
                AI bundled into Business tier
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-indigo-brand)' }}>
                Papera Pro
              </p>
              <p className="font-serif font-bold text-3xl mb-1" style={{ color: 'var(--color-indigo-brand)' }}>
                {paperaAnnualLabel}
              </p>
              <p className="text-xs font-semibold" style={{ color: '#10b981' }}>
                AI included. Save ${Math.round(goodnotesSavings)}+/yr
              </p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div
          className="rounded-3xl overflow-hidden border"
          style={{ background: '#fff', borderColor: 'rgba(0,0,0,0.08)' }}
        >
          {/* Header row */}
          <div
            className="grid grid-cols-5 gap-2 px-4 py-5 border-b"
            style={{ background: '#fafbfc', borderColor: 'rgba(0,0,0,0.08)' }}
          >
            <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#94a3b8' }}>
              Feature
            </div>
            <div className="text-center">
              <div
                className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff' }}
              >
                Papera
              </div>
            </div>
            <div className="text-center text-sm font-bold" style={{ color: '#64748b' }}>
              Goodnotes
            </div>
            <div className="text-center text-sm font-bold" style={{ color: '#64748b' }}>
              Notability
            </div>
            <div className="text-center text-sm font-bold" style={{ color: '#64748b' }}>
              Notion
            </div>
          </div>

          {ROWS.map((row, i) => (
            <div
              key={i}
              className="comparison-row group grid grid-cols-5 gap-2 px-4 py-4 items-center border-b last:border-b-0 transition-colors hover:bg-gray-50/30 relative"
              style={{ borderColor: 'rgba(0,0,0,0.05)' }}
            >
              <div className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--color-ink)' }}>
                {row.feature}
                {row.note && (
                  <div className="relative">
                    <Info size={12} className="text-gray-300 group-hover:text-indigo-400 transition-colors cursor-help" />
                    <div
                      className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-2 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10"
                      style={{
                        background: 'rgba(26,28,35,0.95)',
                        color: '#fff',
                        maxWidth: '260px',
                        whiteSpace: 'normal',
                        minWidth: '200px',
                      }}
                    >
                      {row.note}
                    </div>
                  </div>
                )}
              </div>
              <div className="text-center">{renderCell(row.papera, true)}</div>
              <div className="text-center">{renderCell(row.goodnotes, false)}</div>
              <div className="text-center">{renderCell(row.notability, false)}</div>
              <div className="text-center">{renderCell(row.notion, false)}</div>
            </div>
          ))}
        </div>

        {/* Transparency footnote */}
        <div className="mt-8 p-5 rounded-2xl border text-center" style={{ background: '#fafbfc', borderColor: 'rgba(0,0,0,0.06)' }}>
          <p className="text-xs leading-relaxed" style={{ color: '#64748b' }}>
            <strong style={{ color: 'var(--color-ink)' }}>Source transparency:</strong> All data verified April 2026 from official
            pricing pages (goodnotes.com, notability.com, notion.com). Prices in USD, billed annually, single user. Goodnotes Pro ($35.99/yr)
            +{' '}AI Pass ($9.99/mo = $119.88/yr) per{' '}
            <a href="https://www.goodnotes.com/pricing" target="_blank" rel="noopener" className="underline hover:text-indigo-500">
              Goodnotes pricing
            </a>
            . Notion AI bundled into Business tier (no standalone add-on since May 2025) per{' '}
            <a href="https://notion.com/help/2025-pricing-changes" target="_blank" rel="noopener" className="underline hover:text-indigo-500">
              Notion 2025 pricing changes
            </a>
            . Features marked as boolean apply to native interactive blocks, not PDF template imports.
          </p>
        </div>
      </div>
    </section>
  );
};
