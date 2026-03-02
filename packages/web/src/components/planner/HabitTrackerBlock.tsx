import React from 'react';
import { Block, HabitTrackerData } from '@papergrid/core';
import { Plus, Check } from 'lucide-react';

interface HabitTrackerBlockProps {
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

const getDefaultHabitData = (): HabitTrackerData => ({
  habits: ['Exercise', 'Read', 'Meditate'],
  days: 7,
  checked: [
    Array(7).fill(false),
    Array(7).fill(false),
    Array(7).fill(false),
  ],
});

const getStreak = (row: boolean[]): number => {
  let streak = 0;
  for (let i = row.length - 1; i >= 0; i--) {
    if (row[i]) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
};

export const HabitTrackerBlock: React.FC<HabitTrackerBlockProps> = ({ block, onChange, colorClasses }) => {
  const data = block.habitTrackerData ?? getDefaultHabitData();

  const toggleCheck = (habitIndex: number, dayIndex: number) => {
    const newChecked = data.checked.map((row: boolean[], hi: number) =>
      hi === habitIndex
        ? row.map((val: boolean, di: number) => (di === dayIndex ? !val : val))
        : [...row]
    );
    onChange(block.id, {
      habitTrackerData: { ...data, checked: newChecked },
    });
  };

  const updateHabitName = (habitIndex: number, name: string) => {
    const newHabits = data.habits.map((h: string, i: number) => (i === habitIndex ? name : h));
    onChange(block.id, {
      habitTrackerData: { ...data, habits: newHabits },
    });
  };

  const addHabit = () => {
    const newHabits = [...data.habits, ''];
    const newChecked = [...data.checked, Array(data.days).fill(false)];
    onChange(block.id, {
      habitTrackerData: { ...data, habits: newHabits, checked: newChecked },
    });
  };

  const removeHabit = (habitIndex: number) => {
    if (data.habits.length <= 1) return;
    const newHabits = data.habits.filter((_, i) => i !== habitIndex);
    const newChecked = data.checked.filter((_, i) => i !== habitIndex);
    onChange(block.id, {
      habitTrackerData: { ...data, habits: newHabits, checked: newChecked },
    });
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

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            {/* Day number headers */}
            <thead>
              <tr>
                {/* Habit name column header */}
                <th
                  className={`text-left text-[10px] font-sans font-bold uppercase tracking-wider text-gray-400 px-3 ${colorClasses.bg} border-b ${colorClasses.border}`}
                  style={{ height: '32px', minWidth: '120px' }}
                >
                  Habit
                </th>
                {Array.from({ length: data.days }, (_, i) => (
                  <th
                    key={i}
                    className={`text-center text-[10px] font-sans font-bold text-gray-400 ${colorClasses.bg} border-b ${colorClasses.border}`}
                    style={{ height: '32px', width: '32px', minWidth: '32px' }}
                  >
                    {i + 1}
                  </th>
                ))}
                {/* Streak column */}
                <th
                  className={`text-center text-[10px] font-sans font-bold uppercase tracking-wider text-gray-400 px-2 ${colorClasses.bg} border-b ${colorClasses.border}`}
                  style={{ height: '32px', minWidth: '48px' }}
                >
                  Streak
                </th>
              </tr>
            </thead>
            <tbody>
              {data.habits.map((habit, hi) => {
                const row = data.checked[hi] ?? Array(data.days).fill(false);
                const streak = getStreak(row);

                return (
                  <tr key={hi} className={`border-b ${colorClasses.border} last:border-b-0`}>
                    {/* Habit name cell */}
                    <td className="px-2 group/habit" style={{ height: '32px' }}>
                      <div className="flex items-center gap-1">
                        <input
                          className="flex-1 bg-transparent font-hand text-sm text-gray-700 focus:outline-none border-none p-0 m-0 placeholder-gray-300"
                          style={{ lineHeight: '32px', height: '32px' }}
                          value={habit}
                          onChange={(e) => updateHabitName(hi, e.target.value)}
                          placeholder="Habit name..."
                        />
                        {data.habits.length > 1 && (
                          <button
                            onClick={() => removeHabit(hi)}
                            className="opacity-0 group-hover/habit:opacity-100 text-gray-300 hover:text-red-400 text-xs transition-opacity"
                            aria-label={`Remove ${habit}`}
                          >
                            x
                          </button>
                        )}
                      </div>
                    </td>
                    {/* Day checkboxes */}
                    {Array.from({ length: data.days }, (_, di) => {
                      const isChecked = row[di] ?? false;
                      return (
                        <td key={di} className="p-0 text-center" style={{ height: '32px' }}>
                          <button
                            onClick={() => toggleCheck(hi, di)}
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all mx-auto ${isChecked
                                ? `${colorClasses.highlight} ${colorClasses.border} ${colorClasses.text}`
                                : 'border-gray-200 hover:border-gray-300'
                              }`}
                            aria-label={`${habit} day ${di + 1} ${isChecked ? 'completed' : 'not completed'}`}
                          >
                            {isChecked && <Check size={12} strokeWidth={3} />}
                          </button>
                        </td>
                      );
                    })}
                    {/* Streak counter */}
                    <td className="text-center" style={{ height: '32px' }}>
                      {streak > 0 && (
                        <span className={`inline-flex items-center gap-0.5 text-xs font-sans font-bold ${colorClasses.text}`}>
                          {streak}
                          <span className="text-[10px]">d</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Add Habit button */}
        <button
          onClick={addHabit}
          className={`w-full ${colorClasses.bg} ${colorClasses.hoverHighlight} ${colorClasses.text} text-xs font-sans border-t ${colorClasses.border} flex items-center justify-center gap-1 transition-colors`}
          style={{ height: '32px' }}
        >
          <Plus size={12} /> Add Habit
        </button>
      </div>
    </div>
  );
};
