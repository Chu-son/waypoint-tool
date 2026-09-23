/**
 * Color conversion and theme color extraction utilities for PixiJS & Canvas.
 */

/**
 * Converts a hex color ('#3b82f6', '3b82f6', '#fff', '#3b82f6ff') to a PixiJS numeric color
 * (0x3b82f6). Any alpha channel is ignored. Returns `fallback` for anything that is not a
 * well-formed #RGB / #RRGGBB / #RRGGBBAA string.
 */
export function hexStringToNumber(hex?: string | null, fallback = 0x000000): number {
  if (!hex || typeof hex !== 'string') return fallback;
  const cleaned = hex.trim().replace(/^#/, '');
  if (!/^(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(cleaned)) return fallback;
  const rgb =
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((c) => c + c)
          .join('')
      : cleaned.slice(0, 6);
  return parseInt(rgb, 16);
}

/**
 * Converts a hex string or RGB color to an RGB normalized tuple ([r, g, b] with values 0.0 to 1.0)
 * useful for WebGL / GLSL shader uniforms.
 */
export function hexStringToVec3(
  hex?: string | null,
  fallback: [number, number, number] = [0, 0, 0],
): [number, number, number] {
  if (!hex || typeof hex !== 'string') return fallback;
  const num = hexStringToNumber(hex, -1);
  if (num === -1) return fallback;

  const r = ((num >> 16) & 0xff) / 255;
  const g = ((num >> 8) & 0xff) / 255;
  const b = (num & 0xff) / 255;
  return [r, g, b];
}

/**
 * Resolves a CSS variable value from document.documentElement or computed styles.
 * Returns fallback if running in non-browser environment or variable is not set.
 */
export function getCssVariable(varName: string, fallback = ''): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return fallback;
  }
  const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return val || fallback;
}
