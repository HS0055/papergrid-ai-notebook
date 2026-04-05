import React, { useEffect, useState, useCallback, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';
const SESSION_KEY = 'papergrid_session';

const LOW_INK_THRESHOLD = 5;

interface InkBalance {
  subscription: number;
  purchased: number;
  total: number;
  plan: string;
  resetAt: string | null;
}

interface InkWalletProps {
  refreshTrigger?: number;
  onBuyInk?: () => void;
}

function DropletIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2C12 2 5 10 5 15a7 7 0 1014 0C19 10 12 2 12 2z" />
    </svg>
  );
}

function formatResetDate(resetAt: string | null): string {
  if (!resetAt) return '';
  try {
    const date = new Date(resetAt);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export function InkWallet({ refreshTrigger, onBuyInk }: InkWalletProps) {
  const [balance, setBalance] = useState<InkBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const breakdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchBalance = useCallback(async () => {
    const token = localStorage.getItem(SESSION_KEY);
    if (!token || !API_BASE) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const response = await fetch(`${API_BASE}/api/ink/balance`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch ink balance (${response.status})`);
      }

      const data: unknown = await response.json();
      if (
        typeof data === 'object' &&
        data !== null &&
        'total' in data &&
        'subscription' in data &&
        'purchased' in data
      ) {
        setBalance(data as InkBalance);
      } else {
        throw new Error('Unexpected balance response shape');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load balance';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBalance();
  }, [fetchBalance, refreshTrigger]);

  // Close breakdown popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowBreakdown(false);
      }
    }

    if (showBreakdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showBreakdown]);

  // Not authenticated or no API configured -- render nothing
  if (!API_BASE || !localStorage.getItem(SESSION_KEY)) {
    return null;
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/80 backdrop-blur rounded-full border border-gray-200 shadow-sm animate-pulse">
        <div className="w-5 h-5 rounded-full bg-gray-200" />
        <div className="w-8 h-4 rounded bg-gray-200" />
        <div className="w-6 h-3 rounded bg-gray-200" />
      </div>
    );
  }

  // Error state -- show a retry-able indicator
  if (error) {
    return (
      <button
        onClick={() => {
          setLoading(true);
          void fetchBalance();
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50/80 backdrop-blur rounded-full border border-red-200 shadow-sm text-red-500 text-xs hover:bg-red-100 transition-colors"
        title={error}
      >
        <DropletIcon className="w-4 h-4" />
        <span className="font-medium">--</span>
        <span className="text-[10px] opacity-70">retry</span>
      </button>
    );
  }

  if (!balance) {
    return null;
  }

  const isLow = balance.total < LOW_INK_THRESHOLD;
  const resetLabel = formatResetDate(balance.resetAt);

  return (
    <div ref={containerRef} className="relative">
      {/* Main pill */}
      <button
        onClick={() => setShowBreakdown((prev) => !prev)}
        className={`flex items-center gap-1.5 px-3 py-1.5 backdrop-blur rounded-full border shadow-sm transition-all duration-200 cursor-pointer select-none ${
          isLow
            ? 'bg-amber-50/90 border-amber-300 text-amber-700 hover:bg-amber-100'
            : 'bg-white/80 border-gray-200 text-gray-700 hover:bg-white'
        }`}
        aria-label={`Ink balance: ${balance.total}. Click for details.`}
        aria-expanded={showBreakdown}
      >
        <DropletIcon
          className={`w-5 h-5 transition-colors ${
            isLow ? 'text-amber-500' : 'text-indigo-500'
          }`}
        />
        <span className="font-bold text-sm tabular-nums">{balance.total}</span>
        <span className="text-xs text-gray-500 font-medium">Ink</span>
        {isLow && (
          <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        )}
      </button>

      {/* Breakdown popover */}
      {showBreakdown && (
        <div
          ref={breakdownRef}
          className="absolute top-full right-0 mt-2 w-56 bg-white/95 backdrop-blur-lg rounded-xl border border-gray-200 shadow-xl p-3 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
          role="tooltip"
        >
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Ink Breakdown
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Monthly</span>
              <span className="font-semibold tabular-nums">{balance.subscription}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Purchased</span>
              <span className="font-semibold tabular-nums">{balance.purchased}</span>
            </div>
            <div className="border-t border-gray-100 my-1.5" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700 font-medium">Total</span>
              <span className="font-bold text-indigo-600 tabular-nums">{balance.total}</span>
            </div>
          </div>

          {resetLabel && (
            <div className="mt-2 text-[10px] text-gray-400">
              Monthly Ink resets {resetLabel}
            </div>
          )}

          {balance.plan && (
            <div className="mt-1.5 text-[10px] text-gray-400">
              Plan: <span className="capitalize font-medium text-gray-500">{balance.plan}</span>
            </div>
          )}

          {onBuyInk && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowBreakdown(false);
                onBuyInk();
              }}
              className="mt-3 w-full py-1.5 px-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-lg text-xs font-medium shadow-sm transition-all hover:shadow-md"
            >
              Buy More Ink
            </button>
          )}
        </div>
      )}

      {/* Persistent low-ink Buy button (visible outside popover) */}
      {isLow && onBuyInk && !showBreakdown && (
        <button
          onClick={onBuyInk}
          className="absolute -right-1 -bottom-1 translate-y-full mt-1 px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-medium rounded-full shadow-sm transition-colors whitespace-nowrap"
        >
          Buy Ink
        </button>
      )}
    </div>
  );
}
