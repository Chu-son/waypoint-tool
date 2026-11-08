import { useMemo, useRef } from 'react';
import { useAppStore } from '../../../stores/appStore';
import type { EditObject } from '../../../types/store';
import { useHistoryGesture } from './useHistoryGesture';

/**
 * Drawing one shape on a hand-drawn layer as one undo step, shared by the drawing tools.
 *
 * `begin` picks the layer to draw on, creating one if there is none. `finish` adds the shape; given nothing
 * (the stroke was too small), it takes everything back, the layer it created included.
 */
export function useMapEditDrawGesture() {
  const gesture = useHistoryGesture();
  const targetLayerId = useRef<string | null>(null);

  return useMemo(
    () => ({
      /** `onAbort` clears the preview when the drawing is aborted. */
      begin: (onAbort: () => void) => {
        gesture.begin({ onAbort });
        const state = useAppStore.getState();
        const target =
          state.customLayers.find((l) => l.id === state.activeCustomLayerId && l.type === 'manual') ??
          state.customLayers.find((l) => l.type === 'manual') ??
          state.addManualCustomLayer();
        if (state.activeCustomLayerId !== target.id) state.setActiveCustomLayerId(target.id);
        targetLayerId.current = target.id;
      },
      finish: (shape: EditObject | null) => {
        if (!gesture.isActive()) return;
        if (!shape || !targetLayerId.current) {
          gesture.cancel();
          return;
        }
        const state = useAppStore.getState();
        state.addEditObject(targetLayerId.current, shape);
        state.setSelectedEditObjectId(shape.id);
        gesture.end();
      },
    }),
    [gesture],
  );
}
