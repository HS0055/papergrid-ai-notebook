import React from 'react';
import { Block, WeeklyViewData, WeeklyViewDay } from '@papergrid/core';

interface WeeklyViewBlockProps {
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

const DEFAULT_DAYS: WeeklyViewDay[] = [
  { label: 'Monday', content: '' },
  { label: 'Tuesday', content: '' },
  { label: 'Wednesday', content: '' },
  { label: 'Thursday', content: '' },
  { label: 'Friday', content: '' },
  { label: 'Saturday', content: '' },
  { label: 'Sunday', content: '' },
];

const WEEKEND_LABELS = ['Saturday', 'Sunday', 'Sat', 'Sun'];

const getDefaultWeeklyData = (): WeeklyViewData => ({
  days: DEFAULT_DAYS.map(d => ({ ...d })),
});

export const WeeklyViewBlock: React.FC<WeeklyViewBlockProps> = ({ block, onChange, colorClasses }) => {
  const data = block.weeklyViewData ?? getDefaultWeeklyData();
  const days = data.days.length > 0 ? data.days : DEFAULT_DAYS;

  const handleDayContentChange = (index: number, content: string) => {
    const newDays = days.map((day, i) =>
      i === index ? { ...day, content } : day
    );
    onChange(block.id, {
      weeklyViewData: { ...data, days: newDays },
    });
  };

  const isWeekend = (label: string): boolean => {
    return WEEKEND_LABELS.some(w => label.toLowerCase().startsWith(w.toLowerCase()));
  };

  // Split into two rows: Mon-Thu top, Fri-Sun bottom
  const topRow = days.slice(0, 4);
  const bottomRow = days.slice(4);

  const renderDayCard = (day: WeeklyViewDay, index: number, globalIndex: number) => {
    const weekend = isWeekend(day.label);

    return (
      <div
        key={globalIndex}
        className={`flex flex-col rounded-lg border overflow-hidden ${
          weekend ? 'bg-amber-50/50 border-amber-200' : `${colorClasses.bg} ${colorClasses.border}`
        }`}
      >
        {/* Day header pill */}
        <div
          className={`text-center text-[11px] font-sans font-bold uppercase tracking-wider ${
            weekend ? 'bg-amber-100 text-amber-700' : `${colorClasses.highlight} ${colorClasses.text}`
          }`}
          style={{ height: '32px', lineHeight: '32px' }}
        >
          {day.label}
        </div>
        {/* Content area */}
        <textarea
          className={`w-full flex-1 resize-none bg-transparent font-hand text-sm text-gray-700 placeholder-gray-300 focus:outline-none p-2 border-none ${
            weekend ? 'focus:bg-amber-50' : colorClasses.focusBg
          }`}
          style={{ minHeight: '64px', lineHeight: '32px' }}
          value={day.content}
          onChange={(e) => handleDayContentChange(globalIndex, e.target.value)}
          placeholder="Plans..."
          spellCheck={false}
        />
      </div>
    );
  };

  return (
    <div className="w-full" style={{ marginBottom: '32px' }}>
      <div className="flex flex-col gap-2">
        {/* Top row: first 4 days */}
        <div className="grid grid-cols-4 gap-2">
          {topRow.map((day, i) => renderDayCard(day, i, i))}
        </div>
        {/* Bottom row: remaining days */}
        {bottomRow.length > 0 && (
          <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${bottomRow.length}, minmax(0, 1fr))` }}>
            {bottomRow.map((day, i) => renderDayCard(day, i, i + topRow.length))}
          </div>
        )}
      </div>
    </div>
  );
};
