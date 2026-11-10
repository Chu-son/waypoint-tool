import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { getAppState, resetAppStore } from '../../../test/store';
import { useGeoMapAlign } from './useGeoMapAlign';

const alignment = () => getAppState().geoMap.alignment;

/** Drags the base map from (0, 0) through `points`; `finish` ends the drag unless it is false. */
function drag(points: { x: number; y: number }[], finish = true) {
  const { result, unmount } = renderHook(() => useGeoMapAlign());
  act(() => result.current.start({ x: 0, y: 0 }, false));
  for (const point of points) act(() => result.current.update(point));
  if (finish) act(() => result.current.end());
  return { result, unmount };
}

describe('aligning the base map with a canvas drag', () => {
  beforeEach(() => resetAppStore());

  it('makes a whole drag one undo step', () => {
    drag([
      { x: 1, y: 0 },
      { x: 5, y: 2 },
    ]);

    expect(alignment()).toEqual({ dx: 5, dy: 2, yawDeg: 0 });
    getAppState().undo();
    expect(alignment()).toEqual({ dx: 0, dy: 0, yawDeg: 0 });
    expect(getAppState().historyPast).toHaveLength(0);
  });

  it('puts the map back and leaves no undo step when the drag is aborted', () => {
    getAppState().setGeoAlignment({ dx: 2, dy: 2, yawDeg: 10 });
    const steps = getAppState().historyPast.length;
    const { result } = drag([{ x: 50, y: 50 }], false);

    act(() => {
      expect(result.current.abort()).toBe(true);
    });

    expect(alignment()).toEqual({ dx: 2, dy: 2, yawDeg: 10 });
    expect(getAppState().historyPast).toHaveLength(steps);
  });

  it('puts the map back when the canvas goes away mid-drag', () => {
    const { unmount } = drag([{ x: 9, y: 9 }], false);

    unmount();

    expect(alignment()).toEqual({ dx: 0, dy: 0, yawDeg: 0 });
    expect(getAppState().historyTransactionDepth).toBe(0);
  });

  it('keeps the redo history when a click moves nothing or a drag is aborted', () => {
    getAppState().setGeoAlignment({ dx: 3, dy: 0, yawDeg: 0 });
    getAppState().undo();

    drag([]);
    const { result } = drag([{ x: 99, y: 0 }], false);
    act(() => {
      result.current.abort();
    });

    expect(getAppState().historyPast).toHaveLength(0);
    getAppState().redo();
    expect(alignment().dx).toBe(3);
  });

  it('does nothing on a move without a drag', () => {
    const { result } = renderHook(() => useGeoMapAlign());

    act(() => result.current.update({ x: 9, y: 9 }));

    expect(alignment()).toEqual({ dx: 0, dy: 0, yawDeg: 0 });
  });
});
