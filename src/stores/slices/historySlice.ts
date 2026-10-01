import { StateCreator } from 'zustand';
import type { AppState } from '../appStore';
import {
  WaypointNode,
  CustomLayer,
  AnnotationGroup,
  AnnotationObject,
  InsertionTarget,
  MapLayerClip,
  ProjectMapLayer,
} from '../../types/store';
import { ActiveSelection } from '../../types/selection';
import type { GeoAlignment } from '../../types/geo';
import { validateAndCorrectInsertionTarget } from '../../utils/treeUtils';
import { reconcileLayerOrder } from '../../utils/layerStack';

const MAX_HISTORY_LENGTH = 100;

export type HistorySnapshot = {
  nodes: Record<string, WaypointNode>;
  rootNodeIds: string[];
  selectedNodeIds: string[];
  selection: ActiveSelection;
  anchorNodeId: string | null;
  customLayers: CustomLayer[];
  /** Use area of every map layer at capture time; layers added afterwards keep their own. */
  mapClips: Record<string, MapLayerClip | null>;
  /**
   * Visible flag of every map layer at capture time. Only recorded by operations that change map
   * visibility in bulk (applying a layer visibility set); other snapshots leave it out so that undoing
   * them does not revert visibility toggles made afterwards.
   */
  mapVisibility?: Record<string, boolean>;
  /** Stack order at capture time; reconciled against the layers that exist when restored. */
  layerOrder: string[];
  annotationObjects: Record<string, AnnotationObject>;
  annotationOrder: string[];
  /** Groups and the top-level ids are part of the snapshot so that undoing never leaves a group without its members (or the reverse). */
  annotationGroups: Record<string, AnnotationGroup>;
  rootAnnotationIds: string[];
  insertionTarget: InsertionTarget | null;
  geoAlignment: GeoAlignment;
};

/** Restores the stack order saved in `snapshot` for the layers that exist after restoring its custom layers. */
const restoredLayerOrder = (state: AppState, snapshot: HistorySnapshot): string[] =>
  reconcileLayerOrder(snapshot.layerOrder, [
    ...state.mapLayers.map((l) => l.id),
    ...snapshot.customLayers.map((l) => l.id),
  ]);

/**
 * Map layers with the use areas (and, when recorded, the visibility) saved in `snapshot`; layers the
 * snapshot does not know keep theirs.
 */
const restoredMapLayers = (state: AppState, snapshot: HistorySnapshot): ProjectMapLayer[] =>
  state.mapLayers.map((layer) => {
    const restored = layer.id in snapshot.mapClips ? { ...layer, clip: snapshot.mapClips[layer.id] } : layer;
    const visible = snapshot.mapVisibility?.[layer.id];
    return visible === undefined ? restored : { ...restored, visible };
  });

export type HistorySlice = {
  historyPast: HistorySnapshot[];
  historyFuture: HistorySnapshot[];
  historyTransactionDepth: number;

  /** `includeMapVisibility` also records which map layers are shown, so undo/redo restores it. */
  pushHistorySnapshot: (options?: { includeMapVisibility?: boolean }) => void;
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

const captureSnapshot = (state: AppState, includeMapVisibility = false): HistorySnapshot => ({
  nodes: state.nodes,
  rootNodeIds: state.rootNodeIds,
  selectedNodeIds: state.selectedNodeIds,
  selection: cloneSelection(
    state.selection ??
      (state.selectedNodeIds?.length ? { type: 'nodes', ids: state.selectedNodeIds } : { type: 'none' }),
  ),
  anchorNodeId: state.anchorNodeId,
  customLayers: structuredClone(state.customLayers ?? []),
  mapClips: Object.fromEntries(state.mapLayers.map((l) => [l.id, l.clip ? structuredClone(l.clip) : null])),
  ...(includeMapVisibility ? { mapVisibility: Object.fromEntries(state.mapLayers.map((l) => [l.id, l.visible])) } : {}),
  layerOrder: [...state.layerOrder],
  annotationObjects: structuredClone(state.annotationObjects ?? {}),
  annotationOrder: [...(state.annotationOrder ?? [])],
  annotationGroups: structuredClone(state.annotationGroups ?? {}),
  rootAnnotationIds: [...(state.rootAnnotationIds ?? [])],
  insertionTarget: state.insertionTarget ? { ...state.insertionTarget } : null,
  geoAlignment: state.geoMap.alignment,
});

export const createHistorySlice: StateCreator<AppState, [], [], HistorySlice> = (set, get) => ({
  historyPast: [],
  historyFuture: [],
  historyTransactionDepth: 0,

  pushHistorySnapshot: (options) => {
    const state = get();
    if (state.historyTransactionDepth > 0) return;

    set((state) => {
      const nextPast = [...state.historyPast, captureSnapshot(state, options?.includeMapVisibility === true)];
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
      const nextFuture = [...state.historyFuture, captureSnapshot(state, snapshot.mapVisibility !== undefined)];
      const restoredTarget = validateAndCorrectInsertionTarget(
        snapshot.insertionTarget ?? null,
        snapshot.rootNodeIds,
        snapshot.nodes,
      );
      const restoredSelection: ActiveSelection =
        snapshot.selection ??
        (snapshot.selectedNodeIds?.length ? { type: 'nodes', ids: snapshot.selectedNodeIds } : { type: 'none' });

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
        mapLayers: restoredMapLayers(state, snapshot),
        layerOrder: restoredLayerOrder(state, snapshot),
        annotationObjects: snapshot.annotationObjects ?? {},
        annotationOrder: snapshot.annotationOrder ?? [],
        annotationGroups: snapshot.annotationGroups ?? state.annotationGroups,
        rootAnnotationIds: snapshot.rootAnnotationIds ?? state.rootAnnotationIds,
        insertionTarget: restoredTarget,
        geoMap: { ...state.geoMap, alignment: snapshot.geoAlignment ?? state.geoMap.alignment },
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
      const nextPast = [...state.historyPast, captureSnapshot(state, snapshot.mapVisibility !== undefined)];
      const restoredTarget = validateAndCorrectInsertionTarget(
        snapshot.insertionTarget ?? null,
        snapshot.rootNodeIds,
        snapshot.nodes,
      );
      const restoredSelection: ActiveSelection =
        snapshot.selection ??
        (snapshot.selectedNodeIds?.length ? { type: 'nodes', ids: snapshot.selectedNodeIds } : { type: 'none' });

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
        mapLayers: restoredMapLayers(state, snapshot),
        layerOrder: restoredLayerOrder(state, snapshot),
        annotationObjects: snapshot.annotationObjects ?? {},
        annotationOrder: snapshot.annotationOrder ?? [],
        annotationGroups: snapshot.annotationGroups ?? state.annotationGroups,
        rootAnnotationIds: snapshot.rootAnnotationIds ?? state.rootAnnotationIds,
        insertionTarget: restoredTarget,
        geoMap: { ...state.geoMap, alignment: snapshot.geoAlignment ?? state.geoMap.alignment },
        isDirty: true,
      };
    });
  },

  clearHistory: () => set({ historyPast: [], historyFuture: [], historyTransactionDepth: 0 }),
});
