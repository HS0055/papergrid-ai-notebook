import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NotebookPage, Block, BlockType } from '@papergrid/core';
import { BlockComponent } from './BlockComponent';
import { PianoKeyboard } from './PianoKeyboard';
import { Plus, Info, Quote, Minus, Smile, LayoutGrid, List, X, Sparkles, ChevronDown, Music, Calendar, CalendarDays, CheckSquare, Target, Clock, Sun } from 'lucide-react';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

interface SoundCallbacks {
  penScratch: () => void;
  checkboxClick: () => void;
  blockAdd: () => void;
  blockDelete: () => void;
  dragRustle: () => void;
}

interface NotebookViewProps {
  page: NotebookPage;
  onUpdatePage: (updatedPage: NotebookPage) => void;
  allPages?: NotebookPage[];
  onNavigate?: (pageId: string) => void;
  onBlockDeleted?: (block: Block, index: number) => void;
  sounds?: SoundCallbacks;
}

const PAPER_TYPES = [
  { value: 'lined', label: 'Lined' },
  { value: 'legal', label: 'Legal' },
  { value: 'rows', label: 'Rows' },
  { value: 'grid', label: 'Grid' },
  { value: 'dotted', label: 'Dotted' },
  { value: 'music', label: 'Music' },
  { value: 'isometric', label: 'Iso' },
  { value: 'hex', label: 'Hex' },
  { value: 'blank', label: 'Blank' },
  { value: 'crumpled', label: 'Crumpled' },
] as const;

const PAPER_BG_MAP: Record<string, string> = {
  lined: 'paper-lines',
  grid: 'paper-grid',
  dotted: 'paper-dots',
  blank: 'bg-paper',
  music: 'paper-music',
  rows: 'paper-rows',
  isometric: 'paper-isometric',
  hex: 'paper-hex',
  legal: 'paper-legal',
  crumpled: 'paper-crumpled',
};

const ALL_BLOCK_TYPES: BlockType[] = [
  BlockType.TEXT, BlockType.HEADING, BlockType.CHECKBOX, BlockType.GRID,
  BlockType.CALLOUT, BlockType.QUOTE, BlockType.DIVIDER, BlockType.MOOD_TRACKER,
  BlockType.PRIORITY_MATRIX, BlockType.INDEX,
];

const PAPER_BLOCK_MAP: Record<string, BlockType[]> = {
  lined: ALL_BLOCK_TYPES,
  rows: ALL_BLOCK_TYPES,
  legal: ALL_BLOCK_TYPES,
  blank: ALL_BLOCK_TYPES,
  crumpled: ALL_BLOCK_TYPES,
  music: [BlockType.MUSIC_STAFF, BlockType.TEXT, BlockType.HEADING, BlockType.DIVIDER],
  grid: [BlockType.TEXT, BlockType.HEADING, BlockType.GRID, BlockType.CHECKBOX, BlockType.DIVIDER],
  dotted: [BlockType.TEXT, BlockType.HEADING, BlockType.CHECKBOX, BlockType.CALLOUT, BlockType.MOOD_TRACKER, BlockType.DIVIDER],
  isometric: [BlockType.TEXT, BlockType.HEADING, BlockType.CALLOUT, BlockType.DIVIDER],
  hex: [BlockType.TEXT, BlockType.HEADING, BlockType.CALLOUT, BlockType.DIVIDER],
};

const BLOCK_BUTTON_CONFIG: Record<BlockType, { icon: React.ReactNode; label: string }> = {
  [BlockType.TEXT]: { icon: <span className="font-serif font-bold text-lg">T</span>, label: 'Text' },
  [BlockType.HEADING]: { icon: <span className="font-bold text-lg">H1</span>, label: 'Head' },
  [BlockType.CHECKBOX]: { icon: <span className="text-lg">&#9745;</span>, label: 'Task' },
  [BlockType.GRID]: { icon: <span className="text-lg">&#9638;</span>, label: 'Grid' },
  [BlockType.CALLOUT]: { icon: <Info size={18} />, label: 'Callout' },
  [BlockType.QUOTE]: { icon: <Quote size={18} />, label: 'Quote' },
  [BlockType.DIVIDER]: { icon: <Minus size={18} />, label: 'Divider' },
  [BlockType.MOOD_TRACKER]: { icon: <Smile size={18} />, label: 'Mood' },
  [BlockType.PRIORITY_MATRIX]: { icon: <LayoutGrid size={18} />, label: 'Matrix' },
  [BlockType.INDEX]: { icon: <List size={18} />, label: 'Index' },
  [BlockType.MUSIC_STAFF]: { icon: <Music size={18} />, label: 'Staff' },
};

const SortableBlock: React.FC<{ id: string; children: (props: { dragHandleProps: Record<string, any>; style: React.CSSProperties; isDragging: boolean }) => React.ReactNode }> = ({ id, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 50 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ dragHandleProps: { ...attributes, ...listeners }, style, isDragging })}
    </div>
  );
};

export const NotebookView: React.FC<NotebookViewProps> = ({ page, onUpdatePage, allPages, onNavigate, onBlockDeleted, sounds }) => {
  const [openMenu, setOpenMenu] = useState<'left' | 'right' | null>(null);
  const [showPaperPicker, setShowPaperPicker] = useState(false);
  const [mobileSide, setMobileSide] = useState<'left' | 'right'>('left');
  const [newBlockId, setNewBlockId] = useState<string | null>(null);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [selectedPitch, setSelectedPitch] = useState<{ pitch: string; octave: number } | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<'whole' | 'half' | 'quarter' | 'eighth'>('quarter');
  const paperPickerRef = useRef<HTMLDivElement>(null);

  // Close paper picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (paperPickerRef.current && e.target instanceof Node && !paperPickerRef.current.contains(e.target)) {
        setShowPaperPicker(false);
      }
    };
    if (showPaperPicker) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPaperPicker]);

  // Clear new block animation after it plays
  useEffect(() => {
    if (newBlockId) {
      const timer = setTimeout(() => setNewBlockId(null), 350);
      return () => clearTimeout(timer);
    }
  }, [newBlockId]);

  // Clear focus trigger after it fires
  useEffect(() => {
    if (focusedBlockId) {
      const timer = setTimeout(() => setFocusedBlockId(null), 100);
      return () => clearTimeout(timer);
    }
  }, [focusedBlockId]);

  const handleBlockChange = (id: string, updated: Partial<Block>) => {
    const newBlocks = page.blocks.map(b => b.id === id ? { ...b, ...updated } : b);
    onUpdatePage({ ...page, blocks: newBlocks });
  };

  const handleBlockDelete = (id: string) => {
    const block = page.blocks.find(b => b.id === id);
    const index = page.blocks.findIndex(b => b.id === id);
    if (block && onBlockDeleted) {
      onBlockDeleted(block, index);
    }
    const newBlocks = page.blocks.filter(b => b.id !== id);
    onUpdatePage({ ...page, blocks: newBlocks });
    sounds?.blockDelete();
  };

  const addBlock = (type: BlockType, side: 'left' | 'right') => {
    const newBlock: Block = {
      id: crypto.randomUUID(),
      type,
      content: '',
      checked: false,
      color: page.themeColor || 'slate',
      side,
      gridData: type === BlockType.GRID ? {
        columns: ['Col 1', 'Col 2', 'Col 3'],
        rows: [[{id: '1', content: ''}, {id: '2', content: ''}, {id: '3', content: ''}]]
      } : undefined,
      matrixData: type === BlockType.PRIORITY_MATRIX ? {
        q1: '', q2: '', q3: '', q4: ''
      } : undefined,
      moodValue: type === BlockType.MOOD_TRACKER ? 2 : undefined,
      musicData: type === BlockType.MUSIC_STAFF ? {
        clef: 'treble' as const,
        timeSignature: '4/4',
        notes: [],
      } : undefined,
    };
    setNewBlockId(newBlock.id);
    setFocusedBlockId(newBlock.id);
    onUpdatePage({ ...page, blocks: [...page.blocks, newBlock] });
    setOpenMenu(null);
    sounds?.blockAdd();
  };

  const insertBlockAfter = (afterBlockId: string, type: BlockType, side: 'left' | 'right') => {
    const newBlock: Block = {
      id: crypto.randomUUID(),
      type,
      content: '',
      checked: type === BlockType.CHECKBOX ? false : undefined,
      color: page.themeColor || 'slate',
      side,
    };
    const idx = page.blocks.findIndex(b => b.id === afterBlockId);
    const newBlocks = [...page.blocks];
    newBlocks.splice(idx + 1, 0, newBlock);
    setNewBlockId(newBlock.id);
    setFocusedBlockId(newBlock.id);
    onUpdatePage({ ...page, blocks: newBlocks });
    sounds?.blockAdd();
  };

  const handleEmptySpaceClick = (e: React.MouseEvent, side: 'left' | 'right') => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-block-id]')) return;
    addBlock(BlockType.TEXT, side);
  };

  const handleDragEnd = (event: DragEndEvent, side: 'left' | 'right') => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const sideBlocks = side === 'right'
      ? page.blocks.filter(b => b.side === 'right')
      : page.blocks.filter(b => b.side !== 'right');
    const otherBlocks = side === 'right'
      ? page.blocks.filter(b => b.side !== 'right')
      : page.blocks.filter(b => b.side === 'right');

    const oldIndex = sideBlocks.findIndex(b => b.id === active.id);
    const newIndex = sideBlocks.findIndex(b => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sideBlocks, oldIndex, newIndex);
    onUpdatePage({ ...page, blocks: [...reordered, ...otherBlocks] });
    sounds?.dragRustle();
  };

  const bgClass = PAPER_BG_MAP[page.paperType || 'lined'];

  const getThemeColorClass = (color?: string) => {
    switch (color) {
      case 'rose': return 'bg-rose-300/50';
      case 'indigo': return 'bg-indigo-300/50';
      case 'emerald': return 'bg-emerald-300/50';
      case 'amber': return 'bg-amber-300/50';
      case 'sky': return 'bg-sky-300/50';
      case 'slate': return 'bg-slate-300/50';
      case 'gray':
      default: return 'bg-gray-300/50';
    }
  };

  const getAestheticFontClass = (aesthetic?: string) => {
    switch (aesthetic) {
      case 'modern-planner': return 'font-sans font-bold tracking-tight';
      case 'e-ink': return 'font-sans font-medium tracking-wide text-gray-700';
      case 'bujo': return 'font-hand font-bold text-xl';
      case 'cornell': return 'font-serif font-bold';
      default: return 'font-sans font-bold';
    }
  };

  const marginColorClass = getThemeColorClass(page.themeColor);
  const titleFontClass = getAestheticFontClass(page.aesthetic);

  const leftBlocks = page.blocks.filter(b => b.side !== 'right');
  const rightBlocks = page.blocks.filter(b => b.side === 'right');

  // ── Block Menu (FAB expansion) ────────────────────────────
  const allowedTypes = PAPER_BLOCK_MAP[page.paperType || 'lined'] || ALL_BLOCK_TYPES;

  const renderBlockMenu = (side: 'left' | 'right') => {
    if (openMenu !== side) return null;
    return (
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-40 anim-fab-pop pointer-events-auto">
        <div className="flex flex-wrap justify-center gap-1.5 bg-white/95 backdrop-blur-md shadow-2xl rounded-2xl p-3 border border-gray-200 max-w-[320px] max-h-[60vh] overflow-y-auto">
          {allowedTypes.map(type => {
            const config = BLOCK_BUTTON_CONFIG[type];
            return (
              <button
                key={type}
                onClick={() => addBlock(type, side)}
                className="p-2 hover:bg-indigo-50 rounded-xl text-gray-600 hover:text-indigo-600 text-xs flex flex-col items-center gap-1 w-14 transition-colors"
              >
                {config.icon}
                <span>{config.label}</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setOpenMenu(null)}
          className="absolute -top-2 -right-2 w-6 h-6 bg-gray-800 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-700 transition-colors"
        >
          <X size={12} />
        </button>
      </div>
    );
  };

  // ── FAB Button ────────────────────────────────────────────
  const renderFAB = (side: 'left' | 'right') => (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
      {renderBlockMenu(side)}
      <button
        onClick={() => setOpenMenu(openMenu === side ? null : side)}
        className={`pointer-events-auto w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${
          openMenu === side
            ? 'bg-gray-800 text-white rotate-45 scale-110'
            : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:scale-105 hover:shadow-xl'
        }`}
        aria-label={openMenu === side ? 'Close block menu' : `Add block to ${side} page`}
        aria-expanded={openMenu === side}
      >
        <Plus size={20} />
      </button>
    </div>
  );

  // ── Paper Type Picker Popover ─────────────────────────────
  const renderPaperPicker = () => (
    <div ref={paperPickerRef} className="absolute top-full left-0 mt-1 z-50 anim-popover">
      <div className="bg-white/95 backdrop-blur-md shadow-2xl rounded-xl p-3 border border-gray-200 w-[280px]">
        <div className="grid grid-cols-5 gap-2">
          {PAPER_TYPES.map(pt => (
            <button
              key={pt.value}
              onClick={() => {
                onUpdatePage({...page, paperType: pt.value});
                setShowPaperPicker(false);
              }}
              className={`flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all ${
                page.paperType === pt.value
                  ? 'bg-indigo-100 ring-2 ring-indigo-400 scale-105'
                  : 'hover:bg-gray-100'
              }`}
            >
              <div className={`w-10 h-10 rounded-md border border-gray-300 overflow-hidden ${PAPER_BG_MAP[pt.value]}`}
                style={{ backgroundSize: pt.value === 'lined' || pt.value === 'rows' || pt.value === 'legal' ? '100% 8px' : pt.value === 'grid' ? '8px 8px' : pt.value === 'dotted' ? '8px 8px' : undefined }}
              />
              <span className="text-[9px] font-medium text-gray-500 leading-tight">{pt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Render a Page Panel ───────────────────────────────────
  const renderPagePanel = (side: 'left' | 'right', blocks: Block[], isLeft: boolean) => (
    <div className={`flex-1 h-full bg-paper ${
      isLeft
        ? 'rounded-t-lg md:rounded-l-lg md:rounded-tr-none border-b md:border-b-0 md:border-r border-black/20'
        : 'rounded-b-lg md:rounded-r-lg md:rounded-bl-none border-t md:border-t-0 md:border-l border-white/50'
    } overflow-hidden relative flex flex-col`}>
      {/* Fold Shadow */}
      {isLeft ? (
        <>
          <div className="hidden md:block absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-black/20 to-transparent pointer-events-none z-20" />
          <div className="md:hidden absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/20 to-transparent pointer-events-none z-20" />
        </>
      ) : (
        <>
          <div className="hidden md:block absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-black/20 to-transparent pointer-events-none z-20" />
          <div className="md:hidden absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-black/20 to-transparent pointer-events-none z-20" />
        </>
      )}

      {/* Header */}
      {isLeft ? (
        <div className="h-16 border-b border-gray-200 flex items-end px-6 md:px-10 pb-2 bg-gradient-to-b from-white to-gray-50 shrink-0">
          <input
            className={`w-full text-3xl md:text-4xl text-gray-800 bg-transparent outline-none placeholder-gray-300 ${titleFontClass}`}
            value={page.title}
            onChange={(e) => onUpdatePage({...page, title: e.target.value})}
            placeholder="Untitled Page"
          />
        </div>
      ) : (
        <div className="h-16 border-b border-gray-200 flex items-end justify-between px-6 md:px-10 pb-2 bg-gradient-to-b from-white to-gray-50 shrink-0">
          {/* Paper Type Picker */}
          <div className="relative">
            <button
              onClick={() => setShowPaperPicker(!showPaperPicker)}
              className="flex items-center gap-1 text-xs font-sans text-gray-400 mb-2 uppercase tracking-widest hover:text-gray-600 transition-colors"
              aria-label="Change paper type"
              aria-expanded={showPaperPicker}
            >
              <span>{PAPER_TYPES.find(p => p.value === (page.paperType || 'lined'))?.label || 'Lined'}</span>
              <ChevronDown size={12} className={`transition-transform ${showPaperPicker ? 'rotate-180' : ''}`} />
            </button>
            {showPaperPicker && renderPaperPicker()}
          </div>
          <div className="flex items-center gap-2 text-xs font-sans text-gray-400 mb-2 uppercase tracking-widest whitespace-nowrap">
            {page.aiGenerated && (
              <span className="flex items-center gap-1 text-indigo-400" title="AI Generated">
                <Sparkles size={12} />
                <span className="text-[10px]">AI</span>
              </span>
            )}
            {new Date(page.createdAt).toLocaleDateString()}
          </div>
        </div>
      )}

      {/* Content Area */}
      <div
        className={`flex-1 overflow-y-auto px-6 md:px-10 py-8 ${bgClass} relative cursor-text`}
        onClick={(e) => handleEmptySpaceClick(e, side)}
      >
        {page.paperType !== 'blank' && page.paperType !== 'legal' && page.paperType !== 'crumpled' && (
          <div className={`absolute top-0 bottom-0 left-12 md:left-16 w-px ${marginColorClass} pointer-events-none z-0`} />
        )}
        <div className="relative z-10 min-h-full pb-14">
          {blocks.length === 0 && (
            <div className="text-gray-400 font-hand text-2xl text-center mt-20 opacity-50 select-none pointer-events-none">
              Click anywhere to start typing...
            </div>
          )}
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={(event) => handleDragEnd(event, side)}
          >
            <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
              {blocks.map(block => (
                <SortableBlock key={block.id} id={block.id}>
                  {({ dragHandleProps }) => (
                    <div data-block-id={block.id} className={block.id === newBlockId ? 'anim-block-enter' : ''}>
                      <BlockComponent
                        block={block}
                        onChange={handleBlockChange}
                        onDelete={handleBlockDelete}
                        allPages={allPages}
                        onNavigate={onNavigate}
                        focused={block.id === focusedBlockId}
                        onInsertAfter={(type) => insertBlockAfter(block.id, type, side)}
                        selectedPitch={page.paperType === 'music' ? selectedPitch : undefined}
                        selectedDuration={page.paperType === 'music' ? selectedDuration : undefined}
                        dragHandleProps={dragHandleProps}
                        onPenScratch={sounds?.penScratch}
                        onCheckboxClick={sounds?.checkboxClick}
                      />
                    </div>
                  )}
                </SortableBlock>
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </div>

      {/* Piano Keyboard (music paper only) */}
      {page.paperType === 'music' && (
        <PianoKeyboard
          selectedPitch={selectedPitch}
          onSelectPitch={setSelectedPitch}
          selectedDuration={selectedDuration}
          onSelectDuration={setSelectedDuration}
        />
      )}

      {/* FAB */}
      {renderFAB(side)}
    </div>
  );

  return (
    <div className="flex-1 h-full overflow-hidden bg-[#e5e5e5] flex flex-col justify-center p-4 md:p-8 relative">
      {/* Mobile Page Toggle */}
      <div className="md:hidden flex justify-center mb-2">
        <div className="bg-white/80 backdrop-blur-sm rounded-full p-0.5 flex shadow-sm border border-gray-200">
          <button
            onClick={() => setMobileSide('left')}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              mobileSide === 'left' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Left Page
          </button>
          <button
            onClick={() => setMobileSide('right')}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              mobileSide === 'right' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Right Page
          </button>
        </div>
      </div>

      {/* Book */}
      <div data-export-target className="w-full max-w-6xl h-full mx-auto bg-slate-800 p-1 md:p-2 rounded-xl shadow-2xl flex flex-col md:flex-row relative">
        {/* Desktop: show both pages | Mobile: show selected page */}
        <div className="hidden md:contents">
          {renderPagePanel('left', leftBlocks, true)}
          <div className="w-1 h-full bg-black/40 shadow-[0_0_10px_rgba(0,0,0,0.5)] z-30" />
          {renderPagePanel('right', rightBlocks, false)}
        </div>

        <div className="md:hidden flex-1 flex flex-col">
          {mobileSide === 'left'
            ? renderPagePanel('left', leftBlocks, true)
            : renderPagePanel('right', rightBlocks, false)
          }
        </div>
      </div>
    </div>
  );
};
