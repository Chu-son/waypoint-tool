import { StateCreator } from 'zustand';
import type { AppState } from '../appStore';
import {
  MapSource,
  ProjectMapLayer,
  CustomLayer,
  ManualCustomLayer,
  PluginCustomLayer,
  EditObject,
  ExportRegion,
} from '../../types/store';
import { v4 as uuidv4 } from 'uuid';
import { insertAbove, moveInOrder } from '../../utils/layerStack';

export type MapSlice = {
  /** Loaded map files (image + metadata). Shared by every instance in `mapLayers` that references it. */
  mapSources: MapSource[];
  /** Map instances: each draws one source (or part of it) at a position in the stack. */
  mapLayers: ProjectMapLayer[];
  customLayers: CustomLayer[];
  /** Ids of every map instance and custom layer, from the top of the stack to the bottom. */
  layerOrder: string[];
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

  addMapLayer: (name: string, info: any, base64: string, width: number, height: number) => void;
  /** Adds another instance of the same map directly above `id` (for using a different part of it). */
  duplicateMapLayer: (id: string) => string | null;
  updateMapLayer: (id: string, updates: Partial<Omit<ProjectMapLayer, 'id' | 'sourceId'>>) => void;
  /** Edits map data shared by all instances: pose (`info.origin`) and occupancy thresholds. */
  updateMapSource: (id: string, updates: Partial<Omit<MapSource, 'id'>>) => void;
  removeMapLayer: (id: string) => void;
  /** Moves a layer of any kind within the single stack (`fromIndex` / `toIndex` index `layerOrder`). */
  reorderLayers: (fromIndex: number, toIndex: number) => void;

  addManualCustomLayer: (name?: string, is_reference?: boolean) => ManualCustomLayer;
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

export const createMapSlice: StateCreator<AppState, [], [], MapSlice> = (set, get) => ({
  mapSources: [],
  mapLayers: [],
  customLayers: [],
  layerOrder: [],
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

  addManualCustomLayer: (name?: string, is_reference?: boolean) => {
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
      layerOrder: insertAbove(state.layerOrder, newLayer.id, null),
      activeCustomLayerId: newLayer.id,
      selection: { type: 'custom_layer', layerId: newLayer.id, selectedObjectId: null },
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
        layerOrder: insertAbove(state.layerOrder, layer.id, null),
        activeCustomLayerId: layer.id,
        selection: { type: 'custom_layer', layerId: layer.id, selectedObjectId: null },
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
    set((state) => ({
      customLayers: state.customLayers.filter((l) => l.id !== id),
      layerOrder: state.layerOrder.filter((o) => o !== id),
      activeCustomLayerId: state.activeCustomLayerId === id ? null : state.activeCustomLayerId,
      selection:
        state.selection.type === 'custom_layer' && state.selection.layerId === id ? { type: 'none' } : state.selection,
      isDirty: true,
    })),

  setActiveCustomLayerId: (id: string | null) => {
    get().setSelection(id ? { type: 'custom_layer', layerId: id, selectedObjectId: null } : { type: 'none' });
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

  addMapLayer: (name: string, info: any, base64: string, width: number, height: number) =>
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
      };
      return {
        mapSources: [...state.mapSources, source],
        mapLayers: [layer, ...state.mapLayers],
        layerOrder: insertAbove(state.layerOrder, layer.id, null),
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
    };
    set((state) => ({
      mapLayers: [copy, ...state.mapLayers],
      layerOrder: insertAbove(state.layerOrder, copy.id, id),
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

  removeMapLayer: (id: string) =>
    set((state) => {
      const removed = state.mapLayers.find((l) => l.id === id);
      if (!removed) return {};
      const mapLayers = state.mapLayers.filter((l) => l.id !== id);
      const stillUsed = mapLayers.some((l) => l.sourceId === removed.sourceId);
      return {
        mapLayers,
        mapSources: stillUsed ? state.mapSources : state.mapSources.filter((s) => s.id !== removed.sourceId),
        layerOrder: state.layerOrder.filter((o) => o !== id),
        isDirty: true,
      };
    }),

  reorderLayers: (fromIndex: number, toIndex: number) =>
    set((state) => ({ layerOrder: moveInOrder(state.layerOrder, fromIndex, toIndex), isDirty: true })),

  setEnableSnapping: (enable: boolean) => set({ enableSnapping: enable }),
  setCursorPosition: (pos) => set({ cursorPosition: pos }),
  setMapScale: (scale) => set({ mapScale: scale }),
});
