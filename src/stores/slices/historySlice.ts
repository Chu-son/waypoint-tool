import { StateCreator } from 'zustand';
import type { AppState } from '../appStore';
import {
  WaypointNode,
  CustomLayer,
  AnnotationGroup,
  AnnotationObject,
  InsertionTarget,
  MapLayerClip,
  MapSource,
  ProjectMapLayer,
  LayerGroup,
} from '../../types/store';
import { ActiveSelection } from '../../types/selection';
import type { GeoAlignment } from '../../types/geo';
import { validateAndCorrectInsertionTarget } from '../../utils/treeUtils';
import { allTreeIds, normalizeLayerTree, type LayerTree } from '../../utils/layerTree';
import { selectedCustomLayerId } from '../../utils/layerSelection';

const MAX_HISTORY_LENGTH = 100;

/** Shared pose of every map source, and the own pose of every unlinked map instance (null when linked). */
export type MapPoses = {
  sourceOrigins: Record<string, [number, number, number] | undefined>;
  overrides: Record<string, [number, number, number] | null>;
};

/** What a snapshot records beyond the always-recorded state. */
type SnapshotExtras = { visibility?: boolean; poses?: boolean };

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
   * Visible flag of every map layer and layer group at capture time. Only recorded by operations that
   * change visibility in bulk (applying a layer visibility set); other snapshots leave it out so that
   * undoing them does not revert visibility toggles made afterwards.
   */
  mapVisibility?: Record<string, boolean>;
  /**
   * Poses of the maps at capture time. Only recorded by operations that move maps in bulk (moving a
   * layer group); other snapshots leave it out, as map poses are not part of ordinary undo.
   */
  mapPoses?: MapPoses;
  /** The layer tree at capture time; normalized against the layers that exist when restored. */
  rootLayerIds: string[];
  layerGroups: Record<string, LayerGroup>;
  annotationObjects: Record<string, AnnotationObject>;
  annotationOrder: string[];
  /** Groups and the top-level ids are part of the snapshot so that undoing never leaves a group without its members (or the reverse). */
  annotationGroups: Record<string, AnnotationGroup>;
  rootAnnotationIds: string[];
  insertionTarget: InsertionTarget | null;
  geoAlignment: GeoAlignment;
};

/**
 * The layer tree saved in `snapshot`, for the layers that exist after restoring its custom layers. Groups
 * keep their current visible flag unless the snapshot recorded visibility (as for map layers).
 */
const restoredLayerTree = (state: AppState, snapshot: HistorySnapshot): LayerTree => {
  const layerGroups = Object.fromEntries(
    Object.entries(snapshot.layerGroups).map(([id, group]) => {
      const visible = snapshot.mapVisibility?.[id] ?? state.layerGroups[id]?.visible ?? group.visible;
      return [id, visible === group.visible ? group : { ...group, visible }];
    }),
  );
  return normalizeLayerTree({ rootLayerIds: snapshot.rootLayerIds, layerGroups }, [
    ...state.mapLayers.map((l) => l.id),
    ...snapshot.customLayers.map((l) => l.id),
  ]);
};

/**
 * The layer tree restored from `snapshot`, with the selection it held. Selected layers that no longer
 * exist (maps removed since: removing a map is not undone) drop out of the selection.
 */
const restoredLayers = (
  state: AppState,
  snapshot: HistorySnapshot,
  selection: ActiveSelection,
): Pick<AppState, 'rootLayerIds' | 'layerGroups' | 'selection' | 'activeCustomLayerId' | 'selectedEditObjectId'> => {
  const tree = restoredLayerTree(state, snapshot);
  if (selection.type !== 'layers') {
    return { ...tree, selection, activeCustomLayerId: null, selectedEditObjectId: null };
  }
  const existing = new Set(allTreeIds(tree));
  const ids = selection.ids.filter((id) => existing.has(id));
  if (ids.length === 0)
    return { ...tree, selection: { type: 'none' }, activeCustomLayerId: null, selectedEditObjectId: null };
  const customLayerId = selectedCustomLayerId(ids, { mapLayers: state.mapLayers, layerGroups: tree.layerGroups });
  const selectedObjectId = customLayerId ? selection.selectedObjectId : null;
  return {
    ...tree,
    selection: { type: 'layers', ids, selectedObjectId },
    activeCustomLayerId: customLayerId,
    selectedEditObjectId: selectedObjectId,
  };
};

/**
 * Map layers with the use areas (and, when recorded, the visibility) saved in `snapshot`; layers the
 * snapshot does not know keep theirs.
 */
const restoredMapLayers = (state: AppState, snapshot: HistorySnapshot): ProjectMapLayer[] =>
  state.mapLayers.map((layer) => {
    let restored = layer.id in snapshot.mapClips ? { ...layer, clip: snapshot.mapClips[layer.id] } : layer;
    const override = snapshot.mapPoses?.overrides[layer.id];
    if (override !== undefined) restored = { ...restored, origin_override: override ? [...override] : null };
    const visible = snapshot.mapVisibility?.[layer.id];
    return visible === undefined ? restored : { ...restored, visible };
  });

/** The extras `snapshot` recorded: the opposite snapshot (for redo / undo) records the same ones. */
const extrasOf = (snapshot: HistorySnapshot): SnapshotExtras => ({
  visibility: snapshot.mapVisibility !== undefined,
  poses: snapshot.mapPoses !== undefined,
});

/** Map sources with the shared poses saved in `snapshot`; without any, they stay as they are. */
const restoredMapSources = (state: AppState, snapshot: HistorySnapshot): MapSource[] => {
  const poses = snapshot.mapPoses;
  if (!poses) return state.mapSources;
  return state.mapSources.map((source) => {
    const origin = poses.sourceOrigins[source.id];
    return origin ? { ...source, info: { ...source.info, origin: [...origin] } } : source;
  });
};

export type HistorySlice = {
  historyPast: HistorySnapshot[];
  historyFuture: HistorySnapshot[];
  historyTransactionDepth: number;

  /**
   * `includeMapVisibility` also records which map layers and groups are shown, and `includeMapPoses` the
   * poses of the maps, so that undo/redo restores them.
   */
  pushHistorySnapshot: (options?: { includeMapVisibility?: boolean; includeMapPoses?: boolean }) => void;
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
    case 'layers':
      return { type: 'layers', ids: [...sel.ids], selectedObjectId: sel.selectedObjectId };
  }
};

const capturePoses = (state: AppState): MapPoses => ({
  sourceOrigins: Object.fromEntries(
    state.mapSources.map((s) => [s.id, Array.isArray(s.info?.origin) ? [...s.info.origin] : undefined]),
  ) as MapPoses['sourceOrigins'],
  overrides: Object.fromEntries(
    state.mapLayers.map((l) => [l.id, l.origin_override ? [...l.origin_override] : null]),
  ) as MapPoses['overrides'],
});

const captureSnapshot = (state: AppState, extras: SnapshotExtras = {}): HistorySnapshot => ({
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
  ...(extras.poses ? { mapPoses: capturePoses(state) } : {}),
  ...(extras.visibility
    ? {
        mapVisibility: Object.fromEntries([
          ...state.mapLayers.map((l) => [l.id, l.visible] as const),
          ...Object.values(state.layerGroups).map((g) => [g.id, g.visible] as const),
        ]),
      }
    : {}),
  // Immutable store values: shared, not copied.
  rootLayerIds: state.rootLayerIds,
  layerGroups: state.layerGroups,
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
      const nextPast = [
        ...state.historyPast,
        captureSnapshot(state, { visibility: options?.includeMapVisibility, poses: options?.includeMapPoses }),
      ];
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
      const nextFuture = [...state.historyFuture, captureSnapshot(state, extrasOf(snapshot))];
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
        anchorNodeId: snapshot.anchorNodeId,
        customLayers: snapshot.customLayers,
        mapSources: restoredMapSources(state, snapshot),
        mapLayers: restoredMapLayers(state, snapshot),
        ...restoredLayers(state, snapshot, restoredSelection),
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
      const nextPast = [...state.historyPast, captureSnapshot(state, extrasOf(snapshot))];
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
        anchorNodeId: snapshot.anchorNodeId,
        customLayers: snapshot.customLayers,
        mapSources: restoredMapSources(state, snapshot),
        mapLayers: restoredMapLayers(state, snapshot),
        ...restoredLayers(state, snapshot, restoredSelection),
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
