import { StateCreator } from 'zustand';
import { AppState } from '../appStore';
import { PluginInstance, PluginSetting } from '../../types/store';
import { BackendAPI } from '../../api';

export type PluginSlice = {
  plugins: Record<string, PluginInstance>;
  pluginSettings: PluginSetting[];
  activePluginId: string | null;
  pluginInteractionData: Record<string, any>;
  pluginActiveProperties: Record<string, any>;
  activeInputIndex: number;

  setPlugins: (plugins: Record<string, PluginInstance>) => void;
  setPluginSettings: (settings: PluginSetting[]) => void;
  updatePluginSetting: (id: string, updates: Partial<PluginSetting>) => void;
  setActivePlugin: (pluginId: string | null) => void;
  updatePluginInteractionData: (inputId: string, data: any) => void;
  clearPluginInteractionData: () => void;
  setPluginActiveProperties: (props: Record<string, any>) => void;
  setActiveInputIndex: (index: number) => void;
  reloadPlugins: () => Promise<void>;
};

export const createPluginSlice: StateCreator<AppState, [], [], PluginSlice> = (set, get) => ({
  plugins: {},
  pluginSettings: [],
  activePluginId: null,
  pluginInteractionData: {},
  pluginActiveProperties: {},
  activeInputIndex: 0,

  setPlugins: (plugins) => set({ plugins }),
  
  setPluginSettings: (settings) => set({ pluginSettings: settings, isDirty: true }),
  
  updatePluginSetting: (id, updates) => set((state) => ({
    pluginSettings: state.pluginSettings.map(p => p.id === id ? { ...p, ...updates } : p),
    isDirty: true
  })),
  
  setActivePlugin: (pluginId) => set({ 
    activePluginId: pluginId, 
    pluginInteractionData: {}, 
    pluginActiveProperties: {},
    activeInputIndex: 0 
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
