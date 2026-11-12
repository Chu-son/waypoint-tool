import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from '../appStore';
import {
  layerStackState,
  makeAnnotationGroup,
  makeMap,
  makeTransform,
  makeWaypoint,
  waypointTree,
} from '../../test/fixtures';
import { getAppState, getLayerOrder, resetAppStore } from '../../test/store';

describe('HistorySlice (Undo/Redo)', () => {
  beforeEach(() => {
    const store = useAppStore.getState();
    store.nodes = {};
    store.rootNodeIds = [];
    store.selectedNodeIds = [];
    store.anchorNodeId = null;
    store.historyPast = [];
    store.historyFuture = [];
    store.historyTransactionDepth = 0;
  });

  it('records one history entry per discrete mutation and undoes it', () => {
    const { addNode, undo } = useAppStore.getState();

    addNode({ id: 'node-1', type: 'manual', transform: { x: 0, y: 0, qx: 0, qy: 0, qz: 0, qw: 1 } });
    expect(useAppStore.getState().historyPast.length).toBe(1);

    undo();

    const state = useAppStore.getState();
    expect(state.nodes['node-1']).toBeUndefined();
    expect(state.rootNodeIds).toEqual([]);
    expect(state.historyPast.length).toBe(0);
    expect(state.historyFuture.length).toBe(1);
  });

  it('redoes an undone mutation', () => {
    const { addNode, undo, redo } = useAppStore.getState();

    addNode({ id: 'node-1', type: 'manual', transform: { x: 0, y: 0, qx: 0, qy: 0, qz: 0, qw: 1 } });
    undo();
    redo();

    const state = useAppStore.getState();
    expect(state.nodes['node-1']).toBeDefined();
    expect(state.historyPast.length).toBe(1);
    expect(state.historyFuture.length).toBe(0);
  });

  it('clears the redo stack when a new mutation happens after undo', () => {
    const { addNode, undo } = useAppStore.getState();

    addNode({ id: 'node-1', type: 'manual' });
    undo();
    expect(useAppStore.getState().historyFuture.length).toBe(1);

    addNode({ id: 'node-2', type: 'manual' });
    expect(useAppStore.getState().historyFuture.length).toBe(0);
  });

  it('coalesces many mutations within a transaction into a single history entry', () => {
    const { addNode, updateNode, beginHistoryTransaction, endHistoryTransaction, undo } = useAppStore.getState();

    addNode({ id: 'node-1', type: 'manual', transform: { x: 0, y: 0, qx: 0, qy: 0, qz: 0, qw: 1 } });
    expect(useAppStore.getState().historyPast.length).toBe(1);

    beginHistoryTransaction();
    updateNode('node-1', { transform: { x: 1, y: 0, qx: 0, qy: 0, qz: 0, qw: 1 } });
    updateNode('node-1', { transform: { x: 2, y: 0, qx: 0, qy: 0, qz: 0, qw: 1 } });
    updateNode('node-1', { transform: { x: 3, y: 0, qx: 0, qy: 0, qz: 0, qw: 1 } });
    endHistoryTransaction();

    // Only one new entry added for the whole drag/edit gesture
    expect(useAppStore.getState().historyPast.length).toBe(2);

    undo();
    expect(useAppStore.getState().nodes['node-1'].transform?.x).toBe(0);
  });

  it('coalesces mutations wrapped via runInHistoryTransaction', () => {
    const { addNode, updateNode, runInHistoryTransaction, undo } = useAppStore.getState();

    addNode({ id: 'a', type: 'manual', transform: { x: 0, y: 0, qx: 0, qy: 0, qz: 0, qw: 1 } });
    addNode({ id: 'b', type: 'manual', transform: { x: 0, y: 0, qx: 0, qy: 0, qz: 0, qw: 1 } });
    const before = useAppStore.getState().historyPast.length;

    runInHistoryTransaction(() => {
      updateNode('a', { transform: { x: 5, y: 0, qx: 0, qy: 0, qz: 0, qw: 1 } });
      updateNode('b', { transform: { x: 5, y: 0, qx: 0, qy: 0, qz: 0, qw: 1 } });
    });

    expect(useAppStore.getState().historyPast.length).toBe(before + 1);

    undo();
    const state = useAppStore.getState();
    expect(state.nodes['a'].transform?.x).toBe(0);
    expect(state.nodes['b'].transform?.x).toBe(0);
  });

  it('does nothing when undo/redo stacks are empty', () => {
    const { undo, redo } = useAppStore.getState();
    undo();
    redo();
    const state = useAppStore.getState();
    expect(state.historyPast.length).toBe(0);
    expect(state.historyFuture.length).toBe(0);
  });

  it('trims history past the max length of 100 entries', () => {
    const { addNode } = useAppStore.getState();
    for (let i = 0; i < 105; i++) {
      addNode({ id: `node-${i}`, type: 'manual' });
    }
    expect(useAppStore.getState().historyPast.length).toBe(100);
  });

  it('clearHistory resets both stacks and the transaction depth', () => {
    const { addNode, beginHistoryTransaction, clearHistory } = useAppStore.getState();
    addNode({ id: 'node-1', type: 'manual' });
    beginHistoryTransaction();
    clearHistory();

    const state = useAppStore.getState();
    expect(state.historyPast).toEqual([]);
    expect(state.historyFuture).toEqual([]);
    expect(state.historyTransactionDepth).toBe(0);
  });

  it('captures and restores insertionTarget on undo and redo, sanitized via validateAndCorrectInsertionTarget', () => {
    const store = useAppStore.getState();
    store.setInsertionTarget({ parentId: null, index: 0 });

    store.addNode({ id: 'wp-1', type: 'manual' });
    // After adding node, insertionTarget advances to index: 1
    expect(useAppStore.getState().insertionTarget).toEqual({ parentId: null, index: 1 });

    // Mutate insertion target
    useAppStore.getState().setInsertionTarget({ parentId: null, index: 0 });
    // Add another node
    useAppStore.getState().addNode({ id: 'wp-2', type: 'manual' });
    expect(useAppStore.getState().insertionTarget).toEqual({ parentId: null, index: 1 });

    // Undo should restore insertionTarget before wp-2 was added
    useAppStore.getState().undo();
    expect(useAppStore.getState().insertionTarget).toEqual({ parentId: null, index: 0 });

    // Redo should restore insertionTarget after wp-2 was added
    useAppStore.getState().redo();
    expect(useAppStore.getState().insertionTarget).toEqual({ parentId: null, index: 1 });
  });

  it('undoes and redoes an annotation group together with its top-level id', () => {
    resetAppStore();
    getAppState().addAnnotationGroup(makeAnnotationGroup('grp', []));
    expect(getAppState().rootAnnotationIds).toEqual(['grp']);

    getAppState().undo();
    expect(getAppState().annotationGroups).toEqual({});
    expect(getAppState().rootAnnotationIds).toEqual([]);

    getAppState().redo();
    expect(Object.keys(getAppState().annotationGroups)).toEqual(['grp']);
    expect(getAppState().rootAnnotationIds).toEqual(['grp']);
  });

  describe('transactions that change nothing', () => {
    it('leave no undo step and keep what could be redone', () => {
      resetAppStore();
      getAppState().addNode(makeWaypoint('a'));
      getAppState().undo();

      getAppState().beginHistoryTransaction();
      getAppState().endHistoryTransaction();

      expect(getAppState().historyPast).toHaveLength(0);
      getAppState().redo();
      expect(getAppState().nodes.a).toBeDefined();
    });

    it('still count when something changed inside, even if a nested transaction changed nothing', () => {
      resetAppStore();
      getAppState().runInHistoryTransaction(() => {
        getAppState().runInHistoryTransaction(() => {});
        getAppState().addNode(makeWaypoint('a'));
      });

      expect(getAppState().historyPast).toHaveLength(1);
      getAppState().undo();
      expect(getAppState().nodes.a).toBeUndefined();
    });
  });

  describe('cancelling a transaction', () => {
    it('puts back the state from when it began, and what could be redone', () => {
      resetAppStore({ ...waypointTree([makeWaypoint('a', { transform: makeTransform(1, 2) })]), isDirty: false });
      getAppState().addNode(makeWaypoint('b'));
      getAppState().undo();
      getAppState().setIsDirty(false);

      getAppState().beginHistoryTransaction();
      getAppState().updateNode('a', { transform: makeTransform(5, 5) });
      getAppState().cancelHistoryTransaction();

      expect(getAppState().nodes.a.transform).toMatchObject({ x: 1, y: 2 });
      expect(getAppState().historyPast).toHaveLength(0);
      expect(getAppState().historyTransactionDepth).toBe(0);
      expect(getAppState().isDirty).toBe(false);
      getAppState().redo();
      expect(getAppState().nodes.b).toBeDefined();
    });
  });

  it('records again after undo when a transaction was left open by mistake', () => {
    resetAppStore();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    getAppState().addNode(makeWaypoint('a'));
    getAppState().beginHistoryTransaction();

    getAppState().undo();
    getAppState().addNode(makeWaypoint('b'));
    getAppState().undo();

    expect(getAppState().nodes.b).toBeUndefined();
    expect(getAppState().historyTransactionDepth).toBe(0);
  });

  describe('maps', () => {
    const twoMaps = () => layerStackState(makeMap('m1'), makeMap('m2'));

    it('puts back what a map looked like, by map', () => {
      resetAppStore(twoMaps());
      getAppState().updateMapLayer('m1', { opacity: 0.2, name: 'renamed', visible: false });

      getAppState().undo();

      expect(getAppState().mapLayers.find((l) => l.id === 'm1')).toMatchObject({
        opacity: 1,
        name: 'm1',
        visible: true,
      });
    });

    it('keeps a map added after the step being undone', () => {
      resetAppStore(twoMaps());
      getAppState().addNode(makeWaypoint('a'));
      getAppState().addMapLayer('added', { resolution: 0.05, origin: [0, 0, 0] }, '', 10, 10);

      getAppState().undo();

      expect(getAppState().mapLayers.map((l) => l.name)).toContain('added');
      expect(getLayerOrder()).toHaveLength(3);
    });

    it('does not bring back a map removed after the step being undone', () => {
      resetAppStore(twoMaps());
      getAppState().addNode(makeWaypoint('a'));
      getAppState().removeMapLayer('m2');

      getAppState().undo();

      expect(getAppState().mapLayers.map((l) => l.id)).toEqual(['m1']);
      expect(getLayerOrder()).toEqual(['m1']);
    });
  });

  it('invokes abortCanvasGestures before executing undo and redo', () => {
    const abortSpy = vi.fn().mockReturnValue(true);
    const unregister = useAppStore.getState().registerCanvasAbortHandler(abortSpy);

    useAppStore.getState().addNode({ id: 'wp-1', type: 'manual' });
    expect(abortSpy).not.toHaveBeenCalled();

    useAppStore.getState().undo();
    expect(abortSpy).toHaveBeenCalledTimes(1);

    useAppStore.getState().redo();
    expect(abortSpy).toHaveBeenCalledTimes(2);

    unregister();
  });
});
