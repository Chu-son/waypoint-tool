import { StateCreator } from 'zustand';
import type { AppState } from '../appStore';
import type { HistorySnapshot } from './historySlice';
import {
  MapSource,
  MapLayerClip,
  ProjectMapLayer,
  CustomLayer,
  ManualCustomLayer,
  PluginCustomLayer,
  EditObject,
  ExportRegion,
  LayerGroup,
  GroupPoseOffset,
} from '../../types/store';
import { v4 as uuidv4 } from 'uuid';
import {
  allTreeIds,
  descendantLayerIds,
  detachFromLayerTree,
  insertIntoLayerTree,
  layerOrderOf,
  moveInLayerTree,
  placementAbove,
  removeGroupDeep,
  topLevelInStackOrder,
  ungroupInLayerTree,
  wrapInLayerGroup,
  type LayerTree,
  type LayerTreePlacement,
} from '../../utils/layerTree';
import type { DropPosition } from '../../utils/treeOps';
import { selectedCustomLayerId } from '../../utils/layerSelection';
import { getNextSequentialName } from '../../utils/treeUtils';
import { moveClipWithPose, sameClip } from '../../utils/mapClip';
import {
  composeOffset,
  isIdentityTransform,
  mapsSharingPoseWithOutside,
  transformEditObject,
  transformPose,
  type RigidTransform,
} from '../../utils/layerGroupTransform';

/** The pose shared by the linked instances of a source (`[0, 0, 0]` when its metadata has none). */
const sourceOrigin = (source: MapSource): [number, number, number] => {
  const raw = source.info?.origin;
  return Array.isArray(raw) ? [Number(raw[0]) || 0, Number(raw[1]) || 0, Number(raw[2]) || 0] : [0, 0, 0];
};

/** The group with `pose_offset` set, or removed when there is none. */
const withPoseOffset = (group: LayerGroup, offset: GroupPoseOffset | undefined): LayerGroup => {
  const next: LayerGroup = { ...group };
  if (offset) next.pose_offset = offset;
  else delete next.pose_offset;
  return next;
};

/** What moving a group does to a map it shares with instances outside the group. */
export type SharedPoseMode = 'move_all' | 'unlink';

export type MapSlice = {
  /** Loaded map files (image + metadata). Shared by every instance in `mapLayers` that references it. */
  mapSources: MapSource[];
  /** Map instances: each draws one source (or part of it) at a position in the stack. */
  mapLayers: ProjectMapLayer[];
  customLayers: CustomLayer[];
  /**
   * The layer tree: the single source of the stacking order. Top-level layers and groups, top of the
   * stack first; groups hold the rest in `children_ids`. The flat compositing order is `layerOrderOf`.
   */
  rootLayerIds: string[];
  layerGroups: Record<string, LayerGroup>;
  /** Canvas drag that is reshaping a layer's use area (its clip before the drag); null when not dragging. */
  mapClipDrag: {
    layerId: string;
    initial: MapLayerClip | null;
    snapshotPushed: boolean;
    redoStack: HistorySnapshot[];
  } | null;
  activeCustomLayerId: string | null;
  defaultMapOpacity: number;
  setDefaultMapOpacity: (opacity: number) => void;
  enableSnapping: boolean;
  cursorPosition: { x: number; y: number } | null;
  mapScale: number;
  showPaths: boolean;
  showGrid: boolean;
  showFootprints: boolean;
  shouldFitToMaps: number;
  isExportPreview: boolean;
  showOccupancyHighlight: boolean;
  occupancyHighlightAlpha: number;

  /** Adds a map on top of the stack, or with `atSelection` where the user is working (see `placementForNew`). */
  addMapLayer: (
    name: string,
    info: any,
    base64: string,
    width: number,
    height: number,
    options?: { atSelection?: boolean },
  ) => void;
  /** Adds another instance of the same map directly above `id` (for using a different part of it). */
  duplicateMapLayer: (id: string) => string | null;
  updateMapLayer: (id: string, updates: Partial<Omit<ProjectMapLayer, 'id' | 'sourceId'>>) => void;
  /** Edits map data shared by all instances: occupancy thresholds and, for linked instances, the pose. */
  updateMapSource: (id: string, updates: Partial<Omit<MapSource, 'id'>>) => void;
  /**
   * Moves a map instance. A linked instance moves the shared pose, so every linked instance of the map
   * moves with it; an unlinked one moves alone. The use areas of the instances that moved follow the map.
   */
  setMapLayerOrigin: (id: string, origin: [number, number, number]) => void;
  /** Unlinks (the map stays where it is) or re-links (it returns to the shared pose) an instance's pose. */
  setMapLayerPoseLinked: (id: string, linked: boolean) => void;
  /** Starts reshaping a layer's use area on the canvas. The whole drag is one undo step. */
  beginMapClipDrag: (layerId: string) => void;
  updateMapClipDrag: (clip: MapLayerClip) => void;
  /** Commits the drag; a drag that changed nothing leaves no undo step. */
  endMapClipDrag: () => void;
  /** Abandons the drag and restores the use area from before it. */
  cancelMapClipDrag: () => void;
  removeMapLayer: (id: string) => void;
  /**
   * Moves a layer of any kind within the stack (`fromIndex` / `toIndex` index the flat order) to the
   * position of the layer now at `toIndex`, joining that layer's group.
   */
  reorderLayers: (fromIndex: number, toIndex: number) => void;

  /** Moves layers and groups before / after / inside `targetId`. One undo step; returns false when refused. */
  moveLayerItems: (ids: string[], targetId: string, position: DropPosition) => boolean;
  /** Wraps layers and groups in a new group where the topmost of them was. One undo step. */
  groupLayerItems: (ids: string[], name?: string) => string | null;
  /** Adds an empty group where the user is working (see `addManualCustomLayer`) and selects it. One undo step. */
  addLayerGroup: (name?: string) => string;
  /** Replaces a group by its contents. One undo step. */
  ungroupLayerGroup: (groupId: string) => void;
  /**
   * Deletes a group. `withContents` also deletes every layer inside (map deletions cannot be undone, as
   * with `removeMapLayer`); otherwise the contents take the group's place.
   */
  removeLayerGroup: (groupId: string, options: { withContents: boolean }) => void;
  renameLayerGroup: (groupId: string, name: string) => void;
  /** Toggles the group's own flag; the layers inside keep theirs. */
  setLayerGroupVisible: (groupId: string, visible: boolean) => void;
  /** Sets the own visible flag of layers and groups alike. */
  setLayerItemsVisible: (ids: string[], visible: boolean) => void;
  /**
   * Moves everything inside a group (at any depth) as one rigid body: map poses, plugin layer poses and
   * the objects of hand-drawn layers; the use areas of the maps follow. A map shared with instances outside
   * the group moves for all of them (`move_all`), or only for the group's instances, which are unlinked
   * from the shared pose (`unlink`). One undo step (none with `recordHistory: false`, for the later steps
   * of a held nudge); returns false when there is nothing to move.
   */
  transformLayerGroup: (
    groupId: string,
    transform: RigidTransform,
    options?: { sharedPose?: SharedPoseMode; recordHistory?: boolean },
  ) => boolean;
  /**
   * Copies map instances (sharing their map) and hand-drawn layers right above the originals, and selects
   * the copies. Plugin layers are left out: they belong to the plugin run that made them.
   */
  duplicateLayerItems: (ids: string[]) => string[];

  /** Adds a hand-drawn layer on top of the stack, or with `atSelection` where the user is working. */
  addManualCustomLayer: (
    name?: string,
    is_reference?: boolean,
    options?: { atSelection?: boolean },
  ) => ManualCustomLayer;
  addPluginCustomLayer: (layer: PluginCustomLayer) => void;
  updateCustomLayer: (id: string, updates: Partial<CustomLayer>) => void;
  removeCustomLayer: (id: string) => void;
  setActiveCustomLayerId: (id: string | null) => void;

  addEditObject: (layerId: string, obj: EditObject) => void;
  removeEditObject: (layerId: string, objId: string) => void;
  updateEditObject: (layerId: string, objId: string, updates: Partial<EditObject>) => void;

  setEnableSnapping: (enable: boolean) => void;
  setCursorPosition: (pos: { x: number; y: number } | null) => void;
  setMapScale: (scale: number) => void;
  setShowPaths: (show: boolean) => void;
  setShowGrid: (show: boolean) => void;
  setShowFootprints: (show: boolean) => void;
  triggerFitToMaps: () => void;
  setIsExportPreview: (enabled: boolean) => void;
  setShowOccupancyHighlight: (show: boolean) => void;
  setOccupancyHighlightAlpha: (alpha: number) => void;

  exportRegions: ExportRegion[];
  addExportRegion: (region: ExportRegion) => void;
  updateExportRegion: (id: string, updates: Partial<ExportRegion>) => void;
  removeExportRegion: (id: string) => void;
};

const treeOf = (state: LayerTree): LayerTree => ({
  rootLayerIds: state.rootLayerIds,
  layerGroups: state.layerGroups,
});

const TOP_OF_STACK: LayerTreePlacement = { parentId: null, beforeId: null };

/**
 * Where a layer the user adds goes: directly above the topmost selected layer (in its group), at the top
 * of a selected group, or on top of the stack when nothing in the tree is selected.
 */
const placementForNew = (state: AppState): LayerTreePlacement => {
  if (state.selection.type !== 'layers') return TOP_OF_STACK;
  const [topmost] = topLevelInStackOrder(treeOf(state), state.selection.ids);
  if (!topmost) return TOP_OF_STACK;
  if (state.layerGroups[topmost]) return { parentId: topmost, beforeId: null };
  return placementAbove(treeOf(state), topmost);
};

/** `tree` with a new layer at `placement`; a layer already in the tree keeps its place. */
const withNewLayer = (tree: LayerTree, id: string, placement: LayerTreePlacement = TOP_OF_STACK): LayerTree =>
  layerOrderOf(tree).includes(id) ? tree : insertIntoLayerTree(tree, [id], placement);

/** The selection fields for selecting `ids` in the layer tree (see `setSelection`). */
const layerSelectionOf = (
  ids: string[],
  stack: Pick<AppState, 'mapLayers' | 'layerGroups'>,
  selectedObjectId: string | null = null,
): Pick<AppState, 'selection' | 'activeCustomLayerId' | 'selectedEditObjectId'> => {
  if (ids.length === 0) return { selection: { type: 'none' }, activeCustomLayerId: null, selectedEditObjectId: null };
  const customLayerId = selectedCustomLayerId(ids, stack);
  const objectId = customLayerId ? selectedObjectId : null;
  return {
    selection: { type: 'layers', ids, selectedObjectId: objectId },
    activeCustomLayerId: customLayerId,
    selectedEditObjectId: objectId,
  };
};

/** The selection without the items of the layer tree that are gone from `tree` (unchanged when none are). */
const pruneLayerSelection = (state: AppState, tree: LayerTree): Partial<AppState> => {
  if (state.selection.type !== 'layers') return {};
  const present = new Set(allTreeIds(tree));
  const ids = state.selection.ids.filter((id) => present.has(id));
  if (ids.length === state.selection.ids.length) return {};
  return layerSelectionOf(ids, { ...state, ...tree }, state.selection.selectedObjectId);
};

/**
 * The state without the layers `ids` (map instances and custom layers): sources no instance uses any more
 * go too, and so do removed layers from the selection.
 */
const withoutLayers = (state: AppState, ids: readonly string[]): Partial<AppState> => {
  const removed = new Set(ids);
  const mapLayers = state.mapLayers.filter((l) => !removed.has(l.id));
  const usedSources = new Set(mapLayers.map((l) => l.sourceId));
  const removedSources = new Set(
    state.mapLayers.filter((l) => removed.has(l.id) && !usedSources.has(l.sourceId)).map((l) => l.sourceId),
  );
  const tree = detachFromLayerTree(treeOf(state), ids);
  return {
    mapLayers,
    mapSources: state.mapSources.filter((s) => !removedSources.has(s.id)),
    customLayers: state.customLayers.filter((l) => !removed.has(l.id)),
    ...tree,
    ...pruneLayerSelection(state, tree),
  };
};

export const createMapSlice: StateCreator<AppState, [], [], MapSlice> = (set, get) => ({
  mapSources: [],
  mapLayers: [],
  customLayers: [],
  rootLayerIds: [],
  layerGroups: {},
  mapClipDrag: null,
  activeCustomLayerId: null,
  defaultMapOpacity: 0.5,
  setDefaultMapOpacity: (opacity: number) => set({ defaultMapOpacity: opacity, isDirty: true }),
  enableSnapping: true,
  cursorPosition: null,
  mapScale: 1,
  showPaths: true,
  showGrid: true,
  showFootprints: false,
  shouldFitToMaps: 0,
  isExportPreview: false,
  showOccupancyHighlight: false,
  occupancyHighlightAlpha: 0.6,
  exportRegions: [],

  setShowPaths: (show: boolean) => set({ showPaths: show }),
  setShowGrid: (show: boolean) => set({ showGrid: show }),
  setShowFootprints: (show: boolean) => set({ showFootprints: show }),
  triggerFitToMaps: () => set({ shouldFitToMaps: Date.now() }),
  setIsExportPreview: (enabled: boolean) => set({ isExportPreview: enabled }),
  setShowOccupancyHighlight: (show: boolean) => set({ showOccupancyHighlight: show }),
  setOccupancyHighlightAlpha: (alpha: number) => set({ occupancyHighlightAlpha: alpha }),

  addManualCustomLayer: (name, is_reference, options) => {
    const customLayers = get().customLayers;
    const manualCount = customLayers.filter((l) => l.type === 'manual').length + 1;
    const newLayer: ManualCustomLayer = {
      id: uuidv4(),
      name: name || `Custom Layer ${manualCount}`,
      type: 'manual',
      visible: true,
      opacity: 1.0,
      blend_mode: 'overwrite',
      is_reference: is_reference ?? false,
      editObjects: [],
    };
    set((state) => ({
      customLayers: [newLayer, ...state.customLayers],
      ...withNewLayer(treeOf(state), newLayer.id, options?.atSelection ? placementForNew(state) : TOP_OF_STACK),
      ...layerSelectionOf([newLayer.id], state),
      selectedNodeIds: [],
      selectedAnnotationIds: [],
      isDirty: true,
    }));
    return newLayer;
  },

  addPluginCustomLayer: (layer: PluginCustomLayer) =>
    set((state) => {
      return {
        customLayers: [layer, ...state.customLayers],
        ...withNewLayer(treeOf(state), layer.id),
        ...layerSelectionOf([layer.id], state),
        selectedNodeIds: [],
        selectedAnnotationIds: [],
        isDirty: true,
      };
    }),

  updateCustomLayer: (id: string, updates: Partial<CustomLayer>) =>
    set((state) => ({
      customLayers: state.customLayers.map((l) => (l.id === id ? ({ ...l, ...updates } as CustomLayer) : l)),
      isDirty: true,
    })),

  removeCustomLayer: (id: string) =>
    set((state) => {
      if (!state.customLayers.some((l) => l.id === id)) return {};
      return {
        ...withoutLayers(state, [id]),
        ...(state.activeCustomLayerId === id ? { activeCustomLayerId: null } : {}),
        isDirty: true,
      };
    }),

  setActiveCustomLayerId: (id: string | null) => {
    get().setSelection(id ? { type: 'layers', ids: [id], selectedObjectId: null } : { type: 'none' });
  },

  addEditObject: (layerId: string, obj: EditObject) =>
    set((state) => ({
      customLayers: state.customLayers.map((l) => {
        if (l.id === layerId && l.type === 'manual') {
          return { ...l, editObjects: [...l.editObjects, obj] };
        }
        return l;
      }),
      isDirty: true,
    })),

  removeEditObject: (layerId: string, objId: string) =>
    set((state) => ({
      customLayers: state.customLayers.map((l) => {
        if (l.id === layerId && l.type === 'manual') {
          return { ...l, editObjects: l.editObjects.filter((o) => o.id !== objId) };
        }
        return l;
      }),
      isDirty: true,
    })),

  updateEditObject: (layerId: string, objId: string, updates: Partial<EditObject>) =>
    set((state) => ({
      customLayers: state.customLayers.map((l) => {
        if (l.id === layerId && l.type === 'manual') {
          return {
            ...l,
            editObjects: l.editObjects.map((o) => (o.id === objId ? ({ ...o, ...updates } as EditObject) : o)),
          };
        }
        return l;
      }),
      isDirty: true,
    })),

  addExportRegion: (region) =>
    set((state) => ({
      exportRegions: [...state.exportRegions, region],
      isDirty: true,
    })),
  updateExportRegion: (id, updates) =>
    set((state) => ({
      exportRegions: state.exportRegions.map((r) => (r.id === id ? { ...r, ...updates } : r)),
      isDirty: true,
    })),
  removeExportRegion: (id) =>
    set((state) => ({
      exportRegions: state.exportRegions.filter((r) => r.id !== id),
      isDirty: true,
    })),

  addMapLayer: (name, info, base64, width, height, options) =>
    set((state) => {
      const occSettings = state.occupancySettings || {
        defaultOccupiedThresh: 0.65,
        defaultFreeThresh: 0.25,
        defaultNegate: 0,
      };
      const rawOrigin = info?.origin;
      const origin: [number, number, number] =
        Array.isArray(rawOrigin) && rawOrigin.length >= 2
          ? [Number(rawOrigin[0]) || 0, Number(rawOrigin[1]) || 0, Number(rawOrigin[2]) || 0]
          : [0, 0, 0];
      const initialOrigin: [number, number, number] =
        Array.isArray(info?.initial_origin) && info.initial_origin.length >= 2
          ? [
              Number(info.initial_origin[0]) || 0,
              Number(info.initial_origin[1]) || 0,
              Number(info.initial_origin[2]) || 0,
            ]
          : [...origin];
      const mergedInfo = {
        ...info,
        origin,
        initial_origin: initialOrigin,
        occupied_thresh:
          typeof info?.occupied_thresh === 'number' ? info.occupied_thresh : occSettings.defaultOccupiedThresh,
        free_thresh: typeof info?.free_thresh === 'number' ? info.free_thresh : occSettings.defaultFreeThresh,
        negate: typeof info?.negate === 'number' ? info.negate : occSettings.defaultNegate,
      };
      const source: MapSource = {
        id: uuidv4(),
        name,
        info: mergedInfo,
        image_base64: base64,
        width,
        height,
      };
      const layer: ProjectMapLayer = {
        id: uuidv4(),
        sourceId: source.id,
        name,
        visible: true,
        opacity: state.defaultMapOpacity,
        blend_mode: 'overwrite',
        clip: null,
        origin_override: null,
      };
      return {
        mapSources: [...state.mapSources, source],
        mapLayers: [layer, ...state.mapLayers],
        ...withNewLayer(treeOf(state), layer.id, options?.atSelection ? placementForNew(state) : TOP_OF_STACK),
        isDirty: true,
      };
    }),

  duplicateMapLayer: (id: string) => {
    const original = get().mapLayers.find((l) => l.id === id);
    if (!original) return null;
    const copy: ProjectMapLayer = {
      ...original,
      id: uuidv4(),
      name: `${original.name} (copy)`,
      clip: original.clip ? { rects: original.clip.rects.map((r) => ({ ...r })) } : null,
      origin_override: original.origin_override ? [...original.origin_override] : null,
    };
    set((state) => ({
      mapLayers: [copy, ...state.mapLayers],
      ...withNewLayer(treeOf(state), copy.id, placementAbove(treeOf(state), id)),
      isDirty: true,
    }));
    return copy.id;
  },

  updateMapLayer: (id, updates) =>
    set((state) => ({
      mapLayers: state.mapLayers.map((l) => (l.id === id ? { ...l, ...updates } : l)),
      isDirty: true,
    })),

  updateMapSource: (id, updates) =>
    set((state) => ({
      mapSources: state.mapSources.map((s) => (s.id === id ? { ...s, ...updates } : s)),
      isDirty: true,
    })),

  setMapLayerOrigin: (id, origin) =>
    set((state) => {
      const layer = state.mapLayers.find((l) => l.id === id);
      const source = layer && state.mapSources.find((s) => s.id === layer.sourceId);
      if (!layer || !source) return {};
      if (layer.origin_override) {
        return {
          mapLayers: state.mapLayers.map((l) =>
            l.id === id
              ? { ...l, origin_override: origin, clip: moveClipWithPose(l.clip, layer.origin_override!, origin) }
              : l,
          ),
          isDirty: true,
        };
      }
      const from = sourceOrigin(source);
      return {
        mapSources: state.mapSources.map((s) => (s.id === source.id ? { ...s, info: { ...s.info, origin } } : s)),
        mapLayers: state.mapLayers.map((l) =>
          l.sourceId === source.id && !l.origin_override ? { ...l, clip: moveClipWithPose(l.clip, from, origin) } : l,
        ),
        isDirty: true,
      };
    }),

  setMapLayerPoseLinked: (id, linked) =>
    set((state) => {
      const layer = state.mapLayers.find((l) => l.id === id);
      const source = layer && state.mapSources.find((s) => s.id === layer.sourceId);
      if (!layer || !source || linked === !layer.origin_override) return {};
      const shared = sourceOrigin(source);
      const next: Partial<ProjectMapLayer> = linked
        ? { origin_override: null, clip: moveClipWithPose(layer.clip, layer.origin_override!, shared) }
        : { origin_override: shared };
      return { mapLayers: state.mapLayers.map((l) => (l.id === id ? { ...l, ...next } : l)), isDirty: true };
    }),

  beginMapClipDrag: (layerId) => {
    const layer = get().mapLayers.find((l) => l.id === layerId);
    if (!layer || get().mapClipDrag) return;
    const before = get().historyPast.length;
    const redoStack = get().historyFuture;
    get().pushHistorySnapshot();
    set((state) => ({
      mapClipDrag: { layerId, initial: layer.clip, snapshotPushed: state.historyPast.length > before, redoStack },
    }));
  },

  updateMapClipDrag: (clip) => {
    const drag = get().mapClipDrag;
    if (!drag) return;
    get().updateMapLayer(drag.layerId, { clip });
  },

  endMapClipDrag: () => {
    const drag = get().mapClipDrag;
    if (!drag) return;
    const current = get().mapLayers.find((l) => l.id === drag.layerId)?.clip ?? null;
    // 変わっていなければ、開始時に積んだ履歴を取り除き、消えたやり直し履歴も戻す
    const unchanged = sameClip(drag.initial, current);
    set((state) =>
      unchanged && drag.snapshotPushed
        ? { mapClipDrag: null, historyPast: state.historyPast.slice(0, -1), historyFuture: drag.redoStack }
        : { mapClipDrag: null },
    );
  },

  cancelMapClipDrag: () => {
    const drag = get().mapClipDrag;
    if (!drag) return;
    set((state) => ({
      mapClipDrag: null,
      mapLayers: state.mapLayers.map((l) => (l.id === drag.layerId ? { ...l, clip: drag.initial } : l)),
      ...(drag.snapshotPushed ? { historyPast: state.historyPast.slice(0, -1), historyFuture: drag.redoStack } : {}),
    }));
  },

  removeMapLayer: (id: string) =>
    set((state) => {
      if (!state.mapLayers.some((l) => l.id === id)) return {};
      return { ...withoutLayers(state, [id]), isDirty: true };
    }),

  reorderLayers: (fromIndex: number, toIndex: number) =>
    set((state) => {
      const order = layerOrderOf(state);
      if (fromIndex < 0 || fromIndex >= order.length) return {};
      const to = Math.max(0, Math.min(order.length - 1, toIndex));
      if (to === fromIndex) return {};
      const moved = moveInLayerTree(treeOf(state), [order[fromIndex]], order[to], to > fromIndex ? 'after' : 'before');
      return moved ? { ...moved, isDirty: true } : {};
    }),

  moveLayerItems: (ids, targetId, position) => {
    const moved = moveInLayerTree(treeOf(get()), ids, targetId, position);
    if (!moved) return false;
    get().pushHistorySnapshot();
    set({ ...moved, isDirty: true });
    return true;
  },

  groupLayerItems: (ids, name) => {
    const state = get();
    const id = uuidv4();
    const groupName =
      name ??
      getNextSequentialName(
        'Group',
        Object.values(state.layerGroups).map((g) => g.name),
      );
    const wrapped = wrapInLayerGroup(treeOf(state), ids, { id, name: groupName });
    if (!wrapped) return null;
    state.pushHistorySnapshot();
    set({ ...wrapped, isDirty: true });
    return id;
  },

  addLayerGroup: (name) => {
    const state = get();
    const id = uuidv4();
    const group: LayerGroup = {
      id,
      name:
        name ??
        getNextSequentialName(
          'Group',
          Object.values(state.layerGroups).map((g) => g.name),
        ),
      visible: true,
      children_ids: [],
    };
    const placement = placementForNew(state);
    state.pushHistorySnapshot();
    set((s) => ({
      ...insertIntoLayerTree({ ...treeOf(s), layerGroups: { ...s.layerGroups, [id]: group } }, [id], placement),
      isDirty: true,
    }));
    get().setSelection({ type: 'layers', ids: [id], selectedObjectId: null });
    return id;
  },

  ungroupLayerGroup: (groupId) => {
    if (!get().layerGroups[groupId]) return;
    get().pushHistorySnapshot();
    set((state) => {
      const tree = ungroupInLayerTree(treeOf(state), groupId);
      return { ...tree, ...pruneLayerSelection(state, tree), isDirty: true };
    });
  },

  removeLayerGroup: (groupId, { withContents }) => {
    if (!get().layerGroups[groupId]) return;
    get().pushHistorySnapshot();
    set((state) => {
      if (!withContents) {
        const tree = ungroupInLayerTree(treeOf(state), groupId);
        return { ...tree, ...pruneLayerSelection(state, tree), isDirty: true };
      }
      // The selection is pruned against the tree without the group, so the group leaves it too.
      const { tree, removedLayerIds } = removeGroupDeep(treeOf(state), groupId);
      return { ...withoutLayers({ ...state, ...tree }, removedLayerIds), isDirty: true };
    });
  },

  renameLayerGroup: (groupId, name) =>
    set((state) => {
      const group = state.layerGroups[groupId];
      if (!group || group.name === name) return {};
      return { layerGroups: { ...state.layerGroups, [groupId]: { ...group, name } }, isDirty: true };
    }),

  setLayerGroupVisible: (groupId, visible) =>
    set((state) => {
      const group = state.layerGroups[groupId];
      if (!group || group.visible === visible) return {};
      return { layerGroups: { ...state.layerGroups, [groupId]: { ...group, visible } }, isDirty: true };
    }),

  transformLayerGroup: (groupId, transform, options) => {
    const state = get();
    if (!state.layerGroups[groupId] || isIdentityTransform(transform)) return false;
    const inside = new Set(descendantLayerIds(state, groupId));
    const unlinkShared = options?.sharedPose === 'unlink';
    const sharedWithOutside = new Set(mapsSharingPoseWithOutside(state, groupId).map((l) => l.sourceId));
    const sourceById = new Map(state.mapSources.map((s) => [s.id, s]));

    // Linked instances move their source's pose, once per source; unlinked ones carry their own pose.
    const movedSources = new Map<string, { from: [number, number, number]; to: [number, number, number] }>();
    const unlinkedPoses = new Map<string, { from: [number, number, number]; to: [number, number, number] }>();
    for (const layer of state.mapLayers) {
      const source = sourceById.get(layer.sourceId);
      if (!inside.has(layer.id) || !source) continue;
      if (layer.origin_override) {
        unlinkedPoses.set(layer.id, {
          from: layer.origin_override,
          to: transformPose(layer.origin_override, transform),
        });
      } else if (unlinkShared && sharedWithOutside.has(source.id)) {
        const from = sourceOrigin(source);
        unlinkedPoses.set(layer.id, { from, to: transformPose(from, transform) });
      } else if (!movedSources.has(source.id)) {
        const from = sourceOrigin(source);
        movedSources.set(source.id, { from, to: transformPose(from, transform) });
      }
    }
    const hasMapMoves = movedSources.size > 0 || unlinkedPoses.size > 0;
    const insideCustoms = state.customLayers.filter((l) => inside.has(l.id));
    if (!hasMapMoves && insideCustoms.length === 0) return false;

    if (options?.recordHistory !== false) state.pushHistorySnapshot({ includeMapPoses: true });
    set((s) => ({
      layerGroups: {
        ...s.layerGroups,
        [groupId]: withPoseOffset(s.layerGroups[groupId], composeOffset(s.layerGroups[groupId].pose_offset, transform)),
      },
      mapSources: s.mapSources.map((source) => {
        const moved = movedSources.get(source.id);
        return moved ? { ...source, info: { ...source.info, origin: moved.to } } : source;
      }),
      mapLayers: s.mapLayers.map((layer) => {
        const own = unlinkedPoses.get(layer.id);
        if (own) {
          return { ...layer, origin_override: own.to, clip: moveClipWithPose(layer.clip, own.from, own.to) };
        }
        const moved = !layer.origin_override && movedSources.get(layer.sourceId);
        return moved ? { ...layer, clip: moveClipWithPose(layer.clip, moved.from, moved.to) } : layer;
      }),
      customLayers: s.customLayers.map((layer): CustomLayer => {
        if (!inside.has(layer.id)) return layer;
        if (layer.type === 'plugin')
          return { ...layer, info: { ...layer.info, origin: transformPose(layer.info.origin, transform) } };
        return { ...layer, editObjects: layer.editObjects.map((o) => transformEditObject(o, transform)) };
      }),
      isDirty: true,
    }));
    return true;
  },

  setLayerItemsVisible: (ids, visible) =>
    set((state) => {
      const target = new Set(ids);
      const layerGroups = { ...state.layerGroups };
      ids.forEach((id) => {
        if (layerGroups[id] && layerGroups[id].visible !== visible) layerGroups[id] = { ...layerGroups[id], visible };
      });
      return {
        mapLayers: state.mapLayers.map((l) => (target.has(l.id) && l.visible !== visible ? { ...l, visible } : l)),
        customLayers: state.customLayers.map((l) =>
          target.has(l.id) && l.visible !== visible ? ({ ...l, visible } as CustomLayer) : l,
        ),
        layerGroups,
        isDirty: true,
      };
    }),

  duplicateLayerItems: (ids) => {
    const state = get();
    const ordered = layerOrderOf(state).filter((id) => ids.includes(id));
    const manual = state.customLayers.filter(
      (l): l is ManualCustomLayer => l.type === 'manual' && ordered.includes(l.id),
    );
    if (manual.length > 0) state.pushHistorySnapshot();
    const copies: string[] = [];
    for (const id of ordered) {
      if (state.mapLayers.some((l) => l.id === id)) {
        const copy = get().duplicateMapLayer(id);
        if (copy) copies.push(copy);
        continue;
      }
      const original = manual.find((l) => l.id === id);
      if (!original) continue;
      const copy: ManualCustomLayer = {
        ...structuredClone(original),
        id: uuidv4(),
        name: `${original.name} (copy)`,
        editObjects: original.editObjects.map((o) => ({ ...structuredClone(o), id: uuidv4() })),
      };
      set((s) => ({
        customLayers: [copy, ...s.customLayers],
        ...withNewLayer(treeOf(s), copy.id, placementAbove(treeOf(s), id)),
        isDirty: true,
      }));
      copies.push(copy.id);
    }
    if (copies.length > 0) get().setSelection({ type: 'layers', ids: copies, selectedObjectId: null });
    return copies;
  },

  setEnableSnapping: (enable: boolean) => set({ enableSnapping: enable }),
  setCursorPosition: (pos) => set({ cursorPosition: pos }),
  setMapScale: (scale) => set({ mapScale: scale }),
});
