import { StateCreator } from 'zustand';
import { AppState } from '../appStore';
import { ProjectMapLayer, CustomLayer, ManualCustomLayer, PluginCustomLayer, EditObject, ExportRegion } from '../../types/store';
import { v4 as uuidv4 } from 'uuid';

export type MapSlice = {
  mapLayers: ProjectMapLayer[];
  customLayers: CustomLayer[];
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

  setMapLayers: (layers: ProjectMapLayer[]) => void;
  addMapLayer: (name: string, info: any, base64: string, width: number, height: number) => void;
  updateMapLayer: (id: string, updates: Partial<ProjectMapLayer>) => void;
  removeMapLayer: (id: string) => void;
  reorderMapLayers: (fromIndex: number, toIndex: number) => void;

  setCustomLayers: (layers: CustomLayer[]) => void;
  addManualCustomLayer: (name?: string, is_reference?: boolean) => ManualCustomLayer;
  addPluginCustomLayer: (layer: PluginCustomLayer) => void;
  updateCustomLayer: (id: string, updates: Partial<CustomLayer>) => void;
  removeCustomLayer: (id: string) => void;
  reorderCustomLayers: (fromIndex: number, toIndex: number) => void;
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
  mapLayers: [],
  customLayers: [],
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

  setCustomLayers: (layers: CustomLayer[]) => set({ customLayers: layers, isDirty: true }),

  addManualCustomLayer: (name?: string, is_reference?: boolean) => {
    const customLayers = get().customLayers;
    const manualCount = customLayers.filter(l => l.type === 'manual').length + 1;
    const newLayer: ManualCustomLayer = {
      id: uuidv4(),
      name: name || `Custom Layer ${manualCount}`,
      type: 'manual',
      visible: true,
      opacity: 1.0,
      z_index: customLayers.length,
      blend_mode: 'overwrite',
      is_reference: is_reference ?? false,
      editObjects: [],
    };
    set((state) => ({
      customLayers: [newLayer, ...state.customLayers].map((l, i) => ({ ...l, z_index: i })),
      activeCustomLayerId: newLayer.id,
      selection: { type: 'custom_layer', layerId: newLayer.id, selectedObjectId: null },
      selectedNodeIds: [],
      selectedAnnotationIds: [],
      isDirty: true,
    }));
    return newLayer;
  },

  addPluginCustomLayer: (layer: PluginCustomLayer) => set((state) => {
    const newLayers = [layer, ...state.customLayers];
    const updated = newLayers.map((l, i) => ({ ...l, z_index: i }));
    return {
      customLayers: updated,
      activeCustomLayerId: layer.id,
      selection: { type: 'custom_layer', layerId: layer.id, selectedObjectId: null },
      selectedNodeIds: [],
      selectedAnnotationIds: [],
      isDirty: true,
    };
  }),

  updateCustomLayer: (id: string, updates: Partial<CustomLayer>) => set((state) => ({
    customLayers: state.customLayers.map(l => l.id === id ? ({ ...l, ...updates } as CustomLayer) : l),
    isDirty: true,
  })),

  removeCustomLayer: (id: string) => set((state) => ({
    customLayers: state.customLayers.filter(l => l.id !== id),
    activeCustomLayerId: state.activeCustomLayerId === id ? null : state.activeCustomLayerId,
    selection: state.selection.type === 'custom_layer' && state.selection.layerId === id ? { type: 'none' } : state.selection,
    isDirty: true,
  })),

  reorderCustomLayers: (fromIndex: number, toIndex: number) => set((state) => {
    const layers = [...state.customLayers];
    const [moved] = layers.splice(fromIndex, 1);
    layers.splice(toIndex, 0, moved);
    const updated = layers.map((l, i) => ({ ...l, z_index: i }));
    return { customLayers: updated, isDirty: true };
  }),

  setActiveCustomLayerId: (id: string | null) => {
    get().setSelection(id ? { type: 'custom_layer', layerId: id, selectedObjectId: null } : { type: 'none' });
  },

  addEditObject: (layerId: string, obj: EditObject) => set((state) => ({
    customLayers: state.customLayers.map(l => {
      if (l.id === layerId && l.type === 'manual') {
        return { ...l, editObjects: [...l.editObjects, obj] };
      }
      return l;
    }),
    isDirty: true,
  })),

  removeEditObject: (layerId: string, objId: string) => set((state) => ({
    customLayers: state.customLayers.map(l => {
      if (l.id === layerId && l.type === 'manual') {
        return { ...l, editObjects: l.editObjects.filter(o => o.id !== objId) };
      }
      return l;
    }),
    isDirty: true,
  })),

  updateEditObject: (layerId: string, objId: string, updates: Partial<EditObject>) => set((state) => ({
    customLayers: state.customLayers.map(l => {
      if (l.id === layerId && l.type === 'manual') {
        return {
          ...l,
          editObjects: l.editObjects.map(o => (o.id === objId ? ({ ...o, ...updates } as EditObject) : o)),
        };
      }
      return l;
    }),
    isDirty: true,
  })),

  addExportRegion: (region) => set((state) => ({
    exportRegions: [...state.exportRegions, region],
    isDirty: true,
  })),
  updateExportRegion: (id, updates) => set((state) => ({
    exportRegions: state.exportRegions.map(r => r.id === id ? { ...r, ...updates } : r),
    isDirty: true,
  })),
  removeExportRegion: (id) => set((state) => ({
    exportRegions: state.exportRegions.filter(r => r.id !== id),
    isDirty: true,
  })),

  setMapLayers: (layers: ProjectMapLayer[]) => set({ mapLayers: layers, isDirty: true }),

  addMapLayer: (name: string, info: any, base64: string, width: number, height: number) => set((state) => {
    const occSettings = state.occupancySettings || { defaultOccupiedThresh: 0.65, defaultFreeThresh: 0.25, defaultNegate: 0 };
    const rawOrigin = info?.origin;
    const origin: [number, number, number] = Array.isArray(rawOrigin) && rawOrigin.length >= 2
      ? [Number(rawOrigin[0]) || 0, Number(rawOrigin[1]) || 0, Number(rawOrigin[2]) || 0]
      : [0, 0, 0];
    const initialOrigin: [number, number, number] = Array.isArray(info?.initial_origin) && info.initial_origin.length >= 2
      ? [Number(info.initial_origin[0]) || 0, Number(info.initial_origin[1]) || 0, Number(info.initial_origin[2]) || 0]
      : [...origin];
    const mergedInfo = {
      ...info,
      origin,
      initial_origin: initialOrigin,
      occupied_thresh: typeof info?.occupied_thresh === 'number' ? info.occupied_thresh : occSettings.defaultOccupiedThresh,
      free_thresh: typeof info?.free_thresh === 'number' ? info.free_thresh : occSettings.defaultFreeThresh,
      negate: typeof info?.negate === 'number' ? info.negate : occSettings.defaultNegate,
    };
    const newLayer: ProjectMapLayer = {
      id: uuidv4(),
      name,
      visible: true,
      opacity: state.defaultMapOpacity,
      image_base64: base64,
      info: mergedInfo,
      width,
      height,
      z_index: state.mapLayers.length,
      blend_mode: 'overwrite',
    };
    const newLayers = [newLayer, ...state.mapLayers];
    const updatedLayers = newLayers.map((l, i) => ({ ...l, z_index: i }));
    return { mapLayers: updatedLayers, isDirty: true };
  }),

  updateMapLayer: (id: string, updates: Partial<ProjectMapLayer>) => set((state) => ({
    mapLayers: state.mapLayers.map(l => l.id === id ? { ...l, ...updates } : l),
    isDirty: true,
  })),

  removeMapLayer: (id: string) => set((state) => ({
    mapLayers: state.mapLayers.filter(l => l.id !== id),
    isDirty: true,
  })),

  reorderMapLayers: (fromIndex: number, toIndex: number) => set((state) => {
    const layers = [...state.mapLayers];
    const [moved] = layers.splice(fromIndex, 1);
    layers.splice(toIndex, 0, moved);
    const updatedLayers = layers.map((l, i) => ({ ...l, z_index: i }));
    return { mapLayers: updatedLayers, isDirty: true };
  }),

  setEnableSnapping: (enable: boolean) => set({ enableSnapping: enable }),
  setCursorPosition: (pos) => set({ cursorPosition: pos }),
  setMapScale: (scale) => set({ mapScale: scale }),
});
