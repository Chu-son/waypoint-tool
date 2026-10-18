export interface MenuPosition {
  left: number;
  top: number;
  /** Set when the menu is taller than the window; the menu then scrolls inside this height. */
  maxHeight?: number;
}

const MARGIN = 8;

/** Places `size` so it stays inside `viewport`: opens on the other side of the pointer when it would overflow. */
export function clampMenuPosition(
  x: number,
  y: number,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  margin = MARGIN,
): MenuPosition {
  const place = (point: number, length: number, available: number) => {
    const start = point + length > available - margin ? point - length : point;
    return Math.max(margin, Math.min(start, available - length - margin));
  };

  const maxHeight = viewport.height - margin * 2;
  if (size.height > maxHeight) {
    return { left: place(x, size.width, viewport.width), top: margin, maxHeight };
  }
  return { left: place(x, size.width, viewport.width), top: place(y, size.height, viewport.height) };
}
