import { StateCreator } from 'zustand';
import { AppState } from '../appStore';
import { PluginInstance, PluginSetting } from '../../types/store';
import { BackendAPI } from '../../api';
import { prepareLayersForExport } from '../../utils/mapRasterize';

export type PluginSlice = {
  plugins: Record<string, PluginInstance>;
  pluginSettings: PluginSetting[];
  activePluginId: string | null;
  pluginInteractionData: Record<string, any>;
  pluginActiveProperties: Record<string, any>;
  activeInputIndex: number;

  activePathCalculatorPluginId: string | null;
  pathCalculatorParams: Record<string, any>;
  autoRecalculatePath: boolean;
  calculatedPathSegments: Array<Array<{ x: number; y: number }>> | null;
  isCalculatingPath: boolean;

  setPlugins: (plugins: Record<string, PluginInstance>) => void;
  setPluginSettings: (settings: PluginSetting[]) => void;
  updatePluginSetting: (id: string, updates: Partial<PluginSetting>) => void;
  setActivePlugin: (pluginId: string | null) => void;
  updatePluginInteractionData: (inputId: string, data: any) => void;
  clearPluginInteractionData: () => void;
  setPluginActiveProperties: (props: Record<string, any>) => void;
  setActiveInputIndex: (index: number) => void;
  reloadPlugins: () => Promise<void>;

  setActivePathCalculatorPluginId: (pluginId: string | null) => void;
  setPathCalculatorParams: (params: Record<string, any>) => void;
  setAutoRecalculatePath: (enabled: boolean) => void;
  setCalculatedPathSegments: (segments: Array<Array<{ x: number; y: number }>> | null) => void;
  debouncedRecalculatePath: (delayMs?: number) => void;
  recalculatePath: (options?: { immediate?: boolean }) => Promise<void>;
};

let recalculateTimer: any = null;
let currentCalculationRequestId = 0;

export const createPluginSlice: StateCreator<AppState, [], [], PluginSlice> = (set, get) => ({
  plugins: {},
  pluginSettings: [],
  activePluginId: null,
  pluginInteractionData: {},
  pluginActiveProperties: {},
  activeInputIndex: 0,

  activePathCalculatorPluginId: null,
  pathCalculatorParams: {},
  autoRecalculatePath: true,
  calculatedPathSegments: null,
  isCalculatingPath: false,

  setPlugins: (plugins) => set({ plugins }),
  
  setPluginSettings: (settings) => set({ pluginSettings: settings, isDirty: true }),
  
  updatePluginSetting: (id, updates) => set((state) => ({
    pluginSettings: state.pluginSettings.map(p => p.id === id ? { ...p, ...updates } : p),
    isDirty: true
  })),
  
  setActivePlugin: (pluginId) => set((state) => {
    const plugin = pluginId && state.plugins ? state.plugins[pluginId] : null;
    const isMapLayerGen = plugin?.manifest?.category === 'map_layer_generator';
    return {
      activePluginId: pluginId,
      pluginInteractionData: {},
      pluginActiveProperties: {},
      activeInputIndex: 0,
      ...(!isMapLayerGen ? { activeCustomLayerId: null, isMapEditMode: false } : {}),
    };
  }),
  
  updatePluginInteractionData: (inputId, data) => set((state) => ({
    pluginInteractionData: {
      ...state.pluginInteractionData,
      [inputId]: data
    }
  })),
    
  clearPluginInteractionData: () => set({ 
    pluginInteractionData: {}, 
    pluginActiveProperties: {},
    activeInputIndex: 0 
  }),
  
  setPluginActiveProperties: (props) => set({ pluginActiveProperties: props }),
  
  setActiveInputIndex: (index) => set({ activeInputIndex: index }),

  setActivePathCalculatorPluginId: (pluginId) => {
    set({ activePathCalculatorPluginId: pluginId, isDirty: true });
    if (!pluginId) {
      set({ calculatedPathSegments: null, isCalculatingPath: false });
    } else if (get().autoRecalculatePath) {
      get().recalculatePath({ immediate: true });
    }
  },

  setPathCalculatorParams: (params) => {
    set({ pathCalculatorParams: params, isDirty: true });
    if (get().autoRecalculatePath && get().activePathCalculatorPluginId) {
      get().debouncedRecalculatePath(200);
    }
  },

  setAutoRecalculatePath: (enabled) => set({ autoRecalculatePath: enabled, isDirty: true }),

  setCalculatedPathSegments: (segments) => set({ calculatedPathSegments: segments }),

  debouncedRecalculatePath: (delayMs = 200) => {
    if (recalculateTimer) {
      clearTimeout(recalculateTimer);
      recalculateTimer = null;
    }
    recalculateTimer = setTimeout(() => {
      recalculateTimer = null;
      get().recalculatePath({ immediate: true });
    }, delayMs);
  },

  recalculatePath: async (options) => {
    if (!options?.immediate) {
      get().debouncedRecalculatePath(200);
      return;
    }

    if (recalculateTimer) {
      clearTimeout(recalculateTimer);
      recalculateTimer = null;
    }

    const requestId = ++currentCalculationRequestId;

    const {
      activePathCalculatorPluginId,
      pathCalculatorParams,
      plugins,
      pluginSettings,
      globalPythonPath,
      rootNodeIds,
      nodes,
      mapLayers,
      customLayers,
      robotFootprint,
    } = get();

    if (!activePathCalculatorPluginId || !plugins[activePathCalculatorPluginId]) {
      set({ calculatedPathSegments: null, isCalculatingPath: false });
      get().stopLoading('path-calc');
      return;
    }

    const plugin = plugins[activePathCalculatorPluginId];

    // Collect ordered waypoints
    const waypoints: Array<{ x: number; y: number; qx: number; qy: number; qz: number; qw: number }> = [];
    rootNodeIds.forEach((id) => {
      const node = nodes[id];
      if (!node) return;
      if (node.type === 'manual' && node.transform) {
        waypoints.push(node.transform);
      } else if (node.type === 'generator' && node.children_ids) {
        node.children_ids.forEach((cid) => {
          const child = nodes[cid];
          if (child && child.transform) {
            waypoints.push(child.transform);
          }
        });
      }
    });

    if (waypoints.length < 2) {
      set({ calculatedPathSegments: null, isCalculatingPath: false });
      get().stopLoading('path-calc');
      return;
    }

    set({ isCalculatingPath: true });
    get().startLoading({
      id: 'path-calc',
      message: '経路を計算中...',
      detail: plugin.manifest.name || plugin.id,
      blocking: false,
    });

    try {
      let pythonPathToUse = globalPythonPath?.trim() || "python3";
      if (plugin.manifest.type === "python") {
        const setting = pluginSettings.find((s) => s.id === plugin.id);
        if (setting && setting.pythonOverridePath && setting.pythonOverridePath.trim() !== "") {
          pythonPathToUse = setting.pythonOverridePath.trim();
        }
      }

      const contextData: any = {
        waypoints,
        properties: pathCalculatorParams,
      };

      if (plugin.manifest.needs?.includes('robot_footprint')) {
        contextData.robot_footprint = robotFootprint;
      }

      const layersToPass = await prepareLayersForExport(mapLayers || [], customLayers || []);

      const result = await BackendAPI.runPlugin(
        plugin,
        contextData,
        pythonPathToUse,
        layersToPass
      );

      // Check if this request is still the latest one
      if (requestId !== currentCalculationRequestId) {
        return;
      }

      if (result && Array.isArray(result.segments)) {
        set({ calculatedPathSegments: result.segments, isCalculatingPath: false });
      } else if (Array.isArray(result)) {
        // Flat list of segments or points
        set({ calculatedPathSegments: [result], isCalculatingPath: false });
      } else {
        console.warn("[recalculatePath] Unexpected result format from path calculator:", result);
        set({ calculatedPathSegments: null, isCalculatingPath: false });
      }
    } catch (err) {
      if (requestId === currentCalculationRequestId) {
        console.error("[recalculatePath] Failed to calculate path:", err);
        set({ calculatedPathSegments: null, isCalculatingPath: false });
      }
    } finally {
      if (requestId === currentCalculationRequestId) {
        get().stopLoading('path-calc');
      }
    }
  },

  reloadPlugins: async () => {
    try {
      const installedPlugins = await BackendAPI.fetchInstalledPlugins();
      const newMap: Record<string, PluginInstance> = {};
      
      installedPlugins.forEach((p: PluginInstance) => {
        newMap[p.id] = p;
      });

      const { pluginSettings } = get();
      for (const setting of pluginSettings) {
        if (!setting.isBuiltin && setting.path) {
          try {
            const customPlugin = await BackendAPI.scanCustomPlugin(setting.path);
            newMap[customPlugin.id] = customPlugin;
          } catch (err) {
            console.warn(`[AppStore] Failed to re-scan custom plugin at ${setting.path}:`, err);
          }
        }
      }
      
      set({ plugins: newMap });
      console.log("[AppStore] Plugins reloaded successfully (with custom merging).");
    } catch (err) {
      console.error("Failed to reload plugins:", err);
      throw err;
    }
  },
});
