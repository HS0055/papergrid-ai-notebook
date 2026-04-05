import React, { useRef, useEffect, useCallback } from 'react';
import { Block, BlockType, GridCell, NotebookPage } from '@papergrid/core';
import { Trash2, GripVertical, Plus, Info, Quote, ArrowLeftRight } from 'lucide-react';
import { MusicStaffBlock } from './MusicStaffBlock';
import { CalendarBlock } from './planner/CalendarBlock';
import { WeeklyViewBlock } from './planner/WeeklyViewBlock';
import { HabitTrackerBlock } from './planner/HabitTrackerBlock';
import { GoalSectionBlock } from './planner/GoalSectionBlock';
import { TimeBlockBlock } from './planner/TimeBlockBlock';
import { DailySectionBlock } from './planner/DailySectionBlock';
import { ProgressBarBlock } from './planner/ProgressBarBlock';
import { RatingBlock } from './planner/RatingBlock';
import { WaterTrackerBlock } from './planner/WaterTrackerBlock';
import { SectionNavBlock } from './planner/SectionNavBlock';
import { KanbanBlock } from './planner/KanbanBlock';

interface BlockProps {
  block: Block;
  onChange: (id: string, updatedBlock: Partial<Block>) => void;
  onDelete: (id: string) => void;
  focused?: boolean;
  allPages?: NotebookPage[];
  onNavigate?: (pageId: string) => void;
  onInsertAfter?: (type: BlockType) => void;
  selectedPitch?: { pitch: string; octave: number } | null;
  selectedDuration?: 'whole' | 'half' | 'quarter' | 'eighth';
  dragHandleProps?: Record<string, any>;
  onPenScratch?: () => void;
  onCheckboxClick?: () => void;
}

const getAccentColor = (color?: string): string => {
  switch (color) {
    case 'rose': return '#e11d48';
    case 'indigo': return '#4f46e5';
    case 'emerald': return '#059669';
    case 'amber': return '#d97706';
    case 'sky': return '#0284c7';
    case 'slate': return '#475569';
    case 'gray':
    default: return '#6b7280';
  }
};

const getColorClasses = (color?: string) => {
  switch (color) {
    case 'rose': return { text: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', highlight: 'bg-rose-100', focusBg: 'focus:bg-rose-50', hoverHighlight: 'hover:bg-rose-100' };
    case 'indigo': return { text: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', highlight: 'bg-indigo-100', focusBg: 'focus:bg-indigo-50', hoverHighlight: 'hover:bg-indigo-100' };
    case 'emerald': return { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', highlight: 'bg-emerald-100', focusBg: 'focus:bg-emerald-50', hoverHighlight: 'hover:bg-emerald-100' };
    case 'amber': return { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', highlight: 'bg-amber-100', focusBg: 'focus:bg-amber-50', hoverHighlight: 'hover:bg-amber-100' };
    case 'sky': return { text: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200', highlight: 'bg-sky-100', focusBg: 'focus:bg-sky-50', hoverHighlight: 'hover:bg-sky-100' };
    case 'slate': return { text: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', highlight: 'bg-slate-100', focusBg: 'focus:bg-slate-50', hoverHighlight: 'hover:bg-slate-100' };
    case 'gray':
    default: return { text: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', highlight: 'bg-gray-100', focusBg: 'focus:bg-gray-50', hoverHighlight: 'hover:bg-gray-100' };
  }
};

const getAlignmentClass = (alignment?: string) => {
  switch (alignment) {
    case 'center': return 'text-center';
    case 'right': return 'text-right';
    case 'left':
    default: return 'text-left';
  }
};

const getEmphasisClass = (emphasis?: string, colorClasses?: ReturnType<typeof getColorClasses>) => {
  switch (emphasis) {
    case 'bold': return 'font-bold';
    case 'italic': return 'italic';
    case 'highlight': return `${colorClasses?.highlight} px-1 rounded`;
    case 'none':
    default: return '';
  }
};

export const BlockComponent: React.FC<BlockProps> = ({ block, onChange, onDelete, focused, allPages, onNavigate, onInsertAfter, selectedPitch, selectedDuration, dragHandleProps, onPenScratch, onCheckboxClick }) => {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const calloutRef = useRef<HTMLTextAreaElement>(null);
  const quoteRef = useRef<HTMLTextAreaElement>(null);
  const colorClasses = getColorClasses(block.color);
  const alignmentClass = getAlignmentClass(block.alignment);
  const emphasisClass = getEmphasisClass(block.emphasis, colorClasses);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onInsertAfter?.(block.type);
    }
  };

  const getActiveRef = useCallback(() => {
    if (block.type === BlockType.CALLOUT) return calloutRef;
    if (block.type === BlockType.QUOTE) return quoteRef;
    return textRef;
  }, [block.type]);

  useEffect(() => {
    if (focused) {
      getActiveRef().current?.focus();
    }
  }, [focused, getActiveRef]);

  // Auto-resize textarea to fit content and match line height exactly (32px)
  useEffect(() => {
    const el = getActiveRef().current;
    if (!el) return;

    el.style.height = '32px'; // Reset height to measure scrollHeight correctly
    const lineHeight = 32;
    const contentHeight = el.scrollHeight;
    // Snap to nearest line height multiple
    const snappedHeight = Math.max(lineHeight, Math.ceil(contentHeight / lineHeight) * lineHeight);
    el.style.height = `${snappedHeight}px`;
  }, [block.content, getActiveRef]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(block.id, { content: e.target.value });
    onPenScratch?.();
  };

  const handleGridCellChange = (rowIndex: number, cellIndex: number, value: string) => {
    if (!block.gridData) return;
    const newRows = block.gridData.rows.map((row, ri) =>
      ri === rowIndex ? row.map((cell, ci) =>
        ci === cellIndex ? { ...cell, content: value } : cell
      ) : row
    );
    onChange(block.id, { gridData: { ...block.gridData, rows: newRows } });
  };

  const addGridRow = () => {
    if (!block.gridData) return;
    const newRow = block.gridData.columns.map(() => ({ id: crypto.randomUUID(), content: '' }));
    onChange(block.id, { gridData: { ...block.gridData, rows: [...block.gridData.rows, newRow] } });
  };

  return (
    <div className="group relative flex items-start -ml-16 mb-0 hover:bg-black/5 transition-colors rounded-lg pl-16 pr-2 py-0">
      {/* Block Controls (Hover) */}
      <div className="absolute left-2 top-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-20">
        <div className="p-1 text-gray-400 cursor-move hover:text-gray-600" {...dragHandleProps}>
          <GripVertical size={16} />
        </div>
        <button onClick={() => onChange(block.id, { side: block.side === 'right' ? 'left' : 'right' })} className="p-1 hover:bg-blue-100 rounded text-gray-400 hover:text-blue-500" aria-label="Move block to other page">
          <ArrowLeftRight size={16} />
        </button>
        <button onClick={() => onDelete(block.id)} className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-500" aria-label="Delete block">
          <Trash2 size={16} />
        </button>
      </div>

      <div className="w-full relative">
        {block.type === BlockType.HEADING && (
          <div className={`relative ${alignmentClass}`} style={{ minHeight: '32px', marginBottom: '32px' }}>
            <input
              className={`w-full bg-transparent text-3xl font-bold font-hand text-gray-800 placeholder-gray-300 focus:outline-none border-none p-0 m-0 ${alignmentClass} ${block.emphasis === 'highlight' ? `${colorClasses.bg} px-4 rounded-lg shadow-sm` : colorClasses.text
                }`}
              style={{ lineHeight: '32px', height: '32px', position: 'relative', top: '7px' }}
              value={block.content}
              onChange={(e) => { onChange(block.id, { content: e.target.value }); onPenScratch?.(); }}
              placeholder="Section Heading..."
            />
          </div>
        )}

        {block.type === BlockType.TEXT && (
          <div style={{ marginBottom: '0px' }}>
            <textarea
              ref={textRef}
              className={`w-full bg-transparent font-hand text-xl text-gray-800 resize-none focus:outline-none overflow-hidden placeholder-gray-300 block p-0 m-0 border-none ${alignmentClass} ${emphasisClass}`}
              style={{
                lineHeight: '32px',
                minHeight: '32px',
                position: 'relative',
                top: '9px' // Fine-tune text to sit exactly on the baseline
              }}
              value={block.content}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder="Write here..."
              spellCheck={false}
            />
          </div>
        )}

        {block.type === BlockType.CHECKBOX && (
          <div className={`flex items-center gap-3 ${block.alignment === 'center' ? 'justify-center' : block.alignment === 'right' ? 'justify-end' : ''}`} style={{ minHeight: '32px' }}>
            <input
              type="checkbox"
              checked={block.checked}
              onChange={(e) => { onChange(block.id, { checked: e.target.checked }); onCheckboxClick?.(); }}
              className="w-5 h-5 cursor-pointer rounded border-gray-400"
              style={{ position: 'relative', top: '9px', accentColor: getAccentColor(block.color) }}
            />
            <input
              className={`flex-1 bg-transparent font-hand text-xl text-gray-800 focus:outline-none border-none p-0 m-0 placeholder-gray-300 ${emphasisClass}`}
              style={{ lineHeight: '32px', height: '32px', position: 'relative', top: '9px' }}
              value={block.content}
              onChange={(e) => { onChange(block.id, { content: e.target.value }); onPenScratch?.(); }}
              onKeyDown={handleKeyDown}
              placeholder="To-do item"
            />
          </div>
        )}

        {block.type === BlockType.CALLOUT && (
          <div className={`w-full rounded-br-2xl rounded-tl-md rounded-tr-md rounded-bl-md border ${colorClasses.bg} ${colorClasses.border} shadow-[4px_4px_10px_rgba(0,0,0,0.05)] relative group/callout`}
            style={{ padding: '15px', marginBottom: '32px', boxSizing: 'border-box' }}>
            {/* Washi Tape */}
            <div className={`absolute -top-3 left-1/2 -translate-x-1/2 w-12 h-5 ${colorClasses.highlight} opacity-90 rotate-[-2deg] shadow-sm border border-white/40 backdrop-blur-sm z-10`}></div>
            {/* Folded corner effect */}
            <div className={`absolute bottom-0 right-0 w-6 h-6 ${colorClasses.highlight} rounded-tl-lg shadow-[-2px_-2px_4px_rgba(0,0,0,0.05)]`}></div>
            <textarea
              ref={calloutRef}
              className={`w-full bg-transparent font-sans text-sm text-gray-800 resize-none focus:outline-none overflow-hidden placeholder-gray-400 block p-0 m-0 border-none ${alignmentClass} ${emphasisClass}`}
              style={{ lineHeight: '32px', minHeight: '32px' }}
              value={block.content}
              onChange={handleTextChange}
              placeholder="Sticky note or callout..."
              spellCheck={false}
            />
          </div>
        )}

        {block.type === BlockType.QUOTE && (
          <div className={`w-full pl-6 border-l-4 ${colorClasses.border} relative`} style={{ marginBottom: '32px', boxSizing: 'border-box' }}>
            <Quote className={`absolute -left-3 -top-2 opacity-20 ${colorClasses.text}`} size={32} />
            <textarea
              ref={quoteRef}
              className={`w-full bg-transparent font-serif text-2xl italic text-gray-700 resize-none focus:outline-none overflow-hidden placeholder-gray-300 block p-0 m-0 border-none ${alignmentClass}`}
              style={{ lineHeight: '32px', minHeight: '32px', position: 'relative', top: '9px' }}
              value={block.content}
              onChange={handleTextChange}
              placeholder="Quote..."
              spellCheck={false}
            />
          </div>
        )}

        {block.type === BlockType.DIVIDER && (
          <div className="w-full flex items-center justify-center group/divider relative" style={{ height: '32px', marginBottom: '32px' }}>
            {block.emphasis === 'bold' ? (
              <div className={`w-full border-t-4 ${colorClasses.border} rounded-full`}></div>
            ) : block.emphasis === 'italic' ? (
              <div className={`w-full border-t-2 border-dashed ${colorClasses.border}`}></div>
            ) : block.emphasis === 'highlight' ? (
              <div className={`w-full border-t-4 border-double ${colorClasses.border}`}></div>
            ) : (
              <div className={`w-full border-t-2 ${colorClasses.border}`}></div>
            )}
          </div>
        )}

        {block.type === BlockType.MOOD_TRACKER && (
          <div className="flex items-center gap-4" style={{ height: '32px', marginBottom: '32px' }}>
            <span className="font-sans text-sm font-bold text-gray-400 uppercase tracking-widest">Mood:</span>
            {['😢', '😕', '😐', '🙂', '😄'].map((emoji, i) => (
              <button
                key={i}
                onClick={() => onChange(block.id, { moodValue: i })}
                className={`text-2xl transition-all ${block.moodValue === i ? 'grayscale-0 scale-125' : 'grayscale opacity-50 hover:opacity-100 hover:scale-110 hover:grayscale-0'}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {block.type === BlockType.PRIORITY_MATRIX && (
          <div className="w-full grid grid-cols-2 gap-2 p-2 bg-white/40 backdrop-blur-sm rounded-xl border-2 border-gray-200 shadow-sm" style={{ marginBottom: '32px' }}>
            {['q1', 'q2', 'q3', 'q4'].map((q, i) => {
              const labels = ['Urgent & Important', 'Not Urgent & Important', 'Urgent & Not Important', 'Not Urgent & Not Important'];
              const colors = ['bg-rose-50', 'bg-amber-50', 'bg-sky-50', 'bg-gray-50'];
              const borders = ['border-rose-200', 'border-amber-200', 'border-sky-200', 'border-gray-200'];
              const textColors = ['text-rose-700', 'text-amber-700', 'text-sky-700', 'text-gray-700'];
              return (
                <div key={q} className={`p-3 rounded-lg ${colors[i]} border ${borders[i]} min-h-[128px] flex flex-col`}>
                  <div className={`text-[10px] font-bold uppercase ${textColors[i]} mb-2`}>{labels[i]}</div>
                  <textarea
                    className="flex-1 bg-transparent resize-none focus:outline-none font-hand text-lg text-gray-800 placeholder-gray-400/50"
                    value={block.matrixData?.[q as keyof typeof block.matrixData] || ''}
                    onChange={(e) => {
                      const key = q as 'q1' | 'q2' | 'q3' | 'q4';
                      onChange(block.id, { matrixData: { q1: '', q2: '', q3: '', q4: '', ...block.matrixData, [key]: e.target.value } });
                    }}
                    placeholder="Write tasks here..."
                    spellCheck={false}
                  />
                </div>
              )
            })}
          </div>
        )}

        {block.type === BlockType.INDEX && (
          <div className="w-full font-sans" style={{ marginBottom: '32px' }}>
            <div className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4 border-b border-gray-200 pb-2">Notebook Index</div>
            <div className="flex flex-col gap-2">
              {allPages?.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between group/index cursor-pointer hover:bg-black/5 p-2 rounded-lg transition-colors" onClick={() => onNavigate?.(p.id)}>
                  <span className="font-medium text-gray-700 group-hover/index:text-indigo-600 transition-colors">{p.title || `Untitled Spread ${i + 1}`}</span>
                  <span className="text-xs text-gray-300 border-b-2 border-dotted border-gray-300 flex-1 mx-4 group-hover/index:border-indigo-200 transition-colors"></span>
                  <span className="text-xs font-bold text-gray-400 group-hover/index:text-indigo-500">{i + 1}</span>
                </div>
              ))}
              {(!allPages || allPages.length === 0) && (
                <div className="text-sm text-gray-400 italic">No pages found in this notebook.</div>
              )}
            </div>
          </div>
        )}

        {block.type === BlockType.GRID && block.gridData && (
          <div className="w-full relative" style={{ marginBottom: '32px' }}>
            <div className={`bg-white/40 backdrop-blur-[2px] ring-2 ring-inset ${colorClasses.border.replace('border-', 'ring-')} rounded-sm shadow-sm overflow-hidden`} style={{ boxSizing: 'border-box' }}>
              {/* Grid Header */}
              {block.content && (
                <input
                  className={`w-full ${colorClasses.bg} px-4 text-sm font-sans font-bold ${colorClasses.text} border-b ${colorClasses.border} outline-none m-0`}
                  style={{ height: '32px', lineHeight: '32px', boxSizing: 'border-box' }}
                  value={block.content}
                  onChange={(e) => onChange(block.id, { content: e.target.value })}
                  placeholder="Table Title"
                />
              )}

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className={`${colorClasses.highlight} border-b-2 ${colorClasses.border}`} style={{ height: '32px' }}>
                      {block.gridData.columns.map((col, idx) => (
                        <th key={idx} className={`px-2 text-left font-sans text-xs font-bold uppercase tracking-wider ${colorClasses.text} border-r ${colorClasses.border} last:border-r-0`} style={{ height: '32px', boxSizing: 'border-box' }}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.gridData.rows.map((row, rIdx) => (
                      <tr key={rIdx} className={`border-b ${colorClasses.border} last:border-b-0`}>
                        {row.map((cell, cIdx) => (
                          <td key={cell.id} className={`border-r ${colorClasses.border} last:border-r-0 p-0 relative align-top`} style={{ minHeight: '32px', boxSizing: 'border-box' }}>
                            <textarea
                              className={`w-full h-full p-2 bg-transparent font-hand text-lg focus:outline-none ${colorClasses.focusBg} m-0 border-none resize-none align-top overflow-hidden`}
                              style={{ lineHeight: '32px', minHeight: '64px', boxSizing: 'border-box' }}
                              value={cell.content}
                              onChange={(e) => handleGridCellChange(rIdx, cIdx, e.target.value)}
                              spellCheck={false}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={addGridRow}
                className={`w-full ${colorClasses.bg} ${colorClasses.hoverHighlight} ${colorClasses.text} text-xs font-sans border-t ${colorClasses.border} flex items-center justify-center gap-1 transition-colors m-0`}
                style={{ height: '32px', boxSizing: 'border-box' }}
              >
                <Plus size={12} /> Add Row
              </button>
            </div>
          </div>
        )}

        {block.type === BlockType.MUSIC_STAFF && (
          <MusicStaffBlock
            block={block}
            onChange={onChange}
            selectedPitch={selectedPitch}
            selectedDuration={selectedDuration}
          />
        )}

        {block.type === BlockType.CALENDAR && (
          <CalendarBlock block={block} onChange={onChange} colorClasses={colorClasses} />
        )}

        {block.type === BlockType.WEEKLY_VIEW && (
          <WeeklyViewBlock block={block} onChange={onChange} colorClasses={colorClasses} />
        )}

        {block.type === BlockType.HABIT_TRACKER && (
          <HabitTrackerBlock block={block} onChange={onChange} colorClasses={colorClasses} />
        )}

        {block.type === BlockType.GOAL_SECTION && (
          <GoalSectionBlock block={block} onChange={onChange} colorClasses={colorClasses} />
        )}

        {block.type === BlockType.TIME_BLOCK && (
          <TimeBlockBlock block={block} onChange={onChange} colorClasses={colorClasses} />
        )}

        {block.type === BlockType.DAILY_SECTION && (
          <DailySectionBlock block={block} onChange={onChange} colorClasses={colorClasses} />
        )}

        {block.type === BlockType.PROGRESS_BAR && (
          <ProgressBarBlock block={block} onChange={onChange} colorClasses={colorClasses} />
        )}

        {block.type === BlockType.RATING && (
          <RatingBlock block={block} onChange={onChange} colorClasses={colorClasses} />
        )}

        {block.type === BlockType.WATER_TRACKER && (
          <WaterTrackerBlock block={block} onChange={onChange} colorClasses={colorClasses} />
        )}

        {block.type === BlockType.SECTION_NAV && (
          <SectionNavBlock block={block} onChange={onChange} colorClasses={colorClasses} allPages={allPages} onNavigate={onNavigate} />
        )}

        {block.type === BlockType.KANBAN && (
          <KanbanBlock block={block} onChange={onChange} colorClasses={colorClasses} />
        )}
      </div>
    </div>
  );
};