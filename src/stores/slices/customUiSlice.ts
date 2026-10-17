import { StateCreator } from 'zustand';
import type { AppState } from '../appStore';
import { CustomUiConfig } from '../../types/customUi';
import type { DockLayout } from '../../types/ui';
import { createCustomDockLayout } from '../../utils/dockLayout';
import { BackendAPI } from '../../api';

export type CustomUISlice = {
  customUiConfig: CustomUiConfig | null;
  isCustomUiMode: boolean;
  /** Panel layout while a Custom UI is active. Not saved; null when the config has no `layout`. */
  customPanelLayout: DockLayout | null;
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
  customPanelLayout: null,
  customUiPresetType: null,
  customUiPresetPath: null,

  setCustomUiConfig: (config) =>
    set({
      customUiConfig: config,
      isCustomUiMode: config !== null,
    }),

  setIsCustomUiMode: (enabled) => set({ isCustomUiMode: enabled }),

  toggleCustomUiMode: () => set((state) => ({ isCustomUiMode: !state.isCustomUiMode })),

  applyCustomUiConfig: (config: CustomUiConfig) => {
    set({
      customUiConfig: config,
      isCustomUiMode: true,
      customPanelLayout: null,
    });

    // Apply window layout settings from Custom UI config if present. The panel layout goes into its own
    // `customPanelLayout`, so it neither reads nor overwrites the user's saved layout.
    const layout = config.layout;
    if (layout) {
      const updates: Partial<AppState> = {};

      const tabIds = (tabs?: Array<{ id: string }>) => (tabs ?? []).map((t) => t.id);
      updates.customPanelLayout = createCustomDockLayout(get().dockLayout, {
        left: { tabIds: tabIds(layout.leftPanel?.tabs), width: layout.leftPanel?.defaultWidth },
        right: { tabIds: tabIds(layout.rightPanel?.tabs), width: layout.rightPanel?.defaultWidth },
      });
      if (typeof layout.leftPanel?.defaultOpen === 'boolean') updates.isLeftPanelOpen = layout.leftPanel.defaultOpen;
      if (typeof layout.rightPanel?.defaultOpen === 'boolean') {
        updates.isRightPanelOpen = layout.rightPanel.defaultOpen;
      }
      // `viewMode` is accepted in the config but no longer has an effect.

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
