import React from 'react';
import { Block, WaterTrackerData } from '@papergrid/core';

interface WaterTrackerBlockProps {
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

const getDefaultWaterTrackerData = (): WaterTrackerData => ({
  goal: 8,
  filled: 0,
});

export const WaterTrackerBlock: React.FC<WaterTrackerBlockProps> = ({ block, onChange, colorClasses }) => {
  const data = block.waterTrackerData ?? getDefaultWaterTrackerData();

  const updateData = (partial: Partial<WaterTrackerData>) => {
    onChange(block.id, {
      waterTrackerData: { ...data, ...partial },
    });
  };

  const handleDropletClick = (index: number) => {
    // index is 1-based (glass number)
    // If clicking the last filled glass, unfill it (set filled to index - 1)
    // Otherwise, fill up to that glass
    if (index === data.filled) {
      updateData({ filled: index - 1 });
    } else {
      updateData({ filled: index });
    }
  };

  return (
    <div className="w-full" style={{ marginBottom: '32px' }}>
      <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200 shadow-sm overflow-hidden p-4">
        {/* Header with counter */}
        <div className="flex items-center justify-between mb-3">
          {block.content ? (
            <span
              className={`text-sm font-sans font-bold ${colorClasses.text}`}
              style={{ lineHeight: '32px', height: '32px', display: 'inline-block' }}
            >
              {block.content}
            </span>
          ) : (
            <span
              className={`text-sm font-sans font-bold ${colorClasses.text}`}
              style={{ lineHeight: '32px', height: '32px', display: 'inline-block' }}
            >
              Water Intake
            </span>
          )}
          <span className="text-xs font-sans text-gray-500">
            {data.filled}/{data.goal} glasses
          </span>
        </div>

        {/* Droplet row */}
        <div className="flex items-center gap-2 flex-wrap">
          {Array.from({ length: data.goal }, (_, i) => {
            const glassNumber = i + 1;
            const isFilled = glassNumber <= data.filled;
            return (
              <button
                key={i}
                onClick={() => handleDropletClick(glassNumber)}
                className="transition-transform duration-150 hover:scale-110 cursor-pointer"
                aria-label={`Glass ${glassNumber} ${isFilled ? 'filled' : 'empty'}`}
              >
                <svg viewBox="0 0 24 24" className="w-8 h-8">
                  <path
                    d="M12 2C12 2 5 10 5 15a7 7 0 1014 0C19 10 12 2 12 2z"
                    fill={isFilled ? '#0ea5e9' : 'none'}
                    stroke={isFilled ? '#0ea5e9' : '#d1d5db'}
                    strokeWidth="1.5"
                  />
                </svg>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
