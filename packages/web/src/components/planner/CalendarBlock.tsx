import React from 'react';
import { Block, CalendarData } from '@papergrid/core';

interface CalendarBlockProps {
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

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const getDefaultCalendarData = (): CalendarData => {
  const now = new Date();
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    highlights: [],
  };
};

const getDaysInMonth = (month: number, year: number): number => {
  return new Date(year, month, 0).getDate();
};

const getFirstDayOfWeek = (month: number, year: number): number => {
  return new Date(year, month - 1, 1).getDay();
};

export const CalendarBlock: React.FC<CalendarBlockProps> = ({ block, onChange, colorClasses }) => {
  const data = block.calendarData ?? getDefaultCalendarData();
  const daysInMonth = getDaysInMonth(data.month, data.year);
  const firstDay = getFirstDayOfWeek(data.month, data.year);
  const highlights = data.highlights ?? [];

  const today = new Date();
  const isCurrentMonth = today.getMonth() + 1 === data.month && today.getFullYear() === data.year;
  const todayDate = today.getDate();

  const totalCells = firstDay + daysInMonth;
  const rows = Math.ceil(totalCells / 7);

  const toggleHighlight = (day: number) => {
    const newHighlights = highlights.includes(day)
      ? highlights.filter(d => d !== day)
      : [...highlights, day];
    onChange(block.id, {
      calendarData: { ...data, highlights: newHighlights },
    });
  };

  const changeMonth = (delta: number) => {
    let newMonth = data.month + delta;
    let newYear = data.year;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    } else if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    onChange(block.id, {
      calendarData: { ...data, month: newMonth, year: newYear, highlights: [] },
    });
  };

  return (
    <div className="w-full" style={{ marginBottom: '32px' }}>
      <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Month header */}
        <div className={`flex items-center justify-between px-4 ${colorClasses.bg}`} style={{ height: '32px' }}>
          <button
            onClick={() => changeMonth(-1)}
            className={`text-sm font-sans font-bold ${colorClasses.text} hover:opacity-70 transition-opacity px-1`}
            aria-label="Previous month"
          >
            &lsaquo;
          </button>
          <span className={`text-sm font-sans font-bold ${colorClasses.text} tracking-wide`}>
            {MONTH_NAMES[data.month - 1]} {data.year}
          </span>
          <button
            onClick={() => changeMonth(1)}
            className={`text-sm font-sans font-bold ${colorClasses.text} hover:opacity-70 transition-opacity px-1`}
            aria-label="Next month"
          >
            &rsaquo;
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7">
          {DAY_HEADERS.map((day, i) => (
            <div
              key={i}
              className={`text-center text-[10px] font-sans font-bold uppercase tracking-wider text-gray-400 ${
                i === 0 || i === 6 ? 'bg-amber-50/40' : ''
              }`}
              style={{ height: '32px', lineHeight: '32px' }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Date grid */}
        <div className="grid grid-cols-7">
          {Array.from({ length: rows * 7 }, (_, i) => {
            const dayNum = i - firstDay + 1;
            const isValid = dayNum >= 1 && dayNum <= daysInMonth;
            const isToday = isCurrentMonth && dayNum === todayDate;
            const isHighlighted = isValid && highlights.includes(dayNum);
            const isWeekend = i % 7 === 0 || i % 7 === 6;

            return (
              <div
                key={i}
                className={`flex items-center justify-center ${isWeekend && isValid ? 'bg-amber-50/40' : ''}`}
                style={{ height: '32px' }}
              >
                {isValid && (
                  <button
                    onClick={() => toggleHighlight(dayNum)}
                    className={`w-7 h-7 rounded-full text-xs font-sans transition-all flex items-center justify-center ${
                      isToday && isHighlighted
                        ? `${colorClasses.highlight} ${colorClasses.text} font-bold ring-2 ring-current`
                        : isToday
                          ? `${colorClasses.text} font-bold ring-2 ring-current ring-offset-1`
                          : isHighlighted
                            ? `${colorClasses.highlight} ${colorClasses.text} font-semibold`
                            : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    aria-label={`${MONTH_NAMES[data.month - 1]} ${dayNum}`}
                  >
                    {dayNum}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
