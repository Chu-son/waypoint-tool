import { useEffect, useRef, type RefObject } from 'react';

/**
 * Calls `onOutside` when the user presses the mouse anywhere outside `ref`'s element.
 * Typical use: closing a dropdown or context menu.
 *
 * @param enabled Listen only while true (e.g. while the menu is open).
 */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onOutside: () => void,
  enabled = true,
): void {
  const callback = useRef(onOutside);
  callback.current = onOutside;

  useEffect(() => {
    if (!enabled) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        callback.current();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [ref, enabled]);
}
