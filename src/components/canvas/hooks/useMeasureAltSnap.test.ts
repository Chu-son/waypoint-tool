import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMeasureAltSnap } from './useMeasureAltSnap';
import { resetAppStore, getAppState } from '../../../test/store';
import { makeTransform, makeWaypoint, waypointTree } from '../../../test/fixtures';

function setup(abort = vi.fn(() => true)) {
  const lastWorldPosRef = { current: { x: 1, y: 1 } as { x: number; y: number } | null };
  const scaleRef = { current: 100 };
  const abortRef = { current: abort as (() => boolean) | undefined };
  return { abort, ...renderHook(() => useMeasureAltSnap({ lastWorldPosRef, scaleRef, abortRef })) };
}

const key = (type: 'keydown' | 'keyup', k: string) =>
  act(() => void window.dispatchEvent(new KeyboardEvent(type, { key: k })));

describe('useMeasureAltSnap', () => {
  it('tracks whether Alt is held', () => {
    resetAppStore({});
    const { result } = setup();
    key('keydown', 'Alt');
    expect(result.current.isAltPressed).toBe(true);
    key('keyup', 'Alt');
    expect(result.current.isAltPressed).toBe(false);
  });

  it('snaps to the nearest waypoint while Alt is held in the measure tool, and releases on keyup', () => {
    resetAppStore({
      ...waypointTree([makeWaypoint('w', { transform: makeTransform(1, 1) })]),
      activeTool: 'measure',
    });
    const { result } = setup();
    key('keydown', 'Alt');
    expect(result.current.snappedMeasureTarget).toMatchObject({ x: 1, y: 1 });
    key('keyup', 'Alt');
    expect(result.current.snappedMeasureTarget).toBeNull();
    expect(getAppState().activeTool).toBe('measure');
  });

  it('cancels the interaction when the window loses focus', () => {
    resetAppStore({});
    const { abort } = setup();
    act(() => void window.dispatchEvent(new Event('blur')));
    expect(abort).toHaveBeenCalled();
  });
});
