import { useEffect, useMemo, useRef } from 'react';
import { useAppStore } from '../../../stores/appStore';

export type HistoryGestureOptions = {
  /** Clean-up of what the gesture shows besides the store (previews, refs), run when it is aborted. */
  onAbort?: () => void;
};

export type HistoryGesture = {
  /** Starts a gesture: everything it changes until `end` is undone in one step. Ends a gesture still open. */
  begin: (options?: HistoryGestureOptions) => void;
  /** Commits the gesture. A gesture that changed nothing leaves no undo step. */
  end: () => void;
  /** Aborts the gesture, putting back the state from when it began. True when there was one to abort. */
  cancel: () => boolean;
  isActive: () => boolean;
};

/**
 * One canvas gesture (a drag, a rotation, drawing a shape) as one history transaction.
 *
 * Escape and undo abort it through the canvas abort handlers, and so does unmounting: the store goes back
 * to how it was when the gesture began, so callers write no rollback of their own, only `onAbort` for
 * what lives outside the store.
 */
export function useHistoryGesture(): HistoryGesture {
  const open = useRef<HistoryGestureOptions | null>(null);

  const gesture = useMemo<HistoryGesture>(() => {
    const end = () => {
      if (!open.current) return;
      open.current = null;
      useAppStore.getState().endHistoryTransaction();
    };
    return {
      begin: (options = {}) => {
        end();
        useAppStore.getState().beginHistoryTransaction();
        open.current = options;
      },
      end,
      cancel: () => {
        const current = open.current;
        if (!current) return false;
        open.current = null;
        useAppStore.getState().cancelHistoryTransaction();
        current.onAbort?.();
        return true;
      },
      isActive: () => open.current !== null,
    };
  }, []);

  useEffect(() => {
    const unregister = useAppStore.getState().registerCanvasAbortHandler(gesture.cancel);
    return () => {
      unregister();
      gesture.cancel();
    };
  }, [gesture]);

  return gesture;
}
