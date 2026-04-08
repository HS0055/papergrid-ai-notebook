import { useEffect, useState } from 'react';
import { isNativeApp } from '../utils/platform';

interface KeyboardState {
  keyboardVisible: boolean;
  keyboardHeight: number;
}

/**
 * Subscribes to the VisualViewport API (modern, standards-based) to compute
 * accurate keyboard insets on iOS. Also bridges Capacitor Keyboard events
 * as a safety net for early keyboard-show animation frames.
 *
 * Why VisualViewport instead of just Capacitor keyboardHeight:
 *   - With `resize: 'body'`, Capacitor's keyboardHeight is a native-points
 *     value that doesn't always match CSS px 1:1 (rotation, accessory bar,
 *     QuickType suggestions all affect the effective keyboard area).
 *   - VisualViewport.height IS the actual visible viewport in CSS pixels,
 *     minus the keyboard. `window.innerHeight - visualViewport.height` gives
 *     the true pixel height the keyboard is occupying.
 *   - This matches Apple Notes, Linear, Craft — they all use visualViewport.
 */
export function useKeyboardHandler(): KeyboardState {
  const [keyboardVisible, setKeyboardVisible] = useState<boolean>(false);
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);

  useEffect(() => {
    if (!isNativeApp()) return;
    if (typeof window === 'undefined') return;

    // Defensive access — visualViewport and its props can be undefined on
    // older WKWebView versions or during very early initialization.
    const vv = window.visualViewport;
    if (!vv || typeof vv.addEventListener !== 'function') return;

    const update = () => {
      try {
        const innerH = window.innerHeight || 0;
        const vvH = (vv && typeof vv.height === 'number') ? vv.height : innerH;
        const vvOffset = (vv && typeof vv.offsetTop === 'number') ? vv.offsetTop : 0;
        const kb = Math.max(0, innerH - vvH - vvOffset);
        // Expose as a global CSS variable so any element can pin to the
        // top of the keyboard via `bottom: var(--kb-bottom, 0px)`. Updated
        // synchronously with React state so CSS and React stay in sync.
        document.documentElement.style.setProperty('--kb-bottom', `${kb}px`);
        if (kb > 50) {
          setKeyboardHeight(kb);
          setKeyboardVisible(true);
        } else {
          setKeyboardHeight(0);
          setKeyboardVisible(false);
        }
      } catch {
        // Never throw from a layout listener
      }
    };

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();

    return () => {
      try {
        vv.removeEventListener('resize', update);
        vv.removeEventListener('scroll', update);
      } catch {
        // ignore
      }
    };
  }, []);

  return { keyboardVisible, keyboardHeight };
}
