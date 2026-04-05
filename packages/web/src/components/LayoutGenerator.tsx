import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, X, Loader2, Briefcase, Wand2, ChevronRight, Layers, Palette } from 'lucide-react';
import { previewInkCost } from '../services/geminiService';

interface LayoutGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (prompt: string, industry?: string, aesthetic?: string, pageCount?: string) => Promise<void>;
}

const AESTHETICS = [
  { id: 'pastel', label: 'Pastel & Soft', icon: '🌸', font: 'font-hand', bg: 'bg-rose-50', color: 'text-rose-600', blocks: ['HEADING', 'CHECKBOX', 'CHECKBOX', 'GRID', 'CALLOUT', 'MOOD_TRACKER'] },
  { id: 'modern-planner', label: 'Ultimate Planner', icon: '📱', font: 'font-sans', bg: 'bg-indigo-50', color: 'text-indigo-600', blocks: ['HEADING', 'CHECKBOX', 'CHECKBOX', 'CHECKBOX', 'GRID', 'DIVIDER'] },
  { id: 'bujo', label: 'Bullet Journal', icon: '✍️', font: 'font-hand', bg: 'bg-amber-50', color: 'text-amber-600', blocks: ['HEADING', 'CHECKBOX', 'CHECKBOX', 'TEXT', 'MOOD_TRACKER'] },
  { id: 'rainbow', label: 'ADHD Rainbow', icon: '🌈', font: 'font-hand', bg: 'bg-emerald-50', color: 'text-emerald-600', blocks: ['HEADING', 'CHECKBOX', 'CHECKBOX', 'PRIORITY_MATRIX', 'CALLOUT'] },
  { id: 'e-ink', label: 'E-Ink Focus', icon: '📓', font: 'font-sans', bg: 'bg-gray-50', color: 'text-gray-600', blocks: ['HEADING', 'TEXT', 'TEXT', 'DIVIDER', 'TEXT'] },
  { id: 'cornell', label: 'Cornell Notes', icon: '📝', font: 'font-serif', bg: 'bg-slate-50', color: 'text-slate-600', blocks: ['HEADING', 'TEXT', 'CALLOUT', 'DIVIDER', 'TEXT'] },
];

const SUGGESTIONS = [
  'Weekly Planner',
  'Habit Tracker',
  'Meal Planner',
  'Study Plan',
  'Budget Tracker',
  'Workout Log',
  'Meeting Notes',
  'Travel Itinerary',
];

const BLOCK_PREVIEW: Record<string, { height: string; label: string; style: string }> = {
  HEADING:         { height: 'h-5', label: 'Heading',  style: 'bg-gray-300/50 rounded' },
  TEXT:            { height: 'h-3', label: 'Text',     style: 'bg-gray-200/40 rounded' },
  CHECKBOX:        { height: 'h-3', label: 'Task',     style: 'bg-gray-200/40 rounded' },
  GRID:            { height: 'h-10', label: 'Table',    style: 'bg-white/40 border border-gray-200 rounded shadow-sm' },
  DIVIDER:         { height: 'h-px', label: '',        style: 'bg-gray-200' },
  CALLOUT:         { height: 'h-8', label: 'Note',     style: 'bg-amber-50/60 border border-amber-100 rounded shadow-sm' },
  QUOTE:           { height: 'h-6', label: 'Quote',    style: 'bg-white/40 border-l-2 border-indigo-300 rounded-r' },
  MOOD_TRACKER:    { height: 'h-5', label: 'Mood',     style: 'bg-white/40 rounded-full border border-gray-100' },
  PRIORITY_MATRIX: { height: 'h-12', label: 'Matrix',  style: 'bg-white/40 border border-gray-200 rounded grid grid-cols-2 grid-rows-2 gap-px shadow-sm' },
};

export const LayoutGenerator: React.FC<LayoutGeneratorProps> = ({ isOpen, onClose, onGenerate }) => {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [industry, setIndustry] = useState('');
  const [aesthetic, setAesthetic] = useState('pastel');
  const [isLoading, setIsLoading] = useState(false);
  const [showFullUI, setShowFullUI] = useState(false);
  const [inkPreview, setInkPreview] = useState<{ cost: number; balance: number; canAfford: boolean } | null>(null);
  const [multiPage, setMultiPage] = useState(false);

  const activeAesthetic = useMemo(() => AESTHETICS.find(a => a.id === aesthetic), [aesthetic]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setShowFullUI(true), 50);
      return () => clearTimeout(timer);
    } else {
      setShowFullUI(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setInkPreview(null);
      return;
    }
    let cancelled = false;
    previewInkCost('layout').then((result) => {
      if (!cancelled) setInkPreview(result);
    });
    return () => { cancelled = true; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsLoading(true);
    try {
      await onGenerate(prompt, industry, aesthetic, multiPage ? 'auto' : '1');
      onClose();
      setPrompt('');
      setIndustry('');
      setAesthetic('pastel');
      setMultiPage(false);
    } catch (error) {
      // Parent handles toast
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 transition-all duration-500 ${showFullUI ? 'bg-black/40 backdrop-blur-md' : 'bg-black/0 backdrop-blur-0'}`} role="dialog" aria-modal="true">
      <div className={`bg-[#fdfbf7] rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden border border-white/20 flex flex-col md:flex-row transition-all duration-500 transform ${showFullUI ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-8 scale-95 opacity-0'}`} style={{ maxHeight: '90vh' }}>
        
        {/* Left Section: Controls */}
        <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
          {/* Header */}
          <div className="p-6 pb-2 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Sparkles className="text-white" size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">AI Page Designer</h2>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-widest mt-0.5">Powered by Papera Intelligence</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 transition-colors">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Description Area */}
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">The Vision</label>
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar max-w-[200px] sm:max-w-none">
                  {SUGGESTIONS.slice(0, 4).map(s => (
                    <button key={s} type="button" onClick={() => setPrompt(s)} className="text-[10px] px-2 py-0.5 bg-gray-100 hover:bg-indigo-50 text-gray-500 hover:text-indigo-600 rounded-full transition-colors whitespace-nowrap border border-transparent hover:border-indigo-100">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                className="w-full p-5 bg-white border-2 border-gray-100 rounded-2xl focus:border-indigo-500/30 focus:ring-0 outline-none resize-none font-hand text-xl text-gray-800 shadow-inner placeholder-gray-300 min-h-[120px] transition-all"
                placeholder="What should I build? (e.g. 'A structured reading log with a rating system and quotes section')"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                autoFocus
              />
            </div>

            {/* Industry & Aesthetic Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <Briefcase size={12} /> Industry / Context
                </label>
                <input
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:border-indigo-500/30 outline-none font-sans text-sm text-gray-700 shadow-sm"
                  placeholder="Finance, Health, Art..."
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <Palette size={12} /> Aesthetic Style
                </label>
                <div className="relative group">
                  <select 
                    value={aesthetic}
                    onChange={(e) => setAesthetic(e.target.value)}
                    className="w-full appearance-none px-4 py-3 bg-white border border-gray-200 rounded-xl focus:border-indigo-500/30 outline-none font-sans text-sm text-gray-700 shadow-sm cursor-pointer"
                  >
                    {AESTHETICS.map(a => (
                      <option key={a.id} value={a.id}>{a.icon} {a.label}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <ChevronRight size={14} className="rotate-90" />
                  </div>
                </div>
              </div>
            </div>

            {/* Aesthetic Quick Selection (Visual) */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {AESTHETICS.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setAesthetic(style.id)}
                  className={`group relative aspect-square rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                    aesthetic === style.id
                      ? 'border-indigo-500 bg-indigo-50 shadow-md scale-105'
                      : 'border-transparent bg-white hover:border-gray-200'
                  }`}
                >
                  <span className="text-2xl group-hover:scale-110 transition-transform">{style.icon}</span>
                  <span className={`text-[8px] font-bold uppercase tracking-tight text-center px-1 ${aesthetic === style.id ? 'text-indigo-600' : 'text-gray-400'}`}>
                    {style.id.split('-')[0]}
                  </span>
                </button>
              ))}
            </div>

            {/* Multi-Page Toggle */}
            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <Layers size={12} /> Multi-Page
              </label>
              <button
                type="button"
                onClick={() => setMultiPage(!multiPage)}
                className={`relative w-12 h-6 rounded-full transition-colors ${multiPage ? 'bg-indigo-600' : 'bg-gray-200'}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${multiPage ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-xs text-gray-500 ml-2 flex-1">
                {multiPage ? 'AI decides how many pages your request needs' : 'Single page only'}
              </span>
            </div>

            {/* Footer Actions */}
            <div className="pt-4 flex flex-col gap-3 border-t border-gray-100">
              {inkPreview && (
                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium ${inkPreview.canAfford ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                  {inkPreview.canAfford ? (
                    <span>This will use <strong>{inkPreview.cost} Ink</strong>. You have <strong>{inkPreview.balance} Ink</strong> remaining.</span>
                  ) : (
                    <span>
                      This requires <strong>{inkPreview.cost} Ink</strong> but you only have <strong>{inkPreview.balance}</strong>.{' '}
                      <button type="button" onClick={() => { onClose(); navigate('/pricing'); }} className="underline font-bold hover:text-red-900 transition-colors">Buy Ink</button>
                    </span>
                  )}
                </div>
              )}
              {isLoading && (
                <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-50 rounded-xl border border-indigo-100">
                  <Loader2 className="animate-spin text-indigo-500 shrink-0" size={16} />
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-indigo-700">Designing your pages...</div>
                    <div className="text-[10px] text-indigo-500 mt-0.5">AI is crafting the perfect layout. This may take up to 30 seconds.</div>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="text-[10px] text-gray-400 max-w-[200px]">
                  {multiPage ? 'AI will generate multiple pages with sequential dates.' : 'One focused page.'}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isLoading}
                    className="px-5 py-2.5 text-gray-500 hover:text-gray-700 font-bold uppercase tracking-widest text-[10px] transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Cancel' : 'Discard'}
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !prompt.trim() || (inkPreview !== null && !inkPreview.canAfford)}
                    className={`flex items-center gap-2 px-8 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 ${
                      isLoading
                        ? 'bg-indigo-400 text-white cursor-wait'
                        : (inkPreview !== null && !inkPreview.canAfford)
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:scale-[1.02] active:scale-95'
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Wand2 size={16} />
                        Generate Pages
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Right Section: Real-time Simulation Preview */}
        <div className="hidden md:flex w-80 bg-gray-50/50 border-l border-gray-100 p-8 flex-col">
          <div className="flex items-center justify-between mb-6">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Blueprint Preview</label>
            <Layers size={14} className="text-gray-300" />
          </div>
          
          <div className="flex-1 bg-white rounded-[2rem] border-2 border-gray-100 shadow-2xl shadow-black/5 p-6 overflow-hidden relative group">
            {/* Paper texture overlay */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/notebook.png')]" />
            
            {/* Simulated notebook lines */}
            <div className="absolute inset-0 opacity-20" style={{
              backgroundImage: 'linear-gradient(transparent 15px, #cbd5e1 15px)',
              backgroundSize: '100% 16px',
            }} />

            {/* Dynamic Preview Content */}
            <div className="relative z-10 space-y-4">
              {/* Animated Cursor Dot */}
              {isLoading && (
                <div className="absolute top-0 left-0 w-2 h-2 bg-indigo-500 rounded-full animate-ping shadow-[0_0_10px_rgba(79,70,229,0.8)]" />
              )}

              {/* Title wireframe */}
              <div className={`h-4 w-3/4 bg-gray-300/40 rounded-lg mb-6 transition-all duration-500 ${isLoading ? 'animate-pulse' : ''}`} />

              <div className="space-y-3">
                {activeAesthetic?.blocks.slice(0, 5).map((blockType, i) => {
                  const preview = BLOCK_PREVIEW[blockType];
                  if (!preview) return null;
                  return (
                    <div 
                      key={i} 
                      className={`flex items-center gap-2 transform transition-all duration-700 delay-[${i * 100}ms] ${showFullUI ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0'}`}
                    >
                      {blockType === 'CHECKBOX' && (
                        <div className="w-3 h-3 border-2 border-gray-200 rounded-md shrink-0 bg-white" />
                      )}
                      <div className={`w-full ${preview.height} ${preview.style} relative overflow-hidden group-hover:border-indigo-100 transition-colors`}>
                        {preview.label && (
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[6px] font-black uppercase tracking-tighter text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">
                            {preview.label}
                          </span>
                        )}
                        {isLoading && (
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-shimmer" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Spread Visualizer */}
              <div className="mt-8 flex gap-1 justify-center">
                <div className="w-12 h-1.5 bg-indigo-500 rounded-full" />
                <div className="w-1.5 h-1.5 bg-gray-200 rounded-full" />
                <div className="w-1.5 h-1.5 bg-gray-200 rounded-full" />
              </div>
            </div>

            {/* Aesthetic Badge */}
            <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border transition-all duration-500 ${activeAesthetic?.bg} ${activeAesthetic?.color} ${activeAesthetic?.color.replace('text-', 'border-').replace('-600', '-200')}`}>
              {activeAesthetic?.label}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-2 text-gray-400">
              <Wand2 size={12} />
              <span className="text-[10px] font-medium leading-none">Auto-tuning content for {industry || 'general'} niche...</span>
            </div>
            {prompt && (
              <div className="text-[10px] text-gray-400 italic leading-snug line-clamp-2 border-l-2 border-indigo-100 pl-3">
                "{prompt}"
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

