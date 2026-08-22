import { StateCreator } from 'zustand';
import { AppState } from '../appStore';
import { CustomUiConfig } from '../../types/customUi';
import { BackendAPI } from '../../api';

export type CustomUISlice = {
  customUiConfig: CustomUiConfig | null;
  isCustomUiMode: boolean;
  setCustomUiConfig: (config: CustomUiConfig | null) => void;
  setIsCustomUiMode: (enabled: boolean) => void;
  toggleCustomUiMode: () => void;
  loadCustomUiConfig: () => Promise<void>;
  getEffectiveBrandName: () => string;
};

export const createCustomUISlice: StateCreator<AppState, [], [], CustomUISlice> = (set, get) => ({
  customUiConfig: null,
  isCustomUiMode: false,

  setCustomUiConfig: (config) => set({
    customUiConfig: config,
    isCustomUiMode: config !== null,
  }),

  setIsCustomUiMode: (enabled) => set({ isCustomUiMode: enabled }),

  toggleCustomUiMode: () => set((state) => ({ isCustomUiMode: !state.isCustomUiMode })),

  loadCustomUiConfig: async () => {
    try {
      const config = await BackendAPI.loadCustomUiConfig();
      if (config) {
        set({
          customUiConfig: config as CustomUiConfig,
          isCustomUiMode: true,
        });

        // Apply window layout settings from Custom UI config if present
        const layout = (config as CustomUiConfig).layout;
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
      }
    } catch (err) {
      console.warn('Failed to load Custom UI config:', err);
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
