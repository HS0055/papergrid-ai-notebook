import React from 'react';

interface BlockTypesBentoProps {
  onLaunch: () => void;
}

export const BlockTypesBento: React.FC<BlockTypesBentoProps> = ({ onLaunch }) => {
  return (
    <section className="py-24 px-6" style={{ background: 'var(--color-parchment)' }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="reveal text-center mb-16">
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--color-indigo-brand)' }}>
            12 Block Types
          </p>
          <h2
            className="font-serif font-bold mb-4"
            style={{ fontSize: 'clamp(2.2rem, 4vw, 3.5rem)', color: 'var(--color-ink)', lineHeight: 1.15 }}
          >
            Every block. Every thought.{' '}
            <span className="italic" style={{ color: 'var(--color-indigo-brand)' }}>Your way.</span>
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto text-lg">
            Mix and match content types to create the exact layout your mind needs.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 auto-rows-min">
          {/* Priority Matrix — large 2×2 */}
          <div
            className="reveal-scale col-span-2 row-span-2 rounded-3xl overflow-hidden p-6 border border-gray-200/60 shadow-sm hover:shadow-lg transition-shadow"
            style={{ background: '#fdfbf7', transitionDelay: '0ms' }}
          >
            <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 font-sans">Priority Matrix</div>
            <div className="grid grid-cols-2 gap-3 h-[calc(100%-40px)]">
              {[
                { label: 'Urgent & Important', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', items: ['Launch MVP', 'Fix critical bug'] },
                { label: 'Schedule', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', items: ['Write blog post', 'Update roadmap'] },
                { label: 'Delegate', bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', items: ['Update docs'] },
                { label: 'Eliminate', bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-500', items: ['Old meeting notes'] },
              ].map((q, i) => (
                <div key={i} className={`${q.bg} border ${q.border} rounded-xl p-3 flex flex-col`}>
                  <div className={`text-[9px] font-bold uppercase tracking-widest ${q.text} mb-2`}>{q.label}</div>
                  {q.items.map(item => (
                    <div key={item} className="font-hand text-sm text-gray-700">• {item}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Callout Sticky */}
          <div
            className="reveal-scale rounded-3xl overflow-hidden p-5 border border-amber-200/80 shadow-sm hover:shadow-md transition-shadow relative"
            style={{ background: '#fef3c7', transitionDelay: '80ms' }}
          >
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-12 h-5 rounded-sm" style={{ background: 'rgba(217,119,6,0.45)' }} />
            <div className="absolute bottom-0 right-0 w-6 h-6 bg-amber-100 rounded-tl-xl" />
            <div className="text-[9px] font-bold uppercase tracking-widest text-amber-600 mb-3 font-sans">Sticky Callout</div>
            <p className="font-hand text-base text-amber-800 leading-relaxed">
              "Don't forget to review the design system before the sprint review!"
            </p>
          </div>

          {/* Mood Tracker */}
          <div
            className="reveal-scale rounded-3xl p-5 border border-indigo-100 shadow-sm hover:shadow-md transition-shadow"
            style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #fdf4ff 100%)', transitionDelay: '160ms' }}
          >
            <div className="text-[9px] font-bold uppercase tracking-widest text-indigo-500 mb-4 font-sans">Mood Tracker</div>
            <div className="flex justify-between items-center">
              {['😢', '😕', '😐', '🙂', '😄'].map((e, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span className={`text-2xl transition-all ${i === 3 ? 'scale-130 drop-shadow-sm' : 'opacity-40 grayscale'}`}>{e}</span>
                  <div className="w-1 h-1 rounded-full" style={{ background: i === 3 ? '#818cf8' : 'transparent' }} />
                </div>
              ))}
            </div>
          </div>

          {/* Data Grid / Table */}
          <div
            className="reveal-scale col-span-2 rounded-3xl overflow-hidden border border-emerald-100 shadow-sm hover:shadow-md transition-shadow"
            style={{ background: '#f0fdf4', transitionDelay: '240ms' }}
          >
            <div className="px-5 pt-5 pb-2">
              <div className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 mb-3 font-sans">Data Grid</div>
            </div>
            <div className="overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-emerald-100/80 border-y border-emerald-200">
                    {['Project', 'Deadline', 'Status'].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-bold text-emerald-700 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Landing Page Redesign', 'Mar 5', '🟢 Active'],
                    ['API Integration', 'Mar 12', '🟡 In Progress'],
                    ['User Research', 'Mar 20', '⚪ Planned'],
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-emerald-100 last:border-none">
                      {row.map((cell, j) => (
                        <td key={j} className="px-4 py-2 font-hand text-gray-700 text-sm">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pull Quote */}
          <div
            className="reveal-scale rounded-3xl p-5 border border-indigo-100 shadow-sm hover:shadow-md transition-shadow"
            style={{ background: '#fdfbf7', transitionDelay: '320ms' }}
          >
            <div className="text-[9px] font-bold uppercase tracking-widest text-indigo-400 mb-3 font-sans">Pull Quote</div>
            <div className="border-l-4 border-indigo-300 pl-4">
              <p className="font-serif text-lg italic text-gray-700 leading-relaxed">"Clarity of thought begins with clarity of page."</p>
            </div>
          </div>

          {/* Task List */}
          <div
            className="reveal-scale rounded-3xl p-5 border border-rose-100 shadow-sm hover:shadow-md transition-shadow"
            style={{ background: '#fff7f7', transitionDelay: '400ms' }}
          >
            <div className="text-[9px] font-bold uppercase tracking-widest text-rose-400 mb-3 font-sans">Task List</div>
            <div className="space-y-2">
              {[
                { text: 'Review mockups', done: true },
                { text: 'Push to staging', done: true },
                { text: 'Write release notes', done: false },
                { text: 'Ship to production', done: false },
              ].map((task, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center"
                    style={{ borderColor: task.done ? '#f87171' : '#fca5a5', background: task.done ? '#f87171' : 'transparent' }}
                  >
                    {task.done && <span className="text-white text-[9px] font-bold">✓</span>}
                  </div>
                  <span className={`font-hand text-sm ${task.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>{task.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="reveal text-center mt-12">
          <button
            onClick={onLaunch}
            className="px-8 py-3.5 font-bold text-white rounded-xl transition-all hover:opacity-90"
            style={{ background: 'var(--color-indigo-brand)' }}
          >
            Build your own layout →
          </button>
        </div>
      </div>
    </section>
  );
};
