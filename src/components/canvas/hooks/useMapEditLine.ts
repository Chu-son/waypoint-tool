import { useState, useCallback } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { LineEditObject } from '../../../types/store';
import { v4 as uuidv4 } from 'uuid';

export function useMapEditLine() {
  const activeCustomLayerId = useAppStore((state) => state.activeCustomLayerId);
  const mapEditFillValue = useAppStore((state) => state.mapEditFillValue);
  const addEditObject = useAppStore((state) => state.addEditObject);
  const setSelectedEditObjectId = useAppStore((state) => state.setSelectedEditObjectId);
  const pushHistorySnapshot = useAppStore((state) => state.pushHistorySnapshot);
  const beginHistoryTransaction = useAppStore((state) => state.beginHistoryTransaction);
  const endHistoryTransaction = useAppStore((state) => state.endHistoryTransaction);

  const [lineDrawStart, setLineDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [linePreview, setLinePreview] = useState<LineEditObject | null>(null);

  const handleLineDrawStart = useCallback(
    (worldPos: { x: number; y: number }) => {
      const state = useAppStore.getState();
      let targetLayer = state.customLayers.find(
        (l) => l.id === activeCustomLayerId && l.type === 'manual'
      );
      if (!targetLayer) {
        targetLayer =
          state.customLayers.find((l) => l.type === 'manual') ||
          state.addManualCustomLayer();
      }
      if (state.activeCustomLayerId !== targetLayer.id) {
        state.setActiveCustomLayerId(targetLayer.id);
      }
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
    [activeCustomLayerId, mapEditFillValue]
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
    [lineDrawStart, mapEditFillValue]
  );

  const handleLineDrawEnd = useCallback(() => {
    const state = useAppStore.getState();
    const targetLayer =
      state.customLayers.find(
        (l) => l.id === activeCustomLayerId && l.type === 'manual'
      ) || state.customLayers.find((l) => l.type === 'manual');
    const targetLayerId = targetLayer?.id;

    if (!lineDrawStart || !linePreview || !targetLayerId) {
      setLineDrawStart(null);
      setLinePreview(null);
      return;
    }

    const length = Math.hypot(
      linePreview.x2 - linePreview.x1,
      linePreview.y2 - linePreview.y1
    );

    if (length >= 0.05) {
      const newObj: LineEditObject = {
        ...linePreview,
        id: uuidv4(),
      };
      beginHistoryTransaction();
      addEditObject(targetLayerId, newObj);
      setSelectedEditObjectId(newObj.id);
      endHistoryTransaction();
      pushHistorySnapshot();
    }

    setLineDrawStart(null);
    setLinePreview(null);
  }, [
    lineDrawStart,
    linePreview,
    activeCustomLayerId,
    addEditObject,
    setSelectedEditObjectId,
    beginHistoryTransaction,
    endHistoryTransaction,
    pushHistorySnapshot,
  ]);

  return {
    linePreview,
    isLineDrawing: !!lineDrawStart,
    handleLineDrawStart,
    handleLineDrawMove,
    handleLineDrawEnd,
  };
}
