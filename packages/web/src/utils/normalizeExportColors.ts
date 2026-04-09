/**
 * normalizeExportColors.ts
 *
 * Why this exists
 * ---------------
 * Tailwind v4 generates its default palette using the `oklch()` / `oklab()`
 * CSS color functions. Those render fine in the browser, but client-side
 * HTML → canvas rasterizers (html2canvas, and some code paths inside
 * html-to-image) can't always parse them and will throw:
 *
 *   "Attempting to parse an unsupported color function 'oklab'"
 *
 * The fix is to walk the export subtree BEFORE rasterization, compute
 * each element's effective color-ish properties, and replace any that
 * use a modern color function with an `rgb(...)` equivalent via a hidden
 * canvas 2D context (the browser owns the conversion to sRGB, so it's
 * exact — no color-math rounding on our side).
 *
 * The conversion is stamped as an INLINE style so it wins the cascade,
 * and the helper returns a `restore()` callback that undoes every
 * change (so the live dashboard isn't left with dozens of inline
 * overrides after export).
 *
 * Usage
 * -----
 *     const restore = normalizeExportColors(exportRoot);
 *     try {
 *       await rasterize(exportRoot);
 *     } finally {
 *       restore();
 *     }
 *
 * Browser support
 * ---------------
 * Relies on canvas 2D `fillStyle` accepting modern color functions,
 * which is Chrome 111+, Safari 16.4+, Firefox 113+. On older browsers
 * the conversion silently falls back to leaving the original color
 * alone — the export may show off-hue colors but won't crash.
 */

/** Style properties we scan for modern-color-function usage. */
const COLOR_PROPS = [
  'color',
  'backgroundColor',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'outlineColor',
  'textDecorationColor',
  'caretColor',
  'columnRuleColor',
  'fill',
  'stroke',
] as const;

type ColorProp = (typeof COLOR_PROPS)[number];

/** Regex matches oklab / oklch / lab / lch / color() — everything that trips rasterizers. */
const MODERN_COLOR_RE = /\b(oklab|oklch|lab|lch|color)\s*\(/i;

/**
 * Convert any CSS color string to a concrete `rgb(...)` / `rgba(...)`
 * via the browser's own canvas 2D engine.
 *
 * Returns `null` if the canvas can't parse the color (very old browser
 * or truly malformed input), so callers can skip without crashing.
 */
function makeColorConverter(): (color: string) => string | null {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return () => null;

  const cache = new Map<string, string | null>();

  return (color: string): string | null => {
    if (!color) return null;
    const cached = cache.get(color);
    if (cached !== undefined) return cached;

    // Use a sentinel color before each attempt so we can detect
    // whether `fillStyle = color` actually took effect. If the
    // assignment silently no-oped (unsupported format), the pixel
    // we draw will still be magenta and we know to bail.
    const SENTINEL = '#ff00ff';
    ctx.fillStyle = SENTINEL;
    ctx.fillStyle = color;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillRect(0, 0, 1, 1);

    let pixel: Uint8ClampedArray;
    try {
      pixel = ctx.getImageData(0, 0, 1, 1).data;
    } catch {
      cache.set(color, null);
      return null;
    }

    const [r, g, b, a] = pixel;

    // Sentinel check: magenta came back → fillStyle parse failed.
    // (Very unlikely that a real computed color is pure magenta.)
    if (r === 255 && g === 0 && b === 255 && a === 255 && color !== SENTINEL) {
      cache.set(color, null);
      return null;
    }

    const result =
      a === 255
        ? `rgb(${r}, ${g}, ${b})`
        : `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
    cache.set(color, result);
    return result;
  };
}

/**
 * Walk `root` and inline-replace every modern color function with its
 * rgb equivalent. Returns a `restore()` callback that undoes every
 * change so the live UI isn't mutated after the export completes.
 *
 * Safe to call on a subtree that is currently off-screen (e.g. the
 * `body.papera-exporting` export tree) — it uses `getComputedStyle`
 * which resolves even for absolutely-positioned or transformed nodes.
 */
export function normalizeExportColors(root: HTMLElement): () => void {
  const toRgb = makeColorConverter();
  const restores: Array<() => void> = [];

  const visit = (el: Element): void => {
    if (el instanceof HTMLElement || el instanceof SVGElement) {
      const computed = window.getComputedStyle(el);
      const style = (el as HTMLElement).style;
      const saved: Partial<Record<ColorProp, string>> = {};
      let changed = false;

      for (const prop of COLOR_PROPS) {
        const computedValue = computed.getPropertyValue(
          prop.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()),
        );
        if (!computedValue || !MODERN_COLOR_RE.test(computedValue)) continue;

        const rgb = toRgb(computedValue);
        if (!rgb) continue;

        saved[prop] = style[prop as keyof CSSStyleDeclaration] as string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (style as any)[prop] = rgb;
        changed = true;
      }

      // Also patch any CSS custom properties (--tw-*) that contain
      // modern color functions — some Tailwind utilities read from
      // these and the inline-style override above won't catch them.
      // We only touch variables that actually contain oklab/oklch to
      // avoid bloating the inline style. Walk explicit inline custom
      // properties set on this element.
      const varSaves: Array<[string, string]> = [];
      const inline = el.getAttribute('style') || '';
      if (inline.includes('--')) {
        const varRegex = /(--[a-z0-9-]+)\s*:\s*([^;]+)/gi;
        let match: RegExpExecArray | null;
        while ((match = varRegex.exec(inline)) !== null) {
          const [, name, value] = match;
          if (MODERN_COLOR_RE.test(value)) {
            const rgb = toRgb(value.trim());
            if (rgb) {
              varSaves.push([name, value]);
              style.setProperty(name, rgb);
              changed = true;
            }
          }
        }
      }

      if (changed) {
        restores.push(() => {
          for (const prop of COLOR_PROPS) {
            if (prop in saved) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (style as any)[prop] = saved[prop] ?? '';
            }
          }
          for (const [name, value] of varSaves) {
            style.setProperty(name, value);
          }
        });
      }
    }

    for (const child of Array.from(el.children)) visit(child);
  };

  visit(root);

  return () => {
    for (const r of restores) r();
  };
}
