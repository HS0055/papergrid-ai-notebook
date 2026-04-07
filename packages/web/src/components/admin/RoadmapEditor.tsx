import React, { useState } from 'react';
import { Plus, Trash2, RotateCcw, Download, Upload, Eye, EyeOff, GripVertical } from 'lucide-react';
import {
  ROADMAP as DEFAULT_ROADMAP,
  STATUS_LABELS,
  type RoadmapItem,
  type RoadmapStatus,
} from '@papergrid/core';
import { useEditableConfig } from '../../hooks/useEditableConfig';
import { ROADMAP_STORAGE_KEY } from '../landing/RoadmapSection';

const STATUSES: RoadmapStatus[] = ['live', 'in_progress', 'coming_soon', 'planned'];

const STATUS_BADGE_COLORS: Record<RoadmapStatus, { bg: string; text: string }> = {
  live: { bg: '#dcfce7', text: '#059669' },
  in_progress: { bg: '#e0e7ff', text: '#4f46e5' },
  coming_soon: { bg: '#fef3c7', text: '#d97706' },
  planned: { bg: '#f1f5f9', text: '#64748b' },
};

const COMMON_ICONS = [
  'Sparkles', 'Image', 'FileText', 'LayoutGrid', 'Cloud', 'Download', 'Droplet',
  'Smartphone', 'PenTool', 'ShoppingBag', 'Store', 'Sticker', 'Volume2', 'Users',
  'ScanLine', 'Mic', 'UsersRound', 'Zap', 'Star', 'Heart', 'Calculator',
];

export const RoadmapEditor: React.FC = () => {
  const [roadmap, setRoadmap, reset] = useEditableConfig<readonly RoadmapItem[]>(
    ROADMAP_STORAGE_KEY,
    DEFAULT_ROADMAP,
  );
  const [showImportArea, setShowImportArea] = useState(false);
  const [importJson, setImportJson] = useState('');

  const updateItem = (id: string, patch: Partial<RoadmapItem>) => {
    setRoadmap(roadmap.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const deleteItem = (id: string) => {
    if (!confirm('Delete this roadmap item?')) return;
    setRoadmap(roadmap.filter((i) => i.id !== id));
  };

  const addItem = () => {
    const newItem: RoadmapItem = {
      id: `item-${Date.now()}`,
      title: 'New feature',
      description: 'Describe what this feature does for users.',
      icon: 'Sparkles',
      status: 'planned',
      publicVisible: true,
    };
    setRoadmap([...roadmap, newItem]);
  };

  const moveItem = (id: string, direction: 'up' | 'down') => {
    const index = roadmap.findIndex((i) => i.id === id);
    if (index === -1) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= roadmap.length) return;
    const next = [...roadmap];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    setRoadmap(next);
  };

  const exportJson = () => {
    const json = JSON.stringify(roadmap, null, 2);
    navigator.clipboard.writeText(json).then(
      () => alert('Roadmap JSON copied to clipboard!\n\nPaste into:\npackages/core/src/roadmapConfig.ts'),
      () => prompt('Copy this JSON manually:', json),
    );
  };

  const importFromJson = () => {
    try {
      const parsed = JSON.parse(importJson);
      if (!Array.isArray(parsed)) throw new Error('Must be a JSON array');
      setRoadmap(parsed);
      setImportJson('');
      setShowImportArea(false);
      alert('Roadmap imported successfully');
    } catch (err) {
      alert('Invalid JSON: ' + (err instanceof Error ? err.message : 'unknown error'));
    }
  };

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = roadmap.filter((i) => i.status === s).length;
    return acc;
  }, {} as Record<RoadmapStatus, number>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Roadmap Editor</h2>
          <p className="text-sm text-gray-500 mt-1">
            Edit features shown in the public roadmap section. Changes save instantly to localStorage and sync across tabs.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImportArea(!showImportArea)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Upload size={14} /> Import
          </button>
          <button
            onClick={exportJson}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download size={14} /> Export JSON
          </button>
          <button
            onClick={() => {
              if (confirm('Reset to defaults?')) reset();
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50"
          >
            <RotateCcw size={14} /> Reset
          </button>
          <button
            onClick={addItem}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
          >
            <Plus size={14} /> Add Item
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {STATUSES.map((status) => {
          const colors = STATUS_BADGE_COLORS[status];
          return (
            <div
              key={status}
              className="rounded-xl border p-4"
              style={{ background: colors.bg, borderColor: colors.text + '30' }}
            >
              <div className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.text }}>
                {STATUS_LABELS[status]}
              </div>
              <div className="text-2xl font-bold mt-1" style={{ color: colors.text }}>
                {counts[status]}
              </div>
            </div>
          );
        })}
      </div>

      {/* Import textarea */}
      {showImportArea && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="text-sm font-bold text-amber-800 mb-2">Paste JSON to import</div>
          <textarea
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            rows={8}
            className="w-full px-3 py-2 text-xs font-mono border border-amber-300 rounded-lg"
            placeholder='[{"id": "...", "title": "...", ...}]'
          />
          <button
            onClick={importFromJson}
            className="mt-2 px-4 py-2 text-sm font-bold text-white bg-amber-600 rounded-lg hover:bg-amber-700"
          >
            Import & Replace
          </button>
        </div>
      )}

      {/* Items list */}
      <div className="space-y-3">
        {roadmap.map((item, index) => {
          const colors = STATUS_BADGE_COLORS[item.status];
          return (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-gray-200 p-4 flex gap-4"
            >
              {/* Drag handle + position */}
              <div className="flex flex-col items-center pt-2 text-gray-300">
                <button
                  onClick={() => moveItem(item.id, 'up')}
                  disabled={index === 0}
                  className="hover:text-gray-600 disabled:opacity-30"
                  title="Move up"
                >
                  <GripVertical size={16} />
                </button>
                <span className="text-[10px] text-gray-400">{index + 1}</span>
              </div>

              {/* Form fields */}
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3">
                <div className="lg:col-span-3">
                  <label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Title</label>
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => updateItem(item.id, { title: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-indigo-400 outline-none"
                  />
                </div>

                <div className="lg:col-span-4">
                  <label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Description</label>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateItem(item.id, { description: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-indigo-400 outline-none"
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Status</label>
                  <select
                    value={item.status}
                    onChange={(e) => updateItem(item.id, { status: e.target.value as RoadmapStatus })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-indigo-400 outline-none"
                    style={{ background: colors.bg, color: colors.text, fontWeight: 600 }}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-1">
                  <label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">ETA</label>
                  <input
                    type="text"
                    value={item.eta || ''}
                    onChange={(e) => updateItem(item.id, { eta: e.target.value || undefined })}
                    placeholder="—"
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-indigo-400 outline-none"
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Icon</label>
                  <select
                    value={item.icon}
                    onChange={(e) => updateItem(item.id, { icon: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-indigo-400 outline-none"
                  >
                    {COMMON_ICONS.map((i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-1 pt-5">
                <button
                  onClick={() => updateItem(item.id, { publicVisible: !item.publicVisible })}
                  className="p-1.5 text-gray-400 hover:text-indigo-600"
                  title={item.publicVisible ? 'Hide from public' : 'Show on public'}
                >
                  {item.publicVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="p-1.5 text-gray-400 hover:text-rose-600"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <strong>How this works:</strong> Changes save to your browser's localStorage instantly. They appear on the public landing page <em>only in your browser</em>. To make changes permanent for all visitors, click <strong>Export JSON</strong> and paste the result into <code className="bg-blue-100 px-1 rounded">packages/core/src/roadmapConfig.ts</code>.
      </div>
    </div>
  );
};
