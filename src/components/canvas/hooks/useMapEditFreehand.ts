import { useState, useCallback } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { useResolvedMapLayers } from '../../../hooks/useResolvedMapLayers';
import { FreehandEditObject } from '../../../types/store';
import { v4 as uuidv4 } from 'uuid';
import { useMapEditDrawGesture } from './useMapEditDrawGesture';

/**
 * Ramer-Douglas-Peucker point simplification algorithm.
 */
function simplifyPoints(points: Array<{ x: number; y: number }>, epsilon: number): Array<{ x: number; y: number }> {
  if (points.length <= 2) return points;

  let dmax = 0;
  let index = 0;
  const end = points.length - 1;

  const p1 = points[0];
  const p2 = points[end];

  for (let i = 1; i < end; i++) {
    const p = points[i];
    // Perpendicular distance from p to line p1-p2
    const num = Math.abs((p2.y - p1.y) * p.x - (p2.x - p1.x) * p.y + p2.x * p1.y - p2.y * p1.x);
    const den = Math.hypot(p2.y - p1.y, p2.x - p1.x);
    const d = den === 0 ? Math.hypot(p.x - p1.x, p.y - p1.y) : num / den;

    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  if (dmax > epsilon) {
    const recResults1 = simplifyPoints(points.slice(0, index + 1), epsilon);
    const recResults2 = simplifyPoints(points.slice(index), epsilon);
    return recResults1.slice(0, recResults1.length - 1).concat(recResults2);
  } else {
    return [points[0], points[end]];
  }
}

export function useMapEditFreehand() {
  const activeMapLayerId = useAppStore((state) => state.activeMapLayerId);
  const mapLayers = useResolvedMapLayers();
  const mapEditFillValue = useAppStore((state) => state.mapEditFillValue);
  const mapEditBrushSize = useAppStore((state) => state.mapEditBrushSize); // in pixels
  const draw = useMapEditDrawGesture();

  const [isFreehandDrawing, setIsFreehandDrawing] = useState(false);
  const [freehandPoints, setFreehandPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [brushPreviewPos, setBrushPreviewPos] = useState<{ x: number; y: number } | null>(null);

  // Get active map layer resolution
  const getResolution = useCallback(() => {
    const visibleMap = mapLayers.find((m) => (activeMapLayerId ? m.id === activeMapLayerId : m.visible));
    return visibleMap?.info?.resolution || 0.05;
  }, [activeMapLayerId, mapLayers]);

  const resolution = getResolution();
  const brushRadiusWorld = mapEditBrushSize * resolution;

  const clearDrawing = useCallback(() => {
    setIsFreehandDrawing(false);
    setFreehandPoints([]);
  }, []);

  const handleFreehandDrawStart = useCallback(
    (worldPos: { x: number; y: number }) => {
      draw.begin(clearDrawing);
      setIsFreehandDrawing(true);
      setFreehandPoints([worldPos]);
      setBrushPreviewPos(worldPos);
    },
    [draw, clearDrawing],
  );

  const handleFreehandDrawMove = useCallback(
    (worldPos: { x: number; y: number }) => {
      setBrushPreviewPos(worldPos);
      if (!isFreehandDrawing) return;

      setFreehandPoints((prev) => {
        if (prev.length === 0) return [worldPos];
        const last = prev[prev.length - 1];
        const dist = Math.hypot(worldPos.x - last.x, worldPos.y - last.y);
        // Minimum sampling distance: half of brush radius
        if (dist >= Math.max(0.005, brushRadiusWorld / 2)) {
          return [...prev, worldPos];
        }
        return prev;
      });
    },
    [isFreehandDrawing, brushRadiusWorld],
  );

  const handleFreehandDrawEnd = useCallback(() => {
    // Simplify points using Douglas-Peucker
    const epsilon = Math.max(0.002, brushRadiusWorld * 0.1);
    draw.finish(
      isFreehandDrawing && freehandPoints.length > 0
        ? {
            id: uuidv4(),
            type: 'freehand',
            fillValue: mapEditFillValue,
            points: simplifyPoints(freehandPoints, epsilon),
            brushRadius: brushRadiusWorld,
          }
        : null,
    );
    clearDrawing();
  }, [draw, clearDrawing, isFreehandDrawing, freehandPoints, brushRadiusWorld, mapEditFillValue]);

  const freehandPreview: FreehandEditObject | null =
    isFreehandDrawing && freehandPoints.length > 0
      ? {
          id: 'preview',
          type: 'freehand',
          fillValue: mapEditFillValue,
          points: freehandPoints,
          brushRadius: brushRadiusWorld,
        }
      : null;

  return {
    freehandPreview,
    isFreehandDrawing,
    brushPreviewPos,
    brushRadiusWorld,
    setBrushPreviewPos,
    handleFreehandDrawStart,
    handleFreehandDrawMove,
    handleFreehandDrawEnd,
  };
}
