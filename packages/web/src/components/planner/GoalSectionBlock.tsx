import React from 'react';
import { Block, GoalSectionData, GoalItem } from '@papergrid/core';
import { Plus, Check } from 'lucide-react';

interface GoalSectionBlockProps {
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

const getDefaultGoalData = (): GoalSectionData => ({
  goals: [
    {
      text: '',
      subItems: [
        { text: '', checked: false },
        { text: '', checked: false },
      ],
      progress: 0,
    },
  ],
});

export const GoalSectionBlock: React.FC<GoalSectionBlockProps> = ({ block, onChange, colorClasses }) => {
  const data = block.goalSectionData ?? getDefaultGoalData();
  const goals = data.goals.length > 0 ? data.goals : getDefaultGoalData().goals;

  const updateGoals = (newGoals: GoalItem[]) => {
    onChange(block.id, {
      goalSectionData: { ...data, goals: newGoals },
    });
  };

  const updateGoalText = (goalIndex: number, text: string) => {
    const newGoals = goals.map((g, i) => (i === goalIndex ? { ...g, text } : g));
    updateGoals(newGoals);
  };

  const updateSubItemText = (goalIndex: number, subIndex: number, text: string) => {
    const newGoals = goals.map((g, gi) =>
      gi === goalIndex
        ? {
            ...g,
            subItems: g.subItems.map((s, si) => (si === subIndex ? { ...s, text } : s)),
          }
        : g
    );
    updateGoals(newGoals);
  };

  const toggleSubItem = (goalIndex: number, subIndex: number) => {
    const newGoals = goals.map((g, gi) => {
      if (gi !== goalIndex) return g;
      const newSubItems = g.subItems.map((s, si) =>
        si === subIndex ? { ...s, checked: !s.checked } : s
      );
      // Auto-calculate progress from sub-item completion
      const checkedCount = newSubItems.filter(s => s.checked).length;
      const progress = newSubItems.length > 0 ? Math.round((checkedCount / newSubItems.length) * 100) : 0;
      return { ...g, subItems: newSubItems, progress };
    });
    updateGoals(newGoals);
  };

  const addGoal = () => {
    const newGoal: GoalItem = {
      text: '',
      subItems: [{ text: '', checked: false }],
      progress: 0,
    };
    updateGoals([...goals, newGoal]);
  };

  const addSubItem = (goalIndex: number) => {
    const newGoals = goals.map((g, gi) =>
      gi === goalIndex
        ? { ...g, subItems: [...g.subItems, { text: '', checked: false }] }
        : g
    );
    updateGoals(newGoals);
  };

  const removeGoal = (goalIndex: number) => {
    if (goals.length <= 1) return;
    updateGoals(goals.filter((_, i) => i !== goalIndex));
  };

  const removeSubItem = (goalIndex: number, subIndex: number) => {
    const goal = goals[goalIndex];
    if (!goal || goal.subItems.length <= 1) return;
    const newGoals = goals.map((g, gi) =>
      gi === goalIndex
        ? { ...g, subItems: g.subItems.filter((_, si) => si !== subIndex) }
        : g
    );
    updateGoals(newGoals);
  };

  return (
    <div className="w-full" style={{ marginBottom: '32px' }}>
      <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Section title */}
        <div
          className={`px-4 ${colorClasses.highlight}`}
          style={{ minHeight: '32px', lineHeight: '32px' }}
        >
          <input
            className={`w-full bg-transparent text-lg font-sans font-bold ${colorClasses.text} focus:outline-none border-none p-0 m-0 placeholder-gray-300`}
            style={{ lineHeight: '32px', height: '32px' }}
            value={block.content}
            onChange={(e) => onChange(block.id, { content: e.target.value })}
            placeholder="Goals Section Title..."
          />
        </div>

        {/* Goals list */}
        <div className="p-3 flex flex-col gap-4">
          {goals.map((goal, gi) => (
            <div key={gi} className="group/goal">
              {/* Goal header row */}
              <div className="flex items-center gap-2" style={{ minHeight: '32px' }}>
                <div className={`w-1.5 h-5 rounded-full ${colorClasses.highlight}`} />
                <input
                  className="flex-1 bg-transparent font-sans text-sm font-bold text-gray-800 focus:outline-none border-none p-0 m-0 placeholder-gray-300"
                  style={{ lineHeight: '32px', height: '32px' }}
                  value={goal.text}
                  onChange={(e) => updateGoalText(gi, e.target.value)}
                  placeholder="Goal title..."
                />
                {goals.length > 1 && (
                  <button
                    onClick={() => removeGoal(gi)}
                    className="opacity-0 group-hover/goal:opacity-100 text-gray-300 hover:text-red-400 text-xs transition-opacity px-1"
                    aria-label="Remove goal"
                  >
                    x
                  </button>
                )}
              </div>

              {/* Progress bar */}
              {goal.subItems.length > 0 && (
                <div className="ml-4 mt-1 mb-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${colorClasses.highlight} rounded-full transition-all duration-300`}
                      style={{ width: `${goal.progress ?? 0}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-sans font-bold text-gray-400 tabular-nums">
                    {goal.progress ?? 0}%
                  </span>
                </div>
              )}

              {/* Sub-items */}
              <div className="ml-4 flex flex-col">
                {goal.subItems.map((sub, si) => (
                  <div
                    key={si}
                    className="flex items-center gap-2 group/sub"
                    style={{ minHeight: '32px' }}
                  >
                    <button
                      onClick={() => toggleSubItem(gi, si)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                        sub.checked
                          ? `${colorClasses.highlight} ${colorClasses.border} ${colorClasses.text}`
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      aria-label={`${sub.checked ? 'Uncheck' : 'Check'} sub-item`}
                    >
                      {sub.checked && <Check size={10} strokeWidth={3} />}
                    </button>
                    <input
                      className={`flex-1 bg-transparent font-hand text-sm focus:outline-none border-none p-0 m-0 placeholder-gray-300 ${
                        sub.checked ? 'text-gray-400 line-through' : 'text-gray-700'
                      }`}
                      style={{ lineHeight: '32px', height: '32px' }}
                      value={sub.text}
                      onChange={(e) => updateSubItemText(gi, si, e.target.value)}
                      placeholder="Sub-item..."
                    />
                    {goal.subItems.length > 1 && (
                      <button
                        onClick={() => removeSubItem(gi, si)}
                        className="opacity-0 group-hover/sub:opacity-100 text-gray-300 hover:text-red-400 text-xs transition-opacity"
                        aria-label="Remove sub-item"
                      >
                        x
                      </button>
                    )}
                  </div>
                ))}

                {/* Add sub-item link */}
                <button
                  onClick={() => addSubItem(gi)}
                  className={`text-[11px] font-sans ${colorClasses.text} opacity-50 hover:opacity-100 transition-opacity text-left ml-7`}
                  style={{ height: '32px', lineHeight: '32px' }}
                >
                  + add sub-item
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add Goal button */}
        <button
          onClick={addGoal}
          className={`w-full ${colorClasses.bg} ${colorClasses.hoverHighlight} ${colorClasses.text} text-xs font-sans border-t ${colorClasses.border} flex items-center justify-center gap-1 transition-colors`}
          style={{ height: '32px' }}
        >
          <Plus size={12} /> Add Goal
        </button>
      </div>
    </div>
  );
};
