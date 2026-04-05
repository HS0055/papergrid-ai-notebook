import React from 'react';
import { Block, RatingData } from '@papergrid/core';

interface RatingBlockProps {
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

const getDefaultRatingData = (): RatingData => ({
  label: 'Rate',
  max: 5,
  value: 0,
  style: 'star',
});

const STYLE_ICONS: Record<RatingData['style'], { filled: string; empty: string }> = {
  star: { filled: '\u2605', empty: '\u2606' },
  circle: { filled: '\u25CF', empty: '\u25CB' },
  heart: { filled: '\u2665', empty: '\u2661' },
};

export const RatingBlock: React.FC<RatingBlockProps> = ({ block, onChange, colorClasses }) => {
  const data = block.ratingData ?? getDefaultRatingData();
  const icons = STYLE_ICONS[data.style] ?? STYLE_ICONS.star;

  const updateData = (partial: Partial<RatingData>) => {
    onChange(block.id, {
      ratingData: { ...data, ...partial },
    });
  };

  const handleIconClick = (index: number) => {
    // Clicking the same icon that is the current value toggles it off (set to index - 1)
    const newValue = index === data.value ? index - 1 : index;
    updateData({ value: Math.max(0, newValue) });
  };

  const cycleStyle = () => {
    const styles: RatingData['style'][] = ['star', 'circle', 'heart'];
    const currentIndex = styles.indexOf(data.style);
    const nextStyle = styles[(currentIndex + 1) % styles.length];
    updateData({ style: nextStyle });
  };

  return (
    <div className="w-full" style={{ marginBottom: '32px' }}>
      <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200 shadow-sm overflow-hidden p-4">
        {/* Label row */}
        <div className="flex items-center gap-2 mb-3">
          <input
            className="flex-1 bg-transparent font-hand text-sm text-gray-700 focus:outline-none border-none p-0 m-0 placeholder-gray-300 font-bold"
            style={{ lineHeight: '32px', height: '32px' }}
            value={data.label}
            onChange={(e) => updateData({ label: e.target.value })}
            placeholder="Label..."
          />
          <button
            onClick={cycleStyle}
            className="text-[10px] font-sans text-gray-400 hover:text-gray-600 transition-colors px-2 py-1 rounded border border-gray-200 hover:border-gray-300"
            aria-label="Change rating style"
          >
            {data.style}
          </button>
        </div>

        {/* Rating icons */}
        <div className="flex items-center gap-1" role="radiogroup" aria-label={data.label}>
          {Array.from({ length: data.max }, (_, i) => {
            const index = i + 1;
            const isActive = index <= data.value;
            return (
              <button
                key={i}
                onClick={() => handleIconClick(index)}
                className={`text-2xl transition-all duration-150 hover:scale-110 cursor-pointer select-none ${
                  isActive ? colorClasses.text : 'text-gray-300'
                }`}
                style={{ lineHeight: 1 }}
                role="radio"
                aria-checked={isActive}
                aria-label={`${index} of ${data.max}`}
              >
                {isActive ? icons.filled : icons.empty}
              </button>
            );
          })}
          <span className="ml-2 text-xs font-sans text-gray-400">
            {data.value}/{data.max}
          </span>
        </div>
      </div>
    </div>
  );
};
