import React from 'react';
import { Block, TimeBlockData, TimeBlockEntry } from '@papergrid/core';

interface TimeBlockBlockProps {
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

const formatHour = (hour: number): string => {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:00 ${period}`;
};

const generateDefaultEntries = (startHour: number, endHour: number, interval: 30 | 60): TimeBlockEntry[] => {
  const entries: TimeBlockEntry[] = [];
  for (let h = startHour; h <= endHour; h++) {
    if (interval === 60) {
      entries.push({ time: formatHour(h), content: '' });
    } else {
      entries.push({ time: formatHour(h), content: '' });
      if (h < endHour) {
        const period = h >= 12 ? 'PM' : 'AM';
        const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
        entries.push({ time: `${displayHour}:30 ${period}`, content: '' });
      }
    }
  }
  return entries;
};

const getDefaultTimeBlockData = (): TimeBlockData => ({
  startHour: 8,
  endHour: 18,
  interval: 60,
  entries: generateDefaultEntries(8, 18, 60),
});

const getCurrentHourLabel = (): string => {
  const now = new Date();
  return formatHour(now.getHours());
};

const COLOR_DOTS = ['rose', 'indigo', 'emerald', 'amber', 'sky', 'slate'];

export const TimeBlockBlock: React.FC<TimeBlockBlockProps> = ({ block, onChange, colorClasses }) => {
  const data = block.timeBlockData ?? getDefaultTimeBlockData();
  const entries = data.entries.length > 0 ? data.entries : generateDefaultEntries(data.startHour, data.endHour, data.interval);
  const currentHourLabel = getCurrentHourLabel();

  const updateEntryContent = (index: number, content: string) => {
    const newEntries = entries.map((entry, i) =>
      i === index ? { ...entry, content } : entry
    );
    onChange(block.id, {
      timeBlockData: { ...data, entries: newEntries },
    });
  };

  const cycleEntryColor = (index: number) => {
    const entry = entries[index];
    if (!entry) return;
    const currentIdx = entry.color ? COLOR_DOTS.indexOf(entry.color) : -1;
    const nextColor = currentIdx >= COLOR_DOTS.length - 1 ? undefined : COLOR_DOTS[currentIdx + 1];
    const newEntries = entries.map((e, i) =>
      i === index ? { ...e, color: nextColor } : e
    );
    onChange(block.id, {
      timeBlockData: { ...data, entries: newEntries },
    });
  };

  const getDotColorClass = (color?: string): string => {
    switch (color) {
      case 'rose': return 'bg-rose-400';
      case 'indigo': return 'bg-indigo-400';
      case 'emerald': return 'bg-emerald-400';
      case 'amber': return 'bg-amber-400';
      case 'sky': return 'bg-sky-400';
      case 'slate': return 'bg-slate-400';
      default: return 'bg-transparent';
    }
  };

  return (
    <div className="w-full" style={{ marginBottom: '32px' }}>
      <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Title header */}
        {block.content && (
          <div
            className={`px-4 text-sm font-sans font-bold ${colorClasses.text} ${colorClasses.bg} border-b ${colorClasses.border}`}
            style={{ height: '32px', lineHeight: '32px' }}
          >
            {block.content}
          </div>
        )}

        {/* Time entries */}
        <div className="flex flex-col">
          {entries.map((entry, i) => {
            const isCurrentHour = entry.time === currentHourLabel;
            return (
              <div
                key={i}
                className={`flex items-stretch border-b last:border-b-0 ${colorClasses.border} ${
                  isCurrentHour ? colorClasses.bg : ''
                }`}
              >
                {/* Color dot */}
                <button
                  onClick={() => cycleEntryColor(i)}
                  className="flex items-center justify-center px-2 flex-shrink-0 hover:bg-gray-50 transition-colors"
                  style={{ width: '32px' }}
                  aria-label="Toggle color indicator"
                >
                  <div
                    className={`w-2 h-2 rounded-full ${getDotColorClass(entry.color)} ${
                      entry.color ? '' : 'border border-gray-200'
                    }`}
                  />
                </button>

                {/* Time label */}
                <div
                  className={`flex-shrink-0 flex items-center text-[11px] font-sans font-bold tracking-wide pr-3 ${
                    isCurrentHour ? colorClasses.text : 'text-gray-400'
                  }`}
                  style={{ width: '80px', height: '32px' }}
                >
                  {entry.time}
                </div>

                {/* Divider */}
                <div className={`w-px ${isCurrentHour ? colorClasses.border.replace('border-', 'bg-') : 'bg-gray-100'} flex-shrink-0`} />

                {/* Content */}
                <input
                  className={`flex-1 bg-transparent font-hand text-sm text-gray-700 focus:outline-none border-none px-3 m-0 placeholder-gray-300 ${colorClasses.focusBg}`}
                  style={{ lineHeight: '32px', height: '32px' }}
                  value={entry.content}
                  onChange={(e) => updateEntryContent(i, e.target.value)}
                  placeholder={isCurrentHour ? 'Now...' : ''}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
