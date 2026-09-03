import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../appStore';

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
});
