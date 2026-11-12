import { useState, useCallback } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { RectEditObject } from '../../../types/store';
import { v4 as uuidv4 } from 'uuid';
import { useHistoryGesture } from './useHistoryGesture';
import { useMapEditDrawGesture } from './useMapEditDrawGesture';

export function useMapEditRect() {
  const mapEditFillValue = useAppStore((state) => state.mapEditFillValue);
  const updateEditObject = useAppStore((state) => state.updateEditObject);
  const draw = useMapEditDrawGesture();
  const rotation = useHistoryGesture();

  const [rectDrawStart, setRectDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [rectPreview, setRectPreview] = useState<RectEditObject | null>(null);

  // Rotate handle drag state
  const [rotatingObj, setRotatingObj] = useState<{
    layerId: string;
    objId: string;
    center: { cx: number; cy: number };
  } | null>(null);

  const clearDrawing = useCallback(() => {
    setRectDrawStart(null);
    setRectPreview(null);
  }, []);

  const handleRectDrawStart = useCallback(
    (worldPos: { x: number; y: number }) => {
      draw.begin(clearDrawing);
      setRectDrawStart(worldPos);
      setRectPreview({
        id: 'preview',
        type: 'rect',
        fillValue: mapEditFillValue,
        cx: worldPos.x,
        cy: worldPos.y,
        width: 0.01,
        height: 0.01,
        angle: 0,
      });
    },
    [draw, clearDrawing, mapEditFillValue],
  );

  const handleRectDrawMove = useCallback(
    (worldPos: { x: number; y: number }) => {
      if (!rectDrawStart) return;
      const width = Math.abs(worldPos.x - rectDrawStart.x);
      const height = Math.abs(worldPos.y - rectDrawStart.y);
      const cx = (rectDrawStart.x + worldPos.x) / 2;
      const cy = (rectDrawStart.y + worldPos.y) / 2;

      setRectPreview({
        id: 'preview',
        type: 'rect',
        fillValue: mapEditFillValue,
        cx,
        cy,
        width: Math.max(0.01, width),
        height: Math.max(0.01, height),
        angle: 0,
      });
    },
    [rectDrawStart, mapEditFillValue],
  );

  const handleRectDrawEnd = useCallback(() => {
    const largeEnough = rectPreview && (rectPreview.width >= 0.05 || rectPreview.height >= 0.05);
    draw.finish(largeEnough ? { ...rectPreview, id: uuidv4() } : null);
    clearDrawing();
  }, [draw, clearDrawing, rectPreview]);

  const handleRotateStart = useCallback(
    (layerId: string, objId: string, center: { cx: number; cy: number }) => {
      rotation.begin({ onAbort: () => setRotatingObj(null) });
      setRotatingObj({ layerId, objId, center });
    },
    [rotation],
  );

  const handleRotateMove = useCallback(
    (worldPos: { x: number; y: number }) => {
      if (!rotatingObj) return;
      const dx = worldPos.x - rotatingObj.center.cx;
      const dy = worldPos.y - rotatingObj.center.cy;
      const angle = Math.atan2(dy, dx);

      updateEditObject(rotatingObj.layerId, rotatingObj.objId, { angle });
    },
    [rotatingObj, updateEditObject],
  );

  const handleRotateEnd = useCallback(() => {
    if (!rotatingObj) return;
    setRotatingObj(null);
    rotation.end();
  }, [rotatingObj, rotation]);

  return {
    rectPreview,
    isRectDrawing: !!rectDrawStart,
    isRectRotating: !!rotatingObj,
    handleRectDrawStart,
    handleRectDrawMove,
    handleRectDrawEnd,
    handleRotateStart,
    handleRotateMove,
    handleRotateEnd,
  };
}
