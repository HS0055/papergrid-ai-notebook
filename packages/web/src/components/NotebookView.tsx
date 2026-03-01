import React from 'react';
import { NotebookPage, Block, BlockType } from '@papergrid/core';
import { BlockComponent } from './BlockComponent';
import { Plus, Info, Quote, Minus, Smile, LayoutGrid, List } from 'lucide-react';

interface NotebookViewProps {
  page: NotebookPage;
  onUpdatePage: (updatedPage: NotebookPage) => void;
  allPages?: NotebookPage[];
  onNavigate?: (pageId: string) => void;
}

export const NotebookView: React.FC<NotebookViewProps> = ({ page, onUpdatePage, allPages, onNavigate }) => {
  
  const handleBlockChange = (id: string, updated: Partial<Block>) => {
    const newBlocks = page.blocks.map(b => b.id === id ? { ...b, ...updated } : b);
    onUpdatePage({ ...page, blocks: newBlocks });
  };

  const handleBlockDelete = (id: string) => {
    const newBlocks = page.blocks.filter(b => b.id !== id);
    onUpdatePage({ ...page, blocks: newBlocks });
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
      moodValue: type === BlockType.MOOD_TRACKER ? 2 : undefined
    };
    onUpdatePage({ ...page, blocks: [...page.blocks, newBlock] });
  };

  // Determine background class based on paper type
  const bgClass = {
    lined: 'paper-lines',
    grid: 'paper-grid',
    dotted: 'paper-dots',
    blank: 'bg-paper',
    music: 'paper-music',
    rows: 'paper-rows',
    isometric: 'paper-isometric',
    hex: 'paper-hex',
    legal: 'paper-legal',
    crumpled: 'paper-crumpled'
  }[page.paperType || 'lined'];

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

  const BlockAdder = ({ side }: { side: 'left' | 'right' }) => (
    <div className="h-20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity mt-4 group">
        <div className="flex flex-wrap justify-center gap-2 bg-white/80 backdrop-blur shadow-lg rounded-full p-2 border border-gray-200 transform translate-y-2 group-hover:translate-y-0 transition-all max-w-[90%]">
           <button onClick={() => addBlock(BlockType.TEXT, side)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600 text-xs flex flex-col items-center gap-1 w-12">
              <span className="font-serif font-bold text-lg">T</span>
              <span>Text</span>
           </button>
           <button onClick={() => addBlock(BlockType.HEADING, side)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600 text-xs flex flex-col items-center gap-1 w-12">
              <span className="font-bold text-lg">H1</span>
              <span>Head</span>
           </button>
           <button onClick={() => addBlock(BlockType.CHECKBOX, side)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600 text-xs flex flex-col items-center gap-1 w-12">
              <span className="text-lg">☑</span>
              <span>Task</span>
           </button>
           <button onClick={() => addBlock(BlockType.GRID, side)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600 text-xs flex flex-col items-center gap-1 w-12">
              <span className="text-lg">▦</span>
              <span>Grid</span>
           </button>
           <button onClick={() => addBlock(BlockType.CALLOUT, side)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600 text-xs flex flex-col items-center gap-1 w-12">
              <Info size={18} />
              <span>Callout</span>
           </button>
           <button onClick={() => addBlock(BlockType.QUOTE, side)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600 text-xs flex flex-col items-center gap-1 w-12">
              <Quote size={18} />
              <span>Quote</span>
           </button>
           <button onClick={() => addBlock(BlockType.DIVIDER, side)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600 text-xs flex flex-col items-center gap-1 w-12">
              <Minus size={18} />
              <span>Divider</span>
           </button>
           <button onClick={() => addBlock(BlockType.MOOD_TRACKER, side)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600 text-xs flex flex-col items-center gap-1 w-12">
              <Smile size={18} />
              <span>Mood</span>
           </button>
           <button onClick={() => addBlock(BlockType.PRIORITY_MATRIX, side)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600 text-xs flex flex-col items-center gap-1 w-12">
              <LayoutGrid size={18} />
              <span>Matrix</span>
           </button>
           <button onClick={() => addBlock(BlockType.INDEX, side)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600 text-xs flex flex-col items-center gap-1 w-12">
              <List size={18} />
              <span>Index</span>
           </button>
        </div>
    </div>
  );

  return (
    <div className="flex-1 h-full overflow-hidden bg-[#e5e5e5] flex justify-center p-4 md:p-8 relative">
       {/* Book Cover */}
       <div className="w-full max-w-6xl h-full bg-slate-800 p-1 md:p-2 rounded-xl shadow-2xl flex flex-col md:flex-row relative">
          
          {/* Left Page */}
          <div className={`flex-1 h-full bg-paper rounded-t-lg md:rounded-l-lg md:rounded-tr-none overflow-hidden relative flex flex-col border-b md:border-b-0 md:border-r border-black/20`}>
             {/* Center Fold Shadow */}
             <div className="hidden md:block absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-black/20 to-transparent pointer-events-none z-20"></div>
             <div className="md:hidden absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/20 to-transparent pointer-events-none z-20"></div>
             
             <div className="h-16 border-b border-gray-200 flex items-end px-6 md:px-10 pb-2 bg-gradient-to-b from-white to-gray-50 shrink-0">
               <input
                 className={`w-full text-3xl md:text-4xl text-gray-800 bg-transparent outline-none placeholder-gray-300 ${titleFontClass}`}
                 value={page.title}
                 onChange={(e) => onUpdatePage({...page, title: e.target.value})}
                 placeholder="Untitled Page"
               />
             </div>

             <div className={`flex-1 overflow-y-auto px-6 md:px-10 py-8 ${bgClass} relative`}>
                {page.paperType !== 'blank' && page.paperType !== 'legal' && page.paperType !== 'crumpled' && (
                  <div className={`absolute top-0 bottom-0 left-12 md:left-16 w-px ${marginColorClass} pointer-events-none z-0`}></div>
                )}
                <div className="relative z-10 min-h-full pb-32">
                   {leftBlocks.length === 0 && (
                      <div className="text-gray-400 font-hand text-2xl text-center mt-20 opacity-50 select-none">
                         Tap '+' to start writing on the left page...
                      </div>
                   )}
                   {leftBlocks.map(block => (
                     <BlockComponent key={block.id} block={block} onChange={handleBlockChange} onDelete={handleBlockDelete} allPages={allPages} onNavigate={onNavigate} />
                   ))}
                   <BlockAdder side="left" />
                </div>
             </div>
          </div>

          {/* Center Binding Visual (Desktop only) */}
          <div className="hidden md:block w-1 h-full bg-black/40 shadow-[0_0_10px_rgba(0,0,0,0.5)] z-30"></div>

          {/* Right Page */}
          <div className={`flex-1 h-full bg-paper rounded-b-lg md:rounded-r-lg md:rounded-bl-none overflow-hidden relative flex flex-col border-t md:border-t-0 md:border-l border-white/50`}>
             {/* Center Fold Shadow */}
             <div className="hidden md:block absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-black/20 to-transparent pointer-events-none z-20"></div>
             <div className="md:hidden absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-black/20 to-transparent pointer-events-none z-20"></div>
             
             <div className="h-16 border-b border-gray-200 flex items-end justify-between px-6 md:px-10 pb-2 bg-gradient-to-b from-white to-gray-50 shrink-0">
               <select 
                 className="bg-transparent text-xs font-sans text-gray-400 mb-2 uppercase tracking-widest outline-none cursor-pointer hover:text-gray-600"
                 value={page.paperType || 'lined'}
                 onChange={(e) => onUpdatePage({...page, paperType: e.target.value as any})}
               >
                 <option value="lined">Lined</option>
                 <option value="legal">Legal Pad</option>
                 <option value="rows">Rows</option>
                 <option value="grid">Grid</option>
                 <option value="dotted">Dotted</option>
                 <option value="music">Music</option>
                 <option value="isometric">Isometric</option>
                 <option value="hex">Hex</option>
                 <option value="blank">Blank</option>
                 <option value="crumpled">Crumpled</option>
               </select>
               <div className="text-xs font-sans text-gray-400 mb-2 uppercase tracking-widest whitespace-nowrap">
                  {new Date(page.createdAt).toLocaleDateString()}
               </div>
             </div>

             <div className={`flex-1 overflow-y-auto px-6 md:px-10 py-8 ${bgClass} relative`}>
                {page.paperType !== 'blank' && page.paperType !== 'legal' && page.paperType !== 'crumpled' && (
                  <div className={`absolute top-0 bottom-0 left-12 md:left-16 w-px ${marginColorClass} pointer-events-none z-0`}></div>
                )}
                <div className="relative z-10 min-h-full pb-32">
                   {rightBlocks.length === 0 && (
                      <div className="text-gray-400 font-hand text-2xl text-center mt-20 opacity-50 select-none">
                         Tap '+' to start writing on the right page...
                      </div>
                   )}
                   {rightBlocks.map(block => (
                     <BlockComponent key={block.id} block={block} onChange={handleBlockChange} onDelete={handleBlockDelete} allPages={allPages} onNavigate={onNavigate} />
                   ))}
                   <BlockAdder side="right" />
                </div>
             </div>
          </div>

       </div>
    </div>
  );
};
