import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NotebookView } from './components/NotebookView';
import { LayoutGenerator } from './components/LayoutGenerator';
import { LandingPage } from './components/LandingPage';
import { Notebook, NotebookPage, BlockType } from '@papergrid/core';
import { generateLayout } from './services/geminiService';
import { Book, Plus, Sparkles, Menu, ChevronLeft, ChevronRight, Bookmark, AlertCircle, CheckCircle2, X } from 'lucide-react';

const STORAGE_KEY = 'papergrid_notebooks';

const initialNotebook: Notebook = {
  id: 'nb-1',
  title: 'My Journal',
  coverColor: 'bg-indigo-900',
  createdAt: new Date().toISOString(),
  bookmarks: [],
  pages: [
    {
      id: 'init-1',
      title: 'Welcome',
      createdAt: new Date().toISOString(),
      paperType: 'lined',
      blocks: [
        { id: 'b1', type: BlockType.HEADING, content: 'Welcome to PaperGrid', side: 'left' },
        { id: 'b2', type: BlockType.TEXT, content: 'This is a digital notebook that feels real. The text sits right on the lines.', side: 'left' },
        { id: 'b3', type: BlockType.CHECKBOX, content: 'Try the AI Generator for structured layouts', checked: false, side: 'right' },
      ]
    }
  ]
};

// ─── Toast Component ────────────────────────────────────────
interface ToastData {
  id: number;
  message: string;
  type: 'error' | 'success';
}

const Toast: React.FC<{ toast: ToastData; onDismiss: (id: number) => void }> = ({ toast, onDismiss }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md max-w-sm ${
        isExiting ? 'toast-exit' : 'toast-enter'
      } ${
        toast.type === 'error'
          ? 'bg-red-950/90 border-red-800/50 text-red-100'
          : 'bg-emerald-950/90 border-emerald-800/50 text-emerald-100'
      }`}
    >
      {toast.type === 'error' ? (
        <AlertCircle size={18} className="text-red-400 shrink-0" />
      ) : (
        <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
      )}
      <span className="text-sm font-medium flex-1">{toast.message}</span>
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

// ─── Main App ───────────────────────────────────────────────
export default function App() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([initialNotebook]);
  const [activeNotebookId, setActiveNotebookId] = useState<string>(initialNotebook.id);
  const [activePageIndex, setActivePageIndex] = useState<number>(-1);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [showLanding, setShowLanding] = useState(true);

  // Transition states
  const [isLandingExiting, setIsLandingExiting] = useState(false);
  const [isDashboardEntering, setIsDashboardEntering] = useState(false);
  const [contentKey, setContentKey] = useState(0); // forces re-mount for animation
  const [pageDirection, setPageDirection] = useState<'left' | 'right' | null>(null);

  // Toast state
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const toastCounter = useRef(0);

  const addToast = useCallback((message: string, type: 'error' | 'success') => {
    const id = ++toastCounter.current;
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const landingPref = localStorage.getItem('papergrid_landing_hide');
    if (landingPref) setShowLanding(false);
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setNotebooks(parsed);
          setActiveNotebookId(parsed[0].id);
        }
      } catch (e) {
        console.error("Failed to load saved data");
      }
    }
  }, []);

  // Save to local storage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notebooks));
  }, [notebooks]);

  // ─── Smooth Landing → Dashboard Transition ──────────────
  const handleLaunchApp = () => {
    setIsLandingExiting(true);
    setTimeout(() => {
      setShowLanding(false);
      setIsDashboardEntering(true);
      localStorage.setItem('papergrid_landing_hide', 'true');
      // Clear entering state after animation completes
      setTimeout(() => setIsDashboardEntering(false), 600);
    }, 500); // Wait for landing fade-out
  };

  const activeNotebook = notebooks.find(n => n.id === activeNotebookId) || notebooks[0];
  const activePage = activePageIndex >= 0 && activePageIndex < activeNotebook.pages.length 
    ? activeNotebook.pages[activePageIndex] 
    : null;

  const handleUpdatePage = (updatedPage: NotebookPage) => {
    setNotebooks(prev => prev.map(nb => {
      if (nb.id !== activeNotebookId) return nb;
      return {
        ...nb,
        pages: nb.pages.map(p => p.id === updatedPage.id ? updatedPage : p)
      };
    }));
  };

  const handleNewNotebook = () => {
    const newNb: Notebook = {
      id: crypto.randomUUID(),
      title: 'New Notebook',
      coverColor: ['bg-indigo-900', 'bg-rose-900', 'bg-emerald-900', 'bg-slate-900'][Math.floor(Math.random() * 4)],
      createdAt: new Date().toISOString(),
      bookmarks: [],
      pages: []
    };
    setNotebooks([newNb, ...notebooks]);
    setActiveNotebookId(newNb.id);
    setActivePageIndex(-1);
    setContentKey(k => k + 1); // trigger animation
  };

  // ─── Notebook Switching with Animation ──────────────────
  const handleSwitchNotebook = (nbId: string) => {
    if (nbId === activeNotebookId) return;
    setContentKey(k => k + 1);
    setActiveNotebookId(nbId);
    setActivePageIndex(-1);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleNewPage = () => {
    const newPage: NotebookPage = {
      id: crypto.randomUUID(),
      title: '',
      createdAt: new Date().toISOString(),
      paperType: 'lined',
      blocks: []
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

  // ─── Page Navigation with Animation ─────────────────────
  const handlePageBack = () => {
    if (activePageIndex <= -1) return;
    setPageDirection('left');
    setActivePageIndex(prev => Math.max(-1, prev - 1));
  };

  const handlePageForward = () => {
    if (activePageIndex >= activeNotebook.pages.length) return;
    setPageDirection('right');
    setActivePageIndex(prev => prev + 1);
  };

  const handleOpenCover = () => {
    setPageDirection('right');
    setActivePageIndex(0);
  };

  const handleAiGeneration = async (prompt: string, industry?: string, aesthetic?: string) => {
    try {
      const layout = await generateLayout(prompt, industry, aesthetic);
      const newPage: NotebookPage = {
        id: crypto.randomUUID(),
        title: layout.title,
        createdAt: new Date().toISOString(),
        paperType: layout.paperType,
        blocks: layout.blocks,
        aesthetic: aesthetic || 'modern-planner',
        themeColor: layout.themeColor
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
      addToast('Layout generated successfully!', 'success');
    } catch (error) {
      addToast('Failed to generate layout. Please check your API key.', 'error');
    }
  };

  const toggleBookmark = () => {
    if (!activePage) return;
    setNotebooks(prev => prev.map(nb => {
      if (nb.id !== activeNotebookId) return nb;
      const isBookmarked = nb.bookmarks.includes(activePage.id);
      return {
        ...nb,
        bookmarks: isBookmarked 
          ? nb.bookmarks.filter(id => id !== activePage.id)
          : [...nb.bookmarks, activePage.id]
      };
    }));
  };

  // Determine animation class for page content
  const getPageAnimClass = () => {
    if (pageDirection === 'left') return 'anim-slide-left';
    if (pageDirection === 'right') return 'anim-slide-right';
    return 'anim-content-swap';
  };

  // ─── Landing Page ───────────────────────────────────────
  if (showLanding) {
    return <LandingPage onLaunch={handleLaunchApp} isExiting={isLandingExiting} />;
  }

  // ─── Dashboard ──────────────────────────────────────────
  return (
    <div className={`flex h-screen w-full bg-[#f0f2f5] font-sans text-gray-900 overflow-hidden ${isDashboardEntering ? 'anim-fade-in' : ''}`}>
      {/* Sidebar */}
      <aside 
        className={`${isSidebarOpen ? 'w-72 translate-x-0' : 'w-0 -translate-x-full'} 
        bg-[#1a1c23] text-gray-300 transition-all duration-300 ease-in-out flex flex-col border-r border-gray-800 absolute z-20 md:relative h-full shadow-2xl`}
      >
        <div className="p-6 flex items-center gap-3 text-white border-b border-gray-800/50">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
             <Book size={18} />
          </div>
          <span className="font-semibold text-lg tracking-tight">PaperGrid AI</span>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <div className="px-3 mb-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Notebooks</div>
          {notebooks.map(nb => (
            <button
              key={nb.id}
              onClick={() => handleSwitchNotebook(nb.id)}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all duration-200 ${
                activeNotebookId === nb.id 
                  ? 'bg-gray-800 text-white shadow-md border border-gray-700' 
                  : 'hover:bg-gray-800/50 hover:text-gray-100'
              }`}
            >
               <div className={`w-4 h-6 rounded-sm ${nb.coverColor} shadow-sm border border-white/10`}></div>
               <div className="overflow-hidden">
                 <div className="truncate font-medium text-sm">{nb.title || "Untitled"}</div>
                 <div className="text-[10px] text-gray-500 mt-0.5">{nb.pages.length} spreads</div>
               </div>
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-gray-800/50 space-y-3">
          <button 
             onClick={handleNewNotebook}
             className="w-full py-2.5 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg flex items-center justify-center gap-2 text-sm font-medium border border-gray-700 transition-colors"
          >
             <Plus size={16} />
             <span>New Notebook</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative flex flex-col h-full overflow-hidden items-center justify-center p-4 md:p-12">
        {/* Mobile Header / Sidebar Toggle */}
        <div className="absolute top-4 left-4 z-30">
           <button 
             onClick={() => setIsSidebarOpen(!isSidebarOpen)}
             className="p-2 bg-white/80 backdrop-blur rounded-lg shadow-sm border border-gray-200 text-gray-700 hover:bg-white transition-colors"
           >
             <Menu size={20} />
           </button>
        </div>

        {/* Navigation & Actions */}
        <div className="absolute top-4 right-4 z-30 flex gap-2">
           {activePage && (
             <>
               <button 
                 onClick={toggleBookmark}
                 className={`p-2 backdrop-blur rounded-lg shadow-sm border transition-colors ${
                   activeNotebook.bookmarks.includes(activePage.id) 
                     ? 'bg-amber-100 border-amber-300 text-amber-600' 
                     : 'bg-white/80 border-gray-200 text-gray-700 hover:bg-white'
                 }`}
                 title="Bookmark Page"
               >
                 <Bookmark size={20} fill={activeNotebook.bookmarks.includes(activePage.id) ? "currentColor" : "none"} />
               </button>
               <button 
                 onClick={() => setIsGeneratorOpen(true)}
                 className="py-2 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-lg flex items-center justify-center gap-2 text-sm font-medium shadow-lg shadow-indigo-900/50 transition-all transform hover:scale-[1.02]"
               >
                 <Sparkles size={16} />
                 <span>AI Layout</span>
               </button>
             </>
           )}
        </div>

        {/* Notebook Container */}
        <div className="w-full max-w-6xl h-full flex items-center justify-center relative">
           
           {/* Left Navigation Arrow */}
           {activePageIndex >= 0 && (
             <button 
               onClick={handlePageBack}
               className="absolute left-0 md:-left-12 z-40 p-3 bg-white/80 hover:bg-white rounded-full shadow-lg text-gray-600 transition-all duration-200 hover:-translate-x-1 hover:shadow-xl"
             >
               <ChevronLeft size={24} />
             </button>
           )}

           {/* The Book — animated wrapper */}
           <div
             key={`${activeNotebookId}-${activePageIndex}-${contentKey}`}
             className={`w-full h-full max-h-[900px] relative ${getPageAnimClass()}`}
             onAnimationEnd={() => setPageDirection(null)}
           >
             {activePageIndex === -1 ? (
               /* Cover View */
               <div className="w-full max-w-2xl mx-auto h-full flex items-center justify-center">
                 <div 
                   className={`w-full h-full max-h-[800px] ${activeNotebook.coverColor} rounded-r-3xl rounded-l-md shadow-2xl relative cursor-pointer group transition-transform duration-300 hover:scale-[1.01]`}
                   onClick={handleOpenCover}
                 >
                   {/* Book spine texture */}
                   <div className="absolute left-0 top-0 bottom-0 w-12 bg-black/20 rounded-l-md border-r border-white/10"></div>
                   <div className="absolute left-10 top-0 bottom-0 w-px bg-white/20"></div>
                   
                   <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
                     <input 
                       className="bg-transparent text-white/90 text-4xl md:text-6xl font-serif font-bold text-center border-b border-transparent hover:border-white/30 focus:border-white/50 focus:outline-none transition-colors w-full"
                       value={activeNotebook.title}
                       onChange={(e) => {
                         setNotebooks(prev => prev.map(nb => nb.id === activeNotebookId ? {...nb, title: e.target.value} : nb));
                       }}
                       onClick={(e) => e.stopPropagation()}
                     />
                     <div className="mt-8 text-white/60 font-sans tracking-widest uppercase text-sm">
                       {activeNotebook.pages.length} Spreads
                     </div>
                     <div className="mt-12 opacity-0 group-hover:opacity-100 transition-opacity text-white/80 flex items-center gap-2 bg-black/20 px-4 py-2 rounded-full">
                       <span>Click to open</span>
                       <ChevronRight size={16} />
                     </div>
                   </div>
                 </div>
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
                   }
                 }}
               />
             ) : (
               /* Empty State (End of book) */
               <div className="w-full h-full flex flex-col items-center justify-center bg-white/50 backdrop-blur rounded-2xl border-2 border-dashed border-gray-300">
                 <Book size={48} className="text-gray-300 mb-4" />
                 <h3 className="text-xl font-medium text-gray-600 mb-2">End of Notebook</h3>
                 <button 
                   onClick={handleNewPage}
                   className="py-2.5 px-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-2 font-medium shadow-md transition-colors"
                 >
                   <Plus size={18} /> Add New Spread
                 </button>
               </div>
             )}
           </div>

           {/* Right Navigation Arrow */}
           {activePageIndex !== -1 && activePageIndex < activeNotebook.pages.length && (
             <button 
               onClick={handlePageForward}
               className="absolute right-0 md:-right-12 z-40 p-3 bg-white/80 hover:bg-white rounded-full shadow-lg text-gray-600 transition-all duration-200 hover:translate-x-1 hover:shadow-xl"
             >
               <ChevronRight size={24} />
             </button>
           )}

        </div>
      </main>

      <LayoutGenerator 
        isOpen={isGeneratorOpen}
        onClose={() => setIsGeneratorOpen(false)}
        onGenerate={handleAiGeneration}
      />

      {/* Toast Notification Container */}
      {toasts.length > 0 && (
        <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3">
          {toasts.map(toast => (
            <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </div>
      )}
    </div>
  );
}