import React, { useState } from 'react';
import { Sparkles, X, Loader2, Briefcase } from 'lucide-react';

interface LayoutGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (prompt: string, industry?: string, aesthetic?: string) => Promise<void>;
}

export const LayoutGenerator: React.FC<LayoutGeneratorProps> = ({ isOpen, onClose, onGenerate }) => {
  const [prompt, setPrompt] = useState('');
  const [industry, setIndustry] = useState('');
  const [aesthetic, setAesthetic] = useState('modern-planner');
  const [isLoading, setIsLoading] = useState(false);

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
      setAesthetic('modern-planner');
    } catch (error) {
      // Error handling is done in parent or logged
    } finally {
      setIsLoading(false);
    }
  };

  const aesthetics = [
    { id: 'modern-planner', label: 'Ultimate Planner', icon: '📱' },
    { id: 'e-ink', label: 'E-Ink Focus', icon: '📓' },
    { id: 'bujo', label: 'Bullet Journal', icon: '✍️' },
    { id: 'cornell', label: 'Cornell Notes', icon: '📝' },
  ];

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 transform transition-all scale-100">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-6 flex justify-between items-start border-b border-gray-700">
          <div>
            <h2 className="text-xl font-sans font-bold text-white flex items-center gap-2">
              <Sparkles className="text-yellow-400" size={20} />
              AI Page Designer
            </h2>
            <p className="text-sm text-gray-300 mt-1">Generate structured layouts for any purpose.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 bg-white space-y-4">
          
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Industry / Topic</label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-200 focus:border-gray-400 outline-none font-sans text-gray-700"
                placeholder="e.g. Finance, Education, Fitness, Construction..."
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Aesthetic Style</label>
            <div className="grid grid-cols-4 gap-2">
              {aesthetics.map((style) => (
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
              className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-200 focus:border-gray-400 outline-none resize-none font-sans text-gray-700 min-h-[100px]"
              placeholder="What do you need? (e.g. 'Monthly budget planner with rows for income and expenses')"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              autoFocus
            />
          </div>
            
            {/* Suggestions */}
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {['Project Tracker', 'Lesson Plan', 'Workout Log', 'Meeting Minutes'].map(suggestion => (
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
                  Generating Layers...
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
      </div>
    </div>
  );
};