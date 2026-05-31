import { StateCreator } from 'zustand';
import { AppState } from '../appStore';
import { ProjectMapLayer } from '../../types/store';
import { v4 as uuidv4 } from 'uuid';

export type MapSlice = {
  mapLayers: ProjectMapLayer[];
  defaultMapOpacity: number;
  enableSnapping: boolean;
  cursorPosition: { x: number; y: number } | null;
  mapScale: number;
  showPaths: boolean;
  showGrid: boolean;
  shouldFitToMaps: number;

  setMapLayers: (layers: ProjectMapLayer[]) => void;
  addMapLayer: (name: string, info: any, base64: string, width: number, height: number) => void;
  updateMapLayer: (id: string, updates: Partial<ProjectMapLayer>) => void;
  removeMapLayer: (id: string) => void;
  reorderMapLayers: (fromIndex: number, toIndex: number) => void;
  setEnableSnapping: (enable: boolean) => void;
  setCursorPosition: (pos: { x: number; y: number } | null) => void;
  setMapScale: (scale: number) => void;
  setShowPaths: (show: boolean) => void;
  setShowGrid: (show: boolean) => void;
  triggerFitToMaps: () => void;
};

export const createMapSlice: StateCreator<AppState, [], [], MapSlice> = (set, get) => ({
  mapLayers: [],
  defaultMapOpacity: 0.5,
  enableSnapping: true,
  cursorPosition: null,
  mapScale: 1,
  showPaths: true,
  showGrid: true,
  shouldFitToMaps: 0,

  setShowPaths: (show: boolean) => set({ showPaths: show }),
  setShowGrid: (show: boolean) => set({ showGrid: show }),
  triggerFitToMaps: () => set({ shouldFitToMaps: Date.now() }),

  setMapLayers: (layers: ProjectMapLayer[]) => set({ mapLayers: layers, isDirty: true }),

  addMapLayer: (name: string, info: any, base64: string, width: number, height: number) => set((state) => {
    const newLayer: ProjectMapLayer = {
      id: uuidv4(),
      name,
      visible: true,
      opacity: state.defaultMapOpacity,
      image_base64: base64,
      info: info,
      width,
      height,
      z_index: state.mapLayers.length,
    };
    return { mapLayers: [newLayer, ...state.mapLayers], isDirty: true };
  }),

  updateMapLayer: (id: string, updates: Partial<ProjectMapLayer>) => set((state) => ({
    mapLayers: state.mapLayers.map(l => l.id === id ? { ...l, ...updates } : l),
    isDirty: true
  })),

  removeMapLayer: (id: string) => set((state) => ({
    mapLayers: state.mapLayers.filter(l => l.id !== id),
    isDirty: true
  })),

  reorderMapLayers: (fromIndex: number, toIndex: number) => set((state) => {
    const layers = [...state.mapLayers];
    const [moved] = layers.splice(fromIndex, 1);
    layers.splice(toIndex, 0, moved);
    return { mapLayers: layers, isDirty: true };
  }),

  setEnableSnapping: (enable: boolean) => set({ enableSnapping: enable }),

  setCursorPosition: (pos) => set({ cursorPosition: pos }),
  setMapScale: (scale) => set({ mapScale: scale }),
});
