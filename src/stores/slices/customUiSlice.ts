import { StateCreator } from 'zustand';
import { AppState } from '../appStore';
import { CustomUiConfig } from '../../types/customUi';
import { BackendAPI } from '../../api';

export type CustomUISlice = {
  customUiConfig: CustomUiConfig | null;
  isCustomUiMode: boolean;
  customUiPresetType: 'dev' | 'sample' | null;
  customUiPresetPath: string | null;
  setCustomUiConfig: (config: CustomUiConfig | null) => void;
  setIsCustomUiMode: (enabled: boolean) => void;
  toggleCustomUiMode: () => void;
  loadCustomUiConfig: () => Promise<void>;
  checkCustomUiPreset: () => Promise<void>;
  switchToPresetCustomUi: () => Promise<void>;
  loadCustomUiConfigFile: (filePath?: string) => Promise<void>;
  applyCustomUiConfig: (config: CustomUiConfig) => void;
  getEffectiveBrandName: () => string;
};

export const createCustomUISlice: StateCreator<AppState, [], [], CustomUISlice> = (set, get) => ({
  customUiConfig: null,
  isCustomUiMode: false,
  customUiPresetType: null,
  customUiPresetPath: null,

  setCustomUiConfig: (config) => set({
    customUiConfig: config,
    isCustomUiMode: config !== null,
  }),

  setIsCustomUiMode: (enabled) => set({ isCustomUiMode: enabled }),

  toggleCustomUiMode: () => set((state) => ({ isCustomUiMode: !state.isCustomUiMode })),

  applyCustomUiConfig: (config: CustomUiConfig) => {
    set({
      customUiConfig: config,
      isCustomUiMode: true,
    });

    // Apply window layout settings from Custom UI config if present
    const layout = config.layout;
    if (layout) {
      const updates: Partial<AppState> = {};

      if (layout.leftPanel) {
        if (typeof layout.leftPanel.defaultOpen === 'boolean') {
          updates.isLeftPanelOpen = layout.leftPanel.defaultOpen;
        }
        if (typeof layout.leftPanel.defaultWidth === 'number') {
          updates.leftPanelWidth = layout.leftPanel.defaultWidth;
        }
        if (layout.leftPanel.viewMode) {
          updates.leftPanelViewMode = layout.leftPanel.viewMode;
        }
        if (layout.leftPanel.tabs && layout.leftPanel.tabs.length > 0) {
          updates.leftPanelActiveTab = layout.leftPanel.tabs[0].id;
        }
      }

      if (layout.rightPanel) {
        if (typeof layout.rightPanel.defaultOpen === 'boolean') {
          updates.isRightPanelOpen = layout.rightPanel.defaultOpen;
        }
        if (typeof layout.rightPanel.defaultWidth === 'number') {
          updates.rightPanelWidth = layout.rightPanel.defaultWidth;
        }
        if (layout.rightPanel.viewMode) {
          updates.rightPanelViewMode = layout.rightPanel.viewMode;
        }
        if (layout.rightPanel.tabs && layout.rightPanel.tabs.length > 0) {
          updates.rightPanelActiveTab = layout.rightPanel.tabs[0].id;
        }
      }

      // Welcome modal suppression
      if (layout.showWelcomeModal === false) {
        updates.isWelcomeModalOpen = false;
        updates.isInitialLaunch = false;
      }

      if (Object.keys(updates).length > 0) {
        set(updates);
      }
    }
  },

  loadCustomUiConfig: async () => {
    try {
      const config = await BackendAPI.loadCustomUiConfig();
      if (config) {
        get().applyCustomUiConfig(config as CustomUiConfig);
      }
    } catch (err) {
      console.warn('Failed to load Custom UI config:', err);
    }
  },

  checkCustomUiPreset: async () => {
    try {
      const preset = await BackendAPI.loadCustomUiPreset();
      if (preset && (preset.type === 'dev' || preset.type === 'sample')) {
        set({
          customUiPresetType: preset.type,
          customUiPresetPath: preset.path || null,
        });
      } else {
        set({
          customUiPresetType: null,
          customUiPresetPath: null,
        });
      }
    } catch (err) {
      console.warn('Failed to check Custom UI preset:', err);
    }
  },

  switchToPresetCustomUi: async () => {
    try {
      const preset = await BackendAPI.loadCustomUiPreset();
      if (preset && preset.config) {
        set({
          customUiPresetType: preset.type,
          customUiPresetPath: preset.path || null,
        });
        get().applyCustomUiConfig(preset.config as CustomUiConfig);
      } else {
        console.warn('No custom UI preset found (custom-ui.dev.json / custom-ui.sample.json).');
      }
    } catch (err) {
      console.error('Failed to switch to preset Custom UI:', err);
    }
  },

  loadCustomUiConfigFile: async (filePath?: string) => {
    try {
      if (filePath) {
        const content = await BackendAPI.readTextFile(filePath);
        const json = JSON.parse(content);
        get().applyCustomUiConfig(json as CustomUiConfig);
      }
    } catch (err) {
      console.warn('Failed to load Custom UI config file:', err);
    }
  },

  getEffectiveBrandName: () => {
    const { customUiConfig, isCustomUiMode } = get();
    if (isCustomUiMode && customUiConfig?.brand?.appName) {
      return customUiConfig.brand.appName;
    }
    return 'Waypoint Tool';
  },
});
