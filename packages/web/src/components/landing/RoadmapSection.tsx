import React, { useRef, useEffect, useState } from 'react';
import {
  Sparkles,
  Image,
  FileText,
  LayoutGrid,
  Cloud,
  Download,
  Droplet,
  Smartphone,
  PenTool,
  ShoppingBag,
  Store,
  Sticker,
  Volume2,
  Users,
  ScanLine,
  Mic,
  UsersRound,
  Check,
  Zap,
  Clock,
  Calendar,
  type LucideIcon,
} from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ROADMAP as DEFAULT_ROADMAP,
  STATUS_LABELS,
  STATUS_COLORS,
  type RoadmapStatus,
  type RoadmapItem,
} from '@papergrid/core';
import { useServerConfig } from '../../hooks/useServerConfig';

gsap.registerPlugin(ScrollTrigger);

// Icon name → component map
const ICON_MAP: Record<string, LucideIcon> = {
  Sparkles, Image, FileText, LayoutGrid, Cloud, Download, Droplet,
  Smartphone, PenTool, ShoppingBag, Store, Sticker, Volume2, Users,
  ScanLine, Mic, UsersRound,
};

// Status filter pills
const STATUS_ORDER: RoadmapStatus[] = ['live', 'in_progress', 'coming_soon', 'planned'];

const STATUS_ICONS: Record<RoadmapStatus, LucideIcon> = {
  live: Check,
  in_progress: Zap,
  coming_soon: Clock,
  planned: Calendar,
};

export const RoadmapSection: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const [filter, setFilter] = useState<RoadmapStatus | 'all'>('all');
  // Live-edited roadmap from Convex (admin edits in /admin Roadmap tab
  // propagate here after a ~500ms debounce). Falls back to hardcoded
  // defaults when no override exists on the server.
  const [editableRoadmap] = useServerConfig<readonly RoadmapItem[]>(
    '/api/site-config/roadmap',
    DEFAULT_ROADMAP,
  );
  const allItems = editableRoadmap.filter((i) => i.publicVisible);
  const filteredItems =
    filter === 'all' ? allItems : allItems.filter((i) => i.status === filter);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      const cards = sectionRef.current!.querySelectorAll('.roadmap-card');
      gsap.fromTo(
        Array.from(cards),
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.5,
          stagger: 0.05,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 80%',
            once: true,
          },
        },
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  // Counts for filter pills
  const counts = STATUS_ORDER.reduce((acc, status) => {
    acc[status] = allItems.filter((i) => i.status === status).length;
    return acc;
  }, {} as Record<RoadmapStatus, number>);

  return (
    <section
      id="roadmap"
      ref={sectionRef}
      className="relative py-28 px-6 overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #fdfbf7 0%, #f8f6f3 50%, #fdfbf7 100%)' }}
    >
      {/* Ambient glows */}
      <div
        className="absolute top-0 right-1/4 w-[500px] h-[500px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(79,70,229,0.06) 0%, transparent 70%)', filter: 'blur(60px)' }}
      />
      <div
        className="absolute bottom-0 left-1/4 w-[400px] h-[400px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(217,119,6,0.05) 0%, transparent 70%)', filter: 'blur(50px)' }}
      />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--color-indigo-brand)' }}>
            Honest Roadmap
          </p>
          <h2
            className="font-serif font-bold mb-4"
            style={{ fontSize: 'clamp(2.2rem, 4vw, 3.8rem)', color: 'var(--color-ink)', lineHeight: 1.1 }}
          >
            What's live.{' '}
            <span className="italic" style={{ color: 'var(--color-indigo-brand)' }}>What's coming.</span>
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto text-lg">
            We only mark something live when you can use it today. Everything else is on the timeline below.
          </p>
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          <button
            onClick={() => setFilter('all')}
            className="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all"
            style={{
              background: filter === 'all' ? '#1a1c23' : 'rgba(255,255,255,0.7)',
              color: filter === 'all' ? '#ffffff' : '#64748b',
              border: '1px solid rgba(0,0,0,0.08)',
            }}
          >
            All ({allItems.length})
          </button>
          {STATUS_ORDER.map((status) => {
            const isActive = filter === status;
            const colors = STATUS_COLORS[status];
            const Icon = STATUS_ICONS[status];
            return (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all"
                style={{
                  background: isActive ? colors.text : colors.bg,
                  color: isActive ? '#ffffff' : colors.text,
                  border: `1px solid ${isActive ? colors.text : colors.border}`,
                }}
              >
                <Icon size={12} />
                {STATUS_LABELS[status]} ({counts[status]})
              </button>
            );
          })}
        </div>

        {/* Roadmap grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <RoadmapCard key={item.id} item={item} />
          ))}
        </div>

        {/* Honesty note */}
        <div className="text-center mt-12">
          <p className="text-sm" style={{ color: '#94a3b8' }}>
            Updated weekly · Want to vote on what's next?{' '}
            <a href="mailto:hello@papera.app" className="underline hover:text-indigo-500" style={{ color: 'var(--color-indigo-brand)' }}>
              Email us
            </a>
          </p>
        </div>
      </div>
    </section>
  );
};

// ─── Roadmap card component ───────────────────────────────────
interface RoadmapCardProps {
  item: RoadmapItem;
}

const RoadmapCard: React.FC<RoadmapCardProps> = ({ item }) => {
  const Icon = ICON_MAP[item.icon] || Sparkles;
  const colors = STATUS_COLORS[item.status];
  const StatusIcon = STATUS_ICONS[item.status];

  return (
    <div
      className="roadmap-card relative rounded-2xl p-5 border transition-all hover:scale-[1.02] hover:shadow-lg"
      style={{
        background: '#ffffff',
        borderColor: 'rgba(0,0,0,0.06)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
      }}
    >
      {/* Status badge in top-right corner */}
      <div
        className="absolute top-4 right-4 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest"
        style={{
          background: colors.bg,
          color: colors.text,
          border: `1px solid ${colors.border}`,
        }}
      >
        <StatusIcon size={9} strokeWidth={3} />
        {STATUS_LABELS[item.status]}
      </div>

      {/* Icon */}
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
        style={{
          background: colors.bg,
          color: colors.text,
        }}
      >
        <Icon size={20} strokeWidth={2} />
      </div>

      {/* Title */}
      <h3 className="font-serif font-bold text-lg mb-2 pr-20" style={{ color: 'var(--color-ink)' }}>
        {item.title}
      </h3>

      {/* Description */}
      <p className="text-sm leading-relaxed" style={{ color: '#64748b' }}>
        {item.description}
      </p>

      {/* ETA */}
      {item.eta && (
        <p
          className="text-[10px] font-bold uppercase tracking-widest mt-3"
          style={{ color: colors.text }}
        >
          {item.eta}
        </p>
      )}
    </div>
  );
};
