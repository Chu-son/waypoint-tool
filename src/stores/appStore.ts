import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { NodeSlice, createNodeSlice } from './slices/nodeSlice';
import { UISlice, createUISlice } from './slices/uiSlice';
import { PluginSlice, createPluginSlice } from './slices/pluginSlice';
import { MapSlice, createMapSlice } from './slices/mapSlice';
import { ProjectSlice, createProjectSlice } from './slices/projectSlice';
import { HistorySlice, createHistorySlice } from './slices/historySlice';
import { CustomUISlice, createCustomUISlice } from './slices/customUiSlice';
import { WorkflowSlice, createWorkflowSlice } from './slices/workflowSlice';
import { AnnotationSlice, createAnnotationSlice } from './slices/annotationSlice';
import { InteractionSlice, createInteractionSlice } from './slices/interactionSlice';
import { STORAGE_VERSION, migrateStorage } from './migrations/storageMigration';

export type AppState = NodeSlice & UISlice & PluginSlice & MapSlice & ProjectSlice & HistorySlice & CustomUISlice & WorkflowSlice & AnnotationSlice & InteractionSlice;

export const useAppStore = create<AppState>()(
  persist(
    (set, get, api) => ({
      ...createNodeSlice(set, get, api),
      ...createUISlice(set, get, api),
      ...createPluginSlice(set, get, api),
      ...createMapSlice(set, get, api),
      ...createProjectSlice(set, get, api),
      ...createHistorySlice(set, get, api),
      ...createCustomUISlice(set, get, api),
      ...createWorkflowSlice(set, get, api),
      ...createAnnotationSlice(set, get, api),
      ...createInteractionSlice(set, get, api),
    }),
    {
      name: 'waypoint-tool-storage',
      version: STORAGE_VERSION,
      migrate: (persistedState: unknown, version: number) => migrateStorage(persistedState, version),
      partialize: (state) => ({
        defaultMapOpacity: state.defaultMapOpacity,
        lastDirectory: state.lastDirectory,
        recentProjects: state.recentProjects,
        enableSnapping: state.enableSnapping,
        exportTemplates: state.exportTemplates.filter(t => t.scope !== 'local'), // Treat undefined as global by default
        defaultExportFormats: state.defaultExportFormats,
        indexStartIndex: state.indexStartIndex,
        showPaths: state.showPaths,
        showGrid: state.showGrid,
        showFootprints: state.showFootprints,
        pluginSettings: state.pluginSettings,
        globalPythonPath: state.globalPythonPath,
        decimalPrecision: state.decimalPrecision,
        themeMode: state.themeMode,
        themePreset: state.themePreset,
        leftPanelViewMode: state.leftPanelViewMode,
        rightPanelViewMode: state.rightPanelViewMode,
        leftPanelWidth: state.leftPanelWidth,
        rightPanelWidth: state.rightPanelWidth,
        showProperties: state.showProperties,
        mapEditFillValue: state.mapEditFillValue,
        mapEditBrushSize: state.mapEditBrushSize,
        mapEditSubTool: state.mapEditSubTool,
      }),
    }
  )
);

if (typeof window !== 'undefined') {
  (window as any).useAppStore = useAppStore;
}

// Backward-compatible facet selectors
export const selectAppMode = (state: AppState) => state.appMode;
export const selectActiveSelection = (state: AppState) => state.selection;
export const selectActiveTool = (state: AppState) => state.activeTool;
export const selectSelectedNodeIds = (state: AppState) => state.selectedNodeIds;
export const selectIsMapEditMode = (state: AppState) => state.isMapEditMode;
export const selectIsAnnotationEditMode = (state: AppState) => state.isAnnotationEditMode;
