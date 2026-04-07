import { useMemo, useDeferredValue } from 'react';
import type { Block, MathResult } from '@papergrid/core';
import { buildPageContext, evaluate } from '@papergrid/core';

/**
 * Computes math results for all blocks on a page.
 * Uses useDeferredValue to avoid blocking the UI during typing.
 * Returns a Map of blockId -> MathResult (last evaluated line per block).
 */
export function useMathEngine(
  blocks: Block[],
  enabled: boolean,
): Map<string, MathResult | null> {
  // Defer the blocks array so math computation doesn't block typing
  const deferredBlocks = useDeferredValue(blocks);

  const results = useMemo(() => {
    const map = new Map<string, MathResult | null>();
    if (!enabled || !deferredBlocks || deferredBlocks.length === 0) {
      return map;
    }

    try {
      // Build shared variable context from all blocks (top-to-bottom)
      const context = buildPageContext(deferredBlocks);

      for (const block of deferredBlocks) {
        // ── MathBlock: each row of cells joined → one expression line ──
        if (block.mathBlockData) {
          const { rows, cols, cells } = block.mathBlockData;
          let lastResult: MathResult | null = null;

          for (let r = 0; r < rows; r++) {
            let line = '';
            for (let c = 0; c < cols; c++) {
              line += cells[r * cols + c] ?? '';
            }
            const trimmed = line.trim();
            if (trimmed.length === 0) continue;

            const result = evaluate(trimmed, context);
            if (result !== null) {
              if (result.assignment) {
                context.set(result.assignment, result.result);
              }
              lastResult = result;
            }
          }

          if (lastResult !== null) {
            map.set(block.id, lastResult);
          }
          continue;
        }

        if (!block.content || block.content.trim().length === 0) {
          continue;
        }

        // Evaluate each line independently, store last non-null result
        const lines = block.content.split('\n');
        let lastResult: MathResult | null = null;

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.length === 0) continue;

          const result = evaluate(trimmed, context);
          if (result !== null) {
            // If this line is an assignment, update context for subsequent blocks
            if (result.assignment) {
              context.set(result.assignment, result.result);
            }
            lastResult = result;
          }
        }

        if (lastResult !== null) {
          map.set(block.id, lastResult);
        }
      }
    } catch {
      // Never throw — return whatever results we have
    }

    return map;
  }, [deferredBlocks, enabled]);

  return results;
}
