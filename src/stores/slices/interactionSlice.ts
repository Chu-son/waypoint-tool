import { StateCreator } from 'zustand';
import { AppState } from '../appStore';
import { AppModeState, AppModeTransition } from '../../types/mode';
import { ActiveSelection } from '../../types/selection';
import { ModalType, ModalStack } from '../../types/modal';

export type CanvasAbortHandler = () => boolean;

export interface ModeTransitionListener {
  onExit?: (currentMode: AppModeState, targetMode: AppModeState) => void;
  onEnter?: (newMode: AppModeState, previousMode: AppModeState) => void;
}

export interface InteractionSlice {
  appMode: AppModeState;
  selection: ActiveSelection;
  modalStack: ModalStack;

  // Actions
  transitionToMode: (mode: AppModeTransition) => void;
  updateAppMode: (updates: Partial<AppModeState>) => void;
  setSelection: (selection: ActiveSelection) => void;
  pushModal: (modal: ModalType) => void;
  popModal: () => ModalType | undefined;
  closeModal: (modal: ModalType) => void;

  // Escape Pipeline & Canvas Delegate Registration
  registerCanvasAbortHandler: (handler: CanvasAbortHandler) => () => void;
  abortCanvasGestures: () => boolean;
  subscribeModeTransition: (listener: ModeTransitionListener) => () => void;
  handleGlobalEscape: () => boolean;
}

export const createInteractionSlice: StateCreator<AppState, [], [], InteractionSlice> = (set, get) => {
  const canvasAbortHandlers = new Set<CanvasAbortHandler>();
  const transitionListeners = new Set<ModeTransitionListener>();

  const abortCanvasGestures = (): boolean => {
    let aborted = false;
    for (const handler of Array.from(canvasAbortHandlers).reverse()) {
      try {
        if (handler()) {
          aborted = true;
        }
      } catch (err) {
        console.error('[abortCanvasGestures] Error in canvasAbortHandler:', err);
      }
    }
    return aborted;
  };

  return {
    appMode: { mode: 'select' },
    selection: { type: 'none' },
    modalStack: ['welcome'],

    abortCanvasGestures,

    transitionToMode: (mode: AppModeTransition) => {
      const currentMode = get().appMode;

      let normalizedMode: AppModeState;
      switch (mode.mode) {
        case 'select':
          normalizedMode = { mode: 'select' };
          break;
        case 'waypoint_add':
          normalizedMode = {
            mode: 'waypoint_add',
            snapInput: mode.snapInput ?? '',
            lockedWaypointId: mode.lockedWaypointId ?? null,
            forcedAxis: mode.forcedAxis ?? null,
            forcedSign: mode.forcedSign ?? null,
          };
          break;
        case 'generator_add':
          normalizedMode = {
            mode: 'generator_add',
            pluginId: mode.pluginId ?? null,
          };
          break;
        case 'annotation_edit':
          normalizedMode = {
            mode: 'annotation_edit',
            subTool: mode.subTool ?? 'select',
            targetGroupId: mode.targetGroupId ?? null,
          };
          break;
        case 'custom_layer_edit':
          normalizedMode = {
            mode: 'custom_layer_edit',
            targetLayerId: mode.targetLayerId,
            subTool: mode.subTool ?? 'rect',
            fillValue: mode.fillValue ?? 100,
            brushSize: mode.brushSize ?? 1,
          };
          break;
        case 'export_region_edit':
          normalizedMode = { mode: 'export_region_edit' };
          break;
        case 'plugin_interaction':
          normalizedMode = {
            mode: 'plugin_interaction',
            pluginId: mode.pluginId,
            inputKey: mode.inputKey,
          };
          break;
        case 'element_paste':
          normalizedMode = {
            mode: 'element_paste',
            field: mode.field,
            value: mode.value,
            coordSystem: mode.coordSystem,
            previewNodeId: mode.previewNodeId ?? null,
          };
          break;
        case 'measure':
          normalizedMode = { mode: 'measure' };
          break;
      }

      // Phase 2: OnExit (現在のモードの終了処理)
      // 進行中の過渡ジェスチャー（ドラッグ、回転、描画等）を強制アボート
      abortCanvasGestures();

      // 登録された遷移リスナーの onExit を同期実行
      transitionListeners.forEach((listener) => {
        try {
          listener.onExit?.(currentMode, normalizedMode);
        } catch (err) {
          console.error('[transitionToMode] Error in modeTransitionListener.onExit:', err);
        }
      });

      // Phase 3: State Mutation
      set((state) => {
        const updates: Partial<AppState> = {
          appMode: normalizedMode,
        };

        switch (normalizedMode.mode) {
          case 'select':
            updates.activeTool = 'select';
            updates.isMapEditMode = false;
            updates.isAnnotationEditMode = false;
            updates.activePluginId = null;
            updates.pluginInteractionData = {};
            updates.elementCopyState = null;
            if (state.selection?.type === 'custom_layer') {
              updates.selection = { type: 'none' };
              updates.activeCustomLayerId = null;
              updates.selectedEditObjectId = null;
            }
            break;
          case 'waypoint_add':
            updates.activeTool = 'add_point';
            updates.isMapEditMode = false;
            updates.isAnnotationEditMode = false;
            updates.elementCopyState = null;
            updates.selectedAnnotationIds = [];
            updates.activeCustomLayerId = null;
            updates.selectedEditObjectId = null;
            if (state.selection?.type === 'custom_layer' || state.selection?.type === 'annotations') {
              updates.selection = { type: 'none' };
            }
            break;
          case 'generator_add':
            updates.activeTool = 'add_generator';
            updates.isMapEditMode = false;
            updates.isAnnotationEditMode = false;
            updates.rightPanelActiveTab = 'inspector';
            updates.elementCopyState = null;
            updates.selectedAnnotationIds = [];
            updates.selectedEditObjectId = null;
            if (state.selection?.type === 'annotations') {
              updates.selection = { type: 'none' };
            }
            if (normalizedMode.pluginId) {
              updates.activePluginId = normalizedMode.pluginId;
            }
            break;
          case 'annotation_edit':
            updates.activeTool = 'select';
            updates.isAnnotationEditMode = true;
            updates.activeAnnotationSubTool = normalizedMode.subTool;
            updates.isMapEditMode = false;
            updates.rightPanelActiveTab = 'inspector';
            updates.elementCopyState = null;
            updates.selectedNodeIds = [];
            updates.activeCustomLayerId = null;
            updates.selectedEditObjectId = null;
            if (state.selection?.type !== 'annotations') {
              updates.selection = { type: 'none' };
            }
            if (normalizedMode.targetGroupId !== undefined) {
              updates.activeAnnotationGroupId = normalizedMode.targetGroupId;
            }
            break;
          case 'custom_layer_edit':
            updates.activeTool = 'select';
            updates.isMapEditMode = true;
            updates.mapEditSubTool = normalizedMode.subTool;
            updates.activeEditLayerId = normalizedMode.targetLayerId;
            updates.activeCustomLayerId = normalizedMode.targetLayerId;
            updates.selection = {
              type: 'custom_layer',
              layerId: normalizedMode.targetLayerId,
              selectedObjectId: null,
            };
            updates.selectedNodeIds = [];
            updates.selectedAnnotationIds = [];
            updates.mapEditFillValue = normalizedMode.fillValue;
            updates.mapEditBrushSize = normalizedMode.brushSize;
            updates.isAnnotationEditMode = false;
            updates.rightPanelActiveTab = 'inspector';
            updates.elementCopyState = null;
            break;
          case 'export_region_edit':
            updates.activeTool = 'add_export_region';
            updates.isMapEditMode = false;
            updates.isAnnotationEditMode = false;
            updates.elementCopyState = null;
            updates.selectedAnnotationIds = [];
            updates.activeCustomLayerId = null;
            updates.selectedEditObjectId = null;
            if (state.selection?.type === 'custom_layer' || state.selection?.type === 'annotations') {
              updates.selection = { type: 'none' };
            }
            break;
          case 'plugin_interaction':
            updates.activeTool = 'add_generator';
            updates.isMapEditMode = false;
            updates.isAnnotationEditMode = false;
            updates.elementCopyState = null;
            updates.selectedAnnotationIds = [];
            updates.activeCustomLayerId = null;
            updates.selectedEditObjectId = null;
            if (state.selection?.type === 'custom_layer' || state.selection?.type === 'annotations') {
              updates.selection = { type: 'none' };
            }
            if (normalizedMode.pluginId) {
              updates.activePluginId = normalizedMode.pluginId;
            }
            break;
          case 'element_paste':
            updates.activeTool = 'select';
            updates.isMapEditMode = false;
            updates.isAnnotationEditMode = false;
            updates.selectedAnnotationIds = [];
            updates.activeCustomLayerId = null;
            updates.selectedEditObjectId = null;
            if (state.selection?.type === 'custom_layer' || state.selection?.type === 'annotations') {
              updates.selection = { type: 'none' };
            }
            updates.elementCopyState = {
              field: normalizedMode.field,
              value: normalizedMode.value,
              coordSystem: normalizedMode.coordSystem,
              previewNodeId: normalizedMode.previewNodeId,
            };
            break;
          case 'measure':
            updates.activeTool = 'measure';
            updates.isMapEditMode = false;
            updates.isAnnotationEditMode = false;
            updates.activePluginId = null;
            updates.pluginInteractionData = {};
            updates.elementCopyState = null;
            break;
        }

        return updates;
      });

      // Phase 4: OnEnter (新しいモードの開始処理)
      transitionListeners.forEach((listener) => {
        try {
          listener.onEnter?.(normalizedMode, currentMode);
        } catch (err) {
          console.error('[transitionToMode] Error in modeTransitionListener.onEnter:', err);
        }
      });
    },

    updateAppMode: (updates: Partial<AppModeState>) => {
      set((state) => ({
        appMode: {
          ...state.appMode,
          ...updates,
        } as AppModeState,
      }));
    },

    setSelection: (selection: ActiveSelection) => {
      set((state) => {
        const updates: Partial<AppState> = {
          selection,
        };

        switch (selection.type) {
          case 'none':
            updates.selectedNodeIds = [];
            updates.selectedAnnotationIds = [];
            updates.activeCustomLayerId = null;
            updates.selectedEditObjectId = null;
            break;
          case 'nodes':
            updates.selectedNodeIds = selection.ids;
            updates.selectedAnnotationIds = [];
            updates.activeCustomLayerId = null;
            updates.selectedEditObjectId = null;
            if (selection.ids.length > 0) {
              updates.rightPanelActiveTab = 'inspector';
            }
            if (state.elementCopyState) {
              const targetId = selection.ids.length === 1 ? selection.ids[0] : null;
              updates.elementCopyState = { ...state.elementCopyState, previewNodeId: targetId };
            }
            break;
          case 'annotations':
            updates.selectedNodeIds = [];
            updates.selectedAnnotationIds = selection.ids;
            updates.activeCustomLayerId = null;
            updates.selectedEditObjectId = null;
            if (selection.ids.length > 0) {
              updates.rightPanelActiveTab = 'inspector';
            }
            break;
          case 'custom_layer':
            updates.selectedNodeIds = [];
            updates.selectedAnnotationIds = [];
            updates.activeCustomLayerId = selection.layerId;
            updates.selectedEditObjectId = selection.selectedObjectId;
            updates.rightPanelActiveTab = 'inspector';
            break;
        }

        return updates;
      });
    },

    pushModal: (modal: ModalType) => {
      set((state) => {
        const nextStack = state.modalStack.filter((m) => m !== modal);
        nextStack.push(modal);
        const updates: Partial<AppState> = { modalStack: nextStack };

        if (modal === 'settings') updates.isSettingsModalOpen = true;
        else if (modal === 'export') updates.isExportModalOpen = true;
        else if (modal === 'import') updates.isImportModalOpen = true;
        else if (modal === 'export_maps') updates.isExportMapsModalOpen = true;
        else if (modal === 'shortcuts') updates.isShortcutsModalOpen = true;
        else if (modal === 'welcome') updates.isWelcomeModalOpen = true;
        else if (modal === 'plugin_data') {
          updates.pluginDataModalState = {
            ...state.pluginDataModalState,
            isOpen: true,
          };
        }

        return updates;
      });
    },

    popModal: () => {
      const currentStack = get().modalStack;
      if (currentStack.length === 0) return undefined;
      const nextStack = [...currentStack];
      const popped = nextStack.pop();

      set((state) => {
        const updates: Partial<AppState> = { modalStack: nextStack };

        if (popped === 'settings') updates.isSettingsModalOpen = false;
        else if (popped === 'export') updates.isExportModalOpen = false;
        else if (popped === 'import') updates.isImportModalOpen = false;
        else if (popped === 'export_maps') updates.isExportMapsModalOpen = false;
        else if (popped === 'shortcuts') updates.isShortcutsModalOpen = false;
        else if (popped === 'welcome') updates.isWelcomeModalOpen = false;
        else if (popped === 'plugin_data') {
          updates.pluginDataModalState = {
            ...state.pluginDataModalState,
            isOpen: false,
          };
        }

        return updates;
      });

      return popped;
    },

    closeModal: (modal: ModalType) => {
      set((state) => {
        const nextStack = state.modalStack.filter((m) => m !== modal);
        const updates: Partial<AppState> = { modalStack: nextStack };

        if (modal === 'settings') updates.isSettingsModalOpen = false;
        else if (modal === 'export') updates.isExportModalOpen = false;
        else if (modal === 'import') updates.isImportModalOpen = false;
        else if (modal === 'export_maps') updates.isExportMapsModalOpen = false;
        else if (modal === 'shortcuts') updates.isShortcutsModalOpen = false;
        else if (modal === 'welcome') updates.isWelcomeModalOpen = false;
        else if (modal === 'plugin_data') {
          updates.pluginDataModalState = {
            ...state.pluginDataModalState,
            isOpen: false,
          };
        }

        return updates;
      });
    },

    registerCanvasAbortHandler: (handler: CanvasAbortHandler) => {
      canvasAbortHandlers.add(handler);
      return () => {
        canvasAbortHandlers.delete(handler);
      };
    },

    subscribeModeTransition: (listener: ModeTransitionListener) => {
      transitionListeners.add(listener);
      return () => {
        transitionListeners.delete(listener);
      };
    },

    handleGlobalEscape: () => {
      const state = get();

      // Tier 1: Top Modal in Stack or any open modal
      const isModalActuallyOpen = (modal: ModalType): boolean => {
        const s = get();
        switch (modal) {
          case 'settings': return s.isSettingsModalOpen;
          case 'export': return s.isExportModalOpen;
          case 'import': return s.isImportModalOpen;
          case 'export_maps': return s.isExportMapsModalOpen;
          case 'shortcuts': return s.isShortcutsModalOpen;
          case 'welcome': return s.isWelcomeModalOpen;
          case 'plugin_data': return !!s.pluginDataModalState?.isOpen;
        }
      };

      const activeStack = state.modalStack.filter(isModalActuallyOpen);
      if (activeStack.length !== state.modalStack.length) {
        set({ modalStack: activeStack });
      }

      if (activeStack.length > 0) {
        const top = activeStack[activeStack.length - 1];
        if (top === 'welcome' && state.isInitialLaunch) {
          // Welcome modal cannot be dismissed during initial launch
          return true;
        }
        get().popModal();
        return true;
      }
      if (state.isSettingsModalOpen) {
        get().closeModal('settings');
        return true;
      }
      if (state.isExportModalOpen) {
        get().closeModal('export');
        return true;
      }
      if (state.isImportModalOpen) {
        get().closeModal('import');
        return true;
      }
      if (state.isExportMapsModalOpen) {
        get().closeModal('export_maps');
        return true;
      }
      if (state.isShortcutsModalOpen) {
        get().closeModal('shortcuts');
        return true;
      }
      if (state.isWelcomeModalOpen) {
        if (state.isInitialLaunch) return true;
        get().closeModal('welcome');
        return true;
      }
      if (state.pluginDataModalState?.isOpen) {
        get().closeModal('plugin_data');
        return true;
      }

      // Tier 2: Active input / textarea / select / contentEditable focus
      if (typeof document !== 'undefined' && document.activeElement) {
        const active = document.activeElement as HTMLElement;
        if (
          active &&
          (active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.tagName === 'SELECT' ||
            active.isContentEditable)
        ) {
          active.blur();
          return true;
        }
      }

      // Tier 3: Registered Canvas Transient Gestures (drag, yaw, draw, marquee, etc.)
      if (abortCanvasGestures()) {
        return true;
      }

      // Tier 4: Waypoint Add mode snap input or active constraint
      if (state.appMode.mode === 'waypoint_add') {
        if (state.appMode.snapInput !== '') {
          get().updateAppMode({ snapInput: '' });
          return true;
        }
        if (
          state.appMode.forcedAxis !== null ||
          state.appMode.forcedSign !== null ||
          state.appMode.lockedWaypointId !== null
        ) {
          get().updateAppMode({
            forcedAxis: null,
            forcedSign: null,
            lockedWaypointId: null,
          });
          return true;
        }
      }

      // Tier 5: Mutually Exclusive Selection
      if (state.selection.type !== 'none') {
        get().setSelection({ type: 'none' });
        return true;
      }

      // Tier 6: Non-select Mode Transition
      if (state.appMode.mode !== 'select') {
        get().transitionToMode({ mode: 'select' });
        return true;
      }

      // Tier 7: Idle (no-op)
      return false;
    },
  };
};
