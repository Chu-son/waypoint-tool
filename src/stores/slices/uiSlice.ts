import { StateCreator } from 'zustand';
import { AppState } from '../appStore';
import { v4 as uuidv4 } from 'uuid';
import { VALID_DARK_THEME_PRESET_IDS } from '../../utils/themePresets';

export type ElementCopyField = 'x' | 'y' | 'z' | 'yaw';
export type ElementCopyCoordSystem = 'world' | 'anchor';

export type ElementCopyState = {
  field: ElementCopyField;
  value: number;
  coordSystem: ElementCopyCoordSystem;
  previewNodeId: string | null;
} | null;

export interface TreeRevealTarget {
  type: 'node' | 'annotation';
  id: string;
  timestamp: number;
}

export interface LoadingTask {
  id: string;
  message: string;
  detail?: string;
  blocking?: boolean;
  createdAt: number;
}

export type UISlice = {
  activeTool: 'select' | 'add_point' | 'add_generator' | 'add_rect_sweep' | 'add_export_region';
  isSidebarOpen: boolean;
  mouseCenteredZoom: boolean;
  visibleAttributes: string[];
  indexStartIndex: 0 | 1;
  themeMode: 'dark' | 'light';
  setThemeMode: (mode: 'dark' | 'light') => void;
  themePreset: string;
  setThemePreset: (preset: string) => void;
  isDirty: boolean;
  decimalPrecision: number;
  elementCopyState: ElementCopyState;
  setElementCopyState: (state: ElementCopyState) => void;
  clearElementCopyState: () => void;
  
  treeRevealTarget: TreeRevealTarget | null;
  revealInTree: (type: 'node' | 'annotation', id: string) => void;
  clearTreeRevealTarget: () => void;
  
  leftPanelWidth: number;
  rightPanelWidth: number;
  showProperties: boolean;
  leftPanelActiveTab: string;
  rightPanelActiveTab: string;
  leftPanelViewMode: 'tabs' | 'split';
  rightPanelViewMode: 'tabs' | 'split';
  isLeftPanelOpen: boolean;
  isRightPanelOpen: boolean;
  
  isSettingsModalOpen: boolean;
  isExportModalOpen: boolean;
  isImportModalOpen: boolean;
  isExportMapsModalOpen: boolean;
  isShortcutsModalOpen: boolean;
  isWelcomeModalOpen: boolean;
  isInitialLaunch: boolean;
  settingsModalTab: 'general' | 'options' | 'robot' | 'export' | 'plugins';

  // Plugin Data Viewer Modal State
  pluginDataModalState: {
    isOpen: boolean;
    title: string;
    subtitle?: string;
    data: any;
  };
  openPluginDataModal: (title: string, data: any, subtitle?: string) => void;
  closePluginDataModal: () => void;

  // Map Edit UI State
  isMapEditMode: boolean;
  mapEditSubTool: 'rect' | 'circle' | 'freehand' | 'line';
  mapEditFillValue: number;
  mapEditBrushSize: number;
  activeEditLayerId: string | null;
  activeMapLayerId: string | null;
  selectedEditObjectId: string | null;

  setMapEditMode: (enabled: boolean) => void;
  setMapEditSubTool: (tool: 'rect' | 'circle' | 'freehand' | 'line') => void;
  setMapEditFillValue: (value: number) => void;
  setMapEditBrushSize: (size: number) => void;
  setActiveEditLayerId: (id: string | null) => void;
  setActiveMapLayerId: (id: string | null) => void;
  setSelectedEditObjectId: (id: string | null) => void;

  setActiveTool: (tool: AppState['activeTool']) => void;
  toggleAttributeVisibility: (attr: string) => void;
  setIndexStartIndex: (index: 0 | 1) => void;
  setIsDirty: (dirty: boolean) => void;
  
  setLeftPanelActiveTab: (tab: string) => void;
  setRightPanelActiveTab: (tab: string) => void;
  setLeftPanelViewMode: (mode: 'tabs' | 'split') => void;
  setRightPanelViewMode: (mode: 'tabs' | 'split') => void;
  setLeftPanelOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  setLeftPanelWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  setShowProperties: (show: boolean) => void;
  resetWindowLayout: () => void;
  
  setSettingsModalOpen: (open: boolean, tab?: 'general' | 'options' | 'robot' | 'export' | 'plugins') => void;
  setExportModalOpen: (open: boolean) => void;
  setImportModalOpen: (open: boolean) => void;
  setExportMapsModalOpen: (open: boolean) => void;
  setShortcutsModalOpen: (open: boolean) => void;
  setWelcomeModalOpen: (open: boolean) => void;
  setIsInitialLaunch: (initial: boolean) => void;
  
  // Loading Tasks State
  activeLoadingTasks: Record<string, LoadingTask>;
  startLoading: (task: { id?: string; message: string; detail?: string; blocking?: boolean }) => string;
  stopLoading: (id: string) => void;
  runWithLoading: <T>(
    options: { id?: string; message: string; detail?: string; blocking?: boolean },
    fn: () => Promise<T>
  ) => Promise<T>;

  // Note: setDirty is mapped to setIsDirty in original store
  setDirty: (dirty: boolean) => void;
};

export const createUISlice: StateCreator<AppState, [], [], UISlice> = (set, get) => ({
  activeLoadingTasks: {},

  startLoading: (task) => {
    const id = task.id || uuidv4();
    const newTask: LoadingTask = {
      id,
      message: task.message,
      detail: task.detail,
      blocking: task.blocking !== false,
      createdAt: Date.now(),
    };
    set((state) => ({
      activeLoadingTasks: {
        ...state.activeLoadingTasks,
        [id]: newTask,
      },
    }));
    return id;
  },

  stopLoading: (id: string) => {
    set((state) => {
      if (!state.activeLoadingTasks[id]) return state;
      const { [id]: _, ...rest } = state.activeLoadingTasks;
      return { activeLoadingTasks: rest };
    });
  },

  runWithLoading: async (options, fn) => {
    const id = get().startLoading(options);
    // Yield a frame to allow React to commit state and browser to paint the LoadingOverlay
    await new Promise((resolve) => setTimeout(resolve, 30));
    try {
      return await fn();
    } finally {
      get().stopLoading(id);
    }
  },

  activeTool: 'select',
  isSidebarOpen: true,
  mouseCenteredZoom: true,
  visibleAttributes: [],
  indexStartIndex: 0,
  themeMode: 'dark',
  setThemeMode: (mode: 'dark' | 'light') => set({ themeMode: mode === 'light' ? 'light' : 'dark' }),
  themePreset: 'default',
  setThemePreset: (preset: string) => {
    const normalized =
      preset === 'roomba'
        ? 'emerald'
        : preset === 'dark'
        ? 'default'
        : VALID_DARK_THEME_PRESET_IDS.includes(preset)
        ? preset
        : 'default';
    set({ themePreset: normalized });
  },
  isDirty: false,
  decimalPrecision: 6,
  elementCopyState: null,

  setElementCopyState: (copyState: ElementCopyState) => {
    set({ elementCopyState: copyState });
    if (copyState) {
      get().transitionToMode?.({
        mode: 'element_paste',
        field: copyState.field,
        value: copyState.value,
        coordSystem: copyState.coordSystem,
        previewNodeId: copyState.previewNodeId,
      });
    } else {
      const state = get();
      if (state.appMode?.mode === 'element_paste') {
        state.transitionToMode?.({ mode: 'select' });
      }
    }
  },
  clearElementCopyState: () => {
    const state = get();
    if (state.appMode?.mode === 'element_paste') {
      state.transitionToMode?.({ mode: 'select' });
    }
    set({ elementCopyState: null });
  },

  treeRevealTarget: null,

  leftPanelActiveTab: 'project',
  rightPanelActiveTab: 'layers',
  leftPanelViewMode: 'tabs',
  rightPanelViewMode: 'tabs',
  isLeftPanelOpen: true,
  isRightPanelOpen: true,
  leftPanelWidth: 280,
  rightPanelWidth: 320,
  showProperties: true,

  isSettingsModalOpen: false,
  settingsModalTab: 'general',
  isExportModalOpen: false,
  isImportModalOpen: false,
  isExportMapsModalOpen: false,
  isShortcutsModalOpen: false,
  isWelcomeModalOpen: true,
  isInitialLaunch: true,

  pluginDataModalState: {
    isOpen: false,
    title: '',
    subtitle: undefined,
    data: null,
  },
  openPluginDataModal: (title, data, subtitle) => {
    get().pushModal?.('plugin_data');
    set({
      pluginDataModalState: {
        isOpen: true,
        title,
        subtitle,
        data,
      },
    });
  },
  closePluginDataModal: () => {
    get().closeModal?.('plugin_data');
    set((state) => ({
      pluginDataModalState: {
        ...state.pluginDataModalState,
        isOpen: false,
      },
    }));
  },

  isMapEditMode: false,
  mapEditSubTool: 'rect',
  mapEditFillValue: 0,
  mapEditBrushSize: 10,
  activeEditLayerId: null,
  activeMapLayerId: null,
  selectedEditObjectId: null,

  setMapEditMode: (enabled) => {
    const state = get();
    if (enabled) {
      if (state.transitionToMode) {
        state.transitionToMode({
          mode: 'custom_layer_edit',
          subTool: state.mapEditSubTool,
          targetLayerId:
            state.activeCustomLayerId ||
            state.activeEditLayerId ||
            state.customLayers?.find((l) => l.type === 'manual')?.id ||
            '',
          fillValue: state.mapEditFillValue,
          brushSize: state.mapEditBrushSize,
        });
      } else {
        set({ isMapEditMode: true });
      }
    } else {
      set({ isMapEditMode: false });
      if (state.appMode?.mode === 'custom_layer_edit') {
        state.transitionToMode?.({ mode: 'select' });
      }
    }
  },
  setMapEditSubTool: (tool) => set({ mapEditSubTool: tool }),
  setMapEditFillValue: (value) => set({ mapEditFillValue: value }),
  setMapEditBrushSize: (size) => set({ mapEditBrushSize: size }),
  setActiveEditLayerId: (id) => set({ activeEditLayerId: id }),
  setActiveMapLayerId: (id) => set({ activeMapLayerId: id }),
  setSelectedEditObjectId: (id) => {
    const state = get();
    set({ selectedEditObjectId: id });
    if (id) {
      const layerId = state.activeCustomLayerId || state.activeEditLayerId || '';
      state.setSelection?.({
        type: 'custom_layer',
        layerId,
        selectedObjectId: id,
      });
    }
  },

  setDirty: (dirty: boolean) => set({ isDirty: dirty }),
  setIsDirty: (dirty: boolean) => set({ isDirty: dirty }),

  setActiveTool: (tool: AppState['activeTool']) => {
    const state = get();
    if (state.isMapEditMode) {
      set({ isMapEditMode: false });
    }
    if (state.transitionToMode) {
      if (tool === 'select') {
        state.transitionToMode({ mode: 'select' });
      } else if (tool === 'add_point') {
        state.transitionToMode({
          mode: 'waypoint_add',
          snapInput: '',
          lockedWaypointId: null,
          forcedAxis: null,
          forcedSign: null,
        });
      } else if (tool === 'add_generator') {
        state.transitionToMode({
          mode: 'generator_add',
          pluginId: state.activePluginId,
        });
      } else if (tool === 'add_export_region') {
        state.transitionToMode({
          mode: 'export_region_edit',
        });
      } else {
        state.transitionToMode({ mode: 'select' });
      }
    } else {
      set({ activeTool: tool, isMapEditMode: false });
    }
  },

  toggleAttributeVisibility: (attr: string) => set((state) => {
    const next = state.visibleAttributes.includes(attr) 
      ? state.visibleAttributes.filter(a => a !== attr)
      : [...state.visibleAttributes, attr];
    return { visibleAttributes: next, isDirty: true };
  }),

  setIndexStartIndex: (index: 0 | 1) => set({ indexStartIndex: index, isDirty: true }),

  revealInTree: (type, id) => set({
    isLeftPanelOpen: true,
    leftPanelActiveTab: 'project',
    treeRevealTarget: { type, id, timestamp: Date.now() },
  }),
  clearTreeRevealTarget: () => set({ treeRevealTarget: null }),

  setLeftPanelActiveTab: (tab) => set({ leftPanelActiveTab: tab }),
  setRightPanelActiveTab: (tab) => set({ rightPanelActiveTab: tab }),
  setLeftPanelViewMode: (mode) => set({ leftPanelViewMode: mode, isDirty: true }),
  setRightPanelViewMode: (mode) => set({ rightPanelViewMode: mode, isDirty: true }),
  setLeftPanelOpen: (open) => set({ isLeftPanelOpen: open }),
  setRightPanelOpen: (open) => set({ isRightPanelOpen: open }),
  setLeftPanelWidth: (width) => set({ leftPanelWidth: width, isDirty: true }),
  setRightPanelWidth: (width) => set({ rightPanelWidth: width, isDirty: true }),
  setShowProperties: (show) => set({ showProperties: show, isDirty: true }),
  
  resetWindowLayout: () => set({
    isLeftPanelOpen: true,
    isRightPanelOpen: true,
    leftPanelViewMode: 'tabs',
    rightPanelViewMode: 'tabs',
    leftPanelActiveTab: 'project',
    rightPanelActiveTab: 'layers',
    leftPanelWidth: 280,
    rightPanelWidth: 320,
    isDirty: true
  }),

  setSettingsModalOpen: (open, tab) => {
    if (open) {
      get().pushModal?.('settings');
      if (tab) set({ settingsModalTab: tab });
    } else {
      get().closeModal?.('settings');
    }
  },
  setExportModalOpen: (open) => {
    if (open) get().pushModal?.('export');
    else get().closeModal?.('export');
  },
  setImportModalOpen: (open) => {
    if (open) get().pushModal?.('import');
    else get().closeModal?.('import');
  },
  setExportMapsModalOpen: (open) => {
    if (open) get().pushModal?.('export_maps');
    else get().closeModal?.('export_maps');
  },
  setShortcutsModalOpen: (open) => {
    if (open) get().pushModal?.('shortcuts');
    else get().closeModal?.('shortcuts');
  },
  setWelcomeModalOpen: (open) => {
    if (open) get().pushModal?.('welcome');
    else get().closeModal?.('welcome');
  },
  setIsInitialLaunch: (initial) => set({ isInitialLaunch: initial }),
});
