import React, { useState } from 'react';
import { Block, WeeklyViewData, WeeklyViewDay, WeeklyViewTask } from '@papergrid/core';
import { Check, Plus } from 'lucide-react';

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

  const [addingTaskDay, setAddingTaskDay] = useState<number | null>(null);
  const [newTaskText, setNewTaskText] = useState('');

  const updateDays = (newDays: WeeklyViewDay[]) => {
    onChange(block.id, {
      weeklyViewData: { ...data, days: newDays },
    });
  };

  const handleDayContentChange = (index: number, content: string) => {
    const newDays = days.map((day, i) =>
      i === index ? { ...day, content } : day
    );
    updateDays(newDays);
  };

  const toggleTask = (dayIndex: number, taskIndex: number) => {
    const newDays = days.map((day, di) => {
      if (di !== dayIndex || !day.tasks) return day;
      const newTasks = day.tasks.map((t, ti) =>
        ti === taskIndex ? { ...t, checked: !t.checked } : t
      );
      return { ...day, tasks: newTasks };
    });
    updateDays(newDays);
  };

  const addTask = (dayIndex: number) => {
    if (!newTaskText.trim()) return;
    const newTask: WeeklyViewTask = { text: newTaskText.trim(), checked: false };
    const newDays = days.map((day, di) => {
      if (di !== dayIndex) return day;
      return { ...day, tasks: [...(day.tasks || []), newTask] };
    });
    updateDays(newDays);
    setNewTaskText('');
    setAddingTaskDay(null);
  };

  const removeTask = (dayIndex: number, taskIndex: number) => {
    const newDays = days.map((day, di) => {
      if (di !== dayIndex || !day.tasks) return day;
      return { ...day, tasks: day.tasks.filter((_, ti) => ti !== taskIndex) };
    });
    updateDays(newDays);
  };

  const isWeekend = (label: string): boolean => {
    return WEEKEND_LABELS.some(w => label.toLowerCase().startsWith(w.toLowerCase()));
  };

  // Split into two rows: Mon-Thu top, Fri-Sun bottom
  const topRow = days.slice(0, 4);
  const bottomRow = days.slice(4);

  const renderDayCard = (day: WeeklyViewDay, globalIndex: number) => {
    const weekend = isWeekend(day.label);
    const tasks = day.tasks || [];
    const isAdding = addingTaskDay === globalIndex;

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

        {/* Notes area */}
        <textarea
          className={`w-full resize-none bg-transparent font-hand text-sm text-gray-700 placeholder-gray-300 focus:outline-none p-2 border-none ${
            weekend ? 'focus:bg-amber-50' : colorClasses.focusBg
          }`}
          style={{ minHeight: '48px', lineHeight: '32px' }}
          value={day.content}
          onChange={(e) => handleDayContentChange(globalIndex, e.target.value)}
          placeholder="Notes..."
          spellCheck={false}
        />

        {/* Tasks list */}
        {tasks.length > 0 && (
          <div className={`border-t ${weekend ? 'border-amber-200' : colorClasses.border} px-2 py-1`}>
            {tasks.map((task, ti) => (
              <div
                key={ti}
                className="flex items-center gap-1.5 group/task"
                style={{ minHeight: '24px' }}
              >
                <button
                  onClick={() => toggleTask(globalIndex, ti)}
                  className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all ${
                    task.checked
                      ? `${colorClasses.highlight} ${colorClasses.border} ${colorClasses.text}`
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  aria-label={`${task.checked ? 'Uncheck' : 'Check'} task`}
                >
                  {task.checked && <Check size={8} strokeWidth={3} />}
                </button>
                <span
                  className={`text-xs font-sans flex-1 ${
                    task.checked ? 'text-gray-400 line-through' : 'text-gray-600'
                  }`}
                >
                  {task.text}
                </span>
                <button
                  onClick={() => removeTask(globalIndex, ti)}
                  className="opacity-0 group-hover/task:opacity-100 text-gray-300 hover:text-red-400 text-[10px] transition-opacity"
                  aria-label="Remove task"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add task inline */}
        {isAdding ? (
          <div className={`border-t ${weekend ? 'border-amber-200' : colorClasses.border} px-2 py-1 flex items-center gap-1`}>
            <input
              className="flex-1 text-xs font-sans bg-transparent border-none focus:outline-none placeholder-gray-300 py-0.5"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addTask(globalIndex);
                if (e.key === 'Escape') { setAddingTaskDay(null); setNewTaskText(''); }
              }}
              placeholder="Task..."
              autoFocus
            />
          </div>
        ) : (
          <button
            onClick={() => { setAddingTaskDay(globalIndex); setNewTaskText(''); }}
            className={`w-full text-[10px] font-sans ${colorClasses.text} opacity-40 hover:opacity-100 transition-opacity border-t ${
              weekend ? 'border-amber-200' : colorClasses.border
            } flex items-center justify-center gap-0.5`}
            style={{ height: '24px' }}
          >
            <Plus size={10} /> task
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="w-full" style={{ marginBottom: '32px' }}>
      <div className="flex flex-col gap-2">
        {/* Top row: first 4 days */}
        <div className="grid grid-cols-4 gap-2">
          {topRow.map((day, i) => renderDayCard(day, i))}
        </div>
        {/* Bottom row: remaining days */}
        {bottomRow.length > 0 && (
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${bottomRow.length}, minmax(0, 1fr))` }}>
            {bottomRow.map((day, i) => renderDayCard(day, i + topRow.length))}
          </div>
        )}
      </div>
    </div>
  );
};
