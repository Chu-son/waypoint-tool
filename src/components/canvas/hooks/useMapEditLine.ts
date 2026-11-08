import { useState, useCallback } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { LineEditObject } from '../../../types/store';
import { v4 as uuidv4 } from 'uuid';
import { useMapEditDrawGesture } from './useMapEditDrawGesture';

export function useMapEditLine() {
  const mapEditFillValue = useAppStore((state) => state.mapEditFillValue);
  const draw = useMapEditDrawGesture();

  const [lineDrawStart, setLineDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [linePreview, setLinePreview] = useState<LineEditObject | null>(null);

  const clearDrawing = useCallback(() => {
    setLineDrawStart(null);
    setLinePreview(null);
  }, []);

  const handleLineDrawStart = useCallback(
    (worldPos: { x: number; y: number }) => {
      draw.begin(clearDrawing);
      setLineDrawStart(worldPos);
      setLinePreview({
        id: 'preview',
        type: 'line',
        fillValue: mapEditFillValue,
        x1: worldPos.x,
        y1: worldPos.y,
        x2: worldPos.x,
        y2: worldPos.y,
      });
    },
    [draw, clearDrawing, mapEditFillValue],
  );

  const handleLineDrawMove = useCallback(
    (worldPos: { x: number; y: number }) => {
      if (!lineDrawStart) return;

      setLinePreview({
        id: 'preview',
        type: 'line',
        fillValue: mapEditFillValue,
        x1: lineDrawStart.x,
        y1: lineDrawStart.y,
        x2: worldPos.x,
        y2: worldPos.y,
      });
    },
    [lineDrawStart, mapEditFillValue],
  );

  const handleLineDrawEnd = useCallback(() => {
    const largeEnough =
      linePreview && Math.hypot(linePreview.x2 - linePreview.x1, linePreview.y2 - linePreview.y1) >= 0.05;
    draw.finish(largeEnough ? { ...linePreview, id: uuidv4() } : null);
    clearDrawing();
  }, [draw, clearDrawing, linePreview]);

  return {
    linePreview,
    isLineDrawing: !!lineDrawStart,
    handleLineDrawStart,
    handleLineDrawMove,
    handleLineDrawEnd,
  };
}
