import { useEffect, useState, type MutableRefObject } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { findNearestObjectCenter } from '../utils/hitTest';

export interface SnappedMeasureTarget {
  x: number;
  y: number;
  objectName: string;
}

interface UseMeasureAltSnapOptions {
  /** Last pointer position in world coordinates. */
  lastWorldPosRef: MutableRefObject<{ x: number; y: number } | null>;
  scaleRef: MutableRefObject<number>;
  /** Cancels the in-progress canvas interaction; called when the window loses focus. */
  abortRef: MutableRefObject<(() => boolean) | undefined>;
}

/**
 * Holding Alt in the measure tool snaps the measuring point to the nearest object's center.
 * Tracks Alt and the snap target from window key events, and aborts the interaction on window blur.
 */
export function useMeasureAltSnap({ lastWorldPosRef, scaleRef, abortRef }: UseMeasureAltSnapOptions) {
  const [isAltPressed, setIsAltPressed] = useState(false);
  const [snappedMeasureTarget, setSnappedMeasureTarget] = useState<SnappedMeasureTarget | null>(null);
  const setMeasureHoverPoint = useAppStore((state) => state.setMeasureHoverPoint);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Alt') return;
      setIsAltPressed(true);
      const state = useAppStore.getState();
      if (state.activeTool === 'measure' && lastWorldPosRef.current) {
        const { x, y } = lastWorldPosRef.current;
        const nearest = findNearestObjectCenter(x, y, state.nodes, state.annotationObjects || {}, scaleRef.current);
        setSnappedMeasureTarget(nearest ? { x: nearest.x, y: nearest.y, objectName: nearest.objectName } : null);
        if (state.measureStartPoint && !state.measureEndPoint && nearest) {
          setMeasureHoverPoint({ x: nearest.x, y: nearest.y });
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key !== 'Alt') return;
      setIsAltPressed(false);
      setSnappedMeasureTarget(null);
      const state = useAppStore.getState();
      if (state.activeTool === 'measure' && lastWorldPosRef.current) {
        if (state.measureStartPoint && !state.measureEndPoint) {
          setMeasureHoverPoint(lastWorldPosRef.current);
        }
      }
    };
    const handleWindowBlur = () => {
      setIsAltPressed(false);
      setSnappedMeasureTarget(null);
      abortRef.current?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [setMeasureHoverPoint, lastWorldPosRef, scaleRef, abortRef]);

  return { isAltPressed, snappedMeasureTarget, setSnappedMeasureTarget };
}
