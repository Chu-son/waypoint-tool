import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';
import { clampMenuPosition } from '../utils/menuPosition';

/**
 * Style for a `position: fixed` menu opened at (x, y) that must stay inside the window. The menu is measured after
 * it renders (before paint), so it never shows up off screen.
 */
export function useClampedMenuPosition(ref: RefObject<HTMLElement | null>, x: number, y: number): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({ left: x, top: y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Measure at the natural size: a previous max-height must not shrink the measurement.
    el.style.maxHeight = '';
    const { width, height } = el.getBoundingClientRect();
    const { left, top, maxHeight } = clampMenuPosition(
      x,
      y,
      { width, height },
      { width: window.innerWidth, height: window.innerHeight },
    );
    setStyle(maxHeight === undefined ? { left, top } : { left, top, maxHeight, overflowY: 'auto' });
  }, [ref, x, y]);

  return style;
}
