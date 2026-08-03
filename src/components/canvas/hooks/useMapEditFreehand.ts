import { useState, useCallback } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { FreehandEditObject } from '../../../types/store';
import { v4 as uuidv4 } from 'uuid';

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
  const activeEditLayerId = useAppStore((state) => state.activeEditLayerId);
  const activeMapLayerId = useAppStore((state) => state.activeMapLayerId);
  const mapLayers = useAppStore((state) => state.mapLayers);
  const editLayers = useAppStore((state) => state.editLayers);
  const mapEditFillValue = useAppStore((state) => state.mapEditFillValue);
  const mapEditBrushSize = useAppStore((state) => state.mapEditBrushSize); // in pixels
  const addEditObject = useAppStore((state) => state.addEditObject);
  const setSelectedEditObjectId = useAppStore((state) => state.setSelectedEditObjectId);
  const pushHistorySnapshot = useAppStore((state) => state.pushHistorySnapshot);

  const [isFreehandDrawing, setIsFreehandDrawing] = useState(false);
  const [freehandPoints, setFreehandPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [brushPreviewPos, setBrushPreviewPos] = useState<{ x: number; y: number } | null>(null);

  // Get active map layer resolution
  const getResolution = useCallback(() => {
    let targetMapId = activeMapLayerId;
    if (!targetMapId && activeEditLayerId) {
      const el = editLayers.find((l) => l.id === activeEditLayerId);
      if (el?.targetMapLayerId) targetMapId = el.targetMapLayerId;
    }
    const visibleMap = mapLayers.find((m) => (targetMapId ? m.id === targetMapId : m.visible));
    return visibleMap?.info?.resolution || 0.05;
  }, [activeMapLayerId, activeEditLayerId, editLayers, mapLayers]);

  const resolution = getResolution();
  const brushRadiusWorld = mapEditBrushSize * resolution;

  const handleFreehandDrawStart = useCallback(
    (worldPos: { x: number; y: number }) => {
      const state = useAppStore.getState();
      const targetLayerId = activeEditLayerId || state.editLayers[0]?.id || state.addEditLayer('Edit Layer 1').id;
      if (!state.activeEditLayerId) {
        state.setActiveEditLayerId(targetLayerId);
      }
      setIsFreehandDrawing(true);
      setFreehandPoints([worldPos]);
      setBrushPreviewPos(worldPos);
    },
    [activeEditLayerId]
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
    [isFreehandDrawing, brushRadiusWorld]
  );

  const handleFreehandDrawEnd = useCallback(() => {
    const state = useAppStore.getState();
    const targetLayerId = activeEditLayerId || state.editLayers[0]?.id;
    if (!isFreehandDrawing || !targetLayerId || freehandPoints.length === 0) {
      setIsFreehandDrawing(false);
      setFreehandPoints([]);
      return;
    }

    // Simplify points using Douglas-Peucker
    const epsilon = Math.max(0.002, brushRadiusWorld * 0.1);
    const simplified = simplifyPoints(freehandPoints, epsilon);

    const newObj: FreehandEditObject = {
      id: uuidv4(),
      type: 'freehand',
      fillValue: mapEditFillValue,
      points: simplified,
      brushRadius: brushRadiusWorld,
    };

    addEditObject(targetLayerId, newObj);
    setSelectedEditObjectId(newObj.id);
    pushHistorySnapshot();

    setIsFreehandDrawing(false);
    setFreehandPoints([]);
  }, [
    isFreehandDrawing,
    activeEditLayerId,
    freehandPoints,
    brushRadiusWorld,
    mapEditFillValue,
    addEditObject,
    setSelectedEditObjectId,
    pushHistorySnapshot,
  ]);

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
