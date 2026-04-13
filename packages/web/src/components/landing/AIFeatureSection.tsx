import React, { useEffect, useState, useRef } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const steps = [
  {
    num: '01',
    title: 'No templates. No drag-and-drop.',
    desc: 'Just describe what you need — Papera handles the structure. No blank page, no format hunting.',
  },
  {
    num: '02',
    title: 'Papera builds the spread',
    desc: 'Reads your intent. Builds a complete two-page spread — paper texture, headings, blocks, grids — everything in its right place.',
  },
  {
    num: '03',
    title: 'Every block is yours',
    desc: 'Edit, reorder, recolor, switch paper textures. When a layout is right, it stays right — no rebuilding it again next week.',
  },
];

const prompts = [
  'Weekly planner for a startup founder',
  'Cornell notes for biology class',
  'Bullet journal for January goals',
  'Meeting notes with action items',
  'Gratitude journal with mood tracker',
  'Time-blocking schedule for deep work',
];

// ---------------------------------------------------------------------------
// Block type definitions — each is a discriminated union so the renderer
// can be strictly typed with no runtime ambiguity.
// ---------------------------------------------------------------------------

interface HeadingBlock {
  type: 'HEADING';
  title: string;
  subtitle?: string;
}

interface TextBlock {
  type: 'TEXT';
  content: string;
}

interface CheckboxItem {
  label: string;
  done: boolean;
}

interface CheckboxBlock {
  type: 'CHECKBOX';
  items: CheckboxItem[];
}

interface QuoteBlock {
  type: 'QUOTE';
  content: string;
  attribution?: string;
}

interface CalloutBlock {
  type: 'CALLOUT';
  variant: 'amber' | 'emerald' | 'rose';
  content: string;
}

interface GridRow {
  cells: string[];
}

interface GridBlock {
  type: 'GRID';
  headers: string[];
  rows: GridRow[];
}

interface MoodTrackerBlock {
  type: 'MOOD_TRACKER';
  options: string[];
  selectedIdx: number;
  label: string;
  note?: string;
}

interface KanbanColumn {
  title: string;
  cards: string[];
}

interface KanbanBlock {
  type: 'KANBAN';
  columns: KanbanColumn[];
}

interface HabitRow {
  habit: string;
  days: boolean[];
}

interface HabitTrackerBlock {
  type: 'HABIT_TRACKER';
  dayLabels: string[];
  rows: HabitRow[];
}

interface WeeklyTimeBlock {
  label: string;
  color: string; // tailwind bg class or hex
  span: number; // relative height units (1–4)
}

interface WeeklyDay {
  label: string;
  blocks: WeeklyTimeBlock[];
}

interface WeeklyViewBlock {
  type: 'WEEKLY_VIEW';
  days: WeeklyDay[];
}

type DemoBlock =
  | HeadingBlock
  | TextBlock
  | CheckboxBlock
  | QuoteBlock
  | CalloutBlock
  | GridBlock
  | MoodTrackerBlock
  | KanbanBlock
  | HabitTrackerBlock
  | WeeklyViewBlock;

interface PromptLayout {
  accent: string;
  blocks: [DemoBlock, DemoBlock, DemoBlock];
}

// ---------------------------------------------------------------------------
// Prompt layouts — each uses a distinct combination of block types
// ---------------------------------------------------------------------------

const promptLayouts: PromptLayout[] = [
  // 1. Weekly planner for a startup founder
  // HEADING + WEEKLY_VIEW + KANBAN
  {
    accent: '#4f46e5',
    blocks: [
      {
        type: 'HEADING',
        title: "Founder's Week — Apr 2026",
        subtitle: 'W15 · Sprint 3',
      },
      {
        type: 'WEEKLY_VIEW',
        days: [
          {
            label: 'Mon',
            blocks: [
              { label: 'Investor deck', color: '#4f46e5', span: 2 },
              { label: 'Customer calls', color: '#f59e0b', span: 2 },
            ],
          },
          {
            label: 'Tue',
            blocks: [
              { label: '1:1s + standup', color: '#94a3b8', span: 2 },
              { label: 'Product review', color: '#4f46e5', span: 2 },
            ],
          },
          {
            label: 'Wed',
            blocks: [
              { label: 'Deep writing', color: '#7c3aed', span: 3 },
              { label: 'Email batch', color: '#94a3b8', span: 1 },
            ],
          },
          {
            label: 'Thu',
            blocks: [
              { label: 'Roadmap', color: '#4f46e5', span: 3 },
              { label: '1:1s', color: '#94a3b8', span: 1 },
            ],
          },
          {
            label: 'Fri',
            blocks: [
              { label: 'PH prep', color: '#f43f5e', span: 2 },
              { label: 'Retro', color: '#f59e0b', span: 2 },
            ],
          },
        ],
      },
      {
        type: 'KANBAN',
        columns: [
          { title: 'This Week', cards: ['Onboarding flow v2', 'Pricing page'] },
          { title: 'In Review', cards: ['Mobile nav'] },
          { title: 'Shipped', cards: ['Auth redesign'] },
        ],
      },
    ],
  },

  // 2. Cornell notes for biology class
  // HEADING + GRID + TEXT
  {
    accent: '#10b981',
    blocks: [
      {
        type: 'HEADING',
        title: 'Biology 301 — Cell Division',
        subtitle: 'Lecture 12 · Prof. Chen',
      },
      {
        type: 'GRID',
        headers: ['Cue / Question', 'Notes / Answer'],
        rows: [
          { cells: ['What is mitosis?', 'Prophase → Metaphase → Anaphase → Telophase'] },
          { cells: ['Role of checkpoints?', 'G1, G2, M — prevent damaged DNA replication'] },
          { cells: ['Meiosis vs Mitosis?', 'Meiosis → 4 haploid cells. Mitosis → 2 diploid'] },
        ],
      },
      {
        type: 'TEXT',
        content:
          'Cell division is the basis of growth and repair. Mitosis produces identical daughter cells; meiosis introduces genetic variation. Checkpoint failures are linked to cancer.',
      },
    ],
  },

  // 3. Bullet journal for January goals
  // HEADING + HABIT_TRACKER + MOOD_TRACKER
  {
    accent: '#7c3aed',
    blocks: [
      {
        type: 'HEADING',
        title: 'January 2026',
        subtitle: 'The year of intentional growth',
      },
      {
        type: 'HABIT_TRACKER',
        dayLabels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
        rows: [
          { habit: 'Morning pages', days: [true, true, true, false, true, true, true] },
          { habit: 'Gym', days: [true, false, true, false, true, false, false] },
          { habit: 'No phone 9am', days: [false, true, true, true, false, true, true] },
          { habit: 'Read 20 min', days: [true, true, false, true, true, true, false] },
        ],
      },
      {
        type: 'MOOD_TRACKER',
        options: ['😫', '😕', '🙂', '😊', '🤩'],
        selectedIdx: 3,
        label: 'Today: content',
        note: 'Avg this week: 3.8',
      },
    ],
  },

  // 4. Meeting notes with action items
  // HEADING + CALLOUT + CHECKBOX
  {
    accent: '#f59e0b',
    blocks: [
      {
        type: 'HEADING',
        title: 'Product Sync — Apr 14',
        subtitle: 'Attendees: Alex, Sam, Priya, Dev',
      },
      {
        type: 'CALLOUT',
        variant: 'amber',
        content:
          'Decision: Ship v2 with simplified onboarding. Cut advanced settings from launch scope. Revisit in Q3.',
      },
      {
        type: 'CHECKBOX',
        items: [
          { label: 'Write v2 release notes — @alex', done: true },
          { label: 'Archive old onboarding screens — @sam', done: true },
          { label: 'Update help docs with new flow — @priya', done: false },
          { label: 'QA sign-off on mobile — @dev', done: false },
          { label: 'Schedule stakeholder demo — @alex', done: false },
        ],
      },
    ],
  },

  // 5. Gratitude journal with mood tracker
  // HEADING + QUOTE + MOOD_TRACKER
  {
    accent: '#f43f5e',
    blocks: [
      {
        type: 'HEADING',
        title: 'April 14 — Evening Pages',
        subtitle: 'Gratitude entry #87',
      },
      {
        type: 'QUOTE',
        content:
          'I am grateful for the quiet morning before the world woke up, for unexpected kindness, and for the simple fact that today happened at all.',
        attribution: '— My own words',
      },
      {
        type: 'MOOD_TRACKER',
        options: ['😫', '😕', '🙂', '😊', '🤩'],
        selectedIdx: 2,
        label: 'Mood: calm',
        note: '14-day journal streak',
      },
    ],
  },

  // 6. Time-blocking schedule for deep work
  // HEADING + WEEKLY_VIEW + CALLOUT
  {
    accent: '#4f46e5',
    blocks: [
      {
        type: 'HEADING',
        title: 'Deep Work — This Week',
        subtitle: '4 protected blocks · No meetings before 11am',
      },
      {
        type: 'WEEKLY_VIEW',
        days: [
          {
            label: 'Mon',
            blocks: [
              { label: 'Deep Block', color: '#7c3aed', span: 3 },
              { label: 'Admin', color: '#94a3b8', span: 1 },
            ],
          },
          {
            label: 'Tue',
            blocks: [
              { label: 'Deep Block', color: '#7c3aed', span: 3 },
              { label: 'Email', color: '#94a3b8', span: 1 },
            ],
          },
          {
            label: 'Wed',
            blocks: [
              { label: 'Meetings', color: '#f59e0b', span: 4 },
            ],
          },
          {
            label: 'Thu',
            blocks: [
              { label: 'Deep Block', color: '#7c3aed', span: 3 },
              { label: 'Wrap', color: '#94a3b8', span: 1 },
            ],
          },
          {
            label: 'Fri',
            blocks: [
              { label: 'Deep Block', color: '#7c3aed', span: 2 },
              { label: 'Review', color: '#f59e0b', span: 2 },
            ],
          },
        ],
      },
      {
        type: 'CALLOUT',
        variant: 'emerald',
        content:
          'Rule: No Slack before 10am. Deep blocks are sacred. One meeting-heavy day max per week (Wednesday).',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Block renderer components
// ---------------------------------------------------------------------------

function RenderHeading({ block, accent }: { block: HeadingBlock; accent: string }) {
  return (
    <div
      className="p-4 rounded-lg"
      style={{
        background: 'rgba(255,255,255,0.85)',
        border: '1px solid rgba(0,0,0,0.08)',
        borderLeft: `3px solid ${accent}`,
      }}
    >
      <h4 className="font-serif font-bold text-xl" style={{ color: '#1a1c23' }}>
        {block.title}
      </h4>
      {block.subtitle && (
        <p className="font-hand text-xs mt-0.5" style={{ color: '#94a3b8' }}>
          {block.subtitle}
        </p>
      )}
    </div>
  );
}

function RenderText({ block }: { block: TextBlock }) {
  return (
    <div
      className="px-4 py-3 rounded-lg"
      style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.07)' }}
    >
      <p className="font-hand text-sm leading-relaxed" style={{ color: '#374151' }}>
        {block.content}
      </p>
    </div>
  );
}

function RenderCheckbox({ block, accent }: { block: CheckboxBlock; accent: string }) {
  return (
    <div
      className="px-4 py-3 rounded-lg space-y-2"
      style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.07)' }}
    >
      {block.items.map((item, i) => (
        <div key={i} className="flex items-center gap-2.5">
          <div
            className="w-4 h-4 rounded shrink-0 flex items-center justify-center"
            style={{
              border: item.done ? 'none' : '2px solid #cbd5e1',
              background: item.done ? '#818cf8' : 'transparent',
            }}
          >
            {item.done && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <span
            className="font-hand text-sm"
            style={{
              color: item.done ? '#94a3b8' : '#374151',
              textDecoration: item.done ? 'line-through' : 'none',
            }}
          >
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function RenderQuote({ block, accent }: { block: QuoteBlock; accent: string }) {
  return (
    <div
      className="px-4 py-3 rounded-lg"
      style={{
        background: 'rgba(255,255,255,0.85)',
        border: '1px solid rgba(0,0,0,0.07)',
        borderLeft: `3px solid ${accent}`,
      }}
    >
      <p className="font-hand text-sm italic leading-relaxed" style={{ color: '#374151' }}>
        {block.content}
      </p>
      {block.attribution && (
        <p className="font-hand text-xs mt-2" style={{ color: '#94a3b8' }}>
          {block.attribution}
        </p>
      )}
    </div>
  );
}

const calloutStyles = {
  amber: { bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.35)', text: '#92400e', icon: '💡' },
  emerald: { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.35)', text: '#065f46', icon: '✓' },
  rose: { bg: 'rgba(244,63,94,0.1)', border: 'rgba(244,63,94,0.35)', text: '#9f1239', icon: '⚠' },
};

function RenderCallout({ block }: { block: CalloutBlock }) {
  const s = calloutStyles[block.variant];
  return (
    <div
      className="px-4 py-3 rounded-lg flex gap-3"
      style={{ background: s.bg, border: `1px solid ${s.border}` }}
    >
      <span className="text-base shrink-0 mt-0.5">{s.icon}</span>
      <p className="font-hand text-sm leading-relaxed" style={{ color: s.text }}>
        {block.content}
      </p>
    </div>
  );
}

function RenderGrid({ block, accent }: { block: GridBlock; accent: string }) {
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: '1px solid rgba(0,0,0,0.08)' }}
    >
      {/* Header row */}
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${block.headers.length}, 1fr)` }}
      >
        {block.headers.map((h, i) => (
          <div
            key={i}
            className="px-3 py-2 font-hand text-xs font-bold uppercase tracking-wide"
            style={{ background: `${accent}18`, color: accent, borderBottom: `1px solid ${accent}30` }}
          >
            {h}
          </div>
        ))}
      </div>
      {/* Data rows */}
      {block.rows.map((row, ri) => (
        <div
          key={ri}
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${block.headers.length}, 1fr)`,
            background: ri % 2 === 0 ? 'rgba(255,255,255,0.9)' : 'rgba(248,250,252,0.9)',
            borderBottom: ri < block.rows.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
          }}
        >
          {row.cells.map((cell, ci) => (
            <div
              key={ci}
              className="px-3 py-2 font-hand text-xs"
              style={{
                color: '#374151',
                borderRight: ci < row.cells.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
              }}
            >
              {cell}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function RenderMoodTracker({ block, accent }: { block: MoodTrackerBlock; accent: string }) {
  return (
    <div
      className="px-4 py-3 rounded-lg"
      style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.07)' }}
    >
      <div className="flex items-center justify-between gap-1 mb-2">
        {block.options.map((emoji, i) => (
          <div
            key={i}
            className="flex-1 flex items-center justify-center py-1.5 rounded-lg text-lg cursor-default transition-all"
            style={{
              background: i === block.selectedIdx ? `${accent}20` : 'transparent',
              border: i === block.selectedIdx ? `1.5px solid ${accent}60` : '1.5px solid transparent',
              transform: i === block.selectedIdx ? 'scale(1.15)' : 'scale(1)',
            }}
          >
            {emoji}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="font-hand text-xs font-medium" style={{ color: '#374151' }}>
          {block.label}
        </span>
        {block.note && (
          <span className="font-hand text-xs" style={{ color: '#94a3b8' }}>
            {block.note}
          </span>
        )}
      </div>
    </div>
  );
}

function RenderKanban({ block, accent }: { block: KanbanBlock; accent: string }) {
  const colColors = [accent, '#94a3b8', '#10b981'];
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${block.columns.length}, 1fr)` }}>
      {block.columns.map((col, ci) => (
        <div key={ci} className="flex flex-col gap-1.5">
          <div
            className="font-hand text-xs font-bold uppercase tracking-wide px-2 py-1 rounded"
            style={{ background: `${colColors[ci] ?? accent}15`, color: colColors[ci] ?? accent }}
          >
            {col.title}
            <span
              className="ml-1.5 font-hand text-xs font-normal"
              style={{ opacity: 0.6 }}
            >
              {col.cards.length}
            </span>
          </div>
          {col.cards.map((card, ki) => (
            <div
              key={ki}
              className="px-2.5 py-2 rounded-lg font-hand text-xs"
              style={{
                background: 'rgba(255,255,255,0.9)',
                border: '1px solid rgba(0,0,0,0.08)',
                color: '#374151',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              {card}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function RenderHabitTracker({ block, accent }: { block: HabitTrackerBlock; accent: string }) {
  return (
    <div
      className="px-4 py-3 rounded-lg"
      style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.07)' }}
    >
      {/* Day header */}
      <div className="flex items-center gap-1 mb-1.5">
        <div className="flex-1" />
        {block.dayLabels.map((d, i) => (
          <div
            key={i}
            className="w-6 text-center font-hand text-[10px] font-bold"
            style={{ color: '#94a3b8' }}
          >
            {d}
          </div>
        ))}
      </div>
      {/* Habit rows */}
      {block.rows.map((row, ri) => (
        <div key={ri} className="flex items-center gap-1 py-0.5">
          <div className="flex-1 font-hand text-xs truncate pr-1" style={{ color: '#374151' }}>
            {row.habit}
          </div>
          {row.days.map((filled, di) => (
            <div
              key={di}
              className="w-6 h-6 flex items-center justify-center text-xs"
              style={{ color: filled ? accent : '#cbd5e1' }}
            >
              {filled ? '●' : '○'}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function RenderWeeklyView({ block }: { block: WeeklyViewBlock }) {
  // Each day column renders its blocks as proportional colored strips
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: '1px solid rgba(0,0,0,0.08)' }}
    >
      <div className="grid" style={{ gridTemplateColumns: `repeat(${block.days.length}, 1fr)` }}>
        {block.days.map((day, di) => (
          <div
            key={di}
            style={{ borderRight: di < block.days.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}
          >
            {/* Day label */}
            <div
              className="text-center font-hand text-xs font-bold py-1.5"
              style={{ background: 'rgba(248,250,252,0.9)', color: '#64748b', borderBottom: '1px solid rgba(0,0,0,0.06)' }}
            >
              {day.label}
            </div>
            {/* Time blocks */}
            <div className="flex flex-col p-1 gap-0.5" style={{ height: '88px' }}>
              {day.blocks.map((tb, bi) => (
                <div
                  key={bi}
                  className="rounded font-hand text-[9px] font-medium px-1 flex items-center justify-center text-center leading-tight"
                  style={{
                    background: `${tb.color}22`,
                    border: `1px solid ${tb.color}50`,
                    color: tb.color,
                    flex: tb.span,
                    minHeight: `${tb.span * 14}px`,
                  }}
                >
                  {tb.label}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RenderBlock({ block, accent }: { block: DemoBlock; accent: string }) {
  switch (block.type) {
    case 'HEADING':
      return <RenderHeading block={block} accent={accent} />;
    case 'TEXT':
      return <RenderText block={block} />;
    case 'CHECKBOX':
      return <RenderCheckbox block={block} accent={accent} />;
    case 'QUOTE':
      return <RenderQuote block={block} accent={accent} />;
    case 'CALLOUT':
      return <RenderCallout block={block} />;
    case 'GRID':
      return <RenderGrid block={block} accent={accent} />;
    case 'MOOD_TRACKER':
      return <RenderMoodTracker block={block} accent={accent} />;
    case 'KANBAN':
      return <RenderKanban block={block} accent={accent} />;
    case 'HABIT_TRACKER':
      return <RenderHabitTracker block={block} accent={accent} />;
    case 'WEEKLY_VIEW':
      return <RenderWeeklyView block={block} />;
  }
}

// ---------------------------------------------------------------------------
// Section component
// ---------------------------------------------------------------------------

interface AIFeatureSectionProps {
  onLaunch: () => void;
}

export const AIFeatureSection: React.FC<AIFeatureSectionProps> = ({ onLaunch }) => {
  const [activePromptIdx, setActivePromptIdx] = useState(0);
  const [displayedIdx, setDisplayedIdx] = useState(0);
  const demoRef = useRef<HTMLDivElement>(null);
  const typingTextRef = useRef<HTMLSpanElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const thinkingRef = useRef<HTMLDivElement>(null);
  const block1Ref = useRef<HTMLDivElement>(null);
  const block2Ref = useRef<HTMLDivElement>(null);
  const block3Ref = useRef<HTMLDivElement>(null);
  const hasInitAnimated = useRef(false);
  const currentTlRef = useRef<gsap.core.Timeline | null>(null);

  // Auto-cycle chips — interval longer than the full animation (~2.5s)
  useEffect(() => {
    const timer = setInterval(() => {
      setActivePromptIdx(i => (i + 1) % prompts.length);
    }, 9000);
    return () => clearInterval(timer);
  }, []);

  // Initial scroll-triggered animation (runs once)
  useEffect(() => {
    if (!demoRef.current || !typingTextRef.current) return;

    const ctx = gsap.context(() => {
      gsap.set(thinkingRef.current, { opacity: 0, scale: 0.8 });
      gsap.set([block1Ref.current, block2Ref.current, block3Ref.current], {
        opacity: 0,
        y: 20,
        scale: 0.95,
      });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: demoRef.current,
          start: 'top 70%',
          once: true,
        },
      });

      const promptText = prompts[0];
      const charCount = { val: 0 };

      tl.to(charCount, {
        val: promptText.length,
        duration: 2,
        ease: 'none',
        onUpdate: () => {
          const currentLength = Math.floor(charCount.val);
          if (typingTextRef.current) {
            typingTextRef.current.textContent = promptText.substring(0, currentLength);
          }
          if (cursorRef.current) {
            cursorRef.current.style.opacity = Math.random() > 0.3 ? '1' : '0';
          }
        },
      });

      tl.to(cursorRef.current, { duration: 0.1, opacity: 1 });
      tl.to(cursorRef.current, { opacity: 0, duration: 0.3 }, '+=0.3');
      tl.to(thinkingRef.current, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.7)' }, '-=0.1');
      tl.to({}, { duration: 1.8 });
      tl.to(thinkingRef.current, { opacity: 0, scale: 0.8, duration: 0.3 });
      tl.to(block1Ref.current, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(1.7)' }, '+=0.2');
      tl.to(block2Ref.current, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(1.7)' }, '-=0.2');
      tl.to(block3Ref.current, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(1.7)' }, '-=0.2');

      tl.call(() => {
        hasInitAnimated.current = true;
      });
    }, demoRef);

    return () => ctx.revert();
  }, []);

  // Chip-click animation: fast crossfade swap (~0.7s total, no re-typing)
  useEffect(() => {
    if (!hasInitAnimated.current) return;

    // Kill previous — do NOT reset opacity first; fade out from wherever we are
    if (currentTlRef.current) {
      currentTlRef.current.kill();
      currentTlRef.current = null;
    }

    const blocks = [
      block1Ref.current,
      block2Ref.current,
      block3Ref.current,
    ].filter(Boolean) as HTMLElement[];
    if (!blocks.length) return;

    // Update prompt text immediately (no re-typing on manual switch)
    if (typingTextRef.current) typingTextRef.current.textContent = prompts[activePromptIdx];
    if (cursorRef.current) cursorRef.current.style.opacity = '0';

    const tl = gsap.timeline({
      onComplete: () => { currentTlRef.current = null; },
    });
    currentTlRef.current = tl;

    // Fade out from current opacity (no flash reset)
    tl.to(blocks, { opacity: 0, y: 4, duration: 0.15, ease: 'power2.in' });

    // Brief thinking flash
    tl.set(thinkingRef.current, { opacity: 0, scale: 0.85 });
    tl.to(thinkingRef.current, { opacity: 1, scale: 1, duration: 0.15, ease: 'power2.out' });
    tl.to(thinkingRef.current, { opacity: 0, scale: 0.85, duration: 0.15 }, '+=0.2');

    // Swap content then fade in cleanly
    tl.call(() => setDisplayedIdx(activePromptIdx));
    tl.set(blocks, { y: 0 });
    tl.to(blocks, { opacity: 1, duration: 0.25, ease: 'power2.out', stagger: 0.05 }, '+=0.02');
  }, [activePromptIdx]);

  const layout = promptLayouts[displayedIdx];
  const accentColor = layout.accent;

  return (
    <section
      id="ai-feature"
      className="relative py-28 px-6 overflow-hidden"
      style={{ background: '#f8f6f3' }}
    >
      {/* Ambient glows */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(79,70,229,0.06) 0%, transparent 70%)', filter: 'blur(40px)' }}
      />
      <div
        className="absolute bottom-0 right-1/4 w-[350px] h-[350px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(217,119,6,0.04) 0%, transparent 70%)', filter: 'blur(60px)' }}
      />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Section title */}
        <div className="reveal text-center mb-14">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest mb-6 border"
            style={{ background: 'rgba(79,70,229,0.08)', borderColor: 'rgba(79,70,229,0.2)', color: '#4f46e5' }}
          >
            <Sparkles size={13} />
            The AI Layout Engine
          </div>
          <h2 className="font-serif font-bold mb-4" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', lineHeight: 1.1, color: 'var(--color-ink)' }}>
            Say it.{' '}<span className="italic" style={{ color: '#4f46e5' }}>Papera builds it.</span>
          </h2>
          <p className="max-w-xl mx-auto text-lg" style={{ color: '#64748b', lineHeight: 1.7 }}>
            Describe your week in one sentence. Papera builds a complete notebook layout — paper texture, headings, interactive blocks — in seconds.
          </p>
        </div>

        {/* Unified demo panel */}
        <div
          ref={demoRef}
          className="reveal rounded-3xl overflow-hidden mb-12"
          style={{
            background: '#ffffff',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.1), 0 4px 20px rgba(0,0,0,0.05)',
          }}
        >
          <div className="flex flex-col lg:flex-row lg:items-stretch">
            {/* Left column: prompt input (~40%) */}
            <div
              className="lg:w-2/5 p-8 flex flex-col gap-6"
              style={{ borderRight: '1px solid rgba(0,0,0,0.07)', background: '#fafafa' }}
            >
              <div>
                <div
                  className="text-xs font-bold uppercase tracking-widest mb-3"
                  style={{ color: '#4f46e5' }}
                >
                  Your prompt
                </div>
                <div
                  className="font-hand text-lg rounded-xl p-4"
                  style={{
                    color: '#1a1c23',
                    minHeight: '64px',
                    background: 'rgba(79,70,229,0.04)',
                    border: '1px solid rgba(79,70,229,0.12)',
                  }}
                >
                  <span ref={typingTextRef}></span>
                  <span
                    ref={cursorRef}
                    className="inline-block w-0.5 h-5 ml-0.5 align-middle"
                    style={{ background: '#4f46e5', opacity: 0 }}
                  />
                </div>
              </div>

              <div>
                <div className="text-xs font-medium mb-2" style={{ color: '#94a3b8' }}>
                  Pick a prompt to see it live:
                </div>
                <div className="flex flex-col gap-1.5">
                  {prompts.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => setActivePromptIdx(i)}
                      className="text-left px-3 py-2 rounded-lg text-sm font-medium transition-all"
                      style={{
                        background: activePromptIdx === i ? 'rgba(79,70,229,0.1)' : 'transparent',
                        color: activePromptIdx === i ? '#4f46e5' : '#64748b',
                        border: `1px solid ${activePromptIdx === i ? 'rgba(79,70,229,0.25)' : 'rgba(0,0,0,0.07)'}`,
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right column: generated output (~60%) */}
            <div className="lg:w-3/5 relative" style={{ height: '480px' }}>
              <div
                className="absolute inset-0 paper-lines"
                style={{ backgroundAttachment: 'local' }}
              />
              <div className="relative z-10 p-6 h-full flex flex-col">
                {/* Thinking indicator */}
                <div
                  ref={thinkingRef}
                  className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full z-20"
                  style={{ background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.2)' }}
                >
                  <span className="text-xs font-medium" style={{ color: '#4f46e5' }}>AI thinking</span>
                  <div className="flex gap-1">
                    <div className="thinking-dot"></div>
                    <div className="thinking-dot"></div>
                    <div className="thinking-dot"></div>
                  </div>
                </div>

                {/* Generated blocks — fixed-height container prevents layout jumps on swap */}
                <div className="space-y-3 overflow-y-auto flex-1" style={{ scrollbarWidth: 'none' }}>
                  <div ref={block1Ref}>
                    <RenderBlock block={layout.blocks[0]} accent={accentColor} />
                  </div>
                  <div ref={block2Ref}>
                    <RenderBlock block={layout.blocks[1]} accent={accentColor} />
                  </div>
                  <div ref={block3Ref}>
                    <RenderBlock block={layout.blocks[2]} accent={accentColor} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step callout strips */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-12">
          {steps.map((step, i) => (
            <div
              key={step.num}
              className="reveal rounded-2xl px-6 py-5"
              style={{
                background: 'rgba(79,70,229,0.05)',
                border: '1px solid rgba(79,70,229,0.12)',
                transitionDelay: `${i * 100}ms`,
              }}
            >
              <div className="flex items-start gap-4">
                <span
                  className="font-serif font-bold shrink-0 leading-none mt-0.5"
                  style={{ fontSize: '1.75rem', color: 'rgba(79,70,229,0.3)' }}
                >
                  {step.num}
                </span>
                <div>
                  <h3 className="font-serif font-bold text-base mb-1" style={{ color: 'var(--color-ink)' }}>
                    {step.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#64748b' }}>
                    {step.desc}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="reveal text-center">
          <button
            onClick={onLaunch}
            className="inline-flex items-center gap-2 font-bold text-white transition-all hover:opacity-90"
            style={{
              background: '#4f46e5',
              borderRadius: '10px',
              padding: '11px 28px',
              boxShadow: '0 4px 16px rgba(79,70,229,0.28)',
            }}
          >
            Build my first layout <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
};
