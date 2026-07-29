import { StateCreator } from 'zustand';
import { AppState } from '../appStore';
import { WaypointNode } from '../../types/store';

const MAX_HISTORY_LENGTH = 100;

export type HistorySnapshot = {
  nodes: Record<string, WaypointNode>;
  rootNodeIds: string[];
  selectedNodeIds: string[];
  anchorNodeId: string | null;
};

export type HistorySlice = {
  historyPast: HistorySnapshot[];
  historyFuture: HistorySnapshot[];
  historyTransactionDepth: number;

  pushHistorySnapshot: () => void;
  beginHistoryTransaction: () => void;
  endHistoryTransaction: () => void;
  runInHistoryTransaction: (fn: () => void) => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
};

const captureSnapshot = (state: AppState): HistorySnapshot => ({
  nodes: state.nodes,
  rootNodeIds: state.rootNodeIds,
  selectedNodeIds: state.selectedNodeIds,
  anchorNodeId: state.anchorNodeId,
});

export const createHistorySlice: StateCreator<AppState, [], [], HistorySlice> = (set, get) => ({
  historyPast: [],
  historyFuture: [],
  historyTransactionDepth: 0,

  pushHistorySnapshot: () => {
    const state = get();
    if (state.historyTransactionDepth > 0) return;

    set((state) => {
      const nextPast = [...state.historyPast, captureSnapshot(state)];
      if (nextPast.length > MAX_HISTORY_LENGTH) {
        nextPast.splice(0, nextPast.length - MAX_HISTORY_LENGTH);
      }
      return { historyPast: nextPast, historyFuture: [] };
    });
  },

  beginHistoryTransaction: () => {
    const state = get();
    if (state.historyTransactionDepth === 0) {
      state.pushHistorySnapshot();
    }
    set((state) => ({ historyTransactionDepth: state.historyTransactionDepth + 1 }));
  },

  endHistoryTransaction: () => {
    set((state) => ({ historyTransactionDepth: Math.max(0, state.historyTransactionDepth - 1) }));
  },

  runInHistoryTransaction: (fn: () => void) => {
    const { beginHistoryTransaction, endHistoryTransaction } = get();
    beginHistoryTransaction();
    try {
      fn();
    } finally {
      endHistoryTransaction();
    }
  },

  undo: () => set((state) => {
    if (state.historyPast.length === 0) return {};
    const nextPast = [...state.historyPast];
    const snapshot = nextPast.pop()!;
    const nextFuture = [...state.historyFuture, captureSnapshot(state)];

    return {
      historyPast: nextPast,
      historyFuture: nextFuture,
      nodes: snapshot.nodes,
      rootNodeIds: snapshot.rootNodeIds,
      selectedNodeIds: snapshot.selectedNodeIds,
      anchorNodeId: snapshot.anchorNodeId,
      isDirty: true,
    };
  }),

  redo: () => set((state) => {
    if (state.historyFuture.length === 0) return {};
    const nextFuture = [...state.historyFuture];
    const snapshot = nextFuture.pop()!;
    const nextPast = [...state.historyPast, captureSnapshot(state)];

    return {
      historyPast: nextPast,
      historyFuture: nextFuture,
      nodes: snapshot.nodes,
      rootNodeIds: snapshot.rootNodeIds,
      selectedNodeIds: snapshot.selectedNodeIds,
      anchorNodeId: snapshot.anchorNodeId,
      isDirty: true,
    };
  }),

  clearHistory: () => set({ historyPast: [], historyFuture: [], historyTransactionDepth: 0 }),
});
