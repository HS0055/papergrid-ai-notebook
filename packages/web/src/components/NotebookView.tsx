import React, { useState, useEffect, useRef, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { NotebookPage, Block, BlockType, LinedPaperSettings, HexMapData, IsoFlowData } from '@papergrid/core';
import { BlockComponent } from './BlockComponent';
import { useMathEngine } from '../hooks/useMathEngine';
import { PianoKeyboard } from './PianoKeyboard';
import { HexPaperCanvas } from './planner/HexPaperCanvas';
import { IsoPaperCanvas } from './planner/IsoPaperCanvas';
import { Plus, Info, Quote, Minus, Smile, LayoutGrid, List, X, Sparkles, ChevronDown, Music, Calendar, CalendarDays, CheckSquare, Target, Clock, Sun, AlertTriangle, Bookmark } from 'lucide-react';
import { isNativeApp } from '../utils/platform';
import { triggerHaptic } from '../utils/haptics';
import { ImpactStyle } from '@capacitor/haptics';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

// Per-block error boundary: isolates render crashes to a single block
class BlockErrorBoundary extends Component<
  { blockType: string; blockId: string; children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { blockType: string; blockId: string; children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[PaperGrid] Block render crash — type=${this.props.blockType} id=${this.props.blockId}`, error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 mb-1">
          <AlertTriangle size={14} />
          <span>Block "{this.props.blockType}" failed to render: {this.state.error?.message}</span>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  /** Native-only: toggle bookmark for this page */
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
  /** Native-only: open AI layout generator */
  onOpenAIGenerator?: () => void;
  /** Native-only: append a new page to the notebook */
  onAddPage?: () => void;
}

const PAPER_TYPES = [
  { value: 'lined', label: 'Writing' },
  { value: 'grid', label: 'Grid' },
  { value: 'dotted', label: 'Dotted' },
  { value: 'music', label: 'Music' },
  { value: 'isometric', label: 'Iso' },
  { value: 'hex', label: 'Hex' },
  { value: 'blank', label: 'Blank' },
] as const;

const PAPER_BG_MAP: Record<string, string> = {
  lined: 'paper-lines',
  grid: 'paper-grid',
  dotted: 'paper-dots',
  blank: 'bg-paper',
  music: 'paper-music',
  isometric: 'paper-isometric',
  hex: 'paper-hex',
};

const ALL_BLOCK_TYPES: BlockType[] = [
  BlockType.TEXT, BlockType.HEADING, BlockType.CHECKBOX, BlockType.GRID,
  BlockType.CALLOUT, BlockType.QUOTE, BlockType.DIVIDER, BlockType.MOOD_TRACKER,
  BlockType.PRIORITY_MATRIX, BlockType.INDEX,
  BlockType.CALENDAR, BlockType.WEEKLY_VIEW, BlockType.HABIT_TRACKER,
  BlockType.GOAL_SECTION, BlockType.TIME_BLOCK, BlockType.DAILY_SECTION,
  BlockType.PROGRESS_BAR, BlockType.RATING, BlockType.WATER_TRACKER,
  BlockType.SECTION_NAV, BlockType.KANBAN,
];

const PAPER_BLOCK_MAP: Record<string, BlockType[]> = {
  lined: ALL_BLOCK_TYPES,
  blank: ALL_BLOCK_TYPES,
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
  [BlockType.CALENDAR]: { icon: <Calendar size={18} />, label: 'Calendar' },
  [BlockType.WEEKLY_VIEW]: { icon: <CalendarDays size={18} />, label: 'Weekly' },
  [BlockType.HABIT_TRACKER]: { icon: <CheckSquare size={18} />, label: 'Habits' },
  [BlockType.GOAL_SECTION]: { icon: <Target size={18} />, label: 'Goals' },
  [BlockType.TIME_BLOCK]: { icon: <Clock size={18} />, label: 'Schedule' },
  [BlockType.DAILY_SECTION]: { icon: <Sun size={18} />, label: 'Daily' },
  [BlockType.PROGRESS_BAR]: { icon: <span className="text-lg">▰</span>, label: 'Progress' },
  [BlockType.RATING]: { icon: <span className="text-lg">★</span>, label: 'Rating' },
  [BlockType.WATER_TRACKER]: { icon: <span className="text-lg">💧</span>, label: 'Water' },
  [BlockType.SECTION_NAV]: { icon: <List size={18} />, label: 'Nav' },
  [BlockType.KANBAN]: { icon: <LayoutGrid size={18} />, label: 'Kanban' },
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

interface BlockGroup {
  key: string;
  groupId?: string;
  blocks: Block[];
}

function groupConsecutiveBlocks(blocks: Block[]): BlockGroup[] {
  const groups: BlockGroup[] = [];
  let current: BlockGroup | null = null;

  for (const block of blocks) {
    if (block.groupId && current?.groupId === block.groupId) {
      current.blocks.push(block);
    } else {
      if (current) groups.push(current);
      current = {
        key: block.groupId || block.id,
        groupId: block.groupId,
        blocks: [block],
      };
    }
  }
  if (current) groups.push(current);
  return groups;
}

export const NotebookView: React.FC<NotebookViewProps> = ({
  page, onUpdatePage, allPages, onNavigate, onBlockDeleted, sounds,
  isBookmarked, onToggleBookmark, onOpenAIGenerator,
}) => {
  const native = isNativeApp();
  const [openMenu, setOpenMenu] = useState<'left' | 'right' | null>(null);
  const [showPaperPicker, setShowPaperPicker] = useState(false);
  const [mobileSide, setMobileSide] = useState<'left' | 'right'>('left');
  const [newBlockId, setNewBlockId] = useState<string | null>(null);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [selectedPitch, setSelectedPitch] = useState<{ pitch: string; octave: number } | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<'whole' | 'half' | 'quarter' | 'eighth'>('quarter');
  const paperPickerRef = useRef<HTMLDivElement>(null);

  // Math Engine
  const showMath = page.showMathResults !== false;
  const mathResults = useMathEngine(page.blocks, showMath);

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
    // On hex/iso paper the canvas owns empty-space clicks — don't auto-add a text block.
    if (page.paperType === 'hex' || page.paperType === 'isometric') return;
    addBlock(BlockType.TEXT, side);
  };

  const handleHexMapChange = (next: HexMapData) => {
    onUpdatePage({ ...page, hexMapData: next });
  };

  const handleIsoFlowChange = (next: IsoFlowData) => {
    onUpdatePage({ ...page, isoFlowData: next });
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

  const getLinedBgClass = (settings?: LinedPaperSettings): string => {
    if (!settings) return 'paper-lines';
    if (settings.legalPadMode && settings.rowShading) return 'paper-lines-legal-shaded';
    if (settings.legalPadMode) return 'paper-lines-legal';
    if (settings.rowShading) return 'paper-lines-shaded';
    return 'paper-lines';
  };

  const bgClass = page.paperType === 'lined'
    ? getLinedBgClass(page.linedSettings)
    : (PAPER_BG_MAP[page.paperType || 'lined'] || 'paper-lines');

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
    <div
      className="absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none"
      style={{ bottom: '12px' }}
    >
      {renderBlockMenu(side)}
      <button
        onClick={() => setOpenMenu(openMenu === side ? null : side)}
        className={`pointer-events-auto w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 active:scale-95 ${
          openMenu === side
            ? 'bg-gray-800 text-white rotate-45'
            : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:scale-105 hover:shadow-xl'
        }`}
        aria-label={openMenu === side ? 'Close block menu' : `Add block to ${side} page`}
        aria-expanded={openMenu === side}
      >
        <Plus size={22} />
      </button>
    </div>
  );

  // ── Native AI FAB ─────────────────────────────────────────
  // Floating sparkle button for AI layout generation. Native-only, pulses to draw attention.
  const renderAIFab = () => {
    if (!native || !onOpenAIGenerator) return null;
    return (
      <div
        className="absolute right-4 z-40 pointer-events-none"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)' }}
      >
        <button
          onClick={() => {
            triggerHaptic.impact(ImpactStyle.Medium);
            onOpenAIGenerator();
          }}
          className="pointer-events-auto w-14 h-14 rounded-full flex items-center justify-center bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 text-white shadow-2xl shadow-indigo-900/40 active:scale-95 transition-transform anim-ai-fab-pulse"
          aria-label="Generate AI layout"
        >
          <Sparkles size={24} strokeWidth={2.25} fill="currentColor" />
        </button>
      </div>
    );
  };

  // ── Lined settings helpers ────────────────────────────────
  const updateLinedSettings = (partial: Partial<LinedPaperSettings>) => {
    const current: LinedPaperSettings = page.linedSettings ?? {
      showMargin: false,
      marginSide: 'left',
      rowShading: false,
      legalPadMode: false,
      fontFamily: 'hand',
    };
    onUpdatePage({ ...page, linedSettings: { ...current, ...partial } });
  };

  const linedSettings: LinedPaperSettings = page.linedSettings ?? {
    showMargin: false,
    marginSide: 'left',
    rowShading: false,
    legalPadMode: false,
    fontFamily: 'hand',
  };

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
                style={{ backgroundSize: pt.value === 'lined' ? '100% 8px' : pt.value === 'grid' ? '8px 8px' : pt.value === 'dotted' ? '8px 8px' : undefined }}
              />
              <span className="text-[9px] font-medium text-gray-500 leading-tight">{pt.label}</span>
            </button>
          ))}
        </div>

        {/* Lined-specific settings appear only when Lined is the active paper */}
        {page.paperType === 'lined' && (
          <div className="mt-3 pt-3 border-t border-gray-200 space-y-2.5">
            {/* Margin */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-sans uppercase tracking-wider text-gray-500">Margin</span>
              <div className="flex bg-gray-100 rounded-md p-0.5 text-[10px] font-sans">
                <button
                  onClick={() => updateLinedSettings({ showMargin: false })}
                  className={`px-2 py-0.5 rounded ${!linedSettings.showMargin ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  Off
                </button>
                <button
                  onClick={() => updateLinedSettings({ showMargin: true, marginSide: 'left' })}
                  className={`px-2 py-0.5 rounded ${linedSettings.showMargin && linedSettings.marginSide === 'left' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  Left
                </button>
                <button
                  onClick={() => updateLinedSettings({ showMargin: true, marginSide: 'right' })}
                  className={`px-2 py-0.5 rounded ${linedSettings.showMargin && linedSettings.marginSide === 'right' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  Right
                </button>
              </div>
            </div>

            {/* Row shading */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-sans uppercase tracking-wider text-gray-500">Row shading</span>
              <button
                onClick={() => updateLinedSettings({ rowShading: !linedSettings.rowShading })}
                className={`relative w-8 h-4 rounded-full transition-colors ${linedSettings.rowShading ? 'bg-indigo-400' : 'bg-gray-200'}`}
                aria-label="Toggle row shading"
              >
                <span
                  className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${linedSettings.rowShading ? 'translate-x-4' : 'translate-x-0.5'}`}
                />
              </button>
            </div>

            {/* Legal pad */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-sans uppercase tracking-wider text-gray-500">Legal pad</span>
              <button
                onClick={() => updateLinedSettings({ legalPadMode: !linedSettings.legalPadMode })}
                className={`relative w-8 h-4 rounded-full transition-colors ${linedSettings.legalPadMode ? 'bg-amber-400' : 'bg-gray-200'}`}
                aria-label="Toggle legal pad mode"
              >
                <span
                  className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${linedSettings.legalPadMode ? 'translate-x-4' : 'translate-x-0.5'}`}
                />
              </button>
            </div>

            {/* Font */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-sans uppercase tracking-wider text-gray-500">Font</span>
              <div className="flex bg-gray-100 rounded-md p-0.5 text-[10px]">
                {(['hand', 'sans', 'serif', 'mono'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => updateLinedSettings({ fontFamily: f })}
                    className={`px-2 py-0.5 rounded capitalize ${
                      linedSettings.fontFamily === f
                        ? 'bg-white shadow-sm text-gray-700'
                        : 'text-gray-400 hover:text-gray-600'
                    } ${f === 'hand' ? 'font-hand' : f === 'sans' ? 'font-sans' : f === 'serif' ? 'font-serif' : 'font-mono'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
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

      {/* Header
          Native: single 36px combo row on left panel only (title + paper + bookmark + L/R switch)
                  right panel header is hidden — controls live in the left header
          Web:    separate 48/64px headers per page (unchanged) */}
      {native ? (
        isLeft && (
          <div className="h-9 border-b border-gray-200 flex items-center gap-2 px-3 bg-gradient-to-b from-white to-gray-50 shrink-0">
            <input
              className={`flex-1 min-w-0 text-base text-gray-800 bg-transparent outline-none placeholder-gray-300 truncate ${titleFontClass}`}
              value={page.title}
              onChange={(e) => onUpdatePage({...page, title: e.target.value})}
              placeholder="Untitled"
            />
            {/* Paper type pill */}
            <div className="relative">
              <button
                onClick={() => setShowPaperPicker(!showPaperPicker)}
                className="flex items-center gap-0.5 px-2 h-6 rounded-full bg-gray-100 text-[10px] font-sans uppercase tracking-wider text-gray-600 active:scale-95 transition-transform"
                aria-label="Change paper type"
                aria-expanded={showPaperPicker}
              >
                <span>{PAPER_TYPES.find(p => p.value === (page.paperType || 'lined'))?.label || 'Lined'}</span>
                <ChevronDown size={10} className={`transition-transform ${showPaperPicker ? 'rotate-180' : ''}`} />
              </button>
              {showPaperPicker && renderPaperPicker()}
            </div>
            {/* Bookmark toggle */}
            {onToggleBookmark && (
              <button
                onClick={onToggleBookmark}
                className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors active:scale-90 ${
                  isBookmarked ? 'text-amber-500' : 'text-gray-300'
                }`}
                aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark page'}
              >
                <Bookmark size={16} fill={isBookmarked ? 'currentColor' : 'none'} />
              </button>
            )}
            {/* Side switch — micro segmented control */}
            <div className="flex bg-gray-100 rounded-full p-0.5">
              <button
                onClick={() => setMobileSide('left')}
                className={`w-7 h-5 rounded-full text-[9px] font-bold transition-all ${
                  mobileSide === 'left' ? 'bg-indigo-600 text-white' : 'text-gray-400'
                }`}
                aria-label="Show left page"
              >
                L
              </button>
              <button
                onClick={() => setMobileSide('right')}
                className={`w-7 h-5 rounded-full text-[9px] font-bold transition-all ${
                  mobileSide === 'right' ? 'bg-indigo-600 text-white' : 'text-gray-400'
                }`}
                aria-label="Show right page"
              >
                R
              </button>
            </div>
          </div>
        )
      ) : (
        isLeft ? (
          <div className="h-12 md:h-16 border-b border-gray-200 flex items-end px-3 md:px-10 pb-2 bg-gradient-to-b from-white to-gray-50 shrink-0">
            <input
              className={`w-full text-xl md:text-4xl text-gray-800 bg-transparent outline-none placeholder-gray-300 truncate ${titleFontClass}`}
              value={page.title}
              onChange={(e) => onUpdatePage({...page, title: e.target.value})}
              placeholder="Untitled Page"
            />
          </div>
        ) : (
          <div className="h-12 md:h-16 border-b border-gray-200 flex items-end justify-between px-3 md:px-10 pb-2 bg-gradient-to-b from-white to-gray-50 shrink-0">
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
        )
      )}

      {/* Content Area — bottom padding clears the FAB on mobile */}
      <div
        className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 md:px-10 pt-3 md:pt-8 pb-20 md:pb-8 ${bgClass} relative cursor-text`}
        data-page-font={page.paperType === 'lined' ? (page.linedSettings?.fontFamily ?? 'hand') : undefined}
        style={{ WebkitOverflowScrolling: 'touch' }}
        onClick={(e) => handleEmptySpaceClick(e, side)}
      >
        {page.paperType === 'lined' && page.linedSettings?.showMargin && (
          <div className={`absolute top-0 bottom-0 ${
            (page.linedSettings.marginSide === 'right' || (!page.linedSettings.marginSide && !isLeft))
              ? 'right-[60px]' : 'left-[60px]'
          } w-[2px] bg-red-400/60 pointer-events-none z-0`} />
        )}
        {page.paperType === 'lined' && page.linedSettings?.legalPadMode && (
          <div className={`absolute top-0 bottom-0 left-[60px] w-[2px] bg-red-400/60 pointer-events-none z-0`} />
        )}
        {page.paperType !== 'blank' && page.paperType !== 'lined' && page.paperType !== 'hex' && page.paperType !== 'isometric' && (
          <div className={`absolute top-0 bottom-0 left-12 md:left-16 w-px ${marginColorClass} pointer-events-none z-0`} />
        )}
        {page.paperType === 'hex' && isLeft && (
          <HexPaperCanvas data={page.hexMapData} onChange={handleHexMapChange} />
        )}
        {page.paperType === 'isometric' && isLeft && (
          <IsoPaperCanvas data={page.isoFlowData} onChange={handleIsoFlowChange} />
        )}
        <div className={`relative z-10 min-h-full ${(page.paperType === 'hex' || page.paperType === 'isometric') ? 'pointer-events-none [&_[data-block-id]]:pointer-events-auto' : ''}`}>
          {blocks.length === 0 && page.paperType !== 'hex' && page.paperType !== 'isometric' && (
            <div className="text-gray-400 font-hand text-xl md:text-2xl text-center mt-16 md:mt-20 opacity-50 select-none pointer-events-none">
              Tap anywhere to start writing
            </div>
          )}
          {blocks.length === 0 && (page.paperType === 'hex' || page.paperType === 'isometric') && isLeft && (
            <div className="text-gray-400 font-hand text-xl text-center mt-20 opacity-60 select-none pointer-events-none">
              {page.paperType === 'hex'
                ? 'Tap anywhere to place a hex · Shift-click a hex to connect'
                : 'Tap anywhere to place a step · Shift-click a step to connect'}
            </div>
          )}
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={(event) => handleDragEnd(event, side)}
          >
            <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
              {groupConsecutiveBlocks(blocks).map((group) =>
                group.groupId ? (
                  <div key={`group-${group.key}`} className={`bg-white/40 backdrop-blur-sm rounded-xl border border-gray-200/60 shadow-sm p-3 mb-3 ${
                    group.groupId?.endsWith('-row') ? 'grid grid-cols-1 sm:grid-cols-2 gap-2' : 'space-y-0'
                  }`}>
                    {group.blocks.map((block) => {
                      // In "-row" groups, banner headings and wide blocks span full width
                      const isRowGroup = group.groupId?.endsWith('-row');
                      const spanFull = isRowGroup && (
                        block.containerStyle === 'banner' ||
                        ['WEEKLY_VIEW','KANBAN','GRID','TIME_BLOCK','CALENDAR','HABIT_TRACKER','DAILY_SECTION','GOAL_SECTION','PRIORITY_MATRIX'].includes(block.type)
                      );
                      return (
                      <SortableBlock key={block.id} id={block.id}>
                        {({ dragHandleProps }) => (
                          <div data-block-id={block.id} className={`${block.id === newBlockId ? 'anim-block-enter' : ''} ${spanFull ? 'sm:col-span-2' : ''}`}>
                            <BlockErrorBoundary blockType={block.type} blockId={block.id}>
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
                                mathResult={mathResults.get(block.id) ?? null}
                              />
                            </BlockErrorBoundary>
                          </div>
                        )}
                      </SortableBlock>
                    )})}
                  </div>
                ) : (
                  group.blocks.map((block) => (
                    <SortableBlock key={block.id} id={block.id}>
                      {({ dragHandleProps }) => (
                        <div data-block-id={block.id} className={block.id === newBlockId ? 'anim-block-enter' : ''}>
                          <BlockErrorBoundary blockType={block.type} blockId={block.id}>
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
                              mathResult={mathResults.get(block.id) ?? null}
                            />
                          </BlockErrorBoundary>
                        </div>
                      )}
                    </SortableBlock>
                  ))
                )
              )}
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
    <div
      data-native={native ? 'true' : undefined}
      className={`flex-1 h-full min-h-0 overflow-hidden bg-[#e5e5e5] flex flex-col relative ${native ? 'p-0' : 'p-1 md:p-8 md:justify-center'}`}
    >
      {/* Mobile Page Toggle — only shown on non-native mobile (web mobile Safari).
          Native replaces it with the compact L/R switch inside the header row. */}
      {!native && (
        <div className="md:hidden flex justify-center pt-1 pb-1.5 shrink-0">
          <div className="bg-white/90 backdrop-blur-sm rounded-full p-0.5 flex shadow-sm border border-gray-200">
            <button
              onClick={() => setMobileSide('left')}
              className={`px-4 py-1 rounded-full text-[11px] font-semibold transition-all ${
                mobileSide === 'left' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500'
              }`}
            >
              Left
            </button>
            <button
              onClick={() => setMobileSide('right')}
              className={`px-4 py-1 rounded-full text-[11px] font-semibold transition-all ${
                mobileSide === 'right' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500'
              }`}
            >
              Right
            </button>
          </div>
        </div>
      )}

      {/* Book — fills available space, no centering on mobile */}
      <div data-export-target className={`w-full max-w-6xl flex-1 min-h-0 mx-auto bg-slate-800 ${native ? 'p-0 rounded-none' : 'p-0.5 md:p-2 rounded-lg md:rounded-xl'} shadow-2xl flex flex-col md:flex-row relative`}>
        {/* Desktop: show both pages */}
        <div className="hidden md:contents">
          {renderPagePanel('left', leftBlocks, true)}
          <div className="w-1 h-full bg-black/40 shadow-[0_0_10px_rgba(0,0,0,0.5)] z-30" />
          {renderPagePanel('right', rightBlocks, false)}
        </div>

        {/* Mobile: single selected page */}
        <div className="md:hidden flex-1 min-h-0 flex flex-col">
          {mobileSide === 'left'
            ? renderPagePanel('left', leftBlocks, true)
            : renderPagePanel('right', rightBlocks, false)
          }
        </div>
      </div>

      {/* Native AI FAB — floats over entire notebook */}
      {renderAIFab()}
    </div>
  );
};
