import React, { useState } from 'react';
import { Plus, Trash2, RotateCcw, Download } from 'lucide-react';
import {
  PRICING_PLANS as DEFAULT_PRICING_PLANS,
  INK_PACKS as DEFAULT_INK_PACKS,
  type PricingPlan,
  type PricingPlanId,
  type InkPack,
} from '@papergrid/core';
import { useServerConfig } from '../../hooks/useServerConfig';

interface PricingConfigShape {
  plans: Record<string, PricingPlan>;
  packs: readonly InkPack[];
}

export const PricingEditor: React.FC = () => {
  // Single Convex-backed config holding both plans and packs. Mutations
  // are debounced to the server so fast typing doesn't DoS the endpoint.
  const [config, setConfig, resetConfig] = useServerConfig<PricingConfigShape>(
    '/api/site-config/pricing',
    { plans: DEFAULT_PRICING_PLANS, packs: DEFAULT_INK_PACKS },
  );
  const plans = config.plans;
  const packs = config.packs;
  const setPlans = (next: Record<string, PricingPlan>) => setConfig({ ...config, plans: next });
  const setPacks = (next: readonly InkPack[]) => setConfig({ ...config, packs: next });
  const resetPlans = resetConfig;
  const resetPacks = resetConfig;

  const updatePlan = (id: PricingPlanId, patch: Partial<PricingPlan>) => {
    // When the plan is still a "default" (not yet in the Convex override),
    // `plans[id]` is undefined. Spreading undefined gives you back just
    // the patch, so we'd write a plan with ONLY the patched field and
    // lose everything else (name, price, ink, features...). Hydrate from
    // the canonical defaults first.
    const base = plans[id] ?? DEFAULT_PRICING_PLANS[id];
    if (!base) return;
    setPlans({
      ...plans,
      [id]: { ...base, ...patch },
    });
  };

  const updatePlanInk = (id: PricingPlanId, patch: Partial<{ monthly: number; rollover: number }>) => {
    const base = plans[id] ?? DEFAULT_PRICING_PLANS[id];
    if (!base) return;
    setPlans({
      ...plans,
      [id]: {
        ...base,
        ink: { ...base.ink, ...patch },
      },
    });
  };

  const updatePack = (id: string, patch: Partial<InkPack>) => {
    setPacks(packs.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const addPack = () => {
    const newPack: InkPack = {
      id: `pack-${Date.now()}`,
      name: 'New Pack',
      price: 4.99,
      ink: 50,
      perInkCost: 0.0998,
      badge: null,
      webOnly: false,
    };
    setPacks([...packs, newPack]);
  };

  const deletePack = (id: string) => {
    if (!confirm('Delete this Ink pack?')) return;
    setPacks(packs.filter((p) => p.id !== id));
  };

  const exportAllPricing = () => {
    const json = JSON.stringify({ plans, packs }, null, 2);
    navigator.clipboard.writeText(json).then(
      () => alert('Pricing JSON copied to clipboard!\n\nPaste into:\npackages/core/src/pricingConfig.ts'),
      () => prompt('Copy this JSON manually:', json),
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pricing Editor</h2>
          <p className="text-sm text-gray-500 mt-1">
            Edit subscription plans and Ink packs. Changes sync to Convex
            after ~500&nbsp;ms and appear on the landing page, in-app pricing,
            FAQ, and comparison table for every visitor.
          </p>
          <p className="text-xs text-amber-700 mt-2 max-w-prose">
            <strong>Note:</strong> Ink monthly grant and notebook cap are
            ALSO editable in the separate <em>Plan Limits</em> tab (which
            is what the backend enforces at runtime). Until those two keys
            are merged server-side, edit <strong>both</strong> when you
            change Ink or notebook caps to avoid drift between the
            marketing copy and the enforced limit.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportAllPricing}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download size={14} /> Export JSON
          </button>
          <button
            onClick={() => {
              if (confirm('Reset all pricing to defaults?')) {
                resetPlans();
                resetPacks();
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50"
          >
            <RotateCcw size={14} /> Reset All
          </button>
        </div>
      </div>

      {/* ─── Subscription Plans ─────────────────────────────────── */}
      <section>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Subscription Plans</h3>
        <p className="text-xs text-gray-500 mb-3 max-w-prose">
          All 5 plans are always shown here, even if the Convex override
          doesn't contain them yet. Editing a missing plan will create it
          on the next save. Hidden plans still exist for the backend —
          they're just not rendered on the public landing page.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {(['free', 'starter', 'pro', 'creator', 'founder'] as const).map((planId) => {
            // Hydrate from core defaults when the Convex override doesn't
            // have this plan yet. This lets admins edit / show / hide any
            // of the 5 canonical plans from day 1, without needing a
            // one-off migration to seed the missing rows.
            const plan = plans[planId] ?? DEFAULT_PRICING_PLANS[planId];
            if (!plan) return null;
            const isUnsavedDefault = !plans[planId];
            return (
              <div
                key={planId}
                className={`bg-white rounded-xl border p-5 space-y-3 ${
                  isUnsavedDefault
                    ? 'border-dashed border-amber-300 bg-amber-50/40'
                    : 'border-gray-200'
                }`}
              >
                {/* Plan name + tagline */}
                <div>
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      {planId}
                    </div>
                    {isUnsavedDefault && (
                      <span
                        className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200"
                        title="This plan is not yet in the Convex override. Edit any field to save it."
                      >
                        default
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={plan.name}
                    onChange={(e) => updatePlan(planId, { name: e.target.value })}
                    className="w-full text-xl font-serif font-bold border-0 border-b border-transparent hover:border-gray-200 focus:border-indigo-400 outline-none px-0 py-1"
                  />
                  <input
                    type="text"
                    value={plan.tagline}
                    onChange={(e) => updatePlan(planId, { tagline: e.target.value })}
                    className="w-full text-xs text-gray-500 border-0 border-b border-transparent hover:border-gray-200 focus:border-indigo-400 outline-none px-0 py-0.5"
                  />
                </div>

                {/* Pricing */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                      Monthly $
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={plan.monthlyPrice}
                      onChange={(e) => updatePlan(planId, { monthlyPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-indigo-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                      Annual $
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={plan.annualPrice ?? ''}
                      onChange={(e) => updatePlan(planId, { annualPrice: e.target.value ? parseFloat(e.target.value) : null })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-indigo-400 outline-none"
                    />
                  </div>
                </div>

                {/* Ink */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                      Ink / month
                    </label>
                    <input
                      type="number"
                      value={plan.ink.monthly}
                      onChange={(e) => updatePlanInk(planId, { monthly: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-indigo-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                      Rollover cap
                    </label>
                    <input
                      type="number"
                      value={plan.ink.rollover}
                      onChange={(e) => updatePlanInk(planId, { rollover: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-indigo-400 outline-none"
                    />
                  </div>
                </div>

                {/* Badge + CTA */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                      Badge
                    </label>
                    <input
                      type="text"
                      value={plan.badge ?? ''}
                      placeholder="e.g. MOST POPULAR"
                      onChange={(e) => updatePlan(planId, { badge: e.target.value || null })}
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:border-indigo-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                      CTA Label
                    </label>
                    <input
                      type="text"
                      value={plan.ctaLabel}
                      onChange={(e) => updatePlan(planId, { ctaLabel: e.target.value })}
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:border-indigo-400 outline-none"
                    />
                  </div>
                </div>

                {/* Visibility + featured toggles */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={plan.featured}
                      onChange={(e) => updatePlan(planId, { featured: e.target.checked })}
                      className="rounded"
                    />
                    Featured (highlighted card)
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={plan.hiddenFromLanding === true}
                      onChange={(e) =>
                        updatePlan(planId, { hiddenFromLanding: e.target.checked })
                      }
                      className="rounded"
                    />
                    Hidden from public landing page
                  </label>
                  {plan.annualPrice && plan.annualPrice > 0 && (
                    <p className="text-[10px] text-gray-400 pl-5">
                      Annual-equivalent monthly:&nbsp;
                      <span className="font-mono font-semibold text-gray-600">
                        ${(plan.annualPrice / 12).toFixed(2)}
                      </span>
                      {plan.annualEquivMonthly &&
                        Math.abs(plan.annualEquivMonthly - plan.annualPrice / 12) > 0.01 && (
                          <span className="text-rose-500 ml-2">
                            (stored: ${plan.annualEquivMonthly.toFixed(2)} — stale)
                          </span>
                        )}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── Ink Packs ─────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Ink Top-Up Packs</h3>
          <button
            onClick={addPack}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
          >
            <Plus size={12} /> Add Pack
          </button>
        </div>

        <div className="space-y-2">
          {packs.map((pack) => (
            <div
              key={pack.id}
              className="bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-1 lg:grid-cols-12 gap-3 items-start"
            >
              <div className="lg:col-span-3">
                <label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Name</label>
                <input
                  type="text"
                  value={pack.name}
                  onChange={(e) => updatePack(pack.id, { name: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-indigo-400 outline-none"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Price $</label>
                <input
                  type="number"
                  step="0.01"
                  value={pack.price}
                  onChange={(e) => updatePack(pack.id, { price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-indigo-400 outline-none"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Ink</label>
                <input
                  type="number"
                  value={pack.ink}
                  onChange={(e) => {
                    const ink = parseInt(e.target.value) || 0;
                    updatePack(pack.id, { ink, perInkCost: ink ? pack.price / ink : 0 });
                  }}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-indigo-400 outline-none"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">$/Ink</label>
                <div className="px-2 py-1.5 text-sm bg-gray-50 rounded-lg text-gray-500">
                  ${pack.perInkCost.toFixed(3)}
                </div>
              </div>

              <div className="lg:col-span-2">
                <label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Badge</label>
                <input
                  type="text"
                  value={pack.badge ?? ''}
                  placeholder="—"
                  onChange={(e) => updatePack(pack.id, { badge: e.target.value || null })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:border-indigo-400 outline-none"
                />
              </div>

              <div className="lg:col-span-1 flex items-end justify-end h-full pb-1">
                <button
                  onClick={() => deletePack(pack.id)}
                  className="p-1.5 text-gray-400 hover:text-rose-600"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="lg:col-span-12 flex items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5 text-gray-700">
                  <input
                    type="checkbox"
                    checked={pack.webOnly}
                    onChange={(e) => updatePack(pack.id, { webOnly: e.target.checked })}
                    className="rounded"
                  />
                  Web-only (avoids Apple's 30% cut)
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer note */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <strong>How this works:</strong> Changes save to Convex (<code className="bg-blue-100 px-1 rounded">appSettings["pricing-config"]</code>) after a ~500&nbsp;ms debounce and are immediately visible to all visitors — no deploy required. The defaults in <code className="bg-blue-100 px-1 rounded">packages/core/src/pricingConfig.ts</code> are only the fallback used when no Convex override exists. <strong>Export JSON</strong> is a convenience if you ever want to promote a live edit back into source control as a new default.
      </div>
    </div>
  );
};
