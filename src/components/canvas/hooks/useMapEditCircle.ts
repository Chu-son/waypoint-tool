import { useState, useCallback } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { CircleEditObject } from '../../../types/store';
import { v4 as uuidv4 } from 'uuid';
import { useMapEditDrawGesture } from './useMapEditDrawGesture';

export function useMapEditCircle() {
  const mapEditFillValue = useAppStore((state) => state.mapEditFillValue);
  const draw = useMapEditDrawGesture();

  const [circleCenter, setCircleCenter] = useState<{ x: number; y: number } | null>(null);
  const [circlePreview, setCirclePreview] = useState<CircleEditObject | null>(null);

  const clearDrawing = useCallback(() => {
    setCircleCenter(null);
    setCirclePreview(null);
  }, []);

  const handleCircleDrawStart = useCallback(
    (worldPos: { x: number; y: number }) => {
      draw.begin(clearDrawing);
      setCircleCenter(worldPos);
      setCirclePreview({
        id: 'preview',
        type: 'circle',
        fillValue: mapEditFillValue,
        cx: worldPos.x,
        cy: worldPos.y,
        radius: 0.01,
      });
    },
    [draw, clearDrawing, mapEditFillValue],
  );

  const handleCircleDrawMove = useCallback(
    (worldPos: { x: number; y: number }) => {
      if (!circleCenter) return;
      const dx = worldPos.x - circleCenter.x;
      const dy = worldPos.y - circleCenter.y;
      const radius = Math.hypot(dx, dy);

      setCirclePreview({
        id: 'preview',
        type: 'circle',
        fillValue: mapEditFillValue,
        cx: circleCenter.x,
        cy: circleCenter.y,
        radius: Math.max(0.01, radius),
      });
    },
    [circleCenter, mapEditFillValue],
  );

  const handleCircleDrawEnd = useCallback(() => {
    const largeEnough = circlePreview && circlePreview.radius >= 0.02;
    draw.finish(largeEnough ? { ...circlePreview, id: uuidv4() } : null);
    clearDrawing();
  }, [draw, clearDrawing, circlePreview]);

  return {
    circlePreview,
    isCircleDrawing: !!circleCenter,
    handleCircleDrawStart,
    handleCircleDrawMove,
    handleCircleDrawEnd,
  };
}
