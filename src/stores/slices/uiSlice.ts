import { StateCreator } from 'zustand';
import type { AppState } from '../appStore';
import { v4 as uuidv4 } from 'uuid';
import { VALID_DARK_THEME_PRESET_IDS } from '../../utils/themePresets';
import {
  activateTab as activateDockTab,
  clickTab,
  createDefaultDockLayout,
  moveTab,
  reorderTab,
  setGroupWidth,
  setPanelOpen,
} from '../../utils/dockLayout';
import { applyDockOperation } from '../dockAccess';
import type { DockGroupIndex, DockLayout, DockSide, ElementCopyState } from '../../types/ui';
import type { ImportCategory } from '../../types/modal';

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
  activeTool:
    | 'select'
    | 'add_point'
    | 'add_generator'
    | 'add_rect_sweep'
    | 'add_export_region'
    | 'measure'
    | 'geo_align'
    | 'map_clip';
  isSidebarOpen: boolean;
  mouseCenteredZoom: boolean;
  visibleAttributes: string[];
  indexStartIndex: 0 | 1;
  /** true の場合、エクスポート時に整数値（0 など）も float 形式（0.0）で出力する。 */
  exportIntegersAsFloat: boolean;
  /**
   * true の場合、エクスポートプレビュー／占有ハイライトの再生成を速くするために、デコード済みのレイヤー画像と
   * 手描きレイヤーのラスタライズ結果をメモリに残す。メモリ使用量が増えるため、設定で切れる（アプリ全体の設定で、
   * プロジェクトには保存しない）。
   */
  enableBlendCache: boolean;
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

  /**
   * Expanded containers of each tree (`TreeView`), by tree id. A view state: kept while the app runs,
   * across tab switches, but neither saved in the project nor dirtying it.
   */
  expandedTreeItems: Record<string, string[]>;
  setTreeItemExpanded: (treeId: string, id: string, expanded: boolean) => void;
  expandTreeItems: (treeId: string, ids: string[]) => void;

  showProperties: boolean;
  /** Which tab lives in which column of which side panel, with the column widths. Saved with the app settings. */
  dockLayout: DockLayout;
  /** Selecting an item brings the Inspector forward. Off: the panel stays where the user left it. */
  autoFocusInspector: boolean;
  /** Whether each side panel is open. Session only. */
  isLeftPanelOpen: boolean;
  isRightPanelOpen: boolean;

  /** What a click on a rail tab does: show it, hide its column, or close the panel (see `clickTab`). */
  clickPanelTab: (tabId: string) => void;
  movePanelTab: (tabId: string, target: { side: DockSide; group: DockGroupIndex }, index?: number) => void;
  reorderPanelTab: (side: DockSide, group: DockGroupIndex, fromIndex: number, toIndex: number) => void;
  setPanelGroupWidth: (side: DockSide, group: DockGroupIndex, width: number) => void;
  /** Brings a tab on screen; does nothing when it already is. */
  activateTab: (tabId: string) => void;
  resetPanelLayout: () => void;

  isSettingsModalOpen: boolean;
  isExportModalOpen: boolean;
  isImportModalOpen: boolean;
  importModalCategory: ImportCategory | null;
  isExportMapsModalOpen: boolean;
  isShortcutsModalOpen: boolean;
  isWelcomeModalOpen: boolean;
  isInitialLaunch: boolean;
  settingsModalTab: 'general' | 'appearance' | 'options' | 'robot' | 'export' | 'plugins' | 'conditional_styles';

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
  setExportIntegersAsFloat: (enabled: boolean) => void;
  setEnableBlendCache: (enabled: boolean) => void;
  setIsDirty: (dirty: boolean) => void;

  setAutoFocusInspector: (enabled: boolean) => void;
  setLeftPanelOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  setShowProperties: (show: boolean) => void;
  resetWindowLayout: () => void;

  setSettingsModalOpen: (
    open: boolean,
    tab?: 'general' | 'appearance' | 'options' | 'robot' | 'export' | 'plugins' | 'conditional_styles',
  ) => void;
  setExportModalOpen: (open: boolean) => void;
  /** `category` を渡すと、種類の選択を飛ばしてその取り込み画面から始める。 */
  setImportModalOpen: (open: boolean, category?: ImportCategory) => void;
  setExportMapsModalOpen: (open: boolean) => void;
  setShortcutsModalOpen: (open: boolean) => void;
  setWelcomeModalOpen: (open: boolean) => void;
  setIsInitialLaunch: (initial: boolean) => void;

  // Loading Tasks State
  activeLoadingTasks: Record<string, LoadingTask>;
  startLoading: (task: { id?: string; message: string; detail?: string; blocking?: boolean }) => string;
  /** Changes the text of a running task (e.g. the current step). Does nothing once the task has stopped. */
  updateLoading: (id: string, update: { message?: string; detail?: string }) => void;
  stopLoading: (id: string) => void;
  /**
   * Shows a loading task while `fn` runs and removes it afterwards, even if `fn` throws. `fn` receives
   * a function to report progress, which changes the task's `detail` (and `message` if given).
   * Await it so the new text is painted before the next, possibly heavy, step starts.
   */
  runWithLoading: <T>(
    options: { id?: string; message: string; detail?: string; blocking?: boolean },
    fn: (report: (update: { message?: string; detail?: string }) => Promise<void>) => Promise<T>,
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

  updateLoading: (id, update) => {
    set((state) => {
      const task = state.activeLoadingTasks[id];
      if (!task) return state;
      return {
        activeLoadingTasks: {
          ...state.activeLoadingTasks,
          [id]: {
            ...task,
            message: update.message ?? task.message,
            detail: 'detail' in update ? update.detail : task.detail,
          },
        },
      };
    });
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
      return await fn(async (update) => {
        get().updateLoading(id, update);
        // Let the new text paint before the next (possibly heavy) step starts.
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    } finally {
      get().stopLoading(id);
    }
  },

  activeTool: 'select',
  isSidebarOpen: true,
  mouseCenteredZoom: true,
  visibleAttributes: [],
  indexStartIndex: 0,
  exportIntegersAsFloat: true,
  enableBlendCache: true,
  themeMode: 'light',
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

  dockLayout: createDefaultDockLayout(),
  autoFocusInspector: true,
  isLeftPanelOpen: true,
  isRightPanelOpen: true,
  showProperties: true,

  isSettingsModalOpen: false,
  settingsModalTab: 'general',
  isExportModalOpen: false,
  isImportModalOpen: false,
  importModalCategory: null,
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
        type: 'layers',
        ids: [layerId],
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
      } else if (tool === 'measure') {
        state.transitionToMode({
          mode: 'measure',
        });
      } else if (tool === 'geo_align') {
        state.transitionToMode({ mode: 'geo_map_align' });
      } else {
        state.transitionToMode({ mode: 'select' });
      }
    } else {
      set({ activeTool: tool, isMapEditMode: false });
    }
  },

  toggleAttributeVisibility: (attr: string) =>
    set((state) => {
      const next = state.visibleAttributes.includes(attr)
        ? state.visibleAttributes.filter((a) => a !== attr)
        : [...state.visibleAttributes, attr];
      return { visibleAttributes: next, isDirty: true };
    }),

  setIndexStartIndex: (index: 0 | 1) => set({ indexStartIndex: index, isDirty: true }),

  setExportIntegersAsFloat: (enabled: boolean) => set({ exportIntegersAsFloat: enabled, isDirty: true }),

  // An app-wide preference, not part of the project: changing it does not dirty the project.
  setEnableBlendCache: (enabled: boolean) => set({ enableBlendCache: enabled }),

  revealInTree: (type, id) => {
    const targetTab = type === 'node' ? 'waypoints' : 'annotations';
    get().activateTab(targetTab);
    set({
      treeRevealTarget: { type, id, timestamp: Date.now() },
    });
  },
  clearTreeRevealTarget: () => set({ treeRevealTarget: null }),

  expandedTreeItems: {},
  setTreeItemExpanded: (treeId, id, expanded) =>
    set((state) => {
      const current = state.expandedTreeItems[treeId] ?? [];
      if (current.includes(id) === expanded) return {};
      const next = expanded ? [...current, id] : current.filter((e) => e !== id);
      return { expandedTreeItems: { ...state.expandedTreeItems, [treeId]: next } };
    }),
  expandTreeItems: (treeId, ids) =>
    set((state) => {
      const current = state.expandedTreeItems[treeId] ?? [];
      const added = ids.filter((id) => !current.includes(id));
      if (added.length === 0) return {};
      return { expandedTreeItems: { ...state.expandedTreeItems, [treeId]: [...current, ...added] } };
    }),

  // The side-panel layout belongs to the app, not to the project: none of these mark the project dirty.
  clickPanelTab: (tabId) => set((state) => applyDockOperation(state, (dock) => clickTab(dock, tabId))),
  movePanelTab: (tabId, target, index) =>
    set((state) => applyDockOperation(state, (dock) => moveTab(dock, tabId, target, index))),
  reorderPanelTab: (side, group, fromIndex, toIndex) =>
    set((state) => applyDockOperation(state, (dock) => reorderTab(dock, side, group, fromIndex, toIndex))),
  setPanelGroupWidth: (side, group, width) =>
    set((state) => applyDockOperation(state, (dock) => setGroupWidth(dock, side, group, width))),
  activateTab: (tabId) => set((state) => applyDockOperation(state, (dock) => activateDockTab(dock, tabId))),

  resetPanelLayout: () => set({ dockLayout: createDefaultDockLayout(), isLeftPanelOpen: true, isRightPanelOpen: true }),

  setAutoFocusInspector: (enabled) => set({ autoFocusInspector: enabled }),
  setLeftPanelOpen: (open) => set((state) => applyDockOperation(state, (dock) => setPanelOpen(dock, 'left', open))),
  setRightPanelOpen: (open) => set((state) => applyDockOperation(state, (dock) => setPanelOpen(dock, 'right', open))),
  setShowProperties: (show) => set({ showProperties: show, isDirty: true }),

  resetWindowLayout: () => get().resetPanelLayout(),

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
  setImportModalOpen: (open, category) => {
    if (open) {
      set({ importModalCategory: category ?? null });
      get().pushModal?.('import');
    } else {
      get().closeModal?.('import');
    }
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
