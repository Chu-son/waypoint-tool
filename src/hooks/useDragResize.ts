import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { clampGroupWidth } from '../utils/dockLayout';

interface DragResizeOptions {
  /** The committed width. */
  width: number;
  /** +1 when dragging to the right widens the pane (left side panel), -1 when it narrows it (right side panel). */
  direction: 1 | -1;
  /** Called once on mouse up with the final, clamped width. */
  onCommit: (width: number) => void;
}

/**
 * Drag-to-resize for a pane. While dragging only local state changes (`width` follows the pointer); the store is
 * updated once on mouse up, so a drag does not write settings on every mouse move.
 */
export function useDragResize({ width, direction, onCommit }: DragResizeOptions) {
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;
  const stopRef = useRef<(() => void) | null>(null);

  // Leaving mid-drag (e.g. the pane unmounts) must not leave listeners or the cursor behind.
  useEffect(() => () => stopRef.current?.(), []);

  const onMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = width;
      const previousCursor = document.body.style.cursor;
      let latest = startWidth;

      const onMouseMove = (moveEvent: MouseEvent) => {
        latest = clampGroupWidth(startWidth + direction * (moveEvent.clientX - startX));
        setDragWidth(latest);
      };
      const stop = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = previousCursor;
        stopRef.current = null;
      };
      const onMouseUp = () => {
        stop();
        setDragWidth(null);
        if (latest !== startWidth) onCommitRef.current(latest);
      };

      document.body.style.cursor = 'col-resize';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      stopRef.current = stop;
    },
    [width, direction],
  );

  return { width: dragWidth ?? width, isDragging: dragWidth !== null, onMouseDown };
}
