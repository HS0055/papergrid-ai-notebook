/**
 * Universal Tailwind bg-* class → hex color mapping for 3D cover rendering.
 * Supports all Tailwind color-900 variants used in PaperGrid.
 * Falls through to raw hex if the input is already a hex color.
 */

const TW_TO_HEX: Record<string, string> = {
  // 900 shades (primary cover palette)
  'bg-indigo-900': '#312e81',
  'bg-rose-900': '#881337',
  'bg-emerald-900': '#064e3b',
  'bg-slate-900': '#0f172a',
  'bg-amber-900': '#78350f',
  'bg-sky-900': '#0c4a6e',
  'bg-violet-900': '#4c1d95',
  'bg-stone-900': '#1c1917',
  'bg-red-900': '#7f1d1d',
  'bg-orange-900': '#7c2d12',
  'bg-yellow-900': '#713f12',
  'bg-lime-900': '#365314',
  'bg-green-900': '#14532d',
  'bg-teal-900': '#134e4a',
  'bg-cyan-900': '#164e63',
  'bg-blue-900': '#1e3a5f',
  'bg-purple-900': '#581c87',
  'bg-fuchsia-900': '#701a75',
  'bg-pink-900': '#831843',
  'bg-gray-900': '#111827',
  'bg-zinc-900': '#18181b',
  'bg-neutral-900': '#171717',

  // 800 shades (lighter alternatives)
  'bg-indigo-800': '#3730a3',
  'bg-rose-800': '#9f1239',
  'bg-emerald-800': '#065f46',
  'bg-slate-800': '#1e293b',
  'bg-amber-800': '#92400e',
  'bg-sky-800': '#075985',
  'bg-violet-800': '#5b21b6',
  'bg-stone-800': '#292524',

  // 950 shades (deepest)
  'bg-indigo-950': '#1e1b4b',
  'bg-slate-950': '#020617',
  'bg-gray-950': '#030712',
};

/**
 * Converts a Tailwind bg-* class name or raw hex string to a hex color.
 *
 * @param colorInput - A Tailwind class like 'bg-indigo-900' or a hex like '#312e81'
 * @returns Hex color string (e.g. '#312e81')
 *
 * @example
 * coverColorToHex('bg-indigo-900') // '#312e81'
 * coverColorToHex('#ff5500')       // '#ff5500'
 * coverColorToHex('bg-custom-999') // '#312e81' (fallback)
 */
export function coverColorToHex(colorInput: string): string {
  // Already a hex color
  if (colorInput.startsWith('#')) return colorInput;

  // Lookup in map
  const hex = TW_TO_HEX[colorInput];
  if (hex) return hex;

  // Fallback: default indigo
  return '#312e81';
}

/**
 * Returns a darker version of a hex color for spine rendering.
 */
export function darkenHex(hex: string, factor = 0.65): string {
  const c = hex.replace('#', '');
  const r = Math.round(parseInt(c.substring(0, 2), 16) * factor);
  const g = Math.round(parseInt(c.substring(2, 4), 16) * factor);
  const b = Math.round(parseInt(c.substring(4, 6), 16) * factor);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
