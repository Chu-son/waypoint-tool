import { describe, it, expect, beforeEach } from 'vitest';
import { create } from 'zustand';
import type { AppState } from '../appStore';
import { historyGuard, takeHistoryViolations, withoutHistory } from './historyGuard';
import { captureSnapshot } from './historyModel';
import { getAppState, resetAppStore } from '../../test/store';
import { makeWaypoint } from '../../test/fixtures';

/** A store with just enough of the app's state to break, or keep, the rules the guard checks. */
const makeStore = () =>
  create<AppState>()(
    historyGuard(
      (set) =>
        ({
          historyPast: [],
          historyTransactionDepth: 0,
          nodes: {},
          geoMap: { opacity: 1 },
          record: () => set((s) => ({ historyPast: [...s.historyPast, captureSnapshot(s)] })),
          rename: (name: string) => set((s) => ({ nodes: { ...s.nodes, a: { ...s.nodes.a, name } } })),
          open: () => set({ historyTransactionDepth: 1 }),
          close: () => set({ historyTransactionDepth: 0 }),
          setOpacity: (opacity: number) => set({ geoMap: { opacity } as AppState['geoMap'] }),
        }) as unknown as AppState,
    ),
  );

type Actions = {
  record: () => void;
  rename: (name: string) => void;
  open: () => void;
  close: () => void;
  setOpacity: (opacity: number) => void;
};

const actions = (store: ReturnType<typeof makeStore>) => store.getState() as unknown as Actions;

const reportedKeys = () => takeHistoryViolations().map((v) => v.keys);

describe('the guard against unrecorded undoable changes', () => {
  beforeEach(() => {
    takeHistoryViolations();
  });

  it('reports a change that nothing recorded, naming what changed', () => {
    const store = makeStore();
    actions(store).rename('x');
    expect(reportedKeys()).toEqual([['nodes']]);
  });

  it('accepts a change right after the state before it was recorded', () => {
    const store = makeStore();
    actions(store).record();
    actions(store).rename('x');
    expect(reportedKeys()).toEqual([]);
  });

  it('reports a second change after a single record, which undo would revert with the first', () => {
    const store = makeStore();
    actions(store).record();
    actions(store).rename('x');
    actions(store).setOpacity(0.5);
    expect(reportedKeys()).toEqual([['geoMap']]);
  });

  it('accepts any number of changes inside a transaction', () => {
    const store = makeStore();
    actions(store).open();
    actions(store).rename('x');
    actions(store).setOpacity(0.5);
    actions(store).close();
    expect(reportedKeys()).toEqual([]);
  });

  it('accepts changes marked as not undoable', () => {
    const store = makeStore();
    withoutHistory(() => actions(store).rename('x'));
    expect(reportedKeys()).toEqual([]);
  });

  it('ignores changes to state that undo does not cover', () => {
    const store = makeStore();
    actions(store).open();
    actions(store).close();
    expect(reportedKeys()).toEqual([]);
  });
});

describe('the app store under the guard', () => {
  beforeEach(() => {
    resetAppStore();
    takeHistoryViolations();
  });

  it('reports nothing for recorded changes, undo and redo', () => {
    getAppState().addNode(makeWaypoint('a'));
    getAppState().updateNode('a', { name: 'renamed' });
    getAppState().undo();
    getAppState().redo();
    expect(reportedKeys()).toEqual([]);
  });

  it('reports nothing for loading a project or adding a map, which are not undoable', () => {
    getAppState().resetProject();
    getAppState().addMapLayer('map', { resolution: 0.05, origin: [0, 0, 0] }, '', 10, 10);
    expect(reportedKeys()).toEqual([]);
  });

  it('freezes what it recorded, so changing it in place fails at once', () => {
    getAppState().addNode(makeWaypoint('a'));
    getAppState().updateNode('a', { name: 'renamed' });

    const recorded = getAppState().historyPast[1].nodes.a;
    expect(() => {
      (recorded as { name: string }).name = 'changed in place';
    }).toThrow(TypeError);
  });
});
