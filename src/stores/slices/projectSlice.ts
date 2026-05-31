import { StateCreator } from 'zustand';
import { AppState, useAppStore } from '../appStore';
import { OptionsSchema, ExportTemplate, DefaultExportFormat, WaypointNode, ProjectMapLayer } from '../../types/store';
import { BackendAPI, DialogAPI } from '../../api';
import { v4 as uuidv4 } from 'uuid';

export type ProjectSlice = {
  lastDirectory: string | null;
  optionsSchema: OptionsSchema | null;
  exportTemplates: ExportTemplate[];
  defaultExportFormats: DefaultExportFormat[];
  globalPythonPath: string;

  setLastDirectory: (dir: string | null) => void;
  setGlobalPythonPath: (path: string) => void;
  setOptionsSchema: (schema: OptionsSchema) => void;
  addExportTemplate: (template: ExportTemplate) => void;
  updateExportTemplate: (id: string, updates: Partial<ExportTemplate>) => void;
  removeExportTemplate: (id: string) => void;
  updateDefaultExportFormat: (id: string, updates: Partial<DefaultExportFormat>) => void;
  setProjectData: (data: { rootNodeIds?: string[], root_node_ids?: string[], nodes?: Record<string, WaypointNode>, mapLayers?: ProjectMapLayer[], map_layers?: ProjectMapLayer[], export_templates?: ExportTemplate[], default_export_formats?: DefaultExportFormat[], index_start_index?: 0 | 1, decimal_precision?: number }) => void;
  
  loadProject: () => Promise<void>;
  saveProject: () => Promise<void>;
  resetProject: () => void;
};

export const createProjectSlice: StateCreator<AppState, [], [], ProjectSlice> = (set, get) => ({
  lastDirectory: null,
  optionsSchema: null,
  exportTemplates: [],
  defaultExportFormats: [
    { id: '__default_yaml__', name: 'YAML Document', extension: 'yaml', suffix: '_yaml', enabled: true },
    { id: '__default_json__', name: 'JSON Document', extension: 'json', suffix: '_json', enabled: true },
  ],
  globalPythonPath: 'python',

  setLastDirectory: (dir: string | null) => set({ lastDirectory: dir }),
  setGlobalPythonPath: (path: string) => set({ globalPythonPath: path, isDirty: true }),
  setOptionsSchema: (schema: OptionsSchema) => set({ optionsSchema: schema, isDirty: true }),
  
  addExportTemplate: (template: ExportTemplate) => set((state) => ({
    exportTemplates: [...state.exportTemplates, template],
    isDirty: true
  })),
  
  updateExportTemplate: (id: string, updates: Partial<ExportTemplate>) => set((state) => ({
    exportTemplates: state.exportTemplates.map(t => t.id === id ? { ...t, ...updates } : t),
    isDirty: true
  })),
  
  removeExportTemplate: (id: string) => set((state) => ({
    exportTemplates: state.exportTemplates.filter(t => t.id !== id),
    isDirty: true
  })),

  updateDefaultExportFormat: (id: string, updates: Partial<DefaultExportFormat>) => set((state) => ({
    defaultExportFormats: state.defaultExportFormats.map((f: DefaultExportFormat) => f.id === id ? { ...f, ...updates } : f),
    isDirty: true
  })),

  setProjectData: (data: any) =>
    set((state) => ({
      rootNodeIds: data.root_node_ids || data.rootNodeIds || [],
      nodes: data.nodes || {},
      selectedNodeIds: [],
      mapLayers: data.map_layers || data.mapLayers || state.mapLayers,
      exportTemplates: data.export_templates || state.exportTemplates,
      defaultExportFormats: data.default_export_formats || state.defaultExportFormats,
      indexStartIndex: data.index_start_index ?? state.indexStartIndex,
      decimalPrecision: data.decimal_precision ?? state.decimalPrecision,
      isDirty: false,
    })),

  resetProject: () => set({
    rootNodeIds: [],
    nodes: {},
    selectedNodeIds: [],
    mapLayers: [],
    isDirty: false
  }),

  loadProject: async () => {
    const { lastDirectory, setLastDirectory, setProjectData, setIsDirty, defaultMapOpacity } = get();
    try {
      const selectedPath = await DialogAPI.open({
        multiple: false,
        defaultPath: lastDirectory || undefined,
        filters: [{ name: "Waypoint Project", extensions: ["wptroj"] }],
      });

      if (selectedPath) {
        const pathStr = typeof selectedPath === "string" ? selectedPath : (selectedPath as any).path;
        if (!pathStr) return;

        const getDirName = (path: string) => {
          const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
          return lastSlash > -1 ? path.substring(0, lastSlash) : path;
        };

        setLastDirectory(getDirName(pathStr));
        const projectData = await BackendAPI.loadProject(pathStr);

        setProjectData({
          nodes: projectData.nodes,
          rootNodeIds: projectData.root_node_ids,
          mapLayers: projectData.map_layers?.map((layer: any) => ({
            id: uuidv4(),
            name: layer.name || "Restored Map",
            info: layer.info || {},
            image_base64: layer.image_base64 || "",
            width: layer.width || 1000,
            height: layer.height || 1000,
            visible: true,
            opacity: defaultMapOpacity,
            z_index: 0
          }))
        });
        setIsDirty(false);
      }
    } catch (err) {
      console.error("Failed to load project:", err);
      alert(`プロジェクトの読み込みに失敗しました。\nエラー詳細: ${String(err)}`);
    }
  },

  saveProject: async () => {
    const { lastDirectory, setLastDirectory, rootNodeIds, nodes, mapLayers, setIsDirty } = get();
    try {
      const savePath = await DialogAPI.save({
        defaultPath: lastDirectory || undefined,
        filters: [{ name: "Waypoint Project", extensions: ["wptroj"] }],
      });

      if (savePath) {
        let finalPath = savePath;
        if (!finalPath.toLowerCase().endsWith(".wptroj")) {
          finalPath += ".wptroj";
        }

        const getDirName = (path: string) => {
          const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
          return lastSlash > -1 ? path.substring(0, lastSlash) : path;
        };

        setLastDirectory(getDirName(finalPath));

        const mapLayersToSave = mapLayers.map((layer) => ({
          id: layer.id,
          name: layer.name,
          info: layer.info,
          image_base64: layer.image_base64,
          width: layer.width,
          height: layer.height,
          visible: layer.visible,
          opacity: layer.opacity,
          z_index: layer.z_index,
        }));

        const projectData = {
          root_node_ids: rootNodeIds,
          nodes,
          map_layers: mapLayersToSave,
        };
        await BackendAPI.saveProject(finalPath, projectData);
        setIsDirty(false);
        alert("プロジェクトを保存しました。");
      }
    } catch (err) {
      console.error("Failed to save project:", err);
      alert(`プロジェクトの保存に失敗しました。\nエラー詳細: ${String(err)}`);
    }
  },
});
