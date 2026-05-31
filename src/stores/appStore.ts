import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { NodeSlice, createNodeSlice } from './slices/nodeSlice';
import { UISlice, createUISlice } from './slices/uiSlice';
import { PluginSlice, createPluginSlice } from './slices/pluginSlice';
import { MapSlice, createMapSlice } from './slices/mapSlice';
import { ProjectSlice, createProjectSlice } from './slices/projectSlice';

export type AppState = NodeSlice & UISlice & PluginSlice & MapSlice & ProjectSlice;

export const useAppStore = create<AppState>()(
  persist(
    (set, get, api) => ({
      ...createNodeSlice(set, get, api),
      ...createUISlice(set, get, api),
      ...createPluginSlice(set, get, api),
      ...createMapSlice(set, get, api),
      ...createProjectSlice(set, get, api),
    }),
    {
      name: 'waypoint-tool-storage',
      partialize: (state) => ({
        defaultMapOpacity: state.defaultMapOpacity,
        lastDirectory: state.lastDirectory,
        enableSnapping: state.enableSnapping,
        optionsSchema: state.optionsSchema,
        exportTemplates: state.exportTemplates,
        defaultExportFormats: state.defaultExportFormats,
        indexStartIndex: state.indexStartIndex,
        showPaths: state.showPaths,
        showGrid: state.showGrid,
        pluginSettings: state.pluginSettings,
        toolPanelMaxColumns: state.toolPanelMaxColumns,
        globalPythonPath: state.globalPythonPath,
        decimalPrecision: state.decimalPrecision,
        leftPanelViewMode: state.leftPanelViewMode,
        rightPanelViewMode: state.rightPanelViewMode,
        leftPanelWidth: state.leftPanelWidth,
        rightPanelWidth: state.rightPanelWidth,
        showProperties: state.showProperties,
      }),
    }
  )
);
