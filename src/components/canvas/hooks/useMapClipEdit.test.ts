import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { getAppState, resetAppStore } from '../../../test/store';
import { layerStackState, makeMap } from '../../../test/fixtures';
import { useMapClipEdit } from './useMapClipEdit';

const left = { rects: [{ x: 0, y: 0, width: 5, height: 10 }] };
const clipOf = (id: string) => getAppState().mapLayers.find((l) => l.id === id)?.clip;

/** Drags the right edge of the area on map `a` to each x in `xs`; `finish` ends the drag unless it is false. */
function resize(xs: number[], finish = true) {
  const { result, unmount } = renderHook(() => useMapClipEdit());
  act(() => result.current.startResize('a', 0, { hx: 1, hy: 0 }));
  for (const x of xs) act(() => result.current.update({ x, y: 5 }));
  if (finish) act(() => result.current.end());
  return { result, unmount };
}

describe('reshaping a use area with a canvas drag', () => {
  beforeEach(() => resetAppStore(layerStackState(makeMap('a', { clip: left }))));

  it('makes a whole drag one undo step', () => {
    resize([6, 8]);
    expect(clipOf('a')?.rects[0].width).toBe(8);

    getAppState().undo();

    expect(clipOf('a')).toEqual(left);
  });

  it('puts the area back and leaves no undo step when the drag is aborted', () => {
    const { result } = resize([9], false);

    act(() => {
      expect(result.current.abort()).toBe(true);
    });

    expect(clipOf('a')).toEqual(left);
    expect(getAppState().historyPast).toHaveLength(0);
  });

  it('puts the area back when the canvas goes away mid-drag', () => {
    const { unmount } = resize([9], false);

    unmount();

    expect(clipOf('a')).toEqual(left);
    expect(getAppState().historyTransactionDepth).toBe(0);
  });

  it('puts back "no clip" when a drawn area is only a click', () => {
    resetAppStore(layerStackState(makeMap('a')));
    const { result } = renderHook(() => useMapClipEdit());

    act(() => result.current.startDraw('a', { x: 1, y: 1 }, false));
    act(() => result.current.update({ x: 1, y: 1 }));
    act(() => result.current.end());

    expect(clipOf('a')).toBeNull();
    expect(getAppState().historyPast).toHaveLength(0);
  });

  it('leaves no undo step when the drag changed nothing, and keeps the redo history', () => {
    getAppState().updateMapLayer('a', { opacity: 0.5 });
    getAppState().undo();

    resize([]);

    expect(getAppState().historyPast).toHaveLength(0);
    expect(getAppState().historyFuture).toHaveLength(1);
  });

  it('does nothing on a move without a drag', () => {
    const { result } = renderHook(() => useMapClipEdit());

    act(() => result.current.update({ x: 9, y: 9 }));

    expect(clipOf('a')).toEqual(left);
  });
});
