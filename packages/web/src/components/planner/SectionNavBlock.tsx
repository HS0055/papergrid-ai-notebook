import React from 'react';
import { Block, SectionNavData, NotebookPage } from '@papergrid/core';
import { Plus } from 'lucide-react';

interface SectionNavBlockProps {
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
  allPages?: NotebookPage[];
  onNavigate?: (pageId: string) => void;
}

const getDefaultSectionNavData = (): SectionNavData => ({
  sections: [{ label: 'Getting Started', icon: '\uD83D\uDCD6' }],
});

export const SectionNavBlock: React.FC<SectionNavBlockProps> = ({
  block,
  onChange,
  colorClasses,
  allPages,
  onNavigate,
}) => {
  const data = block.sectionNavData ?? getDefaultSectionNavData();

  const updateData = (partial: Partial<SectionNavData>) => {
    onChange(block.id, {
      sectionNavData: { ...data, ...partial },
    });
  };

  const updateSection = (index: number, partial: Partial<SectionNavData['sections'][number]>) => {
    const newSections = data.sections.map((s, i) =>
      i === index ? { ...s, ...partial } : s
    );
    updateData({ sections: newSections });
  };

  const addSection = () => {
    const newSections = [...data.sections, { label: '', icon: '\uD83D\uDCC4' }];
    updateData({ sections: newSections });
  };

  const removeSection = (index: number) => {
    if (data.sections.length <= 1) return;
    const newSections = data.sections.filter((_, i) => i !== index);
    updateData({ sections: newSections });
  };

  const handleNavigate = (index: number) => {
    if (!onNavigate || !allPages) return;
    const section = data.sections[index];
    // Navigate using pageIndex if set, otherwise try to match by label
    if (section.pageIndex !== undefined && allPages[section.pageIndex]) {
      onNavigate(allPages[section.pageIndex].id);
    } else {
      // Try matching page by title
      const matchedPage = allPages.find(
        (p) => p.title.toLowerCase() === section.label.toLowerCase()
      );
      if (matchedPage) {
        onNavigate(matchedPage.id);
      }
    }
  };

  return (
    <div className="w-full" style={{ marginBottom: '32px' }}>
      <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Content label */}
        {block.content && (
          <div
            className={`px-4 text-sm font-sans font-bold ${colorClasses.text} ${colorClasses.bg} border-b ${colorClasses.border}`}
            style={{ height: '32px', lineHeight: '32px' }}
          >
            {block.content}
          </div>
        )}

        {/* Section list */}
        <div className="flex flex-col">
          {data.sections.map((section, i) => {
            const pageIndex = section.pageIndex;
            const pageNumber = pageIndex !== undefined ? pageIndex + 1 : undefined;

            return (
              <div
                key={i}
                className={`group/nav flex items-center gap-2 px-3 border-l-4 ${colorClasses.border} ${colorClasses.hoverHighlight} transition-colors cursor-pointer`}
                style={{ minHeight: '40px' }}
                onClick={() => handleNavigate(i)}
              >
                {/* Icon input */}
                <input
                  className="w-8 text-center bg-transparent text-base focus:outline-none border-none p-0 m-0"
                  value={section.icon ?? ''}
                  onChange={(e) => {
                    e.stopPropagation();
                    updateSection(i, { icon: e.target.value });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  maxLength={2}
                  style={{ lineHeight: '40px' }}
                  aria-label="Section icon"
                />

                {/* Label input */}
                <input
                  className="flex-1 bg-transparent font-hand text-sm text-gray-700 focus:outline-none border-none p-0 m-0 placeholder-gray-300"
                  style={{ lineHeight: '40px', height: '40px' }}
                  value={section.label}
                  onChange={(e) => {
                    e.stopPropagation();
                    updateSection(i, { label: e.target.value });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Section name..."
                />

                {/* Dot leader and page number */}
                <span className="text-xs font-sans text-gray-300 whitespace-nowrap">
                  {'..............'}
                  {pageNumber !== undefined && (
                    <span className={`ml-1 ${colorClasses.text} font-bold`}>p.{pageNumber}</span>
                  )}
                </span>

                {/* Delete button */}
                {data.sections.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSection(i);
                    }}
                    className="opacity-0 group-hover/nav:opacity-100 text-gray-300 hover:text-red-400 text-xs transition-opacity ml-1"
                    aria-label={`Remove ${section.label}`}
                  >
                    x
                  </button>
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
