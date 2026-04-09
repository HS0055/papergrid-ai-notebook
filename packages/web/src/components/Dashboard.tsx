import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotebookView } from './NotebookView';
import { LayoutGenerator } from './LayoutGenerator';
import { Notebook, NotebookPage, Block, BlockType, PricingPlanId } from '@papergrid/core';
import { generateLayout, generateCover, ExistingPageContext } from '../services/geminiService';
import { CoverGenModal } from './CoverGenModal';
import {
  Book, Plus, Sparkles, Menu, ChevronLeft, ChevronRight, Bookmark,
  AlertCircle, CheckCircle2, X, Home, Search, FileText, Undo2,
  Palette, BookOpen, LayoutDashboard, ListChecks, Calendar, PenLine,
  Printer, Volume2, VolumeX, Wand2, Trash2,
  Users, DollarSign, Gift, Maximize2, Minimize2, CreditCard,
  MessageSquare, Droplet,
} from 'lucide-react';
import { useSoundEffects } from '../hooks/useSoundEffects';
import { useAuth } from '../hooks/useAuth';
import {
  loadNotebooksFromStorage,
  prepareCoverImageForStorage,
  saveNotebooksToStorage,
} from '../utils/notebookStorage';
import { useConvexNotebooks } from '../hooks/useConvexNotebooks';
import { usePricingConfig } from '../hooks/usePricingConfig';
import { Logo } from './landing/Logo';
import { Canvas3DErrorBoundary } from './three/Canvas3DErrorBoundary';
import { TabBar, type TabId } from './ios/TabBar';
import { BottomSheet } from './ios/BottomSheet';
import { isNativeApp } from '../utils/platform';
import { coverColorToHex, darkenHex } from '../utils/coverColors';
import { normalizeExportColors } from '../utils/normalizeExportColors';
import { useKeyboardHandler } from '../hooks/useKeyboardHandler';

// Lazy-load 3D components (Three.js chunk loads on demand)
const BookCoverScene = lazy(() => import('./three/notebook/BookCoverScene'));

const STORAGE_KEY_PREFIX = 'papergrid_notebooks';

const COVER_COLORS = [
  'bg-indigo-900', 'bg-rose-900', 'bg-emerald-900', 'bg-slate-900',
  'bg-amber-900', 'bg-sky-900', 'bg-violet-900', 'bg-stone-900',
  'bg-red-900', 'bg-teal-900', 'bg-fuchsia-900', 'bg-zinc-900',
];

// Rich, designer-grade starter templates. Each one is a fully-composed
// 2-page spread that should feel like opening a premium printed planner —
// not an empty doc with one heading. Every template uses specialised
// planner blocks (TIME_BLOCK, HABIT_TRACKER, DAILY_SECTION, GOAL_SECTION,
// PROGRESS_BAR, KANBAN, etc) so users see real structure on page 1 instead
// of having to assemble it themselves.
const STARTER_TEMPLATES = [
  {
    id: 'blank',
    title: 'Blank Page',
    desc: 'Start from scratch',
    icon: FileText,
    blocks: [] as Block[],
  },
  {
    id: 'planner',
    title: 'Daily Planner',
    desc: 'Hour-by-hour schedule + priorities',
    icon: Calendar,
    blocks: [
      { id: 'dp-h1', type: BlockType.HEADING, content: "Today's Plan", side: 'left' as const, emphasis: 'bold' as const, color: 'indigo' },
      {
        id: 'dp-daily',
        type: BlockType.DAILY_SECTION,
        content: '',
        side: 'left' as const,
        color: 'indigo',
        dailySectionData: {
          dayLabel: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
          date: new Date().toISOString().slice(0, 10),
          sections: [
            { label: 'Morning', content: '' },
            { label: 'Afternoon', content: '' },
            { label: 'Evening', content: '' },
          ],
        },
      },
      { id: 'dp-h2', type: BlockType.HEADING, content: 'Top 3 Priorities', side: 'left' as const, color: 'rose' },
      { id: 'dp-c1', type: BlockType.CHECKBOX, content: '', checked: false, side: 'left' as const },
      { id: 'dp-c2', type: BlockType.CHECKBOX, content: '', checked: false, side: 'left' as const },
      { id: 'dp-c3', type: BlockType.CHECKBOX, content: '', checked: false, side: 'left' as const },
      { id: 'dp-h3', type: BlockType.HEADING, content: 'Schedule', side: 'right' as const, color: 'indigo' },
      {
        id: 'dp-time',
        type: BlockType.TIME_BLOCK,
        content: '',
        side: 'right' as const,
        color: 'indigo',
        timeBlockData: {
          startHour: 7,
          endHour: 21,
          interval: 60,
          entries: [],
        },
      },
      { id: 'dp-h4', type: BlockType.HEADING, content: 'Notes', side: 'right' as const, color: 'slate' },
      { id: 'dp-t1', type: BlockType.TEXT, content: '', side: 'right' as const },
    ] as Block[],
  },
  {
    id: 'meeting',
    title: 'Meeting Notes',
    desc: 'Agenda, decisions, action items',
    icon: PenLine,
    blocks: [
      { id: 'mn-h1', type: BlockType.HEADING, content: 'Meeting Notes', side: 'left' as const, emphasis: 'bold' as const, color: 'slate' },
      {
        id: 'mn-meta',
        type: BlockType.GRID,
        content: '',
        side: 'left' as const,
        color: 'slate',
        gridData: {
          columns: ['Date', 'Time', 'Location'],
          rows: [[
            { id: 'm1a', content: new Date().toLocaleDateString() },
            { id: 'm1b', content: '' },
            { id: 'm1c', content: '' },
          ]],
        },
      },
      { id: 'mn-h2', type: BlockType.HEADING, content: 'Attendees', side: 'left' as const, color: 'indigo' },
      { id: 'mn-t1', type: BlockType.TEXT, content: '', side: 'left' as const },
      { id: 'mn-h3', type: BlockType.HEADING, content: 'Agenda', side: 'left' as const, color: 'indigo' },
      { id: 'mn-a1', type: BlockType.CHECKBOX, content: '', checked: false, side: 'left' as const },
      { id: 'mn-a2', type: BlockType.CHECKBOX, content: '', checked: false, side: 'left' as const },
      { id: 'mn-a3', type: BlockType.CHECKBOX, content: '', checked: false, side: 'left' as const },
      { id: 'mn-call', type: BlockType.CALLOUT, content: 'Key decisions made this meeting...', side: 'right' as const, color: 'amber' },
      { id: 'mn-h4', type: BlockType.HEADING, content: 'Discussion Notes', side: 'right' as const, color: 'slate' },
      { id: 'mn-t2', type: BlockType.TEXT, content: '', side: 'right' as const },
      { id: 'mn-h5', type: BlockType.HEADING, content: 'Action Items', side: 'right' as const, color: 'rose' },
      {
        id: 'mn-actions',
        type: BlockType.GRID,
        content: '',
        side: 'right' as const,
        color: 'rose',
        gridData: {
          columns: ['Owner', 'Task', 'Due'],
          rows: [
            [{ id: 'r1a', content: '' }, { id: 'r1b', content: '' }, { id: 'r1c', content: '' }],
            [{ id: 'r2a', content: '' }, { id: 'r2b', content: '' }, { id: 'r2c', content: '' }],
            [{ id: 'r3a', content: '' }, { id: 'r3b', content: '' }, { id: 'r3c', content: '' }],
          ],
        },
      },
    ] as Block[],
  },
  {
    id: 'tracker',
    title: 'Project Tracker',
    desc: 'Kanban board + milestones',
    icon: ListChecks,
    blocks: [
      { id: 'pt-h1', type: BlockType.HEADING, content: 'Project Tracker', side: 'left' as const, emphasis: 'bold' as const, color: 'indigo' },
      {
        id: 'pt-goal',
        type: BlockType.GOAL_SECTION,
        content: '',
        side: 'left' as const,
        color: 'indigo',
        goalSectionData: {
          goals: [
            { text: 'Project goal', subItems: [{ text: '', checked: false }, { text: '', checked: false }], progress: 0 },
          ],
        },
      },
      {
        id: 'pt-prog',
        type: BlockType.PROGRESS_BAR,
        content: '',
        side: 'left' as const,
        color: 'emerald',
        progressBarData: { label: 'Overall progress', current: 0, target: '100%', color: 'emerald' },
      },
      { id: 'pt-h2', type: BlockType.HEADING, content: 'Blockers & Risks', side: 'left' as const, color: 'rose' },
      { id: 'pt-call', type: BlockType.CALLOUT, content: 'What could derail this project?', side: 'left' as const, color: 'rose' },
      { id: 'pt-h3', type: BlockType.HEADING, content: 'Tasks', side: 'right' as const, color: 'indigo' },
      {
        id: 'pt-kanban',
        type: BlockType.KANBAN,
        content: '',
        side: 'right' as const,
        color: 'indigo',
        kanbanData: {
          columns: [
            { title: 'Backlog', color: 'slate', cards: [] },
            { title: 'In Progress', color: 'amber', cards: [] },
            { title: 'Done', color: 'emerald', cards: [] },
          ],
        },
      },
    ] as Block[],
  },
  {
    id: 'bujo',
    title: 'Bullet Journal',
    desc: 'Rapid log + mood + habits',
    icon: BookOpen,
    blocks: [
      { id: 'bj-h1', type: BlockType.HEADING, content: 'Bullet Journal', side: 'left' as const, emphasis: 'bold' as const, color: 'amber' },
      { id: 'bj-t1', type: BlockType.TEXT, content: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }), side: 'left' as const, alignment: 'center' as const, emphasis: 'italic' as const },
      { id: 'bj-q1', type: BlockType.QUOTE, content: 'The secret of getting ahead is getting started.', side: 'left' as const, color: 'amber' },
      { id: 'bj-h2', type: BlockType.HEADING, content: 'Rapid Log', side: 'left' as const, color: 'indigo' },
      { id: 'bj-c1', type: BlockType.CHECKBOX, content: '', checked: false, side: 'left' as const },
      { id: 'bj-c2', type: BlockType.CHECKBOX, content: '', checked: false, side: 'left' as const },
      { id: 'bj-c3', type: BlockType.CHECKBOX, content: '', checked: false, side: 'left' as const },
      { id: 'bj-c4', type: BlockType.CHECKBOX, content: '', checked: false, side: 'left' as const },
      { id: 'bj-c5', type: BlockType.CHECKBOX, content: '', checked: false, side: 'left' as const },
      { id: 'bj-h3', type: BlockType.HEADING, content: 'Mood', side: 'right' as const, color: 'rose' },
      { id: 'bj-mood', type: BlockType.MOOD_TRACKER, content: '', side: 'right' as const, moodValue: 3, color: 'rose' },
      { id: 'bj-h4', type: BlockType.HEADING, content: 'Habits', side: 'right' as const, color: 'emerald' },
      {
        id: 'bj-habits',
        type: BlockType.HABIT_TRACKER,
        content: '',
        side: 'right' as const,
        color: 'emerald',
        habitTrackerData: {
          habits: ['Water', 'Walk', 'Read'],
          days: 7,
          checked: [
            [false, false, false, false, false, false, false],
            [false, false, false, false, false, false, false],
            [false, false, false, false, false, false, false],
          ],
        },
      },
      {
        id: 'bj-water',
        type: BlockType.WATER_TRACKER,
        content: 'Water Intake',
        side: 'right' as const,
        color: 'sky',
        waterTrackerData: { goal: 8, filled: 0 },
      },
    ] as Block[],
  },
  {
    id: 'weekly',
    title: 'Weekly Review',
    desc: 'Reflection + next-week plan',
    icon: LayoutDashboard,
    blocks: [
      { id: 'wr-h1', type: BlockType.HEADING, content: 'Weekly Review', side: 'left' as const, emphasis: 'bold' as const, color: 'indigo' },
      { id: 'wr-q', type: BlockType.QUOTE, content: 'What worked? What didn\'t? What\'s next?', side: 'left' as const, color: 'indigo' },
      { id: 'wr-h2', type: BlockType.HEADING, content: 'Wins This Week', side: 'left' as const, color: 'emerald' },
      { id: 'wr-w1', type: BlockType.CHECKBOX, content: '', checked: true, side: 'left' as const },
      { id: 'wr-w2', type: BlockType.CHECKBOX, content: '', checked: true, side: 'left' as const },
      { id: 'wr-w3', type: BlockType.CHECKBOX, content: '', checked: true, side: 'left' as const },
      { id: 'wr-h3', type: BlockType.HEADING, content: 'Challenges & Lessons', side: 'left' as const, color: 'rose' },
      { id: 'wr-call', type: BlockType.CALLOUT, content: 'What would I do differently?', side: 'left' as const, color: 'rose' },
      {
        id: 'wr-rating',
        type: BlockType.RATING,
        content: '',
        side: 'left' as const,
        color: 'amber',
        ratingData: { label: 'How was your week?', max: 5, value: 0, style: 'star' },
      },
      { id: 'wr-h4', type: BlockType.HEADING, content: 'Next Week — Priorities', side: 'right' as const, emphasis: 'bold' as const, color: 'indigo' },
      {
        id: 'wr-mx',
        type: BlockType.PRIORITY_MATRIX,
        content: '',
        side: 'right' as const,
        color: 'indigo',
        matrixData: { q1: '', q2: '', q3: '', q4: '' },
      },
      { id: 'wr-h5', type: BlockType.HEADING, content: 'Weekly Schedule', side: 'right' as const, color: 'slate' },
      {
        id: 'wr-week',
        type: BlockType.WEEKLY_VIEW,
        content: '',
        side: 'right' as const,
        color: 'slate',
        weeklyViewData: {
          days: [
            { label: 'Mon', content: '' },
            { label: 'Tue', content: '' },
            { label: 'Wed', content: '' },
            { label: 'Thu', content: '' },
            { label: 'Fri', content: '' },
            { label: 'Sat', content: '' },
            { label: 'Sun', content: '' },
          ],
        },
      },
    ] as Block[],
  },
];

// ─── Toast Component ────────────────────────────────────────
interface ToastData {
  id: number;
  message: string;
  type: 'error' | 'success' | 'undo';
  onUndo?: () => void;
}

const Toast: React.FC<{ toast: ToastData; onDismiss: (id: number) => void }> = ({ toast, onDismiss }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, toast.type === 'undo' ? 5000 : 4000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.type, onDismiss]);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md max-w-sm ${isExiting ? 'toast-exit' : 'toast-enter'
        } ${toast.type === 'error'
          ? 'bg-red-950/90 border-red-800/50 text-red-100'
          : toast.type === 'undo'
            ? 'bg-gray-900/95 border-gray-700/50 text-gray-100'
            : 'bg-emerald-950/90 border-emerald-800/50 text-emerald-100'
        }`}
    >
      {toast.type === 'error' ? (
        <AlertCircle size={18} className="text-red-400 shrink-0" />
      ) : toast.type === 'undo' ? (
        <Undo2 size={18} className="text-gray-400 shrink-0" />
      ) : (
        <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
      )}
      <span className="text-sm font-medium flex-1">{toast.message}</span>
      {toast.onUndo && (
        <button
          onClick={() => {
            toast.onUndo?.();
            setIsExiting(true);
            setTimeout(() => onDismiss(toast.id), 300);
          }}
          className="px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-xs font-bold uppercase tracking-wider transition-colors"
        >
          Undo
        </button>
      )}
      <button
        onClick={() => {
          setIsExiting(true);
          setTimeout(() => onDismiss(toast.id), 300);
        }}
        className="text-white/50 hover:text-white/80 transition-colors shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
};

interface ExportNotebookDocumentProps {
  notebook: Notebook;
  branded: boolean;
  watermarked: boolean;
}

const ExportNotebookDocument: React.FC<ExportNotebookDocumentProps> = ({
  notebook,
  branded,
  watermarked,
}) => {
  const noopUpdatePage = useCallback((_updatedPage: NotebookPage) => {}, []);
  const coverTitle = notebook.title?.trim() || 'Untitled Notebook';
  const pageCount = notebook.pages.length;
  const exportDate = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Resolve the notebook's cover color to an inline gradient so the
  // printed cover page matches the on-screen notebook identity. `coverColor`
  // is stored as a Tailwind class name like `bg-indigo-900`; we map it
  // through `coverColorToHex` because @media print can't reference
  // Tailwind utility classes set at runtime reliably.
  const coverHex = coverColorToHex(notebook.coverColor || 'bg-indigo-900');
  const coverDarkHex = darkenHex(coverHex, 0.65);

  return (
    // NOTE: no aria-hidden — the export tree IS the content readable
    // in the exported PDF. We hide it from on-screen users via
    // `display: none` in globals.css instead.
    <div data-pdf-export-root>
      {/* ── Cover page ───────────────────────────────────── */}
      <section data-pdf-export-page data-pdf-export-cover="true">
        <div
          data-pdf-export-frame
          data-pdf-export-cover-card="true"
          style={{
            backgroundImage: `linear-gradient(155deg, ${coverHex} 0%, ${coverDarkHex} 100%)`,
          }}
        >
          {branded ? (
            <div data-pdf-export-cover-brand>
              <Logo variant="dark" size={40} />
            </div>
          ) : null}

          <div data-pdf-export-cover-body>
            <p data-pdf-export-eyebrow>Notebook</p>
            <h1 data-pdf-export-title>{coverTitle}</h1>
            <p data-pdf-export-subtitle>
              {pageCount} {pageCount === 1 ? 'page' : 'pages'} · Exported {exportDate}
            </p>
          </div>

          <div data-pdf-export-cover-footer>
            {watermarked ? (
              <span data-pdf-export-cover-watermark>Created with Papera</span>
            ) : null}
          </div>
        </div>
      </section>

      {/* ── Content pages ────────────────────────────────── */}
      {notebook.pages.map((page, index) => {
        const rawTitle = page.title?.trim();
        const pageLabel = `Page ${index + 1} of ${pageCount}`;
        // Only show a meaningful left footer label. When the title is
        // empty or already matches the default "Page N" string, fall
        // back to the notebook's cover title so the footer doesn't
        // repeat the page number twice (the previous bug showed
        // "Page 1" on the left and "Page 1 of 1" on the right).
        const defaultPageName = `Page ${index + 1}`.toLowerCase();
        const leftLabel =
          rawTitle && rawTitle.toLowerCase() !== defaultPageName
            ? rawTitle
            : coverTitle;
        return (
          <section key={page.id} data-pdf-export-page>
            <div data-pdf-export-frame>
              {branded ? (
                <div data-pdf-export-header>
                  <Logo variant="light" size={20} />
                  <span>{coverTitle}</span>
                </div>
              ) : null}

              <div data-pdf-export-notebook>
                <NotebookView
                  page={page}
                  onUpdatePage={noopUpdatePage}
                  allPages={notebook.pages}
                  hideChrome
                />
              </div>

              <div data-pdf-export-footer>
                <span>{leftLabel}</span>
                <span>{pageLabel}</span>
              </div>

              {watermarked ? (
                <div data-pdf-export-watermark>Created with Papera</div>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
};

// Persistence keys for last-viewed context (which notebook + page the user
// was on when they left). Lives outside the notebooks payload so it
// survives a full Convex re-sync.
const ACTIVE_CONTEXT_KEY = 'papergrid_active_context';

interface ActiveContext {
  notebookId: string;
  pageIndex: number;
}

function loadActiveContext(): ActiveContext | null {
  try {
    const raw = localStorage.getItem(ACTIVE_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ActiveContext>;
    if (typeof parsed?.notebookId !== 'string') return null;
    if (typeof parsed?.pageIndex !== 'number') return null;
    return { notebookId: parsed.notebookId, pageIndex: parsed.pageIndex };
  } catch {
    return null;
  }
}

function saveActiveContext(ctx: ActiveContext): void {
  try {
    localStorage.setItem(ACTIVE_CONTEXT_KEY, JSON.stringify(ctx));
  } catch {
    // Quota exceeded or disabled — silently drop.
  }
}

// ─── Dashboard ──────────────────────────────────────────────
export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [activeNotebookId, setActiveNotebookId] = useState<string>('');
  const [activePageIndex, setActivePageIndex] = useState<number>(-1);
  // Start TRUE so we render a spinner on mount instead of a blank page
  // while the initial Convex fetch is in flight. On slow accounts (many
  // notebooks), this fetch can take a few seconds and users were
  // previously staring at a white screen.
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  // Focus mode hides every chrome element (sidebar, header, FAB) so the
  // user sees only the notebook spread. Toggled by an icon in the top
  // bar; can be exited with a small floating button or by hitting Esc.
  const [focusMode, setFocusMode] = useState(false);
  // True once the 3D BookCoverScene has painted its first frame. Until
  // then, we hide the DOM overlay (title, color picker, AI Cover CTA,
  // template tiles) so the user never sees them floating over a blank
  // canvas for the 1–2 seconds it takes the chunk + scene to init on
  // first open. Reset every time the active notebook changes.
  const [coverSceneReady, setCoverSceneReady] = useState(false);
  useEffect(() => {
    setCoverSceneReady(false);
  }, [activeNotebookId]);
  // Live ink balance for the sidebar pill. Refreshed on mount + after
  // any AI generation completes.
  const [inkBalance, setInkBalance] = useState<{ subscription: number; purchased: number; total: number; resetAt: string | null } | null>(null);

  // iOS tab bar state
  const [activeTab, setActiveTab] = useState<TabId>('notebooks');
  const native = isNativeApp();
  const { keyboardVisible } = useKeyboardHandler();

  // AI generation approval flow
  const [pendingPages, setPendingPages] = useState<NotebookPage[] | null>(null);
  const [pendingInkCost, setPendingInkCost] = useState(0);

  // Animation states
  const [contentKey, setContentKey] = useState(0);
  const [pageDirection, setPageDirection] = useState<'left' | 'right' | null>(null);

  // 3D animation states
  const [isOpening, setIsOpening] = useState(false);
  const [coverFading, setCoverFading] = useState(false);

  // Sound effects
  const sfx = useSoundEffects();
  const auth = useAuth();
  const convex = useConvexNotebooks();
  const pricing = usePricingConfig();

  const effectivePlan =
    pricing.getPlan((auth.user?.plan ?? 'free') as PricingPlanId) ??
    pricing.getPlan('free');
  const exportUsesBranding = effectivePlan?.brandedExport ?? false;
  const exportUsesWatermark = effectivePlan?.exportWatermark ?? true;

  // User-scoped localStorage key to prevent cross-account data leakage
  const storageKey = auth.user?.id
    ? `${STORAGE_KEY_PREFIX}_${auth.user.id}`
    : STORAGE_KEY_PREFIX;

  // Toast state
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const toastCounter = useRef(0);

  const addToast = useCallback((message: string, type: 'error' | 'success' | 'undo', onUndo?: () => void) => {
    const id = ++toastCounter.current;
    setToasts(prev => [...prev, { id, message, type, onUndo }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Track whether initial load is complete to avoid syncing stale data
  const initialLoadDone = useRef(false);

  // Flag so the sync effect knows it has local-only edits to push up
  // next time it runs (set by the loader when it detects a divergence
  // between localStorage and Convex in favour of local).
  const needsPushUpRef = useRef(false);

  // Load notebooks — MERGE cloud + local, never silently overwrite.
  //
  // The old loader blindly called `saveNotebooksToStorage(storageKey, cloudNbs)`
  // after every cloud fetch. During the Convex outage users kept editing
  // locally (the debounced sync was failing silently), and when Convex
  // came back online the loader overwrote those edits with the stale
  // pre-outage snapshot. This new loader:
  //
  //   1. Fetches BOTH cloud and local in parallel
  //   2. Picks the "winner" as the snapshot with more total pages (best
  //      available proxy for "more recent work" when we don't have
  //      per-doc timestamps)
  //   3. If local wins, sets needsPushUpRef so the next sync uploads it
  //   4. Only writes to localStorage when cloud wins — never overwrites
  //      a richer local snapshot
  useEffect(() => {
    let cancelled = false;
    initialLoadDone.current = false;
    setIsInitialLoading(true);

    const savedContext = loadActiveContext();

    const applyInitial = (nbs: Notebook[]) => {
      if (cancelled) return;
      setNotebooks(nbs);
      const match = savedContext ? nbs.find((n) => n.id === savedContext.notebookId) : null;
      if (match) {
        setActiveNotebookId(match.id);
        const maxIdx = Math.max(-1, match.pages.length - 1);
        setActivePageIndex(Math.min(Math.max(-1, savedContext!.pageIndex), maxIdx));
      } else if (nbs.length > 0) {
        setActiveNotebookId(nbs[0].id);
        setActivePageIndex(-1);
      }
      initialLoadDone.current = true;
      setIsInitialLoading(false);
    };

    // Cheap proxy for "how much content does this snapshot contain?".
    // Notebook count + total page count across all notebooks. Whichever
    // snapshot has more wins the conflict. Not perfect (doesn't notice
    // edits to existing pages) but strictly better than "cloud always
    // wins" which destroyed data.
    const totalWork = (nbs: Notebook[] | null | undefined): number => {
      if (!nbs || nbs.length === 0) return 0;
      let total = nbs.length;
      for (const nb of nbs) total += nb.pages.length;
      return total;
    };

    const load = async () => {
      // Fetch both snapshots in parallel. Neither throws — each returns
      // null on failure so we can reason about which source we trust.
      const [cloudNbs, localNbs] = await Promise.all([
        auth.isAuthenticated
          ? convex.loadNotebooks().catch((e) => {
              console.error('Failed to load from Convex:', e);
              return null;
            })
          : Promise.resolve(null),
        loadNotebooksFromStorage(storageKey).catch(() => null),
      ]);

      if (cancelled) return;

      const cloudWork = totalWork(cloudNbs);
      const localWork = totalWork(localNbs);

      // Case A: local has more content than cloud → there are local-only
      // edits (likely made during an outage). Trust local AND flag the
      // sync effect to push it up.
      if (localWork > cloudWork && localNbs && localNbs.length > 0) {
        if (cloudWork > 0) {
          // Loud warning so the user can see it in the dev tools if the
          // symptom repeats. We deliberately do NOT addToast here because
          // it's informational, not an error.
          console.warn(
            `[Dashboard] localStorage has more data (${localWork} items) than Convex (${cloudWork}). Using local and scheduling push-up.`,
          );
        }
        applyInitial(localNbs);
        if (auth.isAuthenticated && cloudWork < localWork) {
          needsPushUpRef.current = true;
        }
        return;
      }

      // Case B: cloud has as much or more than local → trust cloud.
      // ONLY write to localStorage if cloud is strictly richer, so a
      // reload right after a brief outage doesn't nuke fresh local data.
      if (cloudNbs && cloudNbs.length > 0) {
        applyInitial(cloudNbs);
        if (cloudWork > localWork) {
          void saveNotebooksToStorage(storageKey, cloudNbs).catch(() => {});
        }
        return;
      }

      // Case C: cloud is empty, but local has something → use local.
      if (localNbs && localNbs.length > 0) {
        applyInitial(localNbs);
        if (auth.isAuthenticated) {
          needsPushUpRef.current = true;
        }
        return;
      }

      // Case D: nothing anywhere → create default welcome notebook.
      const defaultNb: Notebook = {
        id: 'nb-1',
        title: 'My Journal',
        coverColor: 'bg-indigo-900',
        createdAt: new Date().toISOString(),
        bookmarks: [],
        pages: [{
          id: 'init-1',
          title: 'Welcome',
          createdAt: new Date().toISOString(),
          paperType: 'lined',
          blocks: [
            { id: 'b1', type: BlockType.HEADING, content: 'Welcome to Papera', side: 'left' },
            { id: 'b2', type: BlockType.TEXT, content: 'This is a digital notebook that feels real. The text sits right on the lines.', side: 'left' },
            { id: 'b3', type: BlockType.CHECKBOX, content: 'Try the AI Generator for structured layouts', checked: false, side: 'right' },
          ]
        }]
      };
      applyInitial([defaultNb]);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [auth.isAuthenticated, storageKey]);

  // Persist the user's current context on every change so a reload
  // drops them back where they were. Previously the state always reset
  // to "first notebook, cover page" which felt like "lost my place."
  useEffect(() => {
    if (!initialLoadDone.current) return;
    if (!activeNotebookId) return;
    saveActiveContext({ notebookId: activeNotebookId, pageIndex: activePageIndex });
  }, [activeNotebookId, activePageIndex]);

  // Fetch the user's current ink balance for the sidebar pill. Refreshes
  // on mount + whenever the auth user changes (login/logout).
  const fetchInkBalance = useCallback(async () => {
    if (!auth.isAuthenticated) {
      setInkBalance(null);
      return;
    }
    const token = localStorage.getItem('papergrid_session');
    if (!token) return;
    try {
      const apiBase = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiBase}/api/ink/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { subscription: number; purchased: number; total: number; resetAt: string | null };
      setInkBalance(data);
    } catch {
      // Silent — the wallet pill just won't show
    }
  }, [auth.isAuthenticated]);
  useEffect(() => {
    void fetchInkBalance();
  }, [fetchInkBalance]);

  // Esc to exit focus mode. Bound at the window level so it works
  // regardless of which child has focus.
  useEffect(() => {
    if (!focusMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFocusMode(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusMode]);

  // Open the Stripe Customer Billing Portal so the user can manage /
  // cancel their subscription. Falls back to navigating /pricing if
  // they're not actually subscribed yet (404 from the backend).
  const openBillingPortal = useCallback(async () => {
    const token = localStorage.getItem('papergrid_session');
    if (!token) {
      navigate('/login');
      return;
    }
    try {
      const apiBase = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiBase}/api/billing/portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.status === 404) {
        navigate('/pricing');
        return;
      }
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        addToast(detail?.error || 'Could not open billing portal', 'error');
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (data.url) window.location.href = data.url;
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Network error', 'error');
    }
  }, [addToast, navigate]);

  // Save to localStorage (user-scoped) on every change
  useEffect(() => {
    if (notebooks.length > 0 && initialLoadDone.current) {
      void saveNotebooksToStorage(storageKey, notebooks).catch((error) => {
        console.error('Failed to persist notebooks:', error);
        addToast('Could not save notebook changes locally.', 'error');
      });
    }
  }, [addToast, notebooks, storageKey]);

  // Sync ALL notebooks to Convex (debounced, remap IDs)
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Hold the freshest notebooks snapshot in a ref so the unload flush
  // handler (which can't re-subscribe to state) always sees current data.
  const notebooksRef = useRef<Notebook[]>(notebooks);
  useEffect(() => {
    notebooksRef.current = notebooks;
  }, [notebooks]);
  useEffect(() => {
    if (!auth.isAuthenticated || notebooks.length === 0 || !initialLoadDone.current) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    // If the loader detected local-only edits that need to be pushed up
    // (e.g. after the Convex outage), skip the debounce and fire the
    // sync on the next tick so stale cloud state can't race the user
    // closing the tab.
    //
    // BUG HISTORY: previously the `delay` variable was computed but
    // never used — the setTimeout at the bottom of this block
    // hardcoded `3000`, so the immediate-push-up recovery path never
    // took effect. Users who hit the "cloud is behind local" branch
    // in the loader still waited the full 3s debounce, which made
    // the whole safeguard a no-op. Now the computed `delay` is
    // actually passed to setTimeout below.
    const delay = needsPushUpRef.current ? 0 : 3000;
    needsPushUpRef.current = false;
    syncTimerRef.current = setTimeout(async () => {
      const results = await convex.syncAllNotebooks(notebooks);
      // Reconcile local state against the server's authoritative snapshot:
      //   - notebook.id  → may have changed (new notebook just created)
      //   - bookmarks    → page IDs were remapped server-side because we
      //                    delete/recreate pages on each save (see http.ts
      //                    /api/notebooks/save). Without this, bookmarks
      //                    disappear on the next reload.
      //   - page.id      → ALSO remapped server-side via pageIdMap. Without
      //                    translating local page ids to their new server
      //                    ids, the UI's bookmark filter
      //                    `pages.filter(p => bookmarks.includes(p.id))`
      //                    silently fails between saves and reloads — pages
      //                    still carry stale local ids while bookmarks
      //                    already hold the fresh server ids.
      if (results.size > 0) {
        setNotebooks(prev => prev.map(nb => {
          const result = results.get(nb.id);
          if (!result) return nb;
          const next: typeof nb = { ...nb };
          if (result.id && result.id !== nb.id) next.id = result.id;
          if (result.bookmarks) next.bookmarks = result.bookmarks;
          if (result.pageIdMap && Object.keys(result.pageIdMap).length > 0) {
            const map = result.pageIdMap;
            next.pages = next.pages.map(p => ({
              ...p,
              id: map[p.id] ?? p.id,
            }));
          }
          return next;
        }));
        setActiveNotebookId(prev => {
          const result = results.get(prev);
          return result?.id ?? prev;
        });
      }
    }, delay);
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [auth.isAuthenticated, notebooks]);

  // Flush any pending debounced sync before the tab closes / hides.
  // Without this, users who hit reload within 3 seconds of editing a
  // notebook lost the most recent changes (including newly added
  // bookmarks) because the debounced sync never got a chance to fire.
  // We also flush on `visibilitychange → hidden` which covers tab
  // switching and mobile backgrounding.
  useEffect(() => {
    if (!auth.isAuthenticated) return;
    const flushNow = () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      const snapshot = notebooksRef.current;
      if (snapshot.length === 0 || !initialLoadDone.current) return;
      // Fire-and-forget — browser may kill the tab before the request
      // lands, but it gives us a chance in the common case.
      void convex.syncAllNotebooks(snapshot).catch(() => {});
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushNow();
    };
    window.addEventListener('beforeunload', flushNow);
    window.addEventListener('pagehide', flushNow);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', flushNow);
      window.removeEventListener('pagehide', flushNow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [auth.isAuthenticated, convex]);

  const activeNotebook = notebooks.find(n => n.id === activeNotebookId) || notebooks[0];
  const activePage = activeNotebook && activePageIndex >= 0 && activePageIndex < activeNotebook.pages.length
    ? activeNotebook.pages[activePageIndex]
    : null;

  // Quiet skeleton shown WHILE the lazy-loaded BookCoverScene chunk is
  // fetching. Previously this rendered a full flat cover with the title,
  // which then "flashed" out as the 3D cover faded in — users saw
  // "New Notebook" twice in the first 50–500ms after opening the app.
  // The new fallback is a uniform dark book-shaped placeholder with a
  // subtle pulse and NO title text, so the 3D scene appears as a clean
  // fade-in instead of replacing duplicate content.
  const renderCoverSkeleton = () => (
    <div className="w-full h-full max-h-[800px] flex items-center justify-center pointer-events-none">
      <div
        className="relative rounded-2xl overflow-hidden shadow-2xl animate-pulse"
        style={{
          width: 'min(85%, 520px)',
          aspectRatio: '3 / 4',
          background: 'linear-gradient(135deg, #1e1e24 0%, #2a2a32 50%, #1e1e24 100%)',
        }}
      >
        {/* Spine darken */}
        <div className="absolute left-0 top-0 bottom-0 w-10 bg-black/30" />
        {/* Soft inner highlight to suggest the 3D shape that's loading */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/30" />
      </div>
    </div>
  );

  // The "real" flat cover. Used by the Canvas3DErrorBoundary as a HARD
  // fallback if WebGL fails or the chunk errors — that path needs the
  // editable title because the 3D renderer is permanently unavailable.
  const renderFlatCoverFallback = () => (
    <div
      className={`w-full h-full max-h-[800px] ${activeNotebook.coverColor} rounded-r-3xl rounded-l-md shadow-2xl relative cursor-pointer group transition-transform duration-300 hover:scale-[1.01] overflow-hidden`}
      onClick={activeNotebook.pages.length > 0 ? handleOpenCover : undefined}
    >
      {activeNotebook.coverImageUrl && (
        <>
          <div
            className="absolute inset-0 bg-center bg-cover"
            style={{ backgroundImage: `url("${activeNotebook.coverImageUrl}")` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/45" />
        </>
      )}
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-black/20 rounded-l-md border-r border-white/10" />
      <div className="absolute left-10 top-0 bottom-0 w-px bg-white/20" />
      <div className="absolute inset-0 flex flex-col items-center justify-center p-8 md:p-12 text-center">
        <input
          className="bg-transparent text-white/90 text-4xl md:text-6xl font-serif font-bold text-center border-b border-transparent hover:border-white/30 focus:border-white/50 focus:outline-none transition-colors w-full"
          value={activeNotebook.title}
          onChange={(e) => {
            setNotebooks(prev => prev.map(nb => nb.id === activeNotebookId ? { ...nb, title: e.target.value } : nb));
          }}
          onClick={(e) => e.stopPropagation()}
        />
        <div className="mt-6 text-white/60 font-sans tracking-widest uppercase text-sm">
          {activeNotebook.pages.length} Spreads
        </div>
        {activeNotebook.pages.length > 0 && (
          <div className="mt-8 opacity-0 group-hover:opacity-100 transition-opacity text-white/80 flex items-center gap-2 bg-black/20 px-4 py-2 rounded-full">
            <span>Click to open</span>
            <ChevronRight size={16} />
          </div>
        )}
      </div>
    </div>
  );

  const handleUpdatePage = (updatedPage: NotebookPage) => {
    setNotebooks(prev => prev.map(nb => {
      if (nb.id !== activeNotebookId) return nb;
      return {
        ...nb,
        pages: nb.pages.map(p => p.id === updatedPage.id ? updatedPage : p)
      };
    }));
  };

  const handleNewNotebook = async () => {
    const newNb: Notebook = {
      id: crypto.randomUUID(),
      title: 'New Notebook',
      coverColor: COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)],
      createdAt: new Date().toISOString(),
      bookmarks: [],
      pages: []
    };
    // Optimistic: add immediately for snappy UX.
    // CRITICAL: use functional setState so we don't capture a stale
    // `notebooks` closure. When this runs right after handleDeleteNotebook
    // (which calls setNotebooks(remaining)), the plain `notebooks` ref
    // still points at the pre-delete list — and spreading that would
    // resurrect the deleted notebook alongside the new one.
    setNotebooks(prev => [newNb, ...prev]);
    setActiveNotebookId(newNb.id);
    setActivePageIndex(-1);
    setContentKey(k => k + 1);

    // Validate against the server's plan-limit enforcement. If we hit the
    // notebook cap, roll back and show the real error message verbatim.
    if (!auth.isAuthenticated) return; // signed-out users only ever have local state
    try {
      const result = await convex.saveNotebook(newNb);
      if (result && result.id && result.id !== newNb.id) {
        setNotebooks(prev => prev.map(nb => nb.id === newNb.id ? { ...nb, id: result.id } : nb));
        setActiveNotebookId(prev => prev === newNb.id ? result.id : prev);
      }
    } catch (e: unknown) {
      const err = e as Error & { code?: string };
      if (err?.code === 'plan_limit') {
        // Roll back the optimistic add. Use functional form for the
        // same closure-safety reason as above.
        setNotebooks(prev => prev.filter(nb => nb.id !== newNb.id));
        setActiveNotebookId(prev => {
          if (prev !== newNb.id) return prev;
          // Fall back to any remaining notebook in current state.
          const remaining = notebooksRef.current.filter(nb => nb.id !== newNb.id);
          return remaining[0]?.id ?? '';
        });
        addToast(err.message, 'error');
      } else {
        // Other errors: leave the local copy alone, the next debounced sync retries.
        console.warn('saveNotebook failed (non-plan-limit):', err);
      }
    }
  };

  const handleSwitchNotebook = (nbId: string) => {
    if (nbId === activeNotebookId) return;
    setContentKey(k => k + 1);
    setActiveNotebookId(nbId);
    setActivePageIndex(-1);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleDeleteNotebook = async (nbId: string) => {
    const nb = notebooks.find(n => n.id === nbId);
    if (!nb) return;

    // Optimistic local removal via functional setState (never touch the
    // stale `notebooks` closure — see the matching comment in
    // handleNewNotebook).
    setNotebooks(prev => prev.filter(n => n.id !== nbId));

    const wasActive = activeNotebookId === nbId;
    if (wasActive) {
      // Switch to the next surviving notebook immediately so the UI
      // never dangles on a deleted id. If nothing survives we defer
      // the auto-recreate until AFTER the server delete succeeds to
      // avoid a plan_limit race on the free tier (create would be
      // rejected because the server still sees the old notebook).
      const fallback = notebooksRef.current.find(n => n.id !== nbId);
      if (fallback) {
        setActiveNotebookId(fallback.id);
      }
      setActivePageIndex(-1);
    }
    setDeleteConfirmId(null);

    // Delete from Convex. We MUST await this before creating a
    // replacement notebook so the server-side plan-limit probe sees
    // the old one as tombstoned.
    const ok = await convex.deleteNotebook(nbId);
    if (ok) {
      addToast(`"${nb.title || 'Untitled'}" deleted`, 'success');
    } else {
      addToast('Deleted locally (cloud sync pending)', 'success');
    }

    // Auto-create a fresh welcome notebook when the user just deleted
    // their last one. Runs AFTER the server delete completes so the
    // plan-limit check on /api/notebooks/save sees zero active rows.
    if (wasActive && notebooksRef.current.length === 0) {
      await handleNewNotebook();
    }

    // Reconcile against the authoritative cloud snapshot. If an earlier
    // stale-closure bug (now fixed) left the user with a ghost notebook
    // in local state, this is their recovery path: once the deleted row
    // is really gone on the server, pull the authoritative list and
    // overwrite local state so the sidebar finally matches reality.
    if (auth.isAuthenticated) {
      try {
        const cloud = await convex.loadNotebooks();
        if (cloud && cloud.length > 0) {
          setNotebooks(cloud);
          // If the previously-active id no longer exists (because it
          // was a ghost), fall through to the first cloud notebook.
          setActiveNotebookId(prev =>
            cloud.some(n => n.id === prev) ? prev : cloud[0].id,
          );
          void saveNotebooksToStorage(storageKey, cloud).catch(() => {});
        }
      } catch {
        // Silent — next debounced sync will eventually reconcile.
      }
    }
  };

  const handleNewPage = (templateBlocks?: Block[]) => {
    const newPage: NotebookPage = {
      id: crypto.randomUUID(),
      title: '',
      createdAt: new Date().toISOString(),
      paperType: 'lined',
      blocks: templateBlocks ? templateBlocks.map(b => ({ ...b, id: crypto.randomUUID() })) : []
    };
    setNotebooks(prev => {
      const updated = prev.map(nb => {
        if (nb.id !== activeNotebookId) return nb;
        return { ...nb, pages: [...nb.pages, newPage] };
      });
      const nb = updated.find(n => n.id === activeNotebookId);
      if (nb) {
        setPageDirection('right');
        setActivePageIndex(nb.pages.length - 1);
      }
      return updated;
    });
  };

  const handlePageBack = () => {
    if (activePageIndex <= -1) return;
    setPageDirection('left');
    setActivePageIndex(prev => Math.max(-1, prev - 1));
    sfx.pageFlip();
  };

  const handlePageForward = () => {
    if (!activeNotebook || activePageIndex >= activeNotebook.pages.length - 1) return;
    setPageDirection('right');
    setActivePageIndex(prev => prev + 1);
    sfx.pageFlip();
  };

  // Flat fallback cover: instant open (no 3D loaded yet)
  const handleOpenCover = () => {
    if (!activeNotebook || activeNotebook.pages.length === 0) return;
    setPageDirection('right');
    setActivePageIndex(0);
    sfx.pageFlip();
  };

  // 3D cover: trigger open animation (with safety timeout)
  const openTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleOpen3DCover = useCallback(() => {
    if (!activeNotebook || activeNotebook.pages.length === 0) return;
    setIsOpening(true);
    // Safety: if 3D animation doesn't complete in 2s, force-open anyway
    if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current);
    openTimeoutRef.current = setTimeout(() => {
      setIsOpening(false);
      setCoverFading(false);
      setPageDirection('right');
      setActivePageIndex(0);
    }, 2000);
  }, [activeNotebook]);

  // 3D cover animation complete → fade out 3D, then switch to page view
  const handleCoverOpenComplete = useCallback(() => {
    // Cancel safety timeout — animation completed normally
    if (openTimeoutRef.current) {
      clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }
    setIsOpening(false);
    setCoverFading(true);
    setTimeout(() => {
      setCoverFading(false);
      setPageDirection('right');
      setActivePageIndex(0);
    }, 400);
  }, []);

  // Focus mode is a pure "hide all chrome" toggle. It NEVER moves the
  // user between cover and pages on its own — if they're on the closed
  // cover, they stay on the closed cover (just without the title input,
  // color picker, AI cover button, templates grid, or Open Notebook CTA).
  // If they're on a page, they stay on that page. Exit is via the Esc key
  // or the floating "Exit focus" pill.
  const handleEnterFocusMode = useCallback(() => {
    setFocusMode(true);
  }, []);

  const handleAiGeneration = async (prompt: string, industry?: string, aesthetic?: string, pageCount?: string) => {
    try {
      // Build context from last 5 existing pages so AI can continue intelligently
      const activeNb = notebooks.find(n => n.id === activeNotebookId);
      let existingPageCtx: ExistingPageContext[] | undefined;
      if (activeNb && activeNb.pages.length > 0) {
        const lastPages = activeNb.pages.slice(-5);
        existingPageCtx = lastPages.map(p => ({
          title: p.title,
          paperType: p.paperType,
          themeColor: p.themeColor || 'slate',
          blockSummary: p.blocks.slice(0, 6).map(b => `${b.type}${b.content ? `: "${b.content.slice(0, 40)}"` : ''}`).join(', '),
        }));
      }

      const generatedPages = await generateLayout(prompt, industry, aesthetic, existingPageCtx, pageCount);
      const newPages: NotebookPage[] = generatedPages.map(layout => ({
        id: crypto.randomUUID(),
        title: layout.title,
        createdAt: new Date().toISOString(),
        paperType: layout.paperType,
        blocks: layout.blocks,
        aesthetic: aesthetic || 'modern-planner',
        themeColor: layout.themeColor,
        aiGenerated: true,
      }));

      // Show approval dialog — user decides whether to add pages
      setPendingPages(newPages);
      setPendingInkCost(newPages.length); // 1 Ink per page
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate layout.';
      addToast(message, 'error');
    }
  };

  // Approve generated pages — add them to notebook
  const approveGeneratedPages = () => {
    if (!pendingPages) return;
    const newPages = pendingPages;
    setNotebooks(prev => {
      const updated = prev.map(nb => {
        if (nb.id !== activeNotebookId) return nb;
        return { ...nb, pages: [...nb.pages, ...newPages] };
      });
      const nb = updated.find(n => n.id === activeNotebookId);
      if (nb) {
        setPageDirection('right');
        setActivePageIndex(nb.pages.length - newPages.length);
      }
      return updated;
    });
    addToast(
      newPages.length > 1
        ? `Added ${newPages.length} pages (${pendingInkCost} Ink used)`
        : 'Page added (1 Ink used)',
      'success'
    );
    setPendingPages(null);
    setPendingInkCost(0);
  };

  // Decline generated pages — discard without adding
  const declineGeneratedPages = () => {
    setPendingPages(null);
    setPendingInkCost(0);
    addToast('Generation discarded — no Ink charged', 'success');
  };

  const toggleBookmark = () => {
    if (!activePage) return;
    setNotebooks(prev => prev.map(nb => {
      if (nb.id !== activeNotebookId) return nb;
      const bookmarks = nb.bookmarks ?? [];
      const isBookmarked = bookmarks.includes(activePage.id);
      return {
        ...nb,
        bookmarks: isBookmarked
          ? bookmarks.filter(id => id !== activePage.id)
          : [...bookmarks, activePage.id]
      };
    }));
  };

  const handleExportPdf = async () => {
    // Programmatic PDF export via html-to-image + jsPDF.
    //
    // Why NOT html2pdf.js (previous attempt)?
    //   html2pdf.js uses html2canvas internally, and html2canvas has a
    //   hard blocker: it CANNOT parse the `oklab()` / `oklch()` CSS
    //   color functions that Tailwind v4 uses throughout its default
    //   palette. Every `.text-gray-700`, `.bg-rose-50`, etc resolved
    //   to `oklch(...)` at runtime, and html2canvas threw
    //   "Attempting to parse an unsupported color function 'oklab'"
    //   the moment it walked into any styled element.
    //
    // Why NOT window.print()?
    //   Browser print dialogs require the user to uncheck "Headers and
    //   footers" and enable "Background graphics" — per-device
    //   preferences we can't force from CSS.
    //
    // Why html-to-image?
    //   It uses a different rasterization strategy that correctly
    //   handles modern CSS color functions (oklab, oklch, lab, lch,
    //   color()). Drop-in replacement for html2canvas with a cleaner
    //   API and active maintenance.
    //
    // Why manual jsPDF composition?
    //   html-to-image only rasterizes — it doesn't wrap in PDF. We
    //   rasterize each [data-pdf-export-page] section separately,
    //   then add each PNG as a new page in a jsPDF document. This
    //   gives us per-page control and clean A4 pagination.
    //
    // Flow
    //   1. Set isExportingPdf=true → renders the loading modal overlay
    //      that hides the dashboard and blocks user input.
    //   2. Add body.papera-exporting class → activates the off-screen
    //      export tree at left: -99999px.
    //   3. Dynamic import html-to-image + jsPDF (~400KB combined,
    //      only loaded on first export).
    //   4. Wait two animation frames so layout settles.
    //   5. For each <section data-pdf-export-page>, rasterize to PNG
    //      via toPng(). Update progress state between pages.
    //   6. Compose all PNGs into a jsPDF document at A4 dimensions.
    //   7. Save the PDF → browser download.
    //   8. Always clean up: remove body class, reset state, clear
    //      progress, even on error.

    if (!activeNotebook) return;
    if (activeNotebook.pages.length === 0) {
      addToast('Add at least one page before exporting.', 'error');
      return;
    }

    setIsExportingPdf(true);
    setExportProgress({ current: 0, total: activeNotebook.pages.length + 1 });
    document.body.classList.add('papera-exporting');

    // Declared outside the try so the `finally` block can always
    // restore inline color overrides, even if rasterization throws.
    let restoreColors: (() => void) | null = null;

    try {
      // Dynamic imports — the ~400KB of PDF libraries only load on
      // first export, keeping the dashboard initial bundle small.
      //
      // We use toJpeg (not toPng) because jsPDF's PNG parser throws
      // "wrong PNG signature" on some html-to-image PNG outputs,
      // particularly on Safari and certain Chrome builds. JPEG is a
      // much more lenient format for PDF embedding, produces smaller
      // output, and since we force a white backgroundColor on every
      // snapshot we don't need PNG's alpha channel anyway.
      const [{ toJpeg }, { jsPDF }] = await Promise.all([
        import('html-to-image'),
        import('jspdf'),
      ]);

      // Two animation frames so flex layout, paper textures, and any
      // GSAP-driven transforms settle before the snapshot. html-to-image
      // reads computed styles synchronously so the DOM must be in its
      // final visual state before we call toPng().
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));

      const exportRoot = document.querySelector<HTMLElement>(
        '[data-pdf-export-root]',
      );
      if (!exportRoot) {
        throw new Error('Export root not found in DOM');
      }

      // Proactively replace every `oklab()` / `oklch()` computed color
      // inside the export tree with an `rgb(...)` equivalent via an
      // off-screen canvas. This is belt-and-braces: html-to-image
      // should handle modern colors, but its foreignObject → SVG →
      // canvas path trips on them in some Chrome builds. Normalizing
      // first guarantees the snapshot can't fail for color reasons.
      // The returned `restoreColors` callback undoes every inline
      // override so the dashboard UI isn't mutated after export.
      // Assigned to the outer-scope variable so `finally` can call it.
      restoreColors = normalizeExportColors(exportRoot);

      const pageSections = Array.from(
        exportRoot.querySelectorAll<HTMLElement>('[data-pdf-export-page]'),
      );
      if (pageSections.length === 0) {
        throw new Error('No pages to export');
      }

      // A4 dimensions in points for jsPDF (595.28 × 841.89 pt).
      // Using points (pt) is more reliable than mm across jsPDF
      // versions and avoids float-rounding errors on page size.
      const pdf = new jsPDF({
        unit: 'pt',
        format: 'a4',
        orientation: 'portrait',
        compress: true,
      });
      const pdfWidthPt = pdf.internal.pageSize.getWidth();
      const pdfHeightPt = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < pageSections.length; i++) {
        const section = pageSections[i];
        setExportProgress({ current: i + 1, total: pageSections.length });

        // pixelRatio: 2 gives retina-quality raster on high-DPI
        // displays without blowing up file size for 4K monitors.
        // quality: 0.95 is visually lossless for text/diagrams while
        // keeping the PDF well under 1 MB per page.
        const dataUrl = await toJpeg(section, {
          pixelRatio: 2,
          cacheBust: true,
          backgroundColor: '#ffffff',
          quality: 0.95,
          // Filter out any stray nodes that shouldn't be in the PDF
          // (e.g. React devtools hooks, stale modals).
          filter: (node) => {
            if (!(node instanceof HTMLElement)) return true;
            const skip = node.getAttribute('data-no-export');
            return skip !== 'true';
          },
        });

        // Defensive check: html-to-image occasionally returns an empty
        // string or a non-image data URL when the DOM tree is in a
        // transient state. Fail loudly with a useful error instead of
        // letting jsPDF throw "wrong JPEG" / "wrong PNG signature".
        if (!dataUrl || !dataUrl.startsWith('data:image/jpeg')) {
          throw new Error(
            `Snapshot for page ${i + 1} is not a valid JPEG (got: ${dataUrl?.slice(0, 32) || 'empty'}...)`,
          );
        }

        if (i > 0) pdf.addPage();
        // Fit the snapshot inside the page — same width, proportional
        // height. If the snapshot is taller than a page it gets
        // clipped; callers should keep each section under one A4
        // sheet's worth of content (which our CSS enforces via
        // min-height constraints).
        pdf.addImage(
          dataUrl,
          'JPEG',
          0,
          0,
          pdfWidthPt,
          pdfHeightPt,
          undefined,
          'FAST',
        );
      }

      const safeFilename =
        (activeNotebook.title?.trim() || 'notebook')
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .toLowerCase() + '.pdf';

      pdf.save(safeFilename);

      addToast('PDF downloaded.', 'success');
    } catch (error) {
      console.error('PDF export failed:', error);
      const message =
        error instanceof Error ? error.message : 'PDF export failed';
      addToast(message, 'error');
    } finally {
      // Always clean up regardless of outcome. The dashboard should
      // never be left in "exporting" mode with a frozen modal or with
      // inline color overrides stuck on hundreds of elements.
      if (restoreColors) {
        try {
          restoreColors();
        } catch (restoreError) {
          // Swallow — failing to restore would just leave a few
          // inline rgb(...) values on the DOM which is harmless.
          console.warn('Failed to restore colors after export:', restoreError);
        }
      }
      document.body.classList.remove('papera-exporting');
      setIsExportingPdf(false);
      setExportProgress(null);
    }
  };

  // Undo handler for block deletion
  const handleBlockDeleted = useCallback((block: Block, index: number) => {
    addToast('Block deleted', 'undo', () => {
      setNotebooks(prev => prev.map(nb => {
        if (nb.id !== activeNotebookId) return nb;
        return {
          ...nb,
          pages: nb.pages.map(p => {
            if (p.id !== activePage?.id) return p;
            const newBlocks = [...p.blocks];
            newBlocks.splice(index, 0, block);
            return { ...p, blocks: newBlocks };
          })
        };
      }));
    });
  }, [activeNotebookId, activePage?.id, addToast]);

  const handleCoverColorChange = (color: string) => {
    setNotebooks(prev => prev.map(nb => nb.id === activeNotebookId ? { ...nb, coverColor: color } : nb));
  };

  const handleRemoveCoverImage = () => {
    setNotebooks(prev => prev.map(nb => nb.id === activeNotebookId ? { ...nb, coverImageUrl: undefined } : nb));
  };

  const getPageAnimClass = () => {
    if (pageDirection === 'left') return 'anim-slide-left';
    if (pageDirection === 'right') return 'anim-slide-right';
    return 'anim-content-swap';
  };

  // Filter notebooks by search
  const filteredNotebooks = sidebarSearch
    ? notebooks.filter(nb => nb.title.toLowerCase().includes(sidebarSearch.toLowerCase()))
    : notebooks;

  // Bookmarked pages for active notebook
  const bookmarkedPages = activeNotebook
    ? activeNotebook.pages.filter(p => (activeNotebook.bookmarks ?? []).includes(p.id))
    : [];

  // Page indicator label
  const getPageLabel = () => {
    if (!activeNotebook) return '';
    if (activePageIndex === -1) return 'Cover';
    if (activePageIndex >= activeNotebook.pages.length) return 'End';
    return `Page ${activePageIndex + 1} of ${activeNotebook.pages.length}`;
  };

  // iOS tab bar handler
  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab);
    if (tab === 'create') {
      setIsGeneratorOpen(true);
    } else if (tab === 'ink') {
      navigate('/pricing');
    }
  }, [navigate]);

  // Show a loading state while the initial Convex/localStorage load is in
  // flight. Previously we returned null here, which rendered a blank
  // white page for up to several seconds on accounts with many notebooks.
  if (isInitialLoading || !activeNotebook) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-[3px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-500 font-medium">Loading your notebooks…</p>
      </div>
    );
  }

  return (
    <>
      <div
        data-dashboard-shell
        className="flex h-dvh w-full bg-[#f0f2f5] font-sans text-gray-900 overflow-hidden anim-fade-in"
      >
      {/* Sidebar backdrop (mobile) — hidden on native iOS (uses tab bar) */}
      {!native && isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-10 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar — hidden on native iOS (replaced by tab bar navigation)
          AND hidden when focus mode is active (user wants notebook only). */}
      <aside
        className={`${native || focusMode ? 'hidden' : isSidebarOpen ? 'w-72 translate-x-0' : 'w-0 -translate-x-full'}
        bg-[#1a1c23] text-gray-300 transition-all duration-300 ease-in-out flex flex-col border-r border-gray-800 absolute z-20 md:relative h-full shadow-2xl overflow-hidden`}
      >
        <div className="p-5 flex items-center text-white border-b border-gray-800/50">
          {/* Same brand Logo component used by the landing page navbar /
              footer. Dark variant gives the cyan glow that pops on the
              sidebar's near-black background. */}
          <Logo variant="dark" size={32} />
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {/* Search */}
          <div className="px-1 mb-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-gray-500" />
              <input
                className="w-full pl-9 pr-3 py-2 bg-gray-800/60 border border-gray-700/50 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-gray-600 transition-colors"
                placeholder="Search notebooks..."
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="px-3 mb-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Notebooks</div>
          {filteredNotebooks.map(nb => (
            <div key={nb.id} className="relative group/nb">
              {deleteConfirmId === nb.id ? (
                /* Delete confirmation inline */
                <div className="px-3 py-2.5 rounded-lg bg-red-950/60 border border-red-800/40 space-y-2">
                  <div className="text-xs text-red-300">Delete "{nb.title || 'Untitled'}"?</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDeleteNotebook(nb.id)}
                      className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-medium transition-colors"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSwitchNotebook(nb.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSwitchNotebook(nb.id); } }}
                  className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all duration-200 cursor-pointer ${activeNotebookId === nb.id
                    ? 'bg-gray-800 text-white shadow-md border border-gray-700'
                    : 'hover:bg-gray-800/50 hover:text-gray-100'
                    }`}
                >
                  <div
                    className={`w-4 h-6 rounded-sm ${nb.coverColor} shadow-sm border border-white/10 bg-cover bg-center shrink-0`}
                    style={nb.coverImageUrl ? { backgroundImage: `url("${nb.coverImageUrl}")` } : undefined}
                  />
                  <div className="overflow-hidden flex-1">
                    <div className="truncate font-medium text-sm">{nb.title || "Untitled"}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1.5">
                      <span>{nb.pages.length} spreads</span>
                      {(nb.bookmarks ?? []).length > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-amber-500">
                          <Bookmark size={8} fill="currentColor" />
                          <span>{nb.bookmarks.length}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  {nb.pages.some(p => p.aiGenerated) && (
                    <Sparkles size={12} className="text-indigo-400 shrink-0" />
                  )}
                  {/* Delete button — appears on hover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmId(nb.id);
                    }}
                    className="opacity-0 group-hover/nb:opacity-100 p-1 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-all shrink-0"
                    title="Delete notebook"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Bookmarks Section (sidebar list) */}
          {bookmarkedPages.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowBookmarks(!showBookmarks)}
                className="w-full px-3 mb-2 text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 hover:text-gray-400 transition-colors"
              >
                <Bookmark size={12} />
                <span>Bookmarks ({bookmarkedPages.length})</span>
                <ChevronRight size={12} className={`ml-auto transition-transform ${showBookmarks ? 'rotate-90' : ''}`} />
              </button>
              {showBookmarks && (
                <div className="space-y-0.5">
                  {bookmarkedPages.map(p => {
                    const pageIdx = activeNotebook.pages.findIndex(pg => pg.id === p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          setPageDirection('right');
                          setActivePageIndex(pageIdx);
                          if (window.innerWidth < 768) setIsSidebarOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800/50 hover:text-gray-200 transition-colors flex items-center gap-2"
                      >
                        <Bookmark size={12} className="text-amber-500 shrink-0" fill="currentColor" />
                        <span className="truncate">{p.title || `Spread ${pageIdx + 1}`}</span>
                        {p.aiGenerated && <Sparkles size={10} className="text-indigo-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-800/50 space-y-3">
          {/* Ink balance pill — clickable to navigate to /pricing for refill */}
          {auth.user && inkBalance && (
            <button
              onClick={() => navigate('/pricing')}
              className="w-full px-3 py-2.5 bg-gradient-to-br from-sky-500/10 to-indigo-500/10 hover:from-sky-500/20 hover:to-indigo-500/20 border border-sky-500/20 hover:border-sky-400/40 rounded-xl flex items-center gap-2.5 transition-all group/ink"
              title="Tap to buy more Ink"
            >
              <div className="w-9 h-9 rounded-lg bg-sky-500/15 flex items-center justify-center shrink-0">
                <Droplet size={16} className="text-sky-300 fill-sky-300/40" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Ink balance</div>
                <div className="text-white font-bold text-base tabular-nums leading-tight">
                  {inkBalance.total.toLocaleString()}
                  <span className="text-[10px] text-gray-500 font-normal ml-1">
                    ({inkBalance.subscription} mo · {inkBalance.purchased} owned)
                  </span>
                </div>
              </div>
              <Plus size={14} className="text-gray-500 group-hover/ink:text-sky-300 transition-colors shrink-0" />
            </button>
          )}

          {/* User Profile */}
          {auth.user && (
            <div className="flex items-center gap-3 px-2 py-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {auth.user.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="text-sm font-medium text-white truncate">{auth.user.name}</div>
                <div className="text-[10px] text-gray-500 truncate">{auth.user.email}</div>
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0 ${auth.user.plan === 'founder' ? 'bg-emerald-500/20 text-emerald-400' :
                auth.user.plan === 'pro' ? 'bg-amber-500/20 text-amber-400' :
                  auth.user.plan === 'starter' ? 'bg-indigo-500/20 text-indigo-400' :
                    'bg-gray-700 text-gray-400'
                }`}>
                {auth.user.plan}
              </span>
            </div>
          )}

          {auth.user?.plan === 'free' && (
            <button
              onClick={() => navigate('/pricing')}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl flex items-center justify-center gap-2 text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all"
            >
              <Sparkles size={14} />
              <span>Upgrade plan</span>
            </button>
          )}

          {/* Manage / cancel subscription — only for paid plans */}
          {auth.user && auth.user.plan !== 'free' && (
            <button
              onClick={openBillingPortal}
              className="w-full py-2 px-4 bg-gray-800/40 hover:bg-gray-800 text-gray-300 hover:text-white rounded-xl flex items-center justify-center gap-2 text-xs font-medium transition-colors border border-gray-700/50 hover:border-gray-600"
              title="Open Stripe billing portal"
            >
              <CreditCard size={13} />
              <span>Manage subscription</span>
            </button>
          )}

          <button
            onClick={handleNewNotebook}
            className="w-full py-2.5 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-xl flex items-center justify-center gap-2 text-sm font-medium border border-gray-700 transition-colors"
          >
            <Plus size={16} />
            <span>New notebook</span>
          </button>

          {/* Beautified nav — community / referral / affiliate as a
              compact 3-tile grid with icons, instead of 3 stacked outline
              buttons that took half the sidebar. */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => navigate('/community')}
              className="group/nav flex flex-col items-center justify-center gap-1 py-2.5 px-2 bg-gray-800/30 hover:bg-indigo-500/15 border border-gray-700/50 hover:border-indigo-500/40 rounded-xl transition-all"
              title="Feedback, requests, updates"
            >
              <MessageSquare size={15} className="text-gray-400 group-hover/nav:text-indigo-300 transition-colors" />
              <span className="text-[10px] font-semibold text-gray-400 group-hover/nav:text-white transition-colors">Community</span>
            </button>
            <button
              onClick={() => navigate('/referral')}
              className="group/nav flex flex-col items-center justify-center gap-1 py-2.5 px-2 bg-gray-800/30 hover:bg-emerald-500/15 border border-gray-700/50 hover:border-emerald-500/40 rounded-xl transition-all relative"
              title="Invite friends · Give Ink, get Ink"
            >
              <Gift size={15} className="text-gray-400 group-hover/nav:text-emerald-300 transition-colors" />
              <span className="text-[10px] font-semibold text-gray-400 group-hover/nav:text-white transition-colors">Invite</span>
              <span className="absolute -top-1 -right-1 px-1 py-0 bg-emerald-500 text-white text-[8px] font-bold rounded-full leading-none uppercase tracking-wider" style={{ paddingTop: 2, paddingBottom: 2 }}>
                +Ink
              </span>
            </button>
            <button
              onClick={() => navigate('/affiliate')}
              className="group/nav flex flex-col items-center justify-center gap-1 py-2.5 px-2 bg-gray-800/30 hover:bg-amber-500/15 border border-gray-700/50 hover:border-amber-500/40 rounded-xl transition-all"
              title="Earn 30% recurring commission"
            >
              <DollarSign size={15} className="text-gray-400 group-hover/nav:text-amber-300 transition-colors" />
              <span className="text-[10px] font-semibold text-gray-400 group-hover/nav:text-white transition-colors">Affiliate</span>
            </button>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-gray-800/50">
            <button
              onClick={() => navigate('/')}
              className="flex-1 py-1.5 px-2 text-gray-500 hover:text-gray-300 rounded-lg flex items-center justify-center gap-1.5 text-[11px] font-medium transition-colors"
            >
              <Home size={11} />
              <span>Home</span>
            </button>
            <div className="w-px h-3 bg-gray-700/50" />
            <button
              onClick={auth.logout}
              className="flex-1 py-1.5 px-2 text-gray-600 hover:text-red-400 rounded-lg text-[11px] font-medium transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area — on native, height SHRINKS with the keyboard via
          --kb-bottom (set by useKeyboardHandler from visualViewport). This is
          the linchpin: every downstream layout (scroll container, cursor pos,
          chevrons, FAB) was built assuming `main` shrinks when keyboard appears
          — it never did until now. */}
      <main
        className={`flex-1 relative flex flex-col items-center overflow-hidden ${native ? 'px-0 justify-start' : 'md:p-12 md:justify-center'}`}
        style={native ? {
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4px)',
          // Keyboard down: reserve tab bar + home indicator (56pt + safe-area)
          // Keyboard up:   reserve toolbar (44pt) above keyboard. Tab bar is hidden.
          paddingBottom: keyboardVisible
            ? '44px'
            : 'calc(env(safe-area-inset-bottom, 0px) + 56px)',
          // Lock to VISIBLE viewport (subtract keyboard) — frame-accurate.
          height: 'calc(100dvh - var(--kb-bottom, 0px))',
          transition: 'height 250ms cubic-bezier(0.32, 0.72, 0, 1), padding-bottom 250ms cubic-bezier(0.32, 0.72, 0, 1)',
        } : undefined}
      >
        {/* Top-left controls — desktop only (tab bar owns left side on native) */}
        {!native && (
          !focusMode && (
          <div
            className="hidden md:flex absolute left-3 z-30 gap-2"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
          >
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 bg-white/80 backdrop-blur rounded-lg shadow-sm border border-gray-200 text-gray-700 hover:bg-white transition-colors"
              aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
              aria-expanded={isSidebarOpen}
            >
              <Menu size={20} />
            </button>
            <button
              onClick={sfx.toggle}
              className={`p-2 backdrop-blur rounded-lg shadow-sm border transition-colors ${sfx.enabled
                ? 'bg-indigo-100 border-indigo-300 text-indigo-600'
                : 'bg-white/80 border-gray-200 text-gray-400 hover:bg-white hover:text-gray-600'
                }`}
              aria-label={sfx.enabled ? 'Mute sounds' : 'Enable sounds'}
              title={sfx.enabled ? 'Sound effects on' : 'Sound effects off'}
            >
              {sfx.enabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
          </div>
          )
        )}

        {/* Navigation & Actions — desktop cluster only.
            On native: bookmark + AI + add-page move into the NotebookView header
            and the floating AI FAB. */}
        {!native && !focusMode && (
        <div
          className="hidden md:flex absolute right-3 z-30 gap-1.5 md:gap-2"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
        >
          {activePage && (
            <>
              {/* Bookmark ribbon toggle — top corner tassel style */}
              <button
                onClick={toggleBookmark}
                className={`relative p-2 backdrop-blur rounded-lg shadow-sm border transition-all duration-300 ${(activeNotebook.bookmarks ?? []).includes(activePage.id)
                  ? 'bg-amber-100 border-amber-300 text-amber-600 scale-110'
                  : 'bg-white/80 border-gray-200 text-gray-700 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-500'
                  }`}
                aria-label={(activeNotebook.bookmarks ?? []).includes(activePage.id) ? 'Remove bookmark' : 'Bookmark page'}
              >
                <Bookmark size={20} fill={(activeNotebook.bookmarks ?? []).includes(activePage.id) ? "currentColor" : "none"} />
                {(activeNotebook.bookmarks ?? []).includes(activePage.id) && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-white" />
                )}
              </button>
              <button
                onClick={() => setIsGeneratorOpen(true)}
                className="py-2 px-3 md:px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-lg flex items-center justify-center gap-1.5 md:gap-2 text-xs md:text-sm font-medium shadow-lg shadow-indigo-900/50 transition-all transform hover:scale-[1.02]"
                aria-label="Generate AI layout"
              >
                <Sparkles size={16} />
                <span className="hidden sm:inline">AI Layout</span>
              </button>
            </>
          )}
          {activeNotebook.pages.length > 0 && (
            <button
              onClick={handleExportPdf}
              className="p-2 bg-white/80 backdrop-blur rounded-lg shadow-sm border border-gray-200 text-gray-700 hover:bg-white hover:text-indigo-600 transition-colors"
              aria-label="Export notebook as PDF"
              title="Export notebook as PDF"
            >
              <Printer size={20} />
            </button>
          )}
          {/* Focus mode toggle — always visible (even on the cover) so
              users can hide everything and see only the notebook. */}
          <button
            onClick={handleEnterFocusMode}
            className="p-2 bg-white/80 backdrop-blur rounded-lg shadow-sm border border-gray-200 text-gray-700 hover:bg-white hover:text-indigo-600 transition-colors"
            aria-label="Enter focus mode"
            title="Focus mode (hide everything)"
          >
            <Maximize2 size={18} />
          </button>
        </div>
        )}

        {/* Focus mode exit pill — only visible when focus mode is on. */}
        {focusMode && !native && (
          <button
            onClick={() => setFocusMode(false)}
            className="absolute right-3 z-40 inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900/90 backdrop-blur text-white rounded-full shadow-2xl text-xs font-semibold hover:bg-slate-800 transition-colors"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
            aria-label="Exit focus mode"
            title="Exit focus mode (Esc)"
          >
            <Minimize2 size={14} />
            <span>Exit focus</span>
            <kbd className="px-1 py-0.5 ml-1 bg-white/15 rounded text-[9px] font-mono uppercase">Esc</kbd>
          </button>
        )}

        {/* Mobile sticky top toolbar — mobile web only (< md).
            Replaces the absolute desktop clusters so icons never collide
            with the Left/Right page pill on narrow screens. Two flex
            clusters with justify-between give breathing room and the
            Left/Right pill in NotebookView naturally sits below. */}
        {!native && !focusMode && (
          <div
            className="md:hidden w-full shrink-0 z-30 flex items-center justify-between gap-1.5 px-2.5 pb-2 bg-gray-100/95 backdrop-blur-md border-b border-gray-200"
            style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
          >
            {/* Left cluster: sidebar + sound */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 bg-white rounded-lg shadow-sm border border-gray-200 text-gray-700 active:bg-gray-100 transition-colors"
                aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
                aria-expanded={isSidebarOpen}
              >
                <Menu size={18} />
              </button>
              <button
                onClick={sfx.toggle}
                className={`p-2 rounded-lg shadow-sm border transition-colors ${sfx.enabled
                  ? 'bg-indigo-100 border-indigo-300 text-indigo-600'
                  : 'bg-white border-gray-200 text-gray-400'
                  }`}
                aria-label={sfx.enabled ? 'Mute sounds' : 'Enable sounds'}
                title={sfx.enabled ? 'Sound effects on' : 'Sound effects off'}
              >
                {sfx.enabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
            </div>

            {/* Right cluster: bookmark + AI + print + focus */}
            <div className="flex items-center gap-1.5">
              {activePage && (
                <>
                  <button
                    onClick={toggleBookmark}
                    className={`relative p-2 rounded-lg shadow-sm border transition-all ${(activeNotebook.bookmarks ?? []).includes(activePage.id)
                      ? 'bg-amber-100 border-amber-300 text-amber-600'
                      : 'bg-white border-gray-200 text-gray-700'
                      }`}
                    aria-label={(activeNotebook.bookmarks ?? []).includes(activePage.id) ? 'Remove bookmark' : 'Bookmark page'}
                  >
                    <Bookmark size={18} fill={(activeNotebook.bookmarks ?? []).includes(activePage.id) ? 'currentColor' : 'none'} />
                    {(activeNotebook.bookmarks ?? []).includes(activePage.id) && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full border border-white" />
                    )}
                  </button>
                  <button
                    onClick={() => setIsGeneratorOpen(true)}
                    className="h-9 w-9 flex items-center justify-center bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-lg shadow-sm"
                    aria-label="Generate AI layout"
                  >
                    <Sparkles size={16} />
                  </button>
                </>
              )}
              {activeNotebook.pages.length > 0 && (
                <button
                  onClick={handleExportPdf}
                  className="p-2 bg-white rounded-lg shadow-sm border border-gray-200 text-gray-700"
                  aria-label="Export notebook as PDF"
                  title="Export notebook as PDF"
                >
                  <Printer size={18} />
                </button>
              )}
              <button
                onClick={handleEnterFocusMode}
                className="p-2 bg-white rounded-lg shadow-sm border border-gray-200 text-gray-700"
                aria-label="Enter focus mode"
                title="Focus mode (hide everything)"
              >
                <Maximize2 size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Notebook Container — flex-fills available main space */}
        <div className="w-full max-w-6xl flex-1 min-h-0 flex flex-col items-center justify-center relative">

          {/* Bookmark Ribbon Tassels — left edge of notebook */}
          {activePageIndex >= 0 && bookmarkedPages.length > 0 && (
            <div className="absolute left-0 md:left-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-1" style={{ marginTop: '-60px' }}>
              {bookmarkedPages.map((p, i) => {
                const pageIdx = activeNotebook.pages.findIndex(pg => pg.id === p.id);
                const isCurrentPage = pageIdx === activePageIndex;
                const ribbonColors = [
                  'from-amber-500 to-amber-600',
                  'from-rose-500 to-rose-600',
                  'from-indigo-500 to-indigo-600',
                  'from-emerald-500 to-emerald-600',
                  'from-violet-500 to-violet-600',
                  'from-sky-500 to-sky-600',
                  'from-pink-500 to-pink-600',
                  'from-teal-500 to-teal-600',
                ];
                const colorClass = ribbonColors[i % ribbonColors.length];
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setPageDirection(pageIdx > activePageIndex ? 'right' : 'left');
                      setActivePageIndex(pageIdx);
                      sfx.pageFlip();
                    }}
                    className={`group/ribbon relative flex items-center transition-all duration-300 ${isCurrentPage ? 'translate-x-0' : '-translate-x-2 hover:translate-x-0'}`}
                    title={p.title || `Page ${pageIdx + 1}`}
                  >
                    {/* Ribbon body */}
                    <div
                      className={`relative bg-gradient-to-r ${colorClass} shadow-lg rounded-r-sm ${isCurrentPage ? 'w-20 md:w-28' : 'w-8 md:w-12 group-hover/ribbon:w-20 md:group-hover/ribbon:w-28'} h-7 transition-all duration-300 flex items-center overflow-hidden`}
                    >
                      {/* Fabric texture overlay */}
                      <div className="absolute inset-0 opacity-20 bg-[repeating-linear-gradient(90deg,transparent,transparent_1px,rgba(255,255,255,0.1)_1px,rgba(255,255,255,0.1)_2px)]" />
                      {/* Label — only visible when expanded */}
                      <span className={`text-white text-[10px] font-medium pl-2 pr-1 truncate whitespace-nowrap transition-opacity duration-200 ${isCurrentPage ? 'opacity-100' : 'opacity-0 group-hover/ribbon:opacity-100'}`}>
                        {p.title || `Pg ${pageIdx + 1}`}
                      </span>
                    </div>
                    {/* Ribbon tail / V-notch */}
                    <div className={`w-0 h-0 border-t-[14px] border-b-[14px] border-l-[6px] border-t-transparent border-b-transparent transition-colors`}
                      style={{
                        borderLeftColor: isCurrentPage ? undefined : undefined,
                      }}
                    />
                  </button>
                );
              })}
            </div>
          )}

          {/* Left Navigation Arrow — inside safe area on native, 44pt target */}
          {activePageIndex >= 0 && !keyboardVisible && (
            <button
              onClick={handlePageBack}
              className="absolute left-2 md:-left-12 top-1/2 -translate-y-1/2 z-40 w-11 h-11 md:p-3 bg-white/80 backdrop-blur hover:bg-white rounded-full shadow-lg text-gray-700 transition-all duration-200 hover:-translate-x-1 hover:shadow-xl flex items-center justify-center"
              aria-label="Previous page"
              style={{ touchAction: 'manipulation' }}
            >
              <ChevronLeft size={22} />
            </button>
          )}

          {/* The Book — animated wrapper */}
          <div
            key={`${activeNotebookId}-${activePageIndex}-${contentKey}`}
            className={`w-full flex-1 min-h-0 ${native ? '' : 'max-h-[900px]'} relative ${getPageAnimClass()}`}
            onAnimationEnd={() => setPageDirection(null)}
          >
            {activePageIndex === -1 ? (
              /* Cover View — 3D with flat CSS fallback. On native: full-width
                  fill (no max-w cap that would leave white space on either side). */
              <div
                className={`w-full ${native ? '' : 'max-w-2xl'} mx-auto h-full flex items-center justify-center transition-opacity duration-400`}
                style={{ opacity: coverFading ? 0 : 1 }}
              >
                <Suspense
                  fallback={renderCoverSkeleton()}
                >
                  {/* 3D Book Cover + DOM overlay */}
                  <div
                    className="relative w-full h-full max-h-[800px] rounded-2xl"
                    style={{ overflow: 'hidden' }}
                  >
                    <Canvas3DErrorBoundary fallback={renderFlatCoverFallback()} resetKey={activeNotebookId}>
                      <BookCoverScene
                        coverColorClass={activeNotebook.coverColor}
                        coverImageUrl={activeNotebook.coverImageUrl}
                        title={activeNotebook.title}
                        pageCount={activeNotebook.pages.length}
                        isOpening={isOpening}
                        onOpenComplete={handleCoverOpenComplete}
                        onReady={() => setCoverSceneReady(true)}
                      />
                    </Canvas3DErrorBoundary>
                    {/* DOM overlay for title editing, color picker, CTA.
                        • In focus mode the user should land directly in
                          the notebook, so this overlay never becomes a
                          second "Open Notebook" gate.
                        • Before the 3D scene fires onReady, the overlay
                          is hidden (opacity 0 + non-interactive) so
                          users never see the title + color picker +
                          template tiles floating over a blank canvas
                          during the 1-2s scene initialization. */}
                    <div
                      className="absolute inset-x-0 top-[20%] md:top-[15%] bottom-[8%] md:bottom-[10%] flex flex-col items-center justify-center px-3 md:px-6 text-center pointer-events-none transition-opacity duration-300"
                      style={{
                        zIndex: 20,
                        opacity: coverSceneReady ? 1 : 0,
                      }}
                    >
                      {/* Gradient scrim removed — 3D scene provides enough contrast */}

                      <div className="relative z-10 flex flex-col items-center w-full max-h-full overflow-y-auto overflow-x-hidden scrollbar-hide">
                      {/* Title — hidden in focus mode (the printed title
                          on the 3D cover is enough). */}
                      {!focusMode && (
                        <input
                          className="pointer-events-auto bg-transparent text-white text-xl md:text-4xl font-serif font-bold text-center border-b-2 border-transparent hover:border-white/30 focus:border-white/50 focus:outline-none transition-colors w-full max-w-md px-2"
                          style={{ textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}
                          value={activeNotebook.title}
                          onChange={(e) => {
                            setNotebooks(prev => prev.map(nb => nb.id === activeNotebookId ? { ...nb, title: e.target.value } : nb));
                          }}
                        />
                      )}

                      {!focusMode && (
                        <div
                          className="mt-1 md:mt-2 text-white/60 font-sans tracking-widest uppercase text-[10px] md:text-xs"
                          style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}
                        >
                          {activeNotebook.pages.length} Spreads
                        </div>
                      )}

                      {/* Cover Customization Panel — hidden in focus mode. */}
                      {!focusMode && (
                      <div className="pointer-events-auto flex flex-col items-center gap-1.5 mt-2 md:mt-4 w-full max-w-md px-2 md:px-4">
                        {/* Color Swatches — wrapping grid for all colors */}
                        <div className="flex flex-wrap items-center justify-center gap-1 md:gap-1.5 px-2 md:px-3 py-1.5 md:py-2 bg-black/40 backdrop-blur-xl rounded-xl md:rounded-2xl border border-white/10 shadow-2xl shadow-black/40">
                          <Palette size={12} className="text-indigo-400 shrink-0 md:hidden" />
                          <Palette size={14} className="text-indigo-400 shrink-0 hidden md:block" />
                          {COVER_COLORS.map(color => (
                            <button
                              key={color}
                              onClick={() => handleCoverColorChange(color)}
                              className={`w-4 h-4 md:w-5 md:h-5 rounded-full ${color} border-2 transition-all duration-300 ${activeNotebook.coverColor === color
                                ? 'border-white scale-125 shadow-lg shadow-white/20'
                                : 'border-white/10 hover:border-white/40 hover:scale-110'
                                }`}
                            />
                          ))}
                        </div>

                        {/* AI Cover Actions */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowCoverModal(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 bg-gradient-to-r from-indigo-600/80 to-violet-600/80 hover:from-indigo-500 hover:to-violet-500 text-white rounded-lg md:rounded-xl text-[11px] md:text-xs font-medium transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                          >
                            <Wand2 size={12} />
                            <span>AI Cover</span>
                          </button>
                          {activeNotebook.coverImageUrl && (
                            <button
                              onClick={handleRemoveCoverImage}
                              className="px-3 py-2 bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-white/40 hover:text-red-400 rounded-xl text-xs transition-all"
                              title="Remove AI cover"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                      )}
                      {activeNotebook.pages.length > 0 ? (
                        !focusMode && !isOpening && (
                          <button
                            onClick={handleOpen3DCover}
                            className="pointer-events-auto mt-3 text-white flex items-center gap-2 bg-indigo-600/80 hover:bg-indigo-500/90 backdrop-blur-sm px-4 py-2 md:px-6 md:py-3 rounded-xl md:rounded-2xl transition-all hover:scale-105 cursor-pointer text-sm md:text-base font-medium shadow-xl shadow-indigo-900/30"
                          >
                            <BookOpen size={16} className="md:hidden" />
                            <BookOpen size={18} className="hidden md:block" />
                            <span>Open Notebook</span>
                            <ChevronRight size={14} className="md:hidden" />
                            <ChevronRight size={16} className="hidden md:block" />
                          </button>
                        )
                      ) : focusMode ? null : (
                        /* Onboarding Templates — premium glass tiles */
                        <div className="pointer-events-auto mt-5 w-full max-w-2xl">
                          <div className="flex items-center justify-center gap-2 mb-3">
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-white/20" />
                            <div className="text-white/60 text-[10px] font-sans uppercase tracking-[0.2em] font-semibold">
                              Get Started
                            </div>
                            <div className="h-px flex-1 bg-gradient-to-l from-transparent via-white/20 to-white/20" />
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                            {STARTER_TEMPLATES.map(tpl => (
                              <button
                                key={tpl.id}
                                onClick={() => handleNewPage(tpl.blocks as Block[])}
                                className="relative p-4 bg-white/[0.08] hover:bg-white/[0.16] backdrop-blur-xl rounded-2xl border border-white/15 hover:border-white/40 transition-all text-left group/tpl overflow-hidden shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-indigo-500/20 hover:-translate-y-0.5"
                              >
                                {/* Subtle gradient glow on hover */}
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-400/0 via-violet-400/0 to-fuchsia-400/0 group-hover/tpl:from-indigo-400/15 group-hover/tpl:via-violet-400/10 group-hover/tpl:to-fuchsia-400/15 transition-all pointer-events-none" />
                                {/* Top row: icon chip */}
                                <div className="relative flex items-center justify-between mb-2.5">
                                  <div className="w-8 h-8 rounded-lg bg-white/10 group-hover/tpl:bg-white/20 border border-white/15 group-hover/tpl:border-white/30 flex items-center justify-center transition-all">
                                    <tpl.icon size={15} className="text-white/75 group-hover/tpl:text-white transition-colors" />
                                  </div>
                                  <ChevronRight size={14} className="text-white/20 group-hover/tpl:text-white/70 group-hover/tpl:translate-x-0.5 transition-all" />
                                </div>
                                {/* Title + description */}
                                <div className="relative">
                                  <div className="text-white text-[13px] font-serif font-semibold tracking-tight leading-tight">
                                    {tpl.title}
                                  </div>
                                  <div className="text-white/55 text-[11px] font-sans mt-0.5 leading-snug">
                                    {tpl.desc}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      </div>{/* end relative z-10 wrapper */}
                    </div>
                  </div>
                </Suspense>
              </div>
            ) : activePage ? (
              /* Spread View */
              <NotebookView
                page={activePage}
                onUpdatePage={handleUpdatePage}
                allPages={activeNotebook.pages}
                onNavigate={(pageId) => {
                  const idx = activeNotebook.pages.findIndex(p => p.id === pageId);
                  if (idx !== -1) {
                    setPageDirection(idx > activePageIndex ? 'right' : 'left');
                    setActivePageIndex(idx);
                    sfx.pageFlip();
                  }
                }}
                onBlockDeleted={handleBlockDeleted}
                sounds={{
                  penScratch: sfx.penScratch,
                  checkboxClick: sfx.checkboxClick,
                  blockAdd: sfx.blockAdd,
                  blockDelete: sfx.blockDelete,
                  dragRustle: sfx.dragRustle,
                }}
                isBookmarked={(activeNotebook.bookmarks ?? []).includes(activePage.id)}
                /* On web, the Dashboard renders its own floating bookmark ribbon (line ~935).
                   On native iOS, that ribbon is hidden, so the NotebookView header shows the
                   bookmark inline instead. Passing the callback only on native avoids the
                   duplicate bookmark button on web. */
                onToggleBookmark={native ? toggleBookmark : undefined}
                onOpenAIGenerator={() => setIsGeneratorOpen(true)}
                onAddPage={() => handleNewPage()}
                hideChrome={focusMode}
              />
            ) : (
              /* Empty State (End of book) */
              <div className="w-full h-full flex flex-col items-center justify-center bg-white/50 backdrop-blur rounded-2xl border-2 border-dashed border-gray-300">
                <Book size={48} className="text-gray-300 mb-4" />
                <h3 className="text-xl font-medium text-gray-600 mb-2">End of Notebook</h3>
                <button
                  onClick={() => handleNewPage()}
                  className="py-2.5 px-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-2 font-medium shadow-md transition-colors"
                >
                  <Plus size={18} /> Add New Spread
                </button>
              </div>
            )}
          </div>

          {/* Right Navigation Arrow — inside safe area on native, 44pt target */}
          {activePageIndex !== -1 && activePageIndex < activeNotebook.pages.length - 1 && !keyboardVisible && (
            <button
              onClick={handlePageForward}
              className="absolute right-2 md:-right-12 top-1/2 -translate-y-1/2 z-40 w-11 h-11 md:p-3 bg-white/80 backdrop-blur hover:bg-white rounded-full shadow-lg text-gray-700 transition-all duration-200 hover:translate-x-1 hover:shadow-xl flex items-center justify-center"
              aria-label="Next page"
              style={{ touchAction: 'manipulation' }}
            >
              <ChevronRight size={22} />
            </button>
          )}

          {/* Page Position Indicator + Add Page
              Native: ultra-compact "13/13" pill, no dots, no add button (lives in FAB)
              Web:    full dot strip + label + add button */}
          {native ? (
            activePageIndex !== -1 && activeNotebook.pages.length > 0 && !keyboardVisible ? (
              <div className="mt-0.5 flex items-center justify-center shrink-0 pointer-events-none">
                <span className="px-2 py-0.5 rounded-full bg-black/30 backdrop-blur text-white text-[10px] font-sans tabular-nums tracking-wide">
                  {activePageIndex + 1}/{activeNotebook.pages.length}
                </span>
              </div>
            ) : null
          ) : (
          <div className="mt-1.5 md:mt-3 flex items-center justify-center gap-2 md:gap-3 shrink-0">
            <span className="text-xs font-sans text-gray-400 uppercase tracking-widest">
              {getPageLabel()}
            </span>
            {activeNotebook.pages.length > 0 && activeNotebook.pages.length <= 20 && (
              <div className="flex items-center gap-1">
                {activeNotebook.pages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setPageDirection(i > activePageIndex ? 'right' : 'left');
                      setActivePageIndex(i);
                    }}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${i === activePageIndex
                      ? 'bg-indigo-500 scale-150'
                      : 'bg-gray-300 hover:bg-gray-400'
                      }`}
                  />
                ))}
              </div>
            )}
            {/* Add new page — always accessible */}
            <button
              onClick={() => handleNewPage()}
              className="p-1.5 rounded-full bg-white/80 hover:bg-indigo-100 border border-gray-200 hover:border-indigo-300 text-gray-500 hover:text-indigo-600 shadow-sm transition-all hover:scale-110"
              title="Add new page"
            >
              <Plus size={14} />
            </button>
          </div>
          )}
        </div>
      </main>

      {/* AI Layout Generator — BottomSheet on native iOS, modal on web */}
      {native ? (
        <BottomSheet
          isOpen={isGeneratorOpen}
          initialDetent="full"
          onClose={() => {
            setIsGeneratorOpen(false);
            setActiveTab('notebooks');
          }}
        >
          <LayoutGenerator
            isOpen={isGeneratorOpen}
            onClose={() => {
              setIsGeneratorOpen(false);
              setActiveTab('notebooks');
            }}
            onGenerate={handleAiGeneration}
          />
        </BottomSheet>
      ) : (
        <LayoutGenerator
          isOpen={isGeneratorOpen}
          onClose={() => setIsGeneratorOpen(false)}
          onGenerate={handleAiGeneration}
        />
      )}

      {/* AI Generation Approval Dialog */}
      {pendingPages && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="bg-indigo-600 px-6 py-4 text-white">
              <h3 className="text-lg font-bold">AI Generated {pendingPages.length} {pendingPages.length === 1 ? 'Page' : 'Pages'}</h3>
              <p className="text-indigo-200 text-sm mt-1">Review before adding to your notebook</p>
            </div>

            {/* Page list */}
            <div className="px-6 py-4 max-h-60 overflow-y-auto">
              {pendingPages.map((page, i) => (
                <div key={page.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                  <div className="w-7 h-7 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center text-xs font-bold">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{page.title}</div>
                    <div className="text-xs text-gray-400">{page.blocks.length} blocks · {page.paperType}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Cost summary */}
            <div className="px-6 py-3 bg-amber-50 border-t border-amber-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-amber-600" fill="currentColor">
                  <path d="M12 2C12 2 5 10 5 15a7 7 0 1014 0C19 10 12 2 12 2z" />
                </svg>
                <span className="text-sm font-bold text-amber-800">
                  {pendingInkCost} Ink will be charged
                </span>
              </div>
              <span className="text-xs text-amber-600">1 Ink per page</span>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 flex gap-3 border-t border-gray-100">
              <button
                onClick={declineGeneratedPages}
                className="flex-1 px-4 py-2.5 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium text-sm transition-colors"
              >
                Discard
              </button>
              <button
                onClick={approveGeneratedPages}
                className="flex-1 px-4 py-2.5 text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-sm transition-colors shadow-lg shadow-indigo-500/20"
              >
                Add {pendingPages.length} {pendingPages.length === 1 ? 'Page' : 'Pages'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification Container */}
      {toasts.length > 0 && (
        <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3">
          {toasts.map(toast => (
            <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </div>
      )}

      {/* PDF Export Loading Modal — covers the screen while the
          off-screen export tree is rasterized to a PDF. The user
          sees ONLY this modal, never the raw export tree being
          rendered. Progress updates per-page so large notebooks
          feel responsive. */}
      {isExportingPdf && (
        <div
          data-no-export="true"
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-live="polite"
          aria-label="Exporting PDF"
        >
          <div className="max-w-sm w-full mx-4 rounded-3xl bg-white shadow-2xl overflow-hidden">
            {/* Top gradient accent */}
            <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-rose-500" />
            <div className="px-8 py-8 text-center">
              {/* Animated spinner */}
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-indigo-50 mb-5">
                <div className="w-7 h-7 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              </div>
              <h3 className="font-serif text-2xl font-bold text-gray-900 mb-2">
                Preparing your PDF
              </h3>
              <p className="text-sm text-gray-500 mb-5 leading-relaxed">
                Rendering {activeNotebook?.title?.trim() || 'your notebook'} at
                print quality. This takes a few seconds.
              </p>
              {/* Progress bar */}
              {exportProgress && exportProgress.total > 0 && (
                <>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-200 ease-out"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            (exportProgress.current / exportProgress.total) * 100,
                          ),
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 font-medium">
                    Page {exportProgress.current} of {exportProgress.total}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Cover Generation Modal */}
      <CoverGenModal
        isOpen={showCoverModal}
        onClose={() => setShowCoverModal(false)}
        onGenerate={async (prompt, aesthetic) => {
          setIsGeneratingCover(true);
          try {
            return await generateCover(prompt, aesthetic);
          } catch (error) {
            addToast('Failed to generate cover', 'error');
            throw error;
          } finally {
            setIsGeneratingCover(false);
          }
        }}
        onApply={async (imageUrl) => {
          try {
            const storageReadyImage = await prepareCoverImageForStorage(imageUrl);
            setNotebooks(prev => prev.map(nb =>
              nb.id === activeNotebookId ? { ...nb, coverImageUrl: storageReadyImage } : nb
            ));
            addToast('AI Cover applied!', 'success');
          } catch (error) {
            console.error('Failed to apply AI cover:', error);
            addToast('Failed to apply cover', 'error');
            throw error instanceof Error ? error : new Error('Failed to apply cover');
          }
        }}
        currentCoverUrl={activeNotebook?.coverImageUrl}
        isGenerating={isGeneratingCover}
      />

      {/* iOS Tab Bar — only renders on native */}
      {/* iOS Tab Bar — only renders on native; hidden while keyboard is up */}
        <TabBar activeTab={activeTab} onTabChange={handleTabChange} hidden={keyboardVisible} />
      </div>

      {activeNotebook.pages.length > 0 && (
        <ExportNotebookDocument
          notebook={activeNotebook}
          branded={exportUsesBranding}
          watermarked={exportUsesWatermark}
        />
      )}
    </>
  );
};
