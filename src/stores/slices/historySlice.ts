import { StateCreator } from 'zustand';
import { AppState } from '../appStore';
import { WaypointNode, CustomLayer, AnnotationObject, InsertionTarget } from '../../types/store';
import { ActiveSelection } from '../../types/selection';
import { validateAndCorrectInsertionTarget } from '../../utils/treeUtils';

const MAX_HISTORY_LENGTH = 100;

export type HistorySnapshot = {
  nodes: Record<string, WaypointNode>;
  rootNodeIds: string[];
  selectedNodeIds: string[];
  selection: ActiveSelection;
  anchorNodeId: string | null;
  customLayers: CustomLayer[];
  annotationObjects: Record<string, AnnotationObject>;
  annotationOrder: string[];
  insertionTarget: InsertionTarget | null;
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

export const cloneSelection = (sel: ActiveSelection | undefined): ActiveSelection => {
  if (!sel) return { type: 'none' };
  switch (sel.type) {
    case 'none':
      return { type: 'none' };
    case 'nodes':
      return { type: 'nodes', ids: [...sel.ids] };
    case 'annotations':
      return { type: 'annotations', ids: [...sel.ids] };
    case 'custom_layer':
      return { type: 'custom_layer', layerId: sel.layerId, selectedObjectId: sel.selectedObjectId };
  }
};

const captureSnapshot = (state: AppState): HistorySnapshot => ({
  nodes: state.nodes,
  rootNodeIds: state.rootNodeIds,
  selectedNodeIds: state.selectedNodeIds,
  selection: cloneSelection(state.selection ?? (state.selectedNodeIds?.length ? { type: 'nodes', ids: state.selectedNodeIds } : { type: 'none' })),
  anchorNodeId: state.anchorNodeId,
  customLayers: structuredClone(state.customLayers ?? []),
  annotationObjects: structuredClone(state.annotationObjects ?? {}),
  annotationOrder: [...(state.annotationOrder ?? [])],
  insertionTarget: state.insertionTarget ? { ...state.insertionTarget } : null,
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

  undo: () => {
    get().abortCanvasGestures?.();
    set((state) => {
      if (state.historyPast.length === 0) return {};
      const nextPast = [...state.historyPast];
      const snapshot = nextPast.pop()!;
      const nextFuture = [...state.historyFuture, captureSnapshot(state)];
      const restoredTarget = validateAndCorrectInsertionTarget(
        snapshot.insertionTarget ?? null,
        snapshot.rootNodeIds,
        snapshot.nodes
      );
      const restoredSelection: ActiveSelection = snapshot.selection ?? (
        snapshot.selectedNodeIds?.length ? { type: 'nodes', ids: snapshot.selectedNodeIds } : { type: 'none' }
      );

      return {
        historyPast: nextPast,
        historyFuture: nextFuture,
        nodes: snapshot.nodes,
        rootNodeIds: snapshot.rootNodeIds,
        selectedNodeIds: restoredSelection.type === 'nodes' ? restoredSelection.ids : [],
        selectedAnnotationIds: restoredSelection.type === 'annotations' ? restoredSelection.ids : [],
        activeCustomLayerId: restoredSelection.type === 'custom_layer' ? restoredSelection.layerId : null,
        selectedEditObjectId: restoredSelection.type === 'custom_layer' ? restoredSelection.selectedObjectId : null,
        selection: restoredSelection,
        anchorNodeId: snapshot.anchorNodeId,
        customLayers: snapshot.customLayers,
        annotationObjects: snapshot.annotationObjects ?? {},
        annotationOrder: snapshot.annotationOrder ?? [],
        insertionTarget: restoredTarget,
        isDirty: true,
      };
    });
  },

  redo: () => {
    get().abortCanvasGestures?.();
    set((state) => {
      if (state.historyFuture.length === 0) return {};
      const nextFuture = [...state.historyFuture];
      const snapshot = nextFuture.pop()!;
      const nextPast = [...state.historyPast, captureSnapshot(state)];
    const restoredTarget = validateAndCorrectInsertionTarget(
      snapshot.insertionTarget ?? null,
      snapshot.rootNodeIds,
      snapshot.nodes
    );
    const restoredSelection: ActiveSelection = snapshot.selection ?? (
      snapshot.selectedNodeIds?.length ? { type: 'nodes', ids: snapshot.selectedNodeIds } : { type: 'none' }
    );

      return {
        historyPast: nextPast,
        historyFuture: nextFuture,
        nodes: snapshot.nodes,
        rootNodeIds: snapshot.rootNodeIds,
        selectedNodeIds: restoredSelection.type === 'nodes' ? restoredSelection.ids : [],
        selectedAnnotationIds: restoredSelection.type === 'annotations' ? restoredSelection.ids : [],
        activeCustomLayerId: restoredSelection.type === 'custom_layer' ? restoredSelection.layerId : null,
        selectedEditObjectId: restoredSelection.type === 'custom_layer' ? restoredSelection.selectedObjectId : null,
        selection: restoredSelection,
        anchorNodeId: snapshot.anchorNodeId,
        customLayers: snapshot.customLayers,
        annotationObjects: snapshot.annotationObjects ?? {},
        annotationOrder: snapshot.annotationOrder ?? [],
        insertionTarget: restoredTarget,
        isDirty: true,
      };
    });
  },

  clearHistory: () => set({ historyPast: [], historyFuture: [], historyTransactionDepth: 0 }),
});
