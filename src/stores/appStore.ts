import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { NodeSlice, createNodeSlice } from './slices/nodeSlice';
import { UISlice, createUISlice } from './slices/uiSlice';
import { PluginSlice, createPluginSlice } from './slices/pluginSlice';
import { MapSlice, createMapSlice } from './slices/mapSlice';
import { ProjectSlice, createProjectSlice } from './slices/projectSlice';
import { HistorySlice, createHistorySlice } from './slices/historySlice';

export type AppState = NodeSlice & UISlice & PluginSlice & MapSlice & ProjectSlice & HistorySlice;

export const useAppStore = create<AppState>()(
  persist(
    (set, get, api) => ({
      ...createNodeSlice(set, get, api),
      ...createUISlice(set, get, api),
      ...createPluginSlice(set, get, api),
      ...createMapSlice(set, get, api),
      ...createProjectSlice(set, get, api),
      ...createHistorySlice(set, get, api),
    }),
    {
      name: 'waypoint-tool-storage',
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
