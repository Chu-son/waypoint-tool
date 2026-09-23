import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BackendAPI } from '../../api';
import { resetAppStore, getAppState } from '../../test/store';
import { makeGroup, makePlugin, makeTransform, makeWaypoint, waypointTree } from '../../test/fixtures';

const router = makePlugin('router', { name: 'Router', category: 'path_calculator', primary_output: 'path_calculator' });

const segments = [
  [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ],
];

describe('path calculator', () => {
  let runPlugin: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    runPlugin = vi.spyOn(BackendAPI, 'runPlugin').mockResolvedValue({ segments });
    resetAppStore({
      plugins: { router },
      activePathCalculatorPluginId: 'router',
      pathCalculatorParams: { margin: 0.2 },
      ...waypointTree([
        makeWaypoint('a', { transform: makeTransform(0, 0) }),
        makeGroup('g', ['b']),
        makeWaypoint('b', { transform: makeTransform(1, 0) }),
        makeWaypoint('gen', { type: 'generator', transform: undefined, children_ids: ['c'] }),
        makeWaypoint('c', { transform: makeTransform(2, 0) }),
      ]),
    });
  });

  afterEach(() => vi.useRealTimers());

  it('sends every waypoint in traversal order, including those inside groups', async () => {
    await getAppState().recalculatePath({ immediate: true });

    const context = runPlugin.mock.calls[0][1] as { waypoints: Array<{ x: number }>; properties: unknown };
    expect(context.waypoints.map((w) => w.x)).toEqual([0, 1, 2]);
    expect(context.properties).toEqual({ margin: 0.2 });
  });

  it('stores the calculated segments', async () => {
    await getAppState().recalculatePath({ immediate: true });

    expect(getAppState().calculatedPathSegments).toEqual(segments);
    expect(getAppState().isCalculatingPath).toBe(false);
  });

  it('clears the path when fewer than two waypoints exist', async () => {
    resetAppStore({
      plugins: { router },
      activePathCalculatorPluginId: 'router',
      calculatedPathSegments: segments,
      ...waypointTree([makeWaypoint('a')]),
    });

    await getAppState().recalculatePath({ immediate: true });

    expect(runPlugin).not.toHaveBeenCalled();
    expect(getAppState().calculatedPathSegments).toBeNull();
  });

  it('clears the path when the calculator is switched off', () => {
    resetAppStore({ activePathCalculatorPluginId: 'router', calculatedPathSegments: segments });

    getAppState().setActivePathCalculatorPluginId(null);

    expect(getAppState().calculatedPathSegments).toBeNull();
  });

  it('debounces bursts of parameter changes into one calculation', async () => {
    vi.useFakeTimers();

    getAppState().setPathCalculatorParams({ margin: 0.1 });
    getAppState().setPathCalculatorParams({ margin: 0.3 });
    await vi.advanceTimersByTimeAsync(250);

    expect(runPlugin).toHaveBeenCalledTimes(1);
    expect((runPlugin.mock.calls[0][1] as { properties: unknown }).properties).toEqual({ margin: 0.3 });
  });

  it('ignores a stale result that arrives after a newer request', async () => {
    let resolveFirst!: (v: unknown) => void;
    runPlugin.mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)));
    runPlugin.mockResolvedValueOnce({ segments });

    const first = getAppState().recalculatePath({ immediate: true });
    await getAppState().recalculatePath({ immediate: true });
    resolveFirst({ segments: [[{ x: 9, y: 9 }]] });
    await first;

    expect(getAppState().calculatedPathSegments).toEqual(segments);
  });
});
