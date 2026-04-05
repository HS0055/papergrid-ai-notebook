import React, { useRef } from 'react';
import { Block, ProgressBarData } from '@papergrid/core';

interface ProgressBarBlockProps {
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

const getDefaultProgressBarData = (): ProgressBarData => ({
  label: 'Progress',
  current: 0,
  target: '100%',
  color: 'indigo',
});

export const ProgressBarBlock: React.FC<ProgressBarBlockProps> = ({ block, onChange, colorClasses }) => {
  const data = block.progressBarData ?? getDefaultProgressBarData();
  const barRef = useRef<HTMLDivElement>(null);

  const updateData = (partial: Partial<ProgressBarData>) => {
    onChange(block.id, {
      progressBarData: { ...data, ...partial },
    });
  };

  const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.round(Math.min(100, Math.max(0, (x / rect.width) * 100)));
    updateData({ current: percentage });
  };

  return (
    <div className="w-full" style={{ marginBottom: '32px' }}>
      <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200 shadow-sm overflow-hidden p-4">
        {/* Label and target inputs */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <input
            className={`flex-1 bg-transparent font-hand text-sm text-gray-700 focus:outline-none border-none p-0 m-0 placeholder-gray-300 font-bold`}
            style={{ lineHeight: '32px', height: '32px' }}
            value={data.label}
            onChange={(e) => updateData({ label: e.target.value })}
            placeholder="Label..."
          />
          <input
            className="w-24 bg-transparent font-hand text-sm text-gray-500 text-right focus:outline-none border-none p-0 m-0 placeholder-gray-300"
            style={{ lineHeight: '32px', height: '32px' }}
            value={data.target}
            onChange={(e) => updateData({ target: e.target.value })}
            placeholder="Target..."
          />
        </div>

        {/* Progress bar */}
        <div
          ref={barRef}
          className="relative w-full bg-gray-200 rounded-full cursor-pointer overflow-hidden"
          style={{ height: '32px' }}
          onClick={handleBarClick}
          role="progressbar"
          aria-valuenow={data.current}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${data.label} progress`}
        >
          {/* Fill */}
          <div
            className={`absolute inset-y-0 left-0 rounded-full ${colorClasses.highlight} transition-all duration-300 ease-out`}
            style={{ width: `${data.current}%` }}
          />
          {/* Percentage label */}
          <span className="absolute inset-0 flex items-center justify-center text-xs font-sans font-bold text-gray-700 mix-blend-multiply select-none">
            {data.current}%
          </span>
        </div>
      </div>
    </div>
  );
};
