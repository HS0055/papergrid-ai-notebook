import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotebookView } from './NotebookView';
import { LayoutGenerator } from './LayoutGenerator';
import { Notebook, NotebookPage, Block, BlockType } from '@papergrid/core';
import { generateLayout, generateCover, ExistingPageContext } from '../services/geminiService';
import { CoverGenModal } from './CoverGenModal';
import {
  Book, Plus, Sparkles, Menu, ChevronLeft, ChevronRight, Bookmark,
  AlertCircle, CheckCircle2, X, Home, Search, FileText, Undo2,
  Palette, BookOpen, LayoutDashboard, ListChecks, Calendar, PenLine,
  Download, Image, Printer, Volume2, VolumeX, Wand2, Trash2,
  Users, DollarSign,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { useSoundEffects } from '../hooks/useSoundEffects';
import { useAuth } from '../hooks/useAuth';
import {
  loadNotebooksFromStorage,
  prepareCoverImageForStorage,
  saveNotebooksToStorage,
} from '../utils/notebookStorage';
import { useConvexNotebooks } from '../hooks/useConvexNotebooks';
import { Canvas3DErrorBoundary } from './three/Canvas3DErrorBoundary';
import { TabBar, type TabId } from './ios/TabBar';
import { BottomSheet } from './ios/BottomSheet';
import { isNativeApp } from '../utils/platform';
import { useKeyboardHandler } from '../hooks/useKeyboardHandler';

// Lazy-load 3D components (Three.js chunk loads on demand)
const BookCoverScene = lazy(() => import('./three/notebook/BookCoverScene'));

const STORAGE_KEY_PREFIX = 'papergrid_notebooks';

const COVER_COLORS = [
  'bg-indigo-900', 'bg-rose-900', 'bg-emerald-900', 'bg-slate-900',
  'bg-amber-900', 'bg-sky-900', 'bg-violet-900', 'bg-stone-900',
  'bg-red-900', 'bg-teal-900', 'bg-fuchsia-900', 'bg-zinc-900',
];

const STARTER_TEMPLATES = [
  { id: 'blank', title: 'Blank Page', desc: 'Start from scratch', icon: FileText, blocks: [] },
  {
    id: 'planner', title: 'Daily Planner', desc: 'Organize your day', icon: Calendar, blocks: [
      { id: 't1', type: BlockType.HEADING, content: 'Daily Plan', side: 'left' as const },
      { id: 't2', type: BlockType.CHECKBOX, content: 'Morning routine', checked: false, side: 'left' as const },
      { id: 't3', type: BlockType.CHECKBOX, content: 'Top priority task', checked: false, side: 'left' as const },
      { id: 't4', type: BlockType.CHECKBOX, content: 'Exercise', checked: false, side: 'left' as const },
      { id: 't5', type: BlockType.DIVIDER, content: '', side: 'right' as const },
      { id: 't6', type: BlockType.TEXT, content: 'Notes for today...', side: 'right' as const },
    ]
  },
  {
    id: 'meeting', title: 'Meeting Notes', desc: 'Capture key points', icon: PenLine, blocks: [
      { id: 'm1', type: BlockType.HEADING, content: 'Meeting Notes', side: 'left' as const },
      { id: 'm2', type: BlockType.TEXT, content: 'Attendees: ', side: 'left' as const },
      { id: 'm3', type: BlockType.CALLOUT, content: 'Key decisions', side: 'left' as const },
      { id: 'm4', type: BlockType.HEADING, content: 'Action Items', side: 'right' as const },
      { id: 'm5', type: BlockType.CHECKBOX, content: '', checked: false, side: 'right' as const },
    ]
  },
  {
    id: 'tracker', title: 'Project Tracker', desc: 'Track tasks & progress', icon: ListChecks, blocks: [
      { id: 'p1', type: BlockType.HEADING, content: 'Project Tracker', side: 'left' as const },
      {
        id: 'p2', type: BlockType.GRID, content: 'Tasks', side: 'left' as const, gridData: {
          columns: ['Task', 'Status', 'Due'],
          rows: [[{ id: '1', content: '' }, { id: '2', content: '' }, { id: '3', content: '' }]]
        }
      },
      { id: 'p3', type: BlockType.CALLOUT, content: 'Blockers & risks', side: 'right' as const },
    ]
  },
  {
    id: 'bujo', title: 'Bullet Journal', desc: 'Rapid logging system', icon: BookOpen, blocks: [
      { id: 'j1', type: BlockType.HEADING, content: 'Bullet Journal', side: 'left' as const },
      { id: 'j2', type: BlockType.CHECKBOX, content: 'Task one', checked: false, side: 'left' as const },
      { id: 'j3', type: BlockType.TEXT, content: '- Note about something', side: 'left' as const },
      { id: 'j4', type: BlockType.MOOD_TRACKER, content: '', side: 'right' as const, moodValue: 3 },
      { id: 'j5', type: BlockType.QUOTE, content: 'Inspiration for the day', side: 'right' as const },
    ]
  },
  {
    id: 'weekly', title: 'Weekly Review', desc: 'Reflect & plan ahead', icon: LayoutDashboard, blocks: [
      { id: 'w1', type: BlockType.HEADING, content: 'Weekly Review', side: 'left' as const },
      { id: 'w2', type: BlockType.TEXT, content: 'Wins this week:', side: 'left' as const },
      { id: 'w3', type: BlockType.TEXT, content: 'Challenges:', side: 'left' as const },
      { id: 'w4', type: BlockType.HEADING, content: 'Next Week', side: 'right' as const },
      { id: 'w5', type: BlockType.PRIORITY_MATRIX, content: '', side: 'right' as const, matrixData: { q1: '', q2: '', q3: '', q4: '' } },
    ]
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
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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
    }, 3000);
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
    // Optimistic: add immediately for snappy UX
    setNotebooks([newNb, ...notebooks]);
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
        // Roll back the optimistic add
        setNotebooks(prev => prev.filter(nb => nb.id !== newNb.id));
        setActiveNotebookId(prev => prev === newNb.id ? (notebooks[0]?.id ?? '') : prev);
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
    // Remove from local state
    const remaining = notebooks.filter(n => n.id !== nbId);
    setNotebooks(remaining);
    if (activeNotebookId === nbId) {
      if (remaining.length > 0) {
        setActiveNotebookId(remaining[0].id);
      } else {
        // Create a fresh notebook if all deleted
        handleNewNotebook();
      }
      setActivePageIndex(-1);
    }
    setDeleteConfirmId(null);
    // Delete from Convex
    const ok = await convex.deleteNotebook(nbId);
    if (ok) {
      addToast(`"${nb.title || 'Untitled'}" deleted`, 'success');
    } else {
      addToast('Deleted locally (cloud sync pending)', 'success');
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

  // Export state
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && e.target instanceof Node && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    if (showExportMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

  const handleExportPNG = async () => {
    const el = document.querySelector<HTMLElement>('[data-export-target]');
    if (!el) return;
    try {
      const canvas = await html2canvas(el, { backgroundColor: '#e5e5e5', scale: 2, useCORS: true });
      const link = document.createElement('a');
      link.download = `${activePage?.title || 'page'}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      addToast('Page exported as PNG', 'success');
    } catch {
      addToast('Failed to export PNG', 'error');
    }
    setShowExportMenu(false);
  };

  const handlePrint = () => {
    window.print();
    setShowExportMenu(false);
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
    <div className="flex h-screen w-full bg-[#f0f2f5] font-sans text-gray-900 overflow-hidden anim-fade-in">
      {/* Sidebar backdrop (mobile) — hidden on native iOS (uses tab bar) */}
      {!native && isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-10 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar — hidden on native iOS (replaced by tab bar navigation) */}
      <aside
        className={`${native ? 'hidden' : isSidebarOpen ? 'w-72 translate-x-0' : 'w-0 -translate-x-full'}
        bg-[#1a1c23] text-gray-300 transition-all duration-300 ease-in-out flex flex-col border-r border-gray-800 absolute z-20 md:relative h-full shadow-2xl overflow-hidden`}
      >
        <div className="p-6 flex items-center gap-3 text-white border-b border-gray-800/50">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Book size={18} />
          </div>
          <span className="font-semibold text-lg tracking-tight">Papera</span>
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
              className="w-full py-2 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-lg flex items-center justify-center gap-2 text-xs font-medium shadow-lg shadow-indigo-500/20 transition-all"
            >
              <Sparkles size={14} />
              <span>Upgrade Plan</span>
            </button>
          )}

          <button
            onClick={handleNewNotebook}
            className="w-full py-2.5 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg flex items-center justify-center gap-2 text-sm font-medium border border-gray-700 transition-colors"
          >
            <Plus size={16} />
            <span>New Notebook</span>
          </button>
          <button
            onClick={() => navigate('/community')}
            className="w-full py-2 px-4 text-gray-400 hover:text-white rounded-lg flex items-center justify-center gap-2 text-xs font-medium transition-colors border border-gray-800 hover:border-gray-700"
          >
            <Users size={14} />
            <span>Community</span>
          </button>
          <button
            onClick={() => navigate('/affiliate')}
            className="w-full py-2 px-4 text-gray-400 hover:text-white rounded-lg flex items-center justify-center gap-2 text-xs font-medium transition-colors border border-gray-800 hover:border-gray-700"
          >
            <DollarSign size={14} />
            <span>Affiliate · Earn 30%</span>
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full py-2 px-4 text-gray-500 hover:text-gray-300 rounded-lg flex items-center justify-center gap-2 text-xs font-medium transition-colors"
          >
            <Home size={14} />
            <span>Back to Home</span>
          </button>
          <button
            onClick={auth.logout}
            className="w-full py-1.5 px-4 text-gray-600 hover:text-red-400 rounded-lg text-xs font-medium transition-colors"
          >
            Log Out
          </button>
        </div>
      </aside>

      {/* Main Content Area — on native, height SHRINKS with the keyboard via
          --kb-bottom (set by useKeyboardHandler from visualViewport). This is
          the linchpin: every downstream layout (scroll container, cursor pos,
          chevrons, FAB) was built assuming `main` shrinks when keyboard appears
          — it never did until now. */}
      <main
        className={`flex-1 relative flex flex-col items-center overflow-hidden ${native ? 'px-0 justify-start' : 'p-4 md:p-12 justify-center'}`}
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
          <div
            className="absolute left-3 z-30 flex gap-2"
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
        )}

        {/* Navigation & Actions — desktop cluster only.
            On native: bookmark + AI + add-page move into the NotebookView header
            and the floating AI FAB. */}
        {!native && (
        <div
          className="absolute right-3 z-30 flex gap-1.5 md:gap-2"
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
              <div className="relative" ref={exportMenuRef}>
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="p-2 bg-white/80 backdrop-blur rounded-lg shadow-sm border border-gray-200 text-gray-700 hover:bg-white transition-colors"
                  aria-label="Export page"
                  aria-expanded={showExportMenu}
                >
                  <Download size={20} />
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 py-1 min-w-[160px] z-50 anim-popover">
                    <button
                      onClick={handleExportPNG}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                    >
                      <Image size={16} className="text-gray-400" />
                      Export as PNG
                    </button>
                    <button
                      onClick={handlePrint}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                    >
                      <Printer size={16} className="text-gray-400" />
                      Print / PDF
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
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
                  fallback={renderFlatCoverFallback()}
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
                      />
                    </Canvas3DErrorBoundary>
                    {/* DOM overlay for title editing, color picker, CTA */}
                    <div
                      className="absolute inset-x-0 top-[20%] md:top-[15%] bottom-[8%] md:bottom-[10%] flex flex-col items-center justify-center px-3 md:px-6 text-center pointer-events-none"
                      style={{ zIndex: 20 }}
                    >
                      {/* Gradient scrim removed — 3D scene provides enough contrast */}

                      <div className="relative z-10 flex flex-col items-center w-full max-h-full overflow-y-auto overflow-x-hidden scrollbar-hide">
                      {/* Title — always shown, looks "printed" on the cover */}
                      <input
                        className="pointer-events-auto bg-transparent text-white text-xl md:text-4xl font-serif font-bold text-center border-b-2 border-transparent hover:border-white/30 focus:border-white/50 focus:outline-none transition-colors w-full max-w-md px-2"
                        style={{ textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}
                        value={activeNotebook.title}
                        onChange={(e) => {
                          setNotebooks(prev => prev.map(nb => nb.id === activeNotebookId ? { ...nb, title: e.target.value } : nb));
                        }}
                      />

                      <div
                        className="mt-1 md:mt-2 text-white/60 font-sans tracking-widest uppercase text-[10px] md:text-xs"
                        style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}
                      >
                        {activeNotebook.pages.length} Spreads
                      </div>

                      {/* Cover Customization Panel */}
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
                      {activeNotebook.pages.length > 0 ? (
                        !isOpening && (
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
                      ) : (
                        /* Onboarding Templates */
                        <div className="pointer-events-auto mt-4 w-full max-w-lg">
                          <div className="text-white/50 text-xs font-sans uppercase tracking-widest mb-2">Get Started</div>
                          <div className="grid grid-cols-3 gap-1.5">
                            {STARTER_TEMPLATES.map(tpl => (
                              <button
                                key={tpl.id}
                                onClick={() => handleNewPage(tpl.blocks as Block[])}
                                className="p-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl border border-white/10 hover:border-white/30 transition-all text-left group/tpl"
                              >
                                <tpl.icon size={16} className="text-white/60 group-hover/tpl:text-white/90 transition-colors mb-1" />
                                <div className="text-white/90 text-[11px] font-semibold">{tpl.title}</div>
                                <div className="text-white/40 text-[9px] mt-0.5">{tpl.desc}</div>
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
  );
};
