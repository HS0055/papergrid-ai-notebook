import React from 'react';
import { Block, DailySectionData, DailySectionEntry } from '@papergrid/core';
import { Plus } from 'lucide-react';

interface DailySectionBlockProps {
  block: Block;
  onChange: (id: string, updatedBlock: Partial<Block>) => void;
  colorClasses: {
    text: string;
    bg: string;
    border: string;
    highlight: string;
    focusBg: string;
    hoverHighlight: string;
  };
}

const getDefaultDayLabel = (): string => {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' };
  return now.toLocaleDateString('en-US', options);
};

const getDefaultDailySectionData = (): DailySectionData => ({
  dayLabel: getDefaultDayLabel(),
  sections: [
    { label: 'Morning', content: '' },
    { label: 'Afternoon', content: '' },
    { label: 'Evening', content: '' },
  ],
});

const SECTION_ACCENTS: Record<string, { bg: string; text: string; border: string }> = {
  morning: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
  afternoon: { bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-200' },
  evening: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200' },
  night: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
};

const getSectionAccent = (label: string, colorClasses: DailySectionBlockProps['colorClasses']) => {
  const lowerLabel = label.toLowerCase();
  const match = SECTION_ACCENTS[lowerLabel];
  if (match) return match;
  // Default to theme colors
  return { bg: colorClasses.bg, text: colorClasses.text, border: colorClasses.border };
};

export const DailySectionBlock: React.FC<DailySectionBlockProps> = ({ block, onChange, colorClasses }) => {
  const data = block.dailySectionData ?? getDefaultDailySectionData();
  const sections = data.sections.length > 0 ? data.sections : getDefaultDailySectionData().sections;
  const dayLabel = data.dayLabel ?? getDefaultDayLabel();

  const updateDayLabel = (newLabel: string) => {
    onChange(block.id, {
      dailySectionData: { ...data, dayLabel: newLabel },
    });
  };

  const updateSectionLabel = (index: number, label: string) => {
    const newSections = sections.map((s, i) =>
      i === index ? { ...s, label } : s
    );
    onChange(block.id, {
      dailySectionData: { ...data, sections: newSections },
    });
  };

  const updateSectionContent = (index: number, content: string) => {
    const newSections = sections.map((s, i) =>
      i === index ? { ...s, content } : s
    );
    onChange(block.id, {
      dailySectionData: { ...data, sections: newSections },
    });
  };

  const addSection = () => {
    const newSections: DailySectionEntry[] = [...sections, { label: 'New Section', content: '' }];
    onChange(block.id, {
      dailySectionData: { ...data, sections: newSections },
    });
  };

  const removeSection = (index: number) => {
    if (sections.length <= 1) return;
    const newSections = sections.filter((_, i) => i !== index);
    onChange(block.id, {
      dailySectionData: { ...data, sections: newSections },
    });
  };

  return (
    <div className="w-full" style={{ marginBottom: '32px' }}>
      <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Date header */}
        <div className="px-4 pt-3 pb-1">
          <input
            className={`w-full bg-transparent text-xl font-sans font-bold text-gray-800 focus:outline-none border-none p-0 m-0 placeholder-gray-300`}
            style={{ lineHeight: '32px', height: '32px' }}
            value={dayLabel}
            onChange={(e) => updateDayLabel(e.target.value)}
            placeholder="Monday, March 2..."
          />
          {/* Decorative underline */}
          <div className={`h-0.5 rounded-full mt-1 ${colorClasses.highlight}`} style={{ width: '60%' }} />
        </div>

        {/* Sections */}
        <div className="p-3 flex flex-col gap-3">
          {sections.map((section, i) => {
            const accent = getSectionAccent(section.label, colorClasses);
            return (
              <div key={i} className="group/section">
                {/* Section label pill */}
                <div className="flex items-center gap-2" style={{ height: '32px' }}>
                  <div className={`inline-flex items-center rounded-full px-3 ${accent.bg} border ${accent.border}`} style={{ height: '24px' }}>
                    <input
                      className={`bg-transparent text-[10px] font-sans font-bold uppercase tracking-widest ${accent.text} focus:outline-none border-none p-0 m-0 w-20`}
                      value={section.label}
                      onChange={(e) => updateSectionLabel(i, e.target.value)}
                    />
                  </div>
                  {sections.length > 1 && (
                    <button
                      onClick={() => removeSection(i)}
                      className="opacity-0 group-hover/section:opacity-100 text-gray-300 hover:text-red-400 text-xs transition-opacity"
                      aria-label={`Remove ${section.label} section`}
                    >
                      x
                    </button>
                  )}
                </div>

                {/* Section content */}
                <textarea
                  className={`w-full bg-transparent font-hand text-sm text-gray-700 resize-none focus:outline-none overflow-hidden placeholder-gray-300 block p-0 pl-2 m-0 border-none ml-1 border-l-2 ${accent.border}`}
                  style={{ lineHeight: '32px', minHeight: '64px' }}
                  value={section.content}
                  onChange={(e) => updateSectionContent(i, e.target.value)}
                  placeholder={`What's planned for ${section.label.toLowerCase()}...`}
                  spellCheck={false}
                />

                {/* Soft divider between sections */}
                {i < sections.length - 1 && (
                  <div className="border-b border-gray-100 mt-1" />
                )}
              </div>
            );
          })}
        </div>

        {/* Add Section button */}
        <button
          onClick={addSection}
          className={`w-full ${colorClasses.bg} ${colorClasses.hoverHighlight} ${colorClasses.text} text-xs font-sans border-t ${colorClasses.border} flex items-center justify-center gap-1 transition-colors`}
          style={{ height: '32px' }}
        >
          <Plus size={12} /> Add Section
        </button>
      </div>
    </div>
  );
};
