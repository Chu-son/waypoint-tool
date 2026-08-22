import { useState, useCallback } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { RectEditObject } from '../../../types/store';
import { v4 as uuidv4 } from 'uuid';

export function useMapEditRect() {
  const activeCustomLayerId = useAppStore((state) => state.activeCustomLayerId);
  const mapEditFillValue = useAppStore((state) => state.mapEditFillValue);
  const addEditObject = useAppStore((state) => state.addEditObject);
  const updateEditObject = useAppStore((state) => state.updateEditObject);
  const setSelectedEditObjectId = useAppStore((state) => state.setSelectedEditObjectId);
  const pushHistorySnapshot = useAppStore((state) => state.pushHistorySnapshot);
  const beginHistoryTransaction = useAppStore((state) => state.beginHistoryTransaction);
  const endHistoryTransaction = useAppStore((state) => state.endHistoryTransaction);

  const [rectDrawStart, setRectDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [rectPreview, setRectPreview] = useState<RectEditObject | null>(null);

  // Rotate handle drag state
  const [rotatingObj, setRotatingObj] = useState<{
    layerId: string;
    objId: string;
    center: { cx: number; cy: number };
  } | null>(null);

  const handleRectDrawStart = useCallback(
    (worldPos: { x: number; y: number }) => {
      const state = useAppStore.getState();
      let targetLayer = state.customLayers.find(l => l.id === activeCustomLayerId && l.type === 'manual');
      if (!targetLayer) {
        targetLayer = state.customLayers.find(l => l.type === 'manual') || state.addManualCustomLayer();
      }
      if (state.activeCustomLayerId !== targetLayer.id) {
        state.setActiveCustomLayerId(targetLayer.id);
      }
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
    [activeCustomLayerId, mapEditFillValue]
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
    [rectDrawStart, mapEditFillValue]
  );

  const handleRectDrawEnd = useCallback(() => {
    const state = useAppStore.getState();
    const targetLayer = state.customLayers.find(l => l.id === activeCustomLayerId && l.type === 'manual') || state.customLayers.find(l => l.type === 'manual');
    const targetLayerId = targetLayer?.id;
    if (!rectDrawStart || !rectPreview || !targetLayerId) {
      setRectDrawStart(null);
      setRectPreview(null);
      return;
    }

    if (rectPreview.width >= 0.05 || rectPreview.height >= 0.05) {
      const newObj: RectEditObject = {
        ...rectPreview,
        id: uuidv4(),
      };
      beginHistoryTransaction();
      addEditObject(targetLayerId, newObj);
      setSelectedEditObjectId(newObj.id);
      endHistoryTransaction();
      pushHistorySnapshot();
    }

    setRectDrawStart(null);
    setRectPreview(null);
  }, [
    rectDrawStart,
    rectPreview,
    activeCustomLayerId,
    addEditObject,
    setSelectedEditObjectId,
    beginHistoryTransaction,
    endHistoryTransaction,
    pushHistorySnapshot,
  ]);

  const handleRotateStart = useCallback(
    (layerId: string, objId: string, center: { cx: number; cy: number }) => {
      beginHistoryTransaction();
      setRotatingObj({ layerId, objId, center });
    },
    [beginHistoryTransaction]
  );

  const handleRotateMove = useCallback(
    (worldPos: { x: number; y: number }) => {
      if (!rotatingObj) return;
      const dx = worldPos.x - rotatingObj.center.cx;
      const dy = worldPos.y - rotatingObj.center.cy;
      const angle = Math.atan2(dy, dx);

      updateEditObject(rotatingObj.layerId, rotatingObj.objId, { angle });
    },
    [rotatingObj, updateEditObject]
  );

  const handleRotateEnd = useCallback(() => {
    if (!rotatingObj) return;
    setRotatingObj(null);
    endHistoryTransaction();
    pushHistorySnapshot();
  }, [rotatingObj, endHistoryTransaction, pushHistorySnapshot]);

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
