import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMapEditLine } from './useMapEditLine';
import { useAppStore } from '../../../stores/appStore';
import { ManualCustomLayer } from '../../../types/store';

describe('useMapEditLine', () => {
  beforeEach(() => {
    const mockManualLayer: ManualCustomLayer = {
      id: 'layer-1',
      name: 'Test Manual Layer',
      type: 'manual',
      visible: true,
      opacity: 1.0,
      z_index: 0,
      editObjects: [],
    };

    useAppStore.setState({
      customLayers: [mockManualLayer],
      activeCustomLayerId: 'layer-1',
      mapEditFillValue: 0,
      selectedEditObjectId: null,
      historyPast: [],
      historyFuture: [],
    });
  });

  it('draws a line and creates LineEditObject on completion', () => {
    const { result } = renderHook(() => useMapEditLine());

    expect(result.current.isLineDrawing).toBe(false);
    expect(result.current.linePreview).toBeNull();

    // Start drawing line from (1, 1)
    act(() => {
      result.current.handleLineDrawStart({ x: 1.0, y: 1.0 });
    });

    expect(result.current.isLineDrawing).toBe(true);
    expect(result.current.linePreview).toEqual({
      id: 'preview',
      type: 'line',
      fillValue: 0,
      x1: 1.0,
      y1: 1.0,
      x2: 1.0,
      y2: 1.0,
    });

    // Move to (5, 4)
    act(() => {
      result.current.handleLineDrawMove({ x: 5.0, y: 4.0 });
    });

    expect(result.current.linePreview).toEqual({
      id: 'preview',
      type: 'line',
      fillValue: 0,
      x1: 1.0,
      y1: 1.0,
      x2: 5.0,
      y2: 4.0,
    });

    // End drawing
    act(() => {
      result.current.handleLineDrawEnd();
    });

    expect(result.current.isLineDrawing).toBe(false);
    expect(result.current.linePreview).toBeNull();

    const layer = useAppStore.getState().customLayers[0] as ManualCustomLayer;
    expect(layer.editObjects).toHaveLength(1);
    const created = layer.editObjects[0];
    expect(created.type).toBe('line');
    if (created.type === 'line') {
      expect(created.x1).toBe(1.0);
      expect(created.y1).toBe(1.0);
      expect(created.x2).toBe(5.0);
      expect(created.y2).toBe(4.0);
      expect(created.fillValue).toBe(0);
    }
  });

  it('discards drawing if line is too short (< 0.05m)', () => {
    const { result } = renderHook(() => useMapEditLine());

    act(() => {
      result.current.handleLineDrawStart({ x: 1.0, y: 1.0 });
      result.current.handleLineDrawMove({ x: 1.01, y: 1.01 });
      result.current.handleLineDrawEnd();
    });

    const layer = useAppStore.getState().customLayers[0] as ManualCustomLayer;
    expect(layer.editObjects).toHaveLength(0);
  });
});
