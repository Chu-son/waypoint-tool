import { StateCreator } from 'zustand';
import { AppState } from '../appStore';

export type ElementCopyField = 'x' | 'y' | 'z' | 'yaw';
export type ElementCopyCoordSystem = 'world' | 'anchor';

export type ElementCopyState = {
  field: ElementCopyField;
  value: number;
  coordSystem: ElementCopyCoordSystem;
  previewNodeId: string | null;
} | null;

export type UISlice = {
  activeTool: 'select' | 'add_point' | 'add_generator' | 'add_rect_sweep' | 'add_export_region';
  isSidebarOpen: boolean;
  mouseCenteredZoom: boolean;
  visibleAttributes: string[];
  indexStartIndex: 0 | 1;
  isDirty: boolean;
  decimalPrecision: number;
  elementCopyState: ElementCopyState;
  setElementCopyState: (state: ElementCopyState) => void;
  clearElementCopyState: () => void;
  
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
  settingsModalTab: 'general' | 'options' | 'robot' | 'export' | 'plugins';

  // Map Edit UI State
  isMapEditMode: boolean;
  mapEditSubTool: 'rect' | 'circle' | 'freehand';
  mapEditFillValue: number;
  mapEditBrushSize: number;
  activeEditLayerId: string | null;
  activeMapLayerId: string | null;
  selectedEditObjectId: string | null;

  setMapEditMode: (enabled: boolean) => void;
  setMapEditSubTool: (tool: 'rect' | 'circle' | 'freehand') => void;
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
  
  // Note: setDirty is mapped to setIsDirty in original store
  setDirty: (dirty: boolean) => void;
};

export const createUISlice: StateCreator<AppState, [], [], UISlice> = (set) => ({
  activeTool: 'select',
  isSidebarOpen: true,
  mouseCenteredZoom: true,
  visibleAttributes: [],
  indexStartIndex: 0,
  isDirty: false,
  decimalPrecision: 6,
  elementCopyState: null,

  setElementCopyState: (state: ElementCopyState) => set({ elementCopyState: state }),
  clearElementCopyState: () => set({ elementCopyState: null }),

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

  isMapEditMode: false,
  mapEditSubTool: 'rect',
  mapEditFillValue: 0,
  mapEditBrushSize: 10,
  activeEditLayerId: null,
  activeMapLayerId: null,
  selectedEditObjectId: null,

  setMapEditMode: (enabled) => set({ isMapEditMode: enabled }),
  setMapEditSubTool: (tool) => set({ mapEditSubTool: tool }),
  setMapEditFillValue: (value) => set({ mapEditFillValue: value }),
  setMapEditBrushSize: (size) => set({ mapEditBrushSize: size }),
  setActiveEditLayerId: (id) => set({ activeEditLayerId: id }),
  setActiveMapLayerId: (id) => set({ activeMapLayerId: id }),
  setSelectedEditObjectId: (id) => set({ selectedEditObjectId: id }),

  setDirty: (dirty: boolean) => set({ isDirty: dirty }),
  setIsDirty: (dirty: boolean) => set({ isDirty: dirty }),

  setActiveTool: (tool: AppState['activeTool']) => set(() => {
    const updates: Partial<AppState> = { activeTool: tool };
    if (tool === 'add_generator') {
      updates.rightPanelActiveTab = 'inspector';
    }
    return updates;
  }),

  toggleAttributeVisibility: (attr: string) => set((state) => {
    const next = state.visibleAttributes.includes(attr) 
      ? state.visibleAttributes.filter(a => a !== attr)
      : [...state.visibleAttributes, attr];
    return { visibleAttributes: next, isDirty: true };
  }),

  setIndexStartIndex: (index: 0 | 1) => set({ indexStartIndex: index, isDirty: true }),

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

  setSettingsModalOpen: (open, tab) => set((state) => ({
    isSettingsModalOpen: open,
    settingsModalTab: tab || state.settingsModalTab
  })),
  setExportModalOpen: (open) => set({ isExportModalOpen: open }),
  setImportModalOpen: (open) => set({ isImportModalOpen: open }),
  setExportMapsModalOpen: (open) => set({ isExportMapsModalOpen: open }),
  setShortcutsModalOpen: (open) => set({ isShortcutsModalOpen: open }),
});
