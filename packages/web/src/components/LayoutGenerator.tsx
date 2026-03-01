import React, { useState, useMemo } from 'react';
import { Sparkles, X, Loader2, Briefcase } from 'lucide-react';

interface LayoutGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (prompt: string, industry?: string, aesthetic?: string) => Promise<void>;
}

const AESTHETICS = [
  { id: 'pastel', label: 'Pastel & Soft', icon: '\uD83C\uDF38', font: 'font-hand', blocks: ['HEADING', 'CHECKBOX', 'CHECKBOX', 'GRID', 'CALLOUT', 'MOOD_TRACKER'] },
  { id: 'modern-planner', label: 'Ultimate Planner', icon: '\uD83D\uDCF1', font: 'font-sans', blocks: ['HEADING', 'CHECKBOX', 'CHECKBOX', 'CHECKBOX', 'GRID', 'DIVIDER'] },
  { id: 'bujo', label: 'Bullet Journal', icon: '\u270D\uFE0F', font: 'font-hand', blocks: ['HEADING', 'CHECKBOX', 'CHECKBOX', 'TEXT', 'MOOD_TRACKER'] },
  { id: 'rainbow', label: 'ADHD Rainbow', icon: '\uD83C\uDF08', font: 'font-hand', blocks: ['HEADING', 'CHECKBOX', 'CHECKBOX', 'PRIORITY_MATRIX', 'CALLOUT'] },
  { id: 'e-ink', label: 'E-Ink Focus', icon: '\uD83D\uDCD3', font: 'font-sans', blocks: ['HEADING', 'TEXT', 'TEXT', 'DIVIDER', 'TEXT'] },
  { id: 'cornell', label: 'Cornell Notes', icon: '\uD83D\uDCDD', font: 'font-serif', blocks: ['HEADING', 'TEXT', 'CALLOUT', 'DIVIDER', 'TEXT'] },
];

const SUGGESTIONS = [
  'Weekly Planner',
  'Daily Schedule',
  'Habit Tracker',
  'Meal Planner',
  'Study Plan',
  'Budget Tracker',
  'Workout Log',
  'Meeting Notes',
];

// Wireframe block labels for preview
const BLOCK_PREVIEW: Record<string, { height: string; label: string; style: string }> = {
  HEADING:         { height: 'h-5', label: 'Heading',  style: 'bg-gray-300 rounded' },
  TEXT:            { height: 'h-3', label: 'Text',     style: 'bg-gray-200 rounded' },
  CHECKBOX:        { height: 'h-3', label: 'Task',     style: 'bg-gray-200 rounded' },
  GRID:            { height: 'h-8', label: 'Table',    style: 'bg-gray-100 border border-gray-300 rounded' },
  DIVIDER:         { height: 'h-px', label: '',        style: 'bg-gray-300' },
  CALLOUT:         { height: 'h-6', label: 'Callout',  style: 'bg-amber-100 border border-amber-200 rounded' },
  QUOTE:           { height: 'h-4', label: 'Quote',    style: 'bg-gray-100 border-l-2 border-gray-300 rounded-r' },
  MOOD_TRACKER:    { height: 'h-4', label: 'Mood',     style: 'bg-gray-100 rounded' },
  PRIORITY_MATRIX: { height: 'h-10', label: 'Matrix',  style: 'bg-gray-100 border border-gray-200 rounded grid grid-cols-2 grid-rows-2 gap-px' },
};

export const LayoutGenerator: React.FC<LayoutGeneratorProps> = ({ isOpen, onClose, onGenerate }) => {
  const [prompt, setPrompt] = useState('');
  const [industry, setIndustry] = useState('');
  const [aesthetic, setAesthetic] = useState('pastel');
  const [isLoading, setIsLoading] = useState(false);

  const activeAesthetic = useMemo(() => AESTHETICS.find(a => a.id === aesthetic), [aesthetic]);

  // Close on Escape key
  React.useEffect(() => {
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
      await onGenerate(prompt, industry, aesthetic);
      onClose();
      setPrompt('');
      setIndustry('');
      setAesthetic('pastel');
    } catch (error) {
      // Error handling is done in parent
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="layout-generator-title">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 transform transition-all scale-100">

        {/* Header */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-6 flex justify-between items-start border-b border-gray-700">
          <div>
            <h2 id="layout-generator-title" className="text-xl font-sans font-bold text-white flex items-center gap-2">
              <Sparkles className="text-yellow-400" size={20} />
              AI Page Designer
            </h2>
            <p className="text-sm text-gray-300 mt-1">Generate structured layouts for any purpose.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>

        {/* Body - Two Column Layout */}
        <div className="flex flex-col md:flex-row">
          {/* Left: Form */}
          <form onSubmit={handleSubmit} className="flex-1 p-6 bg-white space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Industry / Topic</label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <input
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-200 focus:border-gray-400 outline-none font-sans text-gray-700"
                  placeholder="e.g. Finance, Education, Fitness..."
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Aesthetic Style</label>
              <div className="grid grid-cols-3 gap-2">
                {AESTHETICS.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setAesthetic(style.id)}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                      aesthetic === style.id
                        ? 'bg-gray-900 border-gray-900 text-white shadow-md'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-lg mb-1">{style.icon}</span>
                    <span className="text-[10px] font-bold uppercase tracking-tighter">{style.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Description</label>
              <textarea
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-200 focus:border-gray-400 outline-none resize-none font-sans text-gray-700 min-h-[80px]"
                placeholder="What do you need? (e.g. 'Monthly budget planner with rows for income and expenses')"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                autoFocus
              />
            </div>

            {/* Suggestions */}
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {SUGGESTIONS.map(suggestion => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setPrompt(suggestion)}
                  className="px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors whitespace-nowrap"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg mr-2 font-medium text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !prompt.trim()}
                className="flex items-center gap-2 px-6 py-2 bg-gray-900 hover:bg-black disabled:bg-gray-400 text-white rounded-lg font-medium text-sm transition-colors shadow-lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Create Layout
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Right: Live Preview */}
          <div className="hidden md:flex w-56 bg-gray-50 border-l border-gray-100 p-4 flex-col">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Preview</div>
            <div className="flex-1 bg-white rounded-lg border border-gray-200 shadow-sm p-3 overflow-hidden relative">
              {/* Paper lines background */}
              <div className="absolute inset-0 opacity-30" style={{
                backgroundImage: 'linear-gradient(transparent 11px, #cbd5e1 11px)',
                backgroundSize: '100% 12px',
              }} />

              {/* Wireframe blocks */}
              <div className="relative z-10 space-y-2">
                {/* Title wireframe */}
                <div className={`h-3 w-2/3 bg-gray-400 rounded mb-3 ${activeAesthetic?.font || 'font-sans'}`} />

                {activeAesthetic?.blocks.map((blockType, i) => {
                  const preview = BLOCK_PREVIEW[blockType];
                  if (!preview) return null;
                  return (
                    <div key={i} className="flex items-center gap-1.5">
                      {blockType === 'CHECKBOX' && (
                        <div className="w-2.5 h-2.5 border border-gray-300 rounded-sm shrink-0" />
                      )}
                      {blockType === 'DIVIDER' ? (
                        <div className={`w-full ${preview.height} ${preview.style}`} />
                      ) : (
                        <div className={`w-full ${preview.height} ${preview.style}`}>
                          {preview.label && (
                            <span className="text-[7px] text-gray-400 px-1 leading-none">{preview.label}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Right page wireframe */}
                <div className="mt-4 pt-3 border-t border-dashed border-gray-200">
                  <div className="h-2 w-1/2 bg-gray-200 rounded mb-2" />
                  <div className="h-2 w-3/4 bg-gray-200 rounded mb-2" />
                  <div className="h-2 w-1/3 bg-gray-200 rounded" />
                </div>
              </div>

              {/* Style label */}
              <div className="absolute bottom-2 right-2">
                <span className="text-[8px] font-bold text-gray-300 uppercase">{activeAesthetic?.label}</span>
              </div>
            </div>

            {prompt && (
              <div className="mt-3 text-[10px] text-gray-400 leading-relaxed line-clamp-3">
                <span className="font-bold">Prompt:</span> {prompt}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
