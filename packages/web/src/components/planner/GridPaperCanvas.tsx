import React, { useEffect, useRef, useState } from 'react';
import type { GridSheetData } from '@papergrid/core';

interface GridPaperCanvasProps {
  data?: GridSheetData;
  onChange: (data: GridSheetData) => void;
}

/*
 * GridPaperCanvas — page-level overlay that turns the printed .paper-grid
 * cells into editable per-cell character inputs.
 *
 * Architecture (rewritten to avoid focus wars):
 *  - NO globally-focused hidden input.
 *  - Only filled cells render as static <div>s.
 *  - When user clicks an empty area on the grid paper, an inline <input>
 *    appears at the tapped cell, autofocus, ready to receive one character.
 *  - On char input, the cell is written and the input MOVES to the next cell
 *    (same DOM element, just repositioned — iOS keyboard stays open).
 *  - On blur (click outside, paper picker click, FAB click), active cell
 *    clears. NO aggressive refocus loop.
 *
 * The block layer at z-10 is unaffected. Heading and text blocks remain
 * fully clickable above this canvas. Click capture only happens on empty
 * paper area where no block exists.
 */

const CELL = 32;       // must match .paper-grid background-size
const ALLOWED = /^[A-Za-z0-9+\-*/.()=^%$ ,]$/;

const EMPTY: GridSheetData = { cells: {} };

interface ActiveCell {
  row: number;
  col: number;
}

function key(row: number, col: number): string {
  return `${row},${col}`;
}

export const GridPaperCanvas: React.FC<GridPaperCanvasProps> = ({ data, onChange }) => {
  const sheet = data ?? EMPTY;
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState<ActiveCell | null>(null);
  const [size, setSize] = useState({ cols: 0, rows: 0 });

  // Measure parent (the content area div) to know how many cells fit
  useEffect(() => {
    const el = containerRef.current?.parentElement;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cols = Math.floor(entry.contentRect.width / CELL);
        const rows = Math.floor(entry.contentRect.height / CELL);
        setSize({ cols, rows });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const setCell = (row: number, col: number, char: string) => {
    const next: Record<string, string> = { ...sheet.cells };
    if (char === '') {
      delete next[key(row, col)];
    } else {
      next[key(row, col)] = char.slice(-1);
    }
    onChange({ cells: next });
  };

  const moveActive = (rowDelta: number, colDelta: number) => {
    if (!active) return;
    const next = {
      row: Math.max(0, Math.min(active.row + rowDelta, size.rows - 1)),
      col: Math.max(0, Math.min(active.col + colDelta, size.cols - 1)),
    };
    setActive(next);
    // re-focus the input at its new position next tick
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    // Only react to clicks on the container itself (not on filled cells, not on the input)
    if (e.target !== containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const col = Math.floor((e.clientX - rect.left) / CELL);
    const row = Math.floor((e.clientY - rect.top) / CELL);
    if (col < 0 || row < 0 || col >= size.cols || row >= size.rows) return;
    e.preventDefault();
    setActive({ row, col });
  };

  const handleCellMouseDown = (row: number, col: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setActive({ row, col });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!active) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); moveActive(0, 1); return; }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); moveActive(0, -1); return; }
    if (e.key === 'ArrowDown')  { e.preventDefault(); moveActive(1, 0); return; }
    if (e.key === 'ArrowUp')    { e.preventDefault(); moveActive(-1, 0); return; }
    if (e.key === 'Enter')      { e.preventDefault(); moveActive(1, 0); return; }
    if (e.key === 'Tab')        { e.preventDefault(); moveActive(0, e.shiftKey ? -1 : 1); return; }
    if (e.key === 'Backspace') {
      e.preventDefault();
      const current = sheet.cells[key(active.row, active.col)] ?? '';
      if (current.length > 0) {
        setCell(active.row, active.col, '');
      } else if (active.col > 0) {
        const prev = { row: active.row, col: active.col - 1 };
        setCell(prev.row, prev.col, '');
        setActive(prev);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setActive(null);
      return;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!active) return;
    const value = e.target.value;
    if (!value) return;
    const char = value.slice(-1);
    if (!ALLOWED.test(char)) {
      // Clear the input but don't move
      e.target.value = '';
      return;
    }
    setCell(active.row, active.col, char);
    e.target.value = ''; // clear so next char is captured
    if (active.col < size.cols - 1) {
      const next = { row: active.row, col: active.col + 1 };
      setActive(next);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  // When active changes, refocus the input (for navigation moves)
  useEffect(() => {
    if (active) inputRef.current?.focus();
  }, [active]);

  // Auto-clear active when user clicks anywhere outside this canvas
  useEffect(() => {
    if (!active) return;
    const onDocMouseDown = (ev: MouseEvent) => {
      if (!containerRef.current) return;
      const target = ev.target as Node | null;
      if (target && containerRef.current.contains(target)) return;
      setActive(null);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [active]);

  const filledKeys = Object.keys(sheet.cells);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-0"
      style={{ pointerEvents: 'auto' }}
      onMouseDown={handleContainerClick}
    >
      {/* Filled cells */}
      {filledKeys.map((k) => {
        const [row, col] = k.split(',').map(Number);
        // Skip rendering the active cell as a static div — the input takes over
        if (active && active.row === row && active.col === col) return null;
        const ch = sheet.cells[k];
        return (
          <div
            key={k}
            className="absolute select-none flex items-center justify-center text-gray-800"
            style={{
              left: `${col * CELL}px`,
              top: `${row * CELL}px`,
              width: `${CELL}px`,
              height: `${CELL}px`,
              fontFamily: 'var(--font-hand-baseline), var(--font-hand)',
              fontSize: '21px',
              lineHeight: `${CELL}px`,
              pointerEvents: 'auto',
            }}
            onMouseDown={(e) => handleCellMouseDown(row, col, e)}
          >
            {ch}
          </div>
        );
      })}

      {/* Active cell input — the ONLY focused element, only when active */}
      {active && (
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          autoFocus
          value=""
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className="absolute outline-none border-2 border-indigo-400 bg-indigo-50 text-center text-gray-800 caret-transparent rounded-sm"
          style={{
            left: `${active.col * CELL}px`,
            top: `${active.row * CELL}px`,
            width: `${CELL}px`,
            height: `${CELL}px`,
            fontFamily: 'var(--font-hand-baseline), var(--font-hand)',
            fontSize: '21px',
            lineHeight: `${CELL}px`,
            padding: 0,
            margin: 0,
            boxShadow: '0 0 0 2px rgba(99, 102, 241, 0.18)',
          }}
          aria-label={`Cell row ${active.row + 1} column ${active.col + 1}`}
        />
      )}
    </div>
  );
};
