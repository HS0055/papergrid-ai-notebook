import { useEffect, useRef } from 'react';

// ── Inject shimmer keyframes once ──────────────────────────────

const STYLE_ID = 'papera-skeleton-keyframes';

function useInjectKeyframes() {
  const injected = useRef(false);

  useEffect(() => {
    if (injected.current) return;
    if (document.getElementById(STYLE_ID)) {
      injected.current = true;
      return;
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      @keyframes papera-shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      @keyframes papera-pulse-text {
        0%, 100% { opacity: 0.5; }
        50% { opacity: 1; }
      }
      @media (prefers-reduced-motion: reduce) {
        @keyframes papera-shimmer {
          0%, 100% { background-position: 0% 0; }
        }
        @keyframes papera-pulse-text {
          0%, 100% { opacity: 0.7; }
        }
      }
    `;
    document.head.appendChild(style);
    injected.current = true;
  }, []);
}

// ── Shared shimmer style ──────────────────────────────────────

const shimmerStyle: React.CSSProperties = {
  background:
    'linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 37%, #e5e7eb 63%)',
  backgroundSize: '400% 100%',
  animation: 'papera-shimmer 1.4s ease infinite',
};

const shimmerStyleIndigo: React.CSSProperties = {
  background:
    'linear-gradient(90deg, #e0e7ff 25%, #eef2ff 37%, #e0e7ff 63%)',
  backgroundSize: '400% 100%',
  animation: 'papera-shimmer 1.4s ease infinite',
};

// ── Skeleton ──────────────────────────────────────────────────

interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
  rounded?: string;
}

export function Skeleton({
  className = '',
  width = '100%',
  height = '16px',
  rounded = '6px',
}: SkeletonProps) {
  useInjectKeyframes();

  return (
    <div
      className={className}
      style={{
        ...shimmerStyle,
        width,
        height,
        borderRadius: rounded,
      }}
    />
  );
}

// ── SkeletonText ──────────────────────────────────────────────

interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

const LINE_WIDTHS = ['100%', '80%', '60%'];

export function SkeletonText({ lines = 3, className = '' }: SkeletonTextProps) {
  useInjectKeyframes();

  return (
    <div className={`flex flex-col gap-2.5 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          style={{
            ...shimmerStyle,
            width: LINE_WIDTHS[i % LINE_WIDTHS.length],
            height: '12px',
            borderRadius: '4px',
          }}
        />
      ))}
    </div>
  );
}

// ── SkeletonCard ──────────────────────────────────────────────

interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className = '' }: SkeletonCardProps) {
  useInjectKeyframes();

  return (
    <div
      className={`rounded-2xl overflow-hidden bg-white border border-gray-100 ${className}`}
    >
      {/* Cover area (60% aspect) */}
      <div style={{ ...shimmerStyle, width: '100%', paddingTop: '60%' }} />
      {/* Title bar */}
      <div className="p-3 space-y-2">
        <div
          style={{
            ...shimmerStyle,
            width: '70%',
            height: '14px',
            borderRadius: '4px',
          }}
        />
        <div
          style={{
            ...shimmerStyle,
            width: '40%',
            height: '10px',
            borderRadius: '4px',
          }}
        />
      </div>
    </div>
  );
}

// ── SkeletonPage ──────────────────────────────────────────────

interface SkeletonPageProps {
  className?: string;
}

const PAGE_BLOCK_WIDTHS = ['100%', '75%', '60%', '90%', '40%'];

export function SkeletonPage({ className = '' }: SkeletonPageProps) {
  useInjectKeyframes();

  return (
    <div className={`bg-[#fdfbf7] rounded-xl p-6 ${className}`}>
      {/* Title */}
      <div
        style={{
          ...shimmerStyle,
          width: '50%',
          height: '20px',
          borderRadius: '6px',
          marginBottom: '24px',
        }}
      />
      {/* Content blocks */}
      <div className="flex flex-col gap-4">
        {PAGE_BLOCK_WIDTHS.map((w, i) => (
          <div
            key={i}
            style={{
              ...shimmerStyle,
              width: w,
              height: '14px',
              borderRadius: '4px',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── SkeletonAIGeneration ──────────────────────────────────────

interface SkeletonAIGenerationProps {
  className?: string;
}

const AI_BLOCK_WIDTHS = ['100%', '85%', '70%', '90%', '55%'];

export function SkeletonAIGeneration({
  className = '',
}: SkeletonAIGenerationProps) {
  useInjectKeyframes();

  return (
    <div className={`bg-[#fdfbf7] rounded-xl p-6 ${className}`}>
      {/* Staggered indigo skeleton blocks */}
      <div className="flex flex-col gap-4">
        {AI_BLOCK_WIDTHS.map((w, i) => (
          <div
            key={i}
            style={{
              ...shimmerStyleIndigo,
              width: w,
              height: '16px',
              borderRadius: '6px',
              opacity: 0,
              animation: `papera-shimmer 1.4s ease infinite, fadeIn 0.3s ease ${i * 0.32}s forwards`,
            }}
          />
        ))}
      </div>

      {/* "Creating your layout..." label */}
      <div className="flex items-center justify-center gap-2 mt-8">
        <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <span
          className="text-sm font-medium text-indigo-500"
          style={{ animation: 'papera-pulse-text 2s ease-in-out infinite' }}
        >
          Creating your layout...
        </span>
      </div>
    </div>
  );
}
