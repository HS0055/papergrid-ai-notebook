import React, { useState, useRef, useEffect } from 'react';
import {
    Sparkles, X, Wand2, Image as ImageIcon,
    Paintbrush, BookOpen, Leaf, Moon, Sun, Gem, Flame, Palette
} from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';
import { ImpactStyle, NotificationType } from '@capacitor/haptics';

interface CoverGenModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (prompt: string, aesthetic?: string) => Promise<{ imageUrl: string }>;
    onApply: (imageUrl: string) => void | Promise<void>;
    currentCoverUrl?: string;
    isGenerating: boolean;
}

const PROMPT_SUGGESTIONS = [
    { label: 'Leather & Gold', prompt: 'Rich brown leather with gold foil geometric patterns', icon: <BookOpen size={14} /> },
    { label: 'Watercolor Botanicals', prompt: 'Soft watercolor botanical illustrations with pressed flowers and leaves', icon: <Leaf size={14} /> },
    { label: 'Dark Academia', prompt: 'Dark navy leather with constellation map embossed in silver', icon: <Moon size={14} /> },
    { label: 'Minimalist Linen', prompt: 'Clean white linen texture with subtle debossed logo', icon: <Sun size={14} /> },
    { label: 'Jewel Tone Marble', prompt: 'Deep emerald and gold marble pattern with Art Deco borders', icon: <Gem size={14} /> },
    { label: 'Sunset Gradient', prompt: 'Warm sunset gradient from coral to deep purple with soft clouds', icon: <Flame size={14} /> },
    { label: 'Japanese Washi', prompt: 'Traditional Japanese washi paper texture with cherry blossom print', icon: <Palette size={14} /> },
    { label: 'Velvet Night', prompt: 'Deep midnight blue velvet texture with scattered silver stars', icon: <Sparkles size={14} /> },
];

const AESTHETIC_STYLES = [
    { id: 'leather', label: 'Leather', desc: 'Classic leather journal' },
    { id: 'minimal', label: 'Minimal', desc: 'Clean and modern' },
    { id: 'artistic', label: 'Artistic', desc: 'Watercolor & paint' },
    { id: 'luxury', label: 'Luxury', desc: 'Gold foil & marble' },
    { id: 'nature', label: 'Nature', desc: 'Botanical & organic' },
    { id: 'dark', label: 'Dark', desc: 'Moody & dramatic' },
];

export const CoverGenModal: React.FC<CoverGenModalProps> = ({
    isOpen,
    onClose,
    onGenerate,
    onApply,
    currentCoverUrl,
    isGenerating,
}) => {
    const [prompt, setPrompt] = useState('');
    const [aesthetic, setAesthetic] = useState('leather');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isApplying, setIsApplying] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isOpen && textareaRef.current) {
            setTimeout(() => textareaRef.current?.focus(), 100);
        }
        if (!isOpen) {
            setPreviewUrl(null);
            setError(null);
            setIsApplying(false);
        }
    }, [isOpen]);

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError('Please describe your cover design');
            return;
        }
        setError(null);
        triggerHaptic.impact(ImpactStyle.Medium); // Initial impact for starting generation
        try {
            const style = AESTHETIC_STYLES.find(s => s.id === aesthetic);
            const fullAesthetic = style ? `${style.label} — ${style.desc}` : aesthetic;
            const data = await onGenerate(prompt.trim(), fullAesthetic);
            if (!data?.imageUrl) {
                throw new Error('No image returned');
            }
            setPreviewUrl(data.imageUrl);
            triggerHaptic.notification(NotificationType.Success); // Tactile success feedback
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to generate cover');
            triggerHaptic.notification(NotificationType.Error);
        }
    };

    const handleApply = async () => {
        if (previewUrl) {
            triggerHaptic.impact(ImpactStyle.Heavy); // Affirmative impact
            setError(null);
            setIsApplying(true);
            try {
                await onApply(previewUrl);
                onClose();
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to apply cover');
                triggerHaptic.notification(NotificationType.Error);
            } finally {
                setIsApplying(false);
            }
        }
    };

    const handleSuggestionClick = (suggestion: typeof PROMPT_SUGGESTIONS[0]) => {
        triggerHaptic.impact(ImpactStyle.Light);
        setPrompt(suggestion.prompt);
        setPreviewUrl(null);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-md"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-2xl bg-gradient-to-b from-slate-900 to-slate-950 rounded-3xl border border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 pb-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                            <Wand2 size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">AI Cover Designer</h2>
                            <p className="text-xs text-white/40">Powered by Gemini Image</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* Prompt Input */}
                    <div>
                        <label className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2 block">
                            Describe Your Cover
                        </label>
                        <textarea
                            ref={textareaRef}
                            value={prompt}
                            onChange={(e) => { setPrompt(e.target.value); setError(null); }}
                            placeholder="Rich burgundy leather with gold foil art deco patterns and a compass rose embossed in the center..."
                            rows={3}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/20 text-sm resize-none focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.08] transition-all"
                        />
                        {error && (
                            <p className="text-red-400 text-xs mt-1.5">{error}</p>
                        )}
                    </div>

                    {/* Aesthetic Style Selector */}
                    <div>
                        <label className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2 block">
                            Cover Style
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {AESTHETIC_STYLES.map((style) => (
                                <button
                                    key={style.id}
                                    onClick={() => {
                                        setAesthetic(style.id);
                                        triggerHaptic.impact(ImpactStyle.Light);
                                    }}
                                    className={`px-3 py-2.5 rounded-xl text-left transition-all ${aesthetic === style.id
                                        ? 'bg-indigo-600/20 border-indigo-500/40 border text-white'
                                        : 'bg-white/[0.03] border border-white/5 text-white/50 hover:text-white/70 hover:border-white/10'
                                        }`}
                                >
                                    <div className="text-xs font-medium">{style.label}</div>
                                    <div className="text-[10px] text-white/30 mt-0.5">{style.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Quick Prompts */}
                    <div>
                        <label className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2 block">
                            Quick Prompts
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {PROMPT_SUGGESTIONS.map((suggestion, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleSuggestionClick(suggestion)}
                                    className="flex items-center gap-2.5 px-3 py-2.5 bg-white/[0.03] border border-white/5 rounded-xl text-left hover:bg-white/[0.06] hover:border-white/10 transition-all group"
                                >
                                    <span className="text-white/30 group-hover:text-indigo-400 transition-colors">
                                        {suggestion.icon}
                                    </span>
                                    <span className="text-xs text-white/50 group-hover:text-white/70 transition-colors">
                                        {suggestion.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Preview */}
                    {(previewUrl || isGenerating) && (
                        <div>
                            <label className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2 block">
                                Preview
                            </label>
                            <div className="relative aspect-[3/4] max-w-[240px] mx-auto rounded-2xl overflow-hidden border border-white/10 bg-white/[0.03]">
                                {isGenerating ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                                        <div className="relative">
                                            <div className="w-16 h-16 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                                            <Sparkles size={20} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-400 animate-pulse" />
                                        </div>
                                        <p className="text-white/40 text-xs animate-pulse">Generating your cover...</p>
                                        {/* Shimmer effect */}
                                        <div
                                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent"
                                            style={{ animation: 'shimmer 2s infinite', backgroundSize: '200% 100%' }}
                                        />
                                        <style>{`@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>
                                    </div>
                                ) : previewUrl ? (
                                    <img
                                        src={previewUrl}
                                        alt="Generated cover preview"
                                        className="w-full h-full object-cover"
                                    />
                                ) : null}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-6 pt-4 border-t border-white/5 flex items-center gap-3">
                    {previewUrl && !isGenerating && (
                        <button
                            onClick={handleApply}
                            disabled={isApplying}
                            className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ImageIcon size={16} />
                            {isApplying ? 'Applying...' : 'Apply to Cover'}
                        </button>
                    )}
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || isApplying || !prompt.trim()}
                        className={`${previewUrl && !isGenerating ? 'flex-1' : 'w-full'} py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {isGenerating ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Wand2 size={16} />
                                {previewUrl ? 'Regenerate' : 'Generate Cover'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
