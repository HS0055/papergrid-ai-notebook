import React, { useState, useEffect, useRef, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { NotebookPage, Block, BlockType, LinedPaperSettings, HexMapData, IsoFlowData, GridSheetData } from '@papergrid/core';
import { BlockComponent } from './BlockComponent';
import { useMathEngine } from '../hooks/useMathEngine';
import { PianoKeyboard } from './PianoKeyboard';
import { HexPaperCanvas } from './planner/HexPaperCanvas';
import { IsoPaperCanvas } from './planner/IsoPaperCanvas';
import { GridPaperCanvas } from './planner/GridPaperCanvas';
import { isPaperTypeComingSoon } from '../config/featureFlags';
import { Plus, Info, Quote, Minus, Smile, LayoutGrid, List, X, Sparkles, ChevronDown, Music, Calendar, CalendarDays, CheckSquare, Target, Clock, Sun, AlertTriangle, Bookmark } from 'lucide-react';
import { isNativeApp } from '../utils/platform';
import { triggerHaptic } from '../utils/haptics';
import { ImpactStyle } from '@capacitor/haptics';
import { useKeyboardHandler } from '../hooks/useKeyboardHandler';
import { KeyboardToolbar } from './ios/KeyboardToolbar';
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
  /**
   * Focus mode: hide ALL chrome from the notebook view (page-title bar,
   * paper type pill, date, etc) so only the actual writing surface +
   * blocks remain visible. The user-level "Exit focus" pill lives at
   * the Dashboard level.
   */
  hideChrome?: boolean;
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
  isBookmarked, onToggleBookmark, onOpenAIGenerator, hideChrome,
}) => {
  const native = isNativeApp();
  const { keyboardVisible, keyboardHeight } = useKeyboardHandler();
  const [openMenu, setOpenMenu] = useState<'left' | 'right' | null>(null);
  const [showPaperPicker, setShowPaperPicker] = useState(false);
  const [mobileSide, setMobileSide] = useState<'left' | 'right'>('left');
  const [newBlockId, setNewBlockId] = useState<string | null>(null);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [selectedPitch, setSelectedPitch] = useState<{ pitch: string; octave: number } | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<'whole' | 'half' | 'quarter' | 'eighth'>('quarter');
  const paperPickerRef = useRef<HTMLDivElement>(null);

  // Math Engine — only runs on Grid paper. Other papers (Lined, Music, Hex, Iso, Dotted, Blank)
  // are NOT calculator surfaces; auto-evaluation there pollutes the writing experience.
  const showMath = page.paperType === 'grid' && page.showMathResults !== false;
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

  // ── Auto-scroll focused input above the iOS keyboard ──────
  // Apple Notes.app pattern: keep the cursor within the visible viewport
  // (visualViewport, which excludes the keyboard area) with a safety margin
  // above the keyboard. Triggers on:
  //   - focusin                — user tapped a new input
  //   - input                  — user typed a character (textarea may grow)
  //   - selectionchange        — user moved the cursor with arrow keys / gesture
  //   - visualViewport.resize  — keyboard appeared/disappeared
  useEffect(() => {
    if (!native) return;

    const SAFE_MARGIN = 80;          // px above the keyboard / toolbar to stay clear of
    const ANCHOR_FROM_TOP = 0.40;    // cursor anchor: 40% from top of visible area

    const scrollCursorIntoView = (smooth: boolean) => {
      const el = document.activeElement;
      if (
        !(el instanceof HTMLElement) ||
        !el.matches('input, textarea, [contenteditable="true"], [contenteditable=""]')
      ) {
        return;
      }
      const container = el.closest<HTMLElement>('[data-scroll-container]');
      if (!container) return;

      // Compute the actual cursor Y in viewport coordinates.
      // For textareas: approximate as element.bottom (cursor is usually at the tail).
      // For inputs:    element center is good enough (single-line).
      // For contenteditable with selection: use the Range's bounding rect for exact pos.
      let cursorClientY: number;
      if (el instanceof HTMLTextAreaElement) {
        cursorClientY = el.getBoundingClientRect().bottom;
      } else if (el.isContentEditable) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0).cloneRange();
          range.collapse(true);
          const r = range.getBoundingClientRect();
          // Empty range can return all-zeros; fall back to el bottom
          cursorClientY = (r.top === 0 && r.height === 0) ? el.getBoundingClientRect().bottom : r.bottom;
        } else {
          cursorClientY = el.getBoundingClientRect().bottom;
        }
      } else {
        const r = el.getBoundingClientRect();
        cursorClientY = r.top + r.height / 2;
      }

      // Visible area = visualViewport (which excludes the iOS keyboard)
      const vv = window.visualViewport;
      const visibleTop = vv ? vv.offsetTop : 0;
      const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
      const visibleHeight = visibleBottom - visibleTop;
      const safeBottom = visibleBottom - SAFE_MARGIN;
      const safeTop = visibleTop + 20;

      // If cursor is already comfortably visible, don't scroll
      if (cursorClientY >= safeTop && cursorClientY <= safeBottom) return;

      // Compute scroll delta to move cursor to anchor point (40% from top of visible)
      const targetClientY = visibleTop + visibleHeight * ANCHOR_FROM_TOP;
      const delta = cursorClientY - targetClientY;
      if (Math.abs(delta) < 8) return;

      container.scrollBy({
        top: delta,
        behavior: smooth ? 'smooth' : 'auto',
      });
    };

    const onFocusIn = () => requestAnimationFrame(() => scrollCursorIntoView(true));
    const onInput = () => requestAnimationFrame(() => scrollCursorIntoView(false));
    const onSelectionChange = () => requestAnimationFrame(() => scrollCursorIntoView(false));
    const onVVResize = () => requestAnimationFrame(() => scrollCursorIntoView(true));

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('input', onInput);
    document.addEventListener('selectionchange', onSelectionChange);
    window.visualViewport?.addEventListener('resize', onVVResize);

    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('input', onInput);
      document.removeEventListener('selectionchange', onSelectionChange);
      window.visualViewport?.removeEventListener('resize', onVVResize);
    };
  }, [native]);

  // ── Swipe-down on scroll container to dismiss keyboard ──────
  // Apple Notes muscle memory: drag the page content downward when
  // already scrolled to the bottom → keyboard slides away. This is the
  // closest we can get to UIScrollView.keyboardDismissMode = .interactive
  // without a native plugin (Capacitor issue #6064).
  useEffect(() => {
    if (!native || !keyboardVisible) return;

    let touchStartY = 0;
    let touchStartScrollTop = 0;

    const onTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      const container = target?.closest<HTMLElement>('[data-scroll-container]');
      if (!container) return;
      touchStartY = e.touches[0].clientY;
      touchStartScrollTop = container.scrollTop;
    };

    const onTouchMove = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      const container = target?.closest<HTMLElement>('[data-scroll-container]');
      if (!container) return;
      const dy = e.touches[0].clientY - touchStartY;
      // Downward drag of >50px while scroll position hasn't moved (or moved up)
      // means user is gesturing past the top — dismiss keyboard.
      if (dy > 50 && container.scrollTop <= touchStartScrollTop) {
        import('@capacitor/keyboard').then(({ Keyboard }) => {
          Keyboard.hide().catch(() => {});
        });
      }
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
    };
  }, [native, keyboardVisible]);

  // ── Tap-outside-to-dismiss keyboard ───────────────────────
  // Mirrors iOS Notes.app: tapping any non-input region collapses
  // the keyboard. Uses pointerdown (not click) to fire BEFORE the
  // browser shifts focus, so the active textarea blurs cleanly.
  useEffect(() => {
    if (!native || !keyboardVisible) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (
        target.closest('input, textarea, [contenteditable="true"], [contenteditable=""]') ||
        target.closest('[data-keyboard-toolbar]') ||
        target.closest('button')
      ) {
        return;
      }
      import('@capacitor/keyboard').then(({ Keyboard }) => {
        Keyboard.hide().catch(() => {});
      });
    };

    document.addEventListener('pointerdown', handlePointerDown, { capture: true });
    return () => document.removeEventListener('pointerdown', handlePointerDown, { capture: true } as EventListenerOptions);
  }, [native, keyboardVisible]);

  // ── Keyboard toolbar handlers ─────────────────────────────
  // Real formatting actions: heading/checkbox/quote/divider INSERT a new
  // block after the current one. Bold/italic toggle the current block's
  // emphasis. Undo/redo are placeholders pending history store.
  const handleKeyboardToolbarAction = (actionId: string) => {
    const el = document.activeElement;
    const blockEl = el instanceof HTMLElement ? el.closest('[data-block-id]') : null;
    const currentBlockId = blockEl?.getAttribute('data-block-id');
    const currentBlock = currentBlockId ? page.blocks.find(b => b.id === currentBlockId) : null;
    const activeSide: 'left' | 'right' = currentBlock?.side === 'right' ? 'right' : 'left';

    switch (actionId) {
      case 'heading':
      case 'checkbox':
      case 'quote':
      case 'divider': {
        const typeMap = {
          heading: BlockType.HEADING,
          checkbox: BlockType.CHECKBOX,
          quote: BlockType.QUOTE,
          divider: BlockType.DIVIDER,
        } as const;
        const type = typeMap[actionId as keyof typeof typeMap];
        if (currentBlock) {
          insertBlockAfter(currentBlock.id, type, activeSide);
        } else {
          addBlock(type, mobileSide);
        }
        return;
      }
      case 'bold':
      case 'italic': {
        if (currentBlock) {
          const next = currentBlock.emphasis === actionId ? 'none' : (actionId as 'bold' | 'italic');
          handleBlockChange(currentBlock.id, { emphasis: next });
        }
        return;
      }
      case 'undo':
      case 'redo':
        return;
    }
  };

  const handleKeyboardDismiss = () => {
    if (!isNativeApp()) {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      return;
    }
    import('@capacitor/keyboard').then(({ Keyboard }) => {
      Keyboard.hide().catch(() => {});
    });
  };

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
    // On hex/iso/grid paper the canvas owns empty-space clicks — don't auto-add a text block.
    if (page.paperType === 'hex' || page.paperType === 'isometric' || page.paperType === 'grid') return;
    addBlock(BlockType.TEXT, side);
  };

  const handleHexMapChange = (next: HexMapData, side: 'left' | 'right' = 'left') => {
    onUpdatePage(
      side === 'right'
        ? { ...page, hexMapDataRight: next }
        : { ...page, hexMapData: next }
    );
  };

  const handleIsoFlowChange = (next: IsoFlowData, side: 'left' | 'right' = 'left') => {
    onUpdatePage(
      side === 'right'
        ? { ...page, isoFlowDataRight: next }
        : { ...page, isoFlowData: next }
    );
  };

  const handleGridSheetChange = (next: GridSheetData, side: 'left' | 'right' = 'left') => {
    onUpdatePage(
      side === 'right'
        ? { ...page, gridSheetDataRight: next }
        : { ...page, gridSheetData: next }
    );
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
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-40 anim-fab-pop pointer-events-auto w-[min(92vw,360px)]">
        <div className="bg-white/96 backdrop-blur-md shadow-2xl rounded-2xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-100">
            <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-gray-400">Add block</span>
            <button
              onClick={() => setOpenMenu(null)}
              className="w-8 h-8 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-600 rounded-full flex items-center justify-center transition-colors"
              aria-label="Close block menu"
            >
              <X size={15} />
            </button>
          </div>
          {/* Grid */}
          <div className="flex flex-wrap justify-start gap-1.5 p-3 max-h-[52vh] overflow-y-auto">
            {allowedTypes.map(type => {
              const config = BLOCK_BUTTON_CONFIG[type];
              return (
                <button
                  key={type}
                  onClick={() => addBlock(type, side)}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-xl text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 active:scale-95 transition-all w-[72px] h-[60px]"
                  style={{ touchAction: 'manipulation' }}
                >
                  <span className="flex items-center justify-center w-7 h-7">{config.icon}</span>
                  <span className="text-[10px] font-sans leading-none text-center">{config.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ── FAB Button ────────────────────────────────────────────
  // Completely unmount when keyboard is visible to avoid any z-index / stacking
  // leakage above the keyboard. The tiny mount/unmount cost is negligible and
  // gives us a guaranteed-clean hide. Also unmounted in hideChrome mode so
  // PDF exports never show the interactive "+" add-block button.
  const renderFAB = (side: 'left' | 'right') => {
    if (keyboardVisible || hideChrome) return null;
    return (
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
  };

  // ── Native AI FAB ─────────────────────────────────────────
  // Floating sparkle button for AI layout generation. Native-only, pulses to draw attention.
  // Unmounted while the keyboard is visible so it cannot leak above it.
  const renderAIFab = () => {
    if (!native || !onOpenAIGenerator || keyboardVisible) return null;
    return (
      <div
        className="absolute right-4 z-40 pointer-events-none"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)',
        }}
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
          {PAPER_TYPES.map(pt => {
            const comingSoon = isPaperTypeComingSoon(pt.value);
            return (
              <button
                key={pt.value}
                disabled={comingSoon}
                onClick={() => {
                  if (comingSoon) return;
                  onUpdatePage({...page, paperType: pt.value});
                  setShowPaperPicker(false);
                }}
                className={`relative flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all ${
                  comingSoon
                    ? 'opacity-40 cursor-not-allowed'
                    : page.paperType === pt.value
                      ? 'bg-indigo-100 ring-2 ring-indigo-400 scale-105'
                      : 'hover:bg-gray-100'
                }`}
                aria-label={comingSoon ? `${pt.label} — coming soon` : pt.label}
                title={comingSoon ? 'Coming soon' : pt.label}
              >
                <div className={`w-10 h-10 rounded-md border border-gray-300 overflow-hidden ${PAPER_BG_MAP[pt.value]}`}
                  style={{ backgroundSize: pt.value === 'lined' ? '100% 8px' : pt.value === 'grid' ? '8px 8px' : pt.value === 'dotted' ? '8px 8px' : undefined }}
                />
                <span className="text-[9px] font-medium text-gray-500 leading-tight">{pt.label}</span>
                {comingSoon && (
                  <span className="absolute -top-1 -right-1 bg-amber-400 text-white text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 rounded-sm shadow-sm">
                    Soon
                  </span>
                )}
              </button>
            );
          })}
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
    <div className={`flex-1 min-h-0 bg-paper ${
      native
        ? 'border-0 rounded-none'
        : isLeft
          ? 'rounded-t-lg md:rounded-l-lg md:rounded-tr-none border-b md:border-b-0 md:border-r border-black/20'
          : 'rounded-b-lg md:rounded-r-lg md:rounded-bl-none border-t md:border-t-0 md:border-l border-white/50'
    } overflow-hidden relative flex flex-col`}>
      {/* Fold Shadow — DESKTOP ONLY. On a phone there is no "book", just a page. */}
      {!native && (isLeft ? (
        <>
          <div className="hidden md:block absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-black/20 to-transparent pointer-events-none z-20" />
          <div className="md:hidden absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/20 to-transparent pointer-events-none z-20" />
        </>
      ) : (
        <>
          <div className="hidden md:block absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-black/20 to-transparent pointer-events-none z-20" />
          <div className="md:hidden absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-black/20 to-transparent pointer-events-none z-20" />
        </>
      ))}

      {/* Header — entirely hidden in focus mode so the user sees only
          the writing surface + blocks. */}
      {hideChrome ? null : native ? (
        <div
          className="border-b border-black/[0.06] flex items-center gap-3 px-4 bg-paper shrink-0"
          style={{ height: '52px' }}
        >
          <input
            className={`flex-1 min-w-0 text-[17px] font-semibold text-gray-900 bg-transparent outline-none placeholder-gray-300 truncate ${titleFontClass}`}
            value={page.title}
            onChange={(e) => onUpdatePage({...page, title: e.target.value})}
            placeholder="Untitled"
            style={{ touchAction: 'manipulation' }}
          />
          {/* Paper type pill — 44pt target */}
          <div className="relative">
            <button
              onClick={() => setShowPaperPicker(!showPaperPicker)}
              className="flex items-center justify-center gap-1 px-3 min-w-[44px] h-9 rounded-full bg-black/[0.06] text-[12px] font-sans font-medium text-gray-700 active:bg-black/[0.10] transition-colors"
              aria-label="Change paper type"
              aria-expanded={showPaperPicker}
              style={{ touchAction: 'manipulation' }}
            >
              <span>{PAPER_TYPES.find(p => p.value === (page.paperType || 'lined'))?.label || 'Lined'}</span>
              <ChevronDown size={12} className={`transition-transform ${showPaperPicker ? 'rotate-180' : ''}`} />
            </button>
            {showPaperPicker && renderPaperPicker()}
          </div>
          {/* Bookmark — 44pt target */}
          {onToggleBookmark && (
            <button
              onClick={onToggleBookmark}
              className={`w-11 h-11 -mr-2 flex items-center justify-center rounded-full transition-colors active:bg-black/[0.06] ${
                isBookmarked ? 'text-amber-500' : 'text-gray-400'
              }`}
              aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark page'}
              style={{ touchAction: 'manipulation' }}
            >
              <Bookmark size={20} fill={isBookmarked ? 'currentColor' : 'none'} />
            </button>
          )}
        </div>
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

      {/* Content Area — bottom padding clears the FAB on mobile (only when idle).
          When keyboard is up the FAB is unmounted, so we shrink to 16px and let
          the cursor breathe. The scroll container itself shrinks via main's height
          calc, so we don't need defensive `pb-20` reservations any more. */}
      <div
        data-scroll-container
        className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 md:px-10 pt-3 md:pt-8 ${
          native
            ? (keyboardVisible ? 'pb-4' : 'pb-24')
            : 'pb-20 md:pb-8'
        } ${bgClass} relative cursor-text`}
        data-paper-type={page.paperType}
        data-page-font={page.paperType === 'lined' ? (page.linedSettings?.fontFamily ?? 'hand') : undefined}
        data-margin-side={
          page.paperType === 'lined' && (page.linedSettings?.showMargin || page.linedSettings?.legalPadMode)
            ? (page.linedSettings?.showMargin && (page.linedSettings.marginSide === 'right' || (!page.linedSettings.marginSide && !isLeft))
                ? 'right'
                : 'left')
            : undefined
        }
        style={{
          WebkitOverflowScrolling: 'touch',
          scrollPaddingBottom: keyboardVisible ? '96px' : '16px',
          // touch-action: pan-y allows scroll, removes 300ms delay on nested buttons
          touchAction: 'pan-y',
        }}
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
        {page.paperType === 'hex' && !isPaperTypeComingSoon('hex') && (
          <HexPaperCanvas
            data={isLeft ? page.hexMapData : page.hexMapDataRight}
            onChange={(next) => handleHexMapChange(next, side)}
          />
        )}
        {page.paperType === 'isometric' && !isPaperTypeComingSoon('isometric') && (
          <IsoPaperCanvas
            data={isLeft ? page.isoFlowData : page.isoFlowDataRight}
            onChange={(next) => handleIsoFlowChange(next, side)}
          />
        )}
        {page.paperType === 'grid' && !isPaperTypeComingSoon('grid') && (
          <GridPaperCanvas
            data={isLeft ? page.gridSheetData : page.gridSheetDataRight}
            onChange={(next) => handleGridSheetChange(next, side)}
          />
        )}
        {/* Coming-soon placeholder when a page's paper type is feature-flagged off */}
        {isLeft && isPaperTypeComingSoon(page.paperType) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center px-6 pointer-events-none">
            <div className="bg-white/90 backdrop-blur-md border border-amber-200 rounded-2xl shadow-lg px-6 py-5 max-w-sm text-center pointer-events-auto">
              <div className="inline-block bg-amber-400 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-sm shadow-sm mb-3">
                Coming Soon
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-1.5 capitalize">
                {page.paperType === 'isometric' ? 'Iso Flow' : page.paperType} paper
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                {page.paperType === 'music'
                  ? 'Melody sketching with lyrics — drop your first songs here soon.'
                  : page.paperType === 'hex'
                    ? 'Hex network maps for systems thinking — landing in the next release.'
                    : 'Process flow diagrams in isometric perspective — landing in the next release.'}
              </p>
              <p className="text-[10px] text-gray-400 mt-3">
                Switch to Lined, Grid, Dotted, or Blank to keep working.
              </p>
            </div>
          </div>
        )}
        <div className={`relative z-10 min-h-full ${(page.paperType === 'hex' || page.paperType === 'isometric' || page.paperType === 'grid') ? 'pointer-events-none [&_[data-block-id]]:pointer-events-auto' : ''}`}>
        {(() => {
          // Per-paper-type "is empty" check. The hint text only shows when this
          // paper has zero of its OWN native content. Each paper has a different
          // notion of "content":
          //   lined / dotted / blank — text blocks
          //   hex — placed hex nodes
          //   isometric — placed flow steps
          //   grid — filled grid cells
          //   music — placed melody notes (TBD when music ships)
          // Per-side empty checks: each side has its own canvas data, so the
          // hint must reflect the side currently being rendered.
          const hexData = isLeft ? page.hexMapData : page.hexMapDataRight;
          const isoData = isLeft ? page.isoFlowData : page.isoFlowDataRight;
          const gridData = isLeft ? page.gridSheetData : page.gridSheetDataRight;
          const hexEmpty = !hexData?.nodes?.length;
          const isoEmpty = !isoData?.steps?.length;
          const gridEmpty = !gridData?.cells || Object.keys(gridData.cells).length === 0;
          const blocksEmpty = blocks.length === 0;
          const isCanvasPaper = page.paperType === 'hex' || page.paperType === 'isometric' || page.paperType === 'grid';
          const isPaperEmpty =
            (page.paperType === 'hex' && hexEmpty)
            || (page.paperType === 'isometric' && isoEmpty)
            || (page.paperType === 'grid' && gridEmpty)
            || (!isCanvasPaper && blocksEmpty);
          // On canvas-primary papers (grid/hex/iso) the block list is hidden so
          // text content from a previous paper-type doesn't visually leak through.
          const renderBlocks = !isCanvasPaper;
          return (
            <>
              {isPaperEmpty && !isCanvasPaper && !hideChrome && (
                <div className="flex flex-col items-center gap-3 mt-14 md:mt-20 opacity-40 select-none pointer-events-none">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/>
                  </svg>
                  <span className="text-gray-400 font-hand text-lg md:text-xl text-center">
                    Tap the <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-500 text-[11px] font-bold align-middle mx-0.5">+</span> to add a block
                  </span>
                </div>
              )}
              {isPaperEmpty && (page.paperType === 'hex' || page.paperType === 'isometric') && isLeft && !hideChrome && (
                <div className="text-gray-400 font-hand text-xl text-center mt-20 opacity-60 select-none pointer-events-none">
                  {page.paperType === 'hex'
                    ? 'Tap anywhere to place a hex · Shift-click a hex to connect'
                    : 'Tap anywhere to place a step · Shift-click a step to connect'}
                </div>
              )}
              {isPaperEmpty && page.paperType === 'grid' && isLeft && !hideChrome && (
                <div className="text-gray-400 font-hand text-xl text-center mt-20 opacity-60 select-none pointer-events-none">
                  Tap any cell to write · arrow keys move · backspace deletes
                </div>
              )}
              {!renderBlocks && null}
            </>
          );
        })()}
          {(page.paperType !== 'hex' && page.paperType !== 'isometric' && page.paperType !== 'grid') && (
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
          )}
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
      className={`flex-1 h-full min-h-0 overflow-hidden flex flex-col relative ${
        native
          ? 'p-0 bg-paper'
          : 'bg-[#e5e5e5] p-1 md:p-8 md:justify-center'
      }`}
    >
      {/* Mobile Page Toggle — only shown on non-native mobile (web mobile Safari).
          Native replaces it with the compact L/R switch inside the header row. */}
      {!native && (
        <div className="md:hidden flex justify-center pt-2 pb-2 shrink-0">
          <div className="bg-white/95 backdrop-blur-sm rounded-full p-0.5 flex shadow-sm border border-gray-200">
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
      <div
        data-export-target
        className={`w-full max-w-6xl flex-1 min-h-0 mx-auto flex flex-col md:flex-row relative ${
          native
            ? 'bg-transparent'
            : 'bg-slate-800 p-0.5 md:p-2 rounded-lg md:rounded-xl shadow-2xl'
        }`}
      >
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

      {/* Floating L/R segmented control — native, hidden while typing.
          Lives in the thumb zone, doesn't fight the title row. */}
      {native && !keyboardVisible && (
        <div
          className="absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px)' }}
        >
          <div
            className="liquid-glass pointer-events-auto flex rounded-full p-1 shadow-lg"
            role="tablist"
            aria-label="Page side"
          >
            <button
              onClick={() => { triggerHaptic.impact(ImpactStyle.Light); setMobileSide('left'); }}
              className={`min-w-[56px] h-9 px-4 rounded-full text-[13px] font-semibold transition-colors ${
                mobileSide === 'left' ? 'bg-white text-gray-900 shadow' : 'text-gray-500'
              }`}
              style={{ touchAction: 'manipulation' }}
              role="tab"
              aria-selected={mobileSide === 'left'}
            >
              Left
            </button>
            <button
              onClick={() => { triggerHaptic.impact(ImpactStyle.Light); setMobileSide('right'); }}
              className={`min-w-[56px] h-9 px-4 rounded-full text-[13px] font-semibold transition-colors ${
                mobileSide === 'right' ? 'bg-white text-gray-900 shadow' : 'text-gray-500'
              }`}
              style={{ touchAction: 'manipulation' }}
              role="tab"
              aria-selected={mobileSide === 'right'}
            >
              Right
            </button>
          </div>
        </div>
      )}

      {/* iOS Keyboard Toolbar — pinned to top of keyboard, native-only */}
      <KeyboardToolbar
        visible={keyboardVisible}
        keyboardHeight={keyboardHeight}
        onAction={handleKeyboardToolbarAction}
        onDismiss={handleKeyboardDismiss}
      />
    </div>
  );
};
