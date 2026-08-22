import { useState, useCallback } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { CircleEditObject } from '../../../types/store';
import { v4 as uuidv4 } from 'uuid';

export function useMapEditCircle() {
  const activeCustomLayerId = useAppStore((state) => state.activeCustomLayerId);
  const mapEditFillValue = useAppStore((state) => state.mapEditFillValue);
  const addEditObject = useAppStore((state) => state.addEditObject);
  const setSelectedEditObjectId = useAppStore((state) => state.setSelectedEditObjectId);
  const pushHistorySnapshot = useAppStore((state) => state.pushHistorySnapshot);

  const [circleCenter, setCircleCenter] = useState<{ x: number; y: number } | null>(null);
  const [circlePreview, setCirclePreview] = useState<CircleEditObject | null>(null);

  const handleCircleDrawStart = useCallback(
    (worldPos: { x: number; y: number }) => {
      const state = useAppStore.getState();
      let targetLayer = state.customLayers.find(l => l.id === activeCustomLayerId && l.type === 'manual');
      if (!targetLayer) {
        targetLayer = state.customLayers.find(l => l.type === 'manual') || state.addManualCustomLayer();
      }
      if (state.activeCustomLayerId !== targetLayer.id) {
        state.setActiveCustomLayerId(targetLayer.id);
      }
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
    [activeCustomLayerId, mapEditFillValue]
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
    [circleCenter, mapEditFillValue]
  );

  const handleCircleDrawEnd = useCallback(() => {
    const state = useAppStore.getState();
    const targetLayer = state.customLayers.find(l => l.id === activeCustomLayerId && l.type === 'manual') || state.customLayers.find(l => l.type === 'manual');
    const targetLayerId = targetLayer?.id;
    if (!circleCenter || !circlePreview || !targetLayerId) {
      setCircleCenter(null);
      setCirclePreview(null);
      return;
    }

    if (circlePreview.radius >= 0.02) {
      const newObj: CircleEditObject = {
        ...circlePreview,
        id: uuidv4(),
      };
      addEditObject(targetLayerId, newObj);
      setSelectedEditObjectId(newObj.id);
      pushHistorySnapshot();
    }

    setCircleCenter(null);
    setCirclePreview(null);
  }, [
    circleCenter,
    circlePreview,
    activeCustomLayerId,
    addEditObject,
    setSelectedEditObjectId,
    pushHistorySnapshot,
  ]);

  return {
    circlePreview,
    isCircleDrawing: !!circleCenter,
    handleCircleDrawStart,
    handleCircleDrawMove,
    handleCircleDrawEnd,
  };
}
