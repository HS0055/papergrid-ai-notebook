import React, { useState } from 'react';
import { Block, KanbanData, KanbanColumn, KanbanCard } from '@papergrid/core';
import { Plus, ChevronRight } from 'lucide-react';

interface KanbanBlockProps {
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

const getDefaultKanbanData = (): KanbanData => ({
  columns: [
    { title: 'To Do', color: 'rose', cards: [] },
    { title: 'In Progress', color: 'amber', cards: [] },
    { title: 'Done', color: 'emerald', cards: [] },
  ],
});

const COLUMN_HEADER_COLORS: Record<string, string> = {
  rose: 'bg-rose-100 text-rose-700 border-rose-200',
  amber: 'bg-amber-100 text-amber-700 border-amber-200',
  emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  sky: 'bg-sky-100 text-sky-700 border-sky-200',
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
  violet: 'bg-violet-100 text-violet-700 border-violet-200',
};

const getColumnHeaderClasses = (color: string): string => {
  return COLUMN_HEADER_COLORS[color] ?? 'bg-gray-100 text-gray-700 border-gray-200';
};

export const KanbanBlock: React.FC<KanbanBlockProps> = ({ block, onChange, colorClasses }) => {
  const data = block.kanbanData ?? getDefaultKanbanData();
  const [newCardTexts, setNewCardTexts] = useState<Record<number, string>>({});

  const updateColumns = (newColumns: KanbanColumn[]) => {
    onChange(block.id, {
      kanbanData: { ...data, columns: newColumns },
    });
  };

  const updateColumnTitle = (colIndex: number, title: string) => {
    const newColumns = data.columns.map((col, i) =>
      i === colIndex ? { ...col, title } : col
    );
    updateColumns(newColumns);
  };

  const addCard = (colIndex: number) => {
    const text = (newCardTexts[colIndex] ?? '').trim();
    if (!text) return;

    const newCard: KanbanCard = {
      id: crypto.randomUUID(),
      text,
      checked: false,
    };

    const newColumns = data.columns.map((col, i) =>
      i === colIndex ? { ...col, cards: [...col.cards, newCard] } : col
    );
    updateColumns(newColumns);
    setNewCardTexts((prev) => ({ ...prev, [colIndex]: '' }));
  };

  const removeCard = (colIndex: number, cardId: string) => {
    const newColumns = data.columns.map((col, i) =>
      i === colIndex
        ? { ...col, cards: col.cards.filter((c) => c.id !== cardId) }
        : col
    );
    updateColumns(newColumns);
  };

  const toggleCard = (colIndex: number, cardId: string) => {
    const newColumns = data.columns.map((col, i) =>
      i === colIndex
        ? {
            ...col,
            cards: col.cards.map((c) =>
              c.id === cardId ? { ...c, checked: !c.checked } : c
            ),
          }
        : col
    );
    updateColumns(newColumns);
  };

  const moveCardToNext = (colIndex: number, cardId: string) => {
    const nextColIndex = colIndex + 1;
    if (nextColIndex >= data.columns.length) return;

    const card = data.columns[colIndex].cards.find((c) => c.id === cardId);
    if (!card) return;

    const newColumns = data.columns.map((col, i) => {
      if (i === colIndex) {
        return { ...col, cards: col.cards.filter((c) => c.id !== cardId) };
      }
      if (i === nextColIndex) {
        return { ...col, cards: [...col.cards, { ...card }] };
      }
      return col;
    });
    updateColumns(newColumns);
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

        {/* Columns grid */}
        <div
          className="grid gap-0"
          style={{ gridTemplateColumns: `repeat(${data.columns.length}, minmax(0, 1fr))` }}
        >
          {data.columns.map((col, colIndex) => {
            const headerClasses = getColumnHeaderClasses(col.color);
            const isLastColumn = colIndex === data.columns.length - 1;

            return (
              <div
                key={colIndex}
                className={`flex flex-col ${!isLastColumn ? 'border-r border-gray-200' : ''}`}
              >
                {/* Column header */}
                <div className={`px-2 ${headerClasses} border-b`} style={{ height: '32px' }}>
                  <input
                    className="w-full bg-transparent text-[11px] font-sans font-bold uppercase tracking-wider focus:outline-none border-none p-0 m-0"
                    style={{ lineHeight: '32px', height: '32px' }}
                    value={col.title}
                    onChange={(e) => updateColumnTitle(colIndex, e.target.value)}
                    placeholder="Column..."
                  />
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-1.5 p-2 min-h-[80px]">
                  {col.cards.map((card) => (
                    <div
                      key={card.id}
                      className="group/card bg-white border border-gray-200 rounded-lg shadow-sm px-2 py-1.5 flex items-start gap-1.5"
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleCard(colIndex, card.id)}
                        className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center mt-0.5 transition-all ${
                          card.checked
                            ? `${colorClasses.highlight} ${colorClasses.border} ${colorClasses.text}`
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        aria-label={`${card.checked ? 'Uncheck' : 'Check'} card`}
                      >
                        {card.checked && (
                          <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M2 6l3 3 5-5" />
                          </svg>
                        )}
                      </button>

                      {/* Card text */}
                      <span
                        className={`flex-1 text-xs font-sans leading-tight ${
                          card.checked ? 'text-gray-400 line-through' : 'text-gray-700'
                        }`}
                      >
                        {card.text}
                      </span>

                      {/* Action buttons (visible on hover) */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity flex-shrink-0">
                        {!isLastColumn && (
                          <button
                            onClick={() => moveCardToNext(colIndex, card.id)}
                            className="text-gray-300 hover:text-gray-600 transition-colors"
                            aria-label={`Move to ${data.columns[colIndex + 1]?.title ?? 'next column'}`}
                          >
                            <ChevronRight size={12} />
                          </button>
                        )}
                        <button
                          onClick={() => removeCard(colIndex, card.id)}
                          className="text-gray-300 hover:text-red-400 text-[10px] transition-colors"
                          aria-label="Remove card"
                        >
                          x
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add card input */}
                <div className="px-2 pb-2">
                  <div className="flex items-center gap-1">
                    <input
                      className="flex-1 text-xs font-sans bg-transparent border border-gray-200 rounded px-1.5 focus:outline-none focus:border-gray-300 placeholder-gray-300"
                      style={{ height: '28px' }}
                      value={newCardTexts[colIndex] ?? ''}
                      onChange={(e) =>
                        setNewCardTexts((prev) => ({ ...prev, [colIndex]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') addCard(colIndex);
                      }}
                      placeholder="New card..."
                    />
                    <button
                      onClick={() => addCard(colIndex)}
                      className={`${colorClasses.text} opacity-50 hover:opacity-100 transition-opacity flex-shrink-0`}
                      aria-label="Add card"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
