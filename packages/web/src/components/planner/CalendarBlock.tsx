import React, { useState, useRef, useCallback } from 'react';
import { Block, CalendarData, CalendarEvent } from '@papergrid/core';
import { Plus, X } from 'lucide-react';

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

const EVENT_COLORS: Record<string, string> = {
  rose: 'bg-rose-200 text-rose-800',
  indigo: 'bg-indigo-200 text-indigo-800',
  emerald: 'bg-emerald-200 text-emerald-800',
  amber: 'bg-amber-200 text-amber-800',
  sky: 'bg-sky-200 text-sky-800',
  slate: 'bg-slate-200 text-slate-800',
  gray: 'bg-gray-200 text-gray-800',
};

const getDefaultCalendarData = (): CalendarData => {
  const now = new Date();
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    highlights: [],
    events: [],
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
  const events = data.events ?? [];

  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [newEventTitle, setNewEventTitle] = useState('');
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDayLongPressStart = useCallback((day: number) => {
    pressTimer.current = setTimeout(() => {
      setEditingDay(prev => prev === day ? null : day);
    }, 500);
  }, []);

  const handleDayLongPressEnd = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  const today = new Date();
  const isCurrentMonth = today.getMonth() + 1 === data.month && today.getFullYear() === data.year;
  const todayDate = today.getDate();

  const totalCells = firstDay + daysInMonth;
  const rows = Math.ceil(totalCells / 7);

  const getEventsForDay = (day: number): CalendarEvent[] =>
    events.filter(e => e.day === day);

  const toggleHighlight = (day: number) => {
    const newHighlights = highlights.includes(day)
      ? highlights.filter(d => d !== day)
      : [...highlights, day];
    onChange(block.id, {
      calendarData: { ...data, highlights: newHighlights },
    });
  };

  const addEvent = (day: number) => {
    if (!newEventTitle.trim()) return;
    const newEvent: CalendarEvent = {
      day,
      title: newEventTitle.trim(),
    };
    onChange(block.id, {
      calendarData: { ...data, events: [...events, newEvent] },
    });
    setNewEventTitle('');
    setEditingDay(null);
  };

  const removeEvent = (day: number, index: number) => {
    const dayEvents = events.filter(e => e.day === day);
    const eventToRemove = dayEvents[index];
    if (!eventToRemove) return;
    // Find the actual index in the full events array
    let count = 0;
    const actualIndex = events.findIndex(e => {
      if (e.day === day) {
        if (count === index) return true;
        count++;
      }
      return false;
    });
    if (actualIndex === -1) return;
    const newEvents = events.filter((_, i) => i !== actualIndex);
    onChange(block.id, {
      calendarData: { ...data, events: newEvents },
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
            const dayEvents = isValid ? getEventsForDay(dayNum) : [];
            const hasEvents = dayEvents.length > 0;

            return (
              <div
                key={i}
                className={`flex flex-col items-center ${isWeekend && isValid ? 'bg-amber-50/40' : ''}`}
                style={{ minHeight: '40px', padding: '2px 0' }}
              >
                {isValid && (
                  <>
                    <button
                      onClick={() => toggleHighlight(dayNum)}
                      onDoubleClick={() => setEditingDay(editingDay === dayNum ? null : dayNum)}
                      onTouchStart={() => handleDayLongPressStart(dayNum)}
                      onTouchEnd={handleDayLongPressEnd}
                      onTouchMove={handleDayLongPressEnd}
                      className={`w-8 h-8 md:w-7 md:h-7 rounded-full text-xs font-sans transition-all flex items-center justify-center flex-shrink-0 ${
                        isToday && isHighlighted
                          ? `${colorClasses.highlight} ${colorClasses.text} font-bold ring-2 ring-current`
                          : isToday
                            ? `${colorClasses.text} font-bold ring-2 ring-current ring-offset-1`
                            : isHighlighted
                              ? `${colorClasses.highlight} ${colorClasses.text} font-semibold`
                              : 'text-gray-600 hover:bg-gray-100'
                      }`}
                      aria-label={`${MONTH_NAMES[data.month - 1]} ${dayNum}${hasEvents ? `, ${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''}` : ''}`}
                    >
                      {dayNum}
                    </button>
                    {/* Event dots */}
                    {hasEvents && (
                      <div className="flex gap-0.5 mt-0.5">
                        {dayEvents.slice(0, 3).map((evt, ei) => (
                          <div
                            key={ei}
                            className={`w-1.5 h-1.5 rounded-full ${
                              evt.color && EVENT_COLORS[evt.color]
                                ? EVENT_COLORS[evt.color].split(' ')[0]
                                : colorClasses.highlight
                            }`}
                            title={evt.title}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Mobile hint: long press to add events */}
        <div className="md:hidden text-center text-[9px] font-sans text-gray-300 py-1">
          Hold a day to add event
        </div>

        {/* Events list */}
        {events.length > 0 && (
          <div className={`border-t ${colorClasses.border} px-3 py-2`}>
            <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-gray-400 mb-1">
              Events
            </div>
            <div className="flex flex-col gap-1">
              {/* Group events by day, show in order */}
              {Array.from(new Set(events.map(e => e.day)))
                .sort((a, b) => a - b)
                .map(day => {
                  const dayEvents = getEventsForDay(day);
                  return dayEvents.map((evt, ei) => (
                    <div
                      key={`${day}-${ei}`}
                      className="flex items-center gap-2 group/event"
                      style={{ minHeight: '24px' }}
                    >
                      <span className={`text-[10px] font-sans font-bold tabular-nums ${colorClasses.text}`} style={{ width: '24px' }}>
                        {day}
                      </span>
                      <span
                        className={`text-xs font-sans px-1.5 py-0.5 rounded ${
                          evt.color && EVENT_COLORS[evt.color]
                            ? EVENT_COLORS[evt.color]
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {evt.title}
                      </span>
                      <button
                        onClick={() => removeEvent(day, ei)}
                        className="text-gray-300 hover:text-red-400 md:opacity-0 md:group-hover/event:opacity-100 transition-opacity ml-auto active:text-red-500"
                        aria-label={`Remove event: ${evt.title}`}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ));
                })}
            </div>
          </div>
        )}

        {/* Add event inline (shown when double-clicking a day) */}
        {editingDay !== null && (
          <div className={`border-t ${colorClasses.border} px-3 py-2 flex items-center gap-2`}>
            <span className={`text-xs font-sans font-bold ${colorClasses.text}`}>
              Day {editingDay}:
            </span>
            <input
              className="flex-1 text-xs font-sans bg-transparent border-b border-gray-200 focus:border-gray-400 focus:outline-none py-1 placeholder-gray-300"
              value={newEventTitle}
              onChange={(e) => setNewEventTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addEvent(editingDay);
                if (e.key === 'Escape') { setEditingDay(null); setNewEventTitle(''); }
              }}
              placeholder="Event title..."
              autoFocus
            />
            <button
              onClick={() => addEvent(editingDay)}
              className={`${colorClasses.text} hover:opacity-70 transition-opacity`}
              aria-label="Add event"
            >
              <Plus size={14} />
            </button>
            <button
              onClick={() => { setEditingDay(null); setNewEventTitle(''); }}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Cancel"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
