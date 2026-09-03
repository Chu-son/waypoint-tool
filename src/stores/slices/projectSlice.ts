import { StateCreator } from 'zustand';
import { AppState } from '../appStore';
import { OptionsSchema, ExportTemplate, DefaultExportFormat, AnnotationObject, RobotFootprint, OccupancySettings, RecentProjectItem, StrictProjectData } from '../../types/store';
import { BackendAPI, DialogAPI } from '../../api';
import { DEFAULT_PATH_COLOR } from '../../utils/colorPresets';
import {
  DEFAULT_ROBOT_FOOTPRINT,
  DEFAULT_OCCUPANCY_SETTINGS,
  DEFAULT_MAP_OPACITY,
  DEFAULT_EXPORT_FORMATS,
  migrateAndNormalizeProjectData,
} from '../migrations/projectMigration';

export {
  DEFAULT_ROBOT_FOOTPRINT,
  DEFAULT_OCCUPANCY_SETTINGS,
  DEFAULT_MAP_OPACITY,
  DEFAULT_EXPORT_FORMATS,
};

/**
 * 既存テスト（customLayersReference.test.ts, generatedLayersAndPath.test.ts）のための後方互換ラッパー
 */
export function normalizeProjectData(data: any) {
  const normalized = migrateAndNormalizeProjectData(data);
  return {
    customLayers: normalized.custom_layers,
    workflowState: normalized.custom_ui_data?.workflow_state
      ? {
          currentStepIndex: normalized.custom_ui_data.workflow_state.current_step_index,
          maxReachedStepIndex: normalized.custom_ui_data.workflow_state.max_reached_step_index,
          workflowVariables: normalized.custom_ui_data.workflow_state.workflow_variables,
          stepExecutionIds: normalized.custom_ui_data.workflow_state.step_execution_ids,
        }
      : null,
  };
}

export type ProjectSlice = {
  lastDirectory: string | null;
  recentProjects: RecentProjectItem[];
  optionsSchema: OptionsSchema | null;
  exportTemplates: ExportTemplate[];
  defaultExportFormats: DefaultExportFormat[];
  globalPythonPath: string;
  robotFootprint: RobotFootprint;
  occupancySettings: OccupancySettings;
  pathColor: string;
  pathWidth: number;
  pathOpacity: number;
  syncPathWidthWithFootprint: boolean;

  currentProjectPath: string | null;
  setCurrentProjectPath: (path: string | null) => void;
  setLastDirectory: (dir: string | null) => void;
  addRecentProject: (pathStr: string) => void;
  setGlobalPythonPath: (path: string) => void;
  setOptionsSchema: (schema: OptionsSchema) => void;
  setRobotFootprint: (footprint: RobotFootprint) => void;
  setOccupancySettings: (settings: OccupancySettings) => void;
  updateOccupancySettings: (updates: Partial<OccupancySettings>) => void;
  setPathColor: (color: string) => void;
  setPathWidth: (width: number) => void;
  setPathOpacity: (opacity: number) => void;
  setSyncPathWidthWithFootprint: (sync: boolean) => void;
  addExportTemplate: (template: ExportTemplate) => void;
  updateExportTemplate: (id: string, updates: Partial<ExportTemplate>) => void;
  removeExportTemplate: (id: string) => void;
  updateDefaultExportFormat: (id: string, updates: Partial<DefaultExportFormat>) => void;
  setProjectData: (data: any) => void;
  
  loadProject: () => Promise<boolean>;
  loadProjectFromPath: (pathStr: string) => Promise<boolean>;
  saveProject: () => Promise<void>;
  saveProjectAs: () => Promise<void>;
  resetProject: () => void;
};

export function buildProjectData(state: AppState): StrictProjectData {
  const mapLayersToSave = state.mapLayers.map((layer) => ({
    id: layer.id,
    name: layer.name,
    info: layer.info,
    image_base64: layer.image_base64,
    width: layer.width,
    height: layer.height,
    visible: layer.visible,
    opacity: layer.opacity,
    z_index: layer.z_index,
    blend_mode: layer.blend_mode,
  }));

  const annotationObjectsToSave = Object.values(state.annotationObjects || {});

  return {
    version: 1,
    root_node_ids: state.rootNodeIds,
    nodes: state.nodes,
    map_layers: mapLayersToSave,
    custom_layers: state.customLayers,
    annotation_objects: annotationObjectsToSave,
    annotation_groups: state.annotationGroups || {},
    root_annotation_ids: state.rootAnnotationIds || [],
    export_regions: state.exportRegions,
    options_schema: state.optionsSchema,
    export_templates: state.exportTemplates.filter((t: ExportTemplate) => t.scope === 'local'),
    default_export_formats: state.defaultExportFormats,
    robot_footprint: state.robotFootprint,
    occupancy_settings: state.occupancySettings,
    default_map_opacity: state.defaultMapOpacity,
    left_panel_view_mode: state.leftPanelViewMode,
    right_panel_view_mode: state.rightPanelViewMode,
    active_path_calculator_plugin_id: state.activePathCalculatorPluginId,
    path_calculator_params: state.pathCalculatorParams,
    auto_recalculate_path: state.autoRecalculatePath,
    path_color: state.pathColor,
    path_width: state.pathWidth,
    path_opacity: state.pathOpacity,
    sync_path_width_with_footprint: state.syncPathWidthWithFootprint,
    index_start_index: state.indexStartIndex,
    decimal_precision: state.decimalPrecision,
    custom_ui_data: {
      workflow_state: {
        current_step_index: state.currentStepIndex,
        max_reached_step_index: state.maxReachedStepIndex,
        workflow_variables: state.workflowVariables,
        step_execution_ids: state.stepExecutionIds,
      },
    },
  };
}

export const createProjectSlice: StateCreator<AppState, [], [], ProjectSlice> = (set, get) => {
  const executeSaveProject = async (finalPath: string) => {
    const getDirName = (path: string) => {
      const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
      return lastSlash > -1 ? path.substring(0, lastSlash) : path;
    };

    const { setLastDirectory, setIsDirty, addRecentProject } = get();
    setLastDirectory(getDirName(finalPath));

    const projectData = buildProjectData(get());
    await BackendAPI.saveProject(finalPath, projectData);
    setIsDirty(false);
    addRecentProject(finalPath);
    set({ currentProjectPath: finalPath });
    alert("プロジェクトを保存しました。");
  };

  return {
  lastDirectory: null,
  recentProjects: [],
  optionsSchema: null,
  exportTemplates: [],
  defaultExportFormats: DEFAULT_EXPORT_FORMATS,
  globalPythonPath: 'python',
  robotFootprint: DEFAULT_ROBOT_FOOTPRINT,
  occupancySettings: DEFAULT_OCCUPANCY_SETTINGS,
  pathColor: DEFAULT_PATH_COLOR,
  pathWidth: 0.1,
  pathOpacity: 0.7,
  syncPathWidthWithFootprint: false,
  currentProjectPath: null,

  setCurrentProjectPath: (path: string | null) => set({ currentProjectPath: path }),
  setLastDirectory: (dir: string | null) => set({ lastDirectory: dir }),
  addRecentProject: (pathStr: string) => set((state) => {
    const normalizedPath = pathStr.trim();
    if (!normalizedPath) return state;
    const fileName = normalizedPath.split(/[/\\]/).pop() || normalizedPath;
    const name = fileName.replace(/\.wptroj$/i, '');
    const filtered = state.recentProjects.filter((p) => p.path !== normalizedPath);
    const updated: RecentProjectItem = {
      path: normalizedPath,
      name,
      lastOpened: Date.now(),
    };
    return {
      recentProjects: [updated, ...filtered].slice(0, 10),
    };
  }),
  setGlobalPythonPath: (path: string) => set({ globalPythonPath: path, isDirty: true }),
  setOptionsSchema: (schema: OptionsSchema) => set({ optionsSchema: schema, isDirty: true }),
  setRobotFootprint: (footprint: RobotFootprint) => set({ robotFootprint: footprint, isDirty: true }),
  setOccupancySettings: (settings: OccupancySettings) => set({ occupancySettings: settings, isDirty: true }),
  updateOccupancySettings: (updates: Partial<OccupancySettings>) => set((state) => ({
    occupancySettings: { ...state.occupancySettings, ...updates },
    isDirty: true
  })),
  setPathColor: (color: string) => set({ pathColor: color, isDirty: true }),
  setPathWidth: (width: number) => set({ pathWidth: width, isDirty: true }),
  setPathOpacity: (opacity: number) => set({ pathOpacity: opacity, isDirty: true }),
  setSyncPathWidthWithFootprint: (sync: boolean) => set({ syncPathWidthWithFootprint: sync, isDirty: true }),
  
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

  setProjectData: (rawData: any) =>
    set((state) => {
      // プロジェクト境界を跨いだUndo/Redoを防ぐため履歴をクリア
      state.clearHistory();
      state.resetWorkflow();

      const data = migrateAndNormalizeProjectData(rawData);

      const annotationMap: Record<string, AnnotationObject> = {};
      data.annotation_objects.forEach((obj) => {
        if (obj?.id) annotationMap[obj.id] = obj;
      });

      if (data.custom_ui_data?.workflow_state) {
        state.setWorkflowState({
          currentStepIndex: data.custom_ui_data.workflow_state.current_step_index,
          maxReachedStepIndex: data.custom_ui_data.workflow_state.max_reached_step_index,
          workflowVariables: data.custom_ui_data.workflow_state.workflow_variables,
          stepExecutionIds: data.custom_ui_data.workflow_state.step_execution_ids,
        });
      }

      const globalTemplates = state.exportTemplates.filter((t) => t.scope !== 'local');
      const localTemplates = data.export_templates.map((t: any) => ({ ...t, scope: 'local' }));

      const customUiLayout = state.isCustomUiMode && state.customUiConfig ? state.customUiConfig.layout : null;
      const effectiveLeftViewMode = customUiLayout?.leftPanel?.viewMode ?? data.left_panel_view_mode;
      const effectiveRightViewMode = customUiLayout?.rightPanel?.viewMode ?? data.right_panel_view_mode;

      return {
        rootNodeIds: data.root_node_ids,
        nodes: data.nodes,
        selectedNodeIds: [],
        insertionTarget: null,
        mapLayers: data.map_layers,
        customLayers: data.custom_layers,
        activeCustomLayerId: null,
        annotationObjects: annotationMap,
        annotationGroups: data.annotation_groups,
        rootAnnotationIds: data.root_annotation_ids,
        annotationOrder: data.annotation_objects.map((a) => a.id),
        selectedAnnotationIds: [],
        isAnnotationEditMode: false,
        exportTemplates: [...globalTemplates, ...localTemplates],
        exportRegions: data.export_regions,
        optionsSchema: data.options_schema,
        robotFootprint: data.robot_footprint,
        occupancySettings: data.occupancy_settings,
        defaultMapOpacity: data.default_map_opacity,
        leftPanelViewMode: effectiveLeftViewMode,
        rightPanelViewMode: effectiveRightViewMode,
        activePathCalculatorPluginId: data.active_path_calculator_plugin_id,
        pathCalculatorParams: data.path_calculator_params,
        autoRecalculatePath: data.auto_recalculate_path,
        pathColor: data.path_color,
        pathWidth: data.path_width,
        pathOpacity: data.path_opacity,
        syncPathWidthWithFootprint: data.sync_path_width_with_footprint,
        defaultExportFormats: data.default_export_formats,
        indexStartIndex: data.index_start_index,
        decimalPrecision: data.decimal_precision,
        isDirty: false,
      };
    }),

  resetProject: () => {
    get().resetWorkflow();
    set((state) => {
      // プロジェクト境界を跨いだUndo/Redoを防ぐため履歴をクリア
      state.clearHistory();

      return {
        rootNodeIds: [],
        nodes: {},
        selectedNodeIds: [],
        insertionTarget: null,
        mapLayers: [],
        customLayers: [],
        activeCustomLayerId: null,
        annotationObjects: {},
        annotationGroups: {},
        rootAnnotationIds: [],
        annotationOrder: [],
        selectedAnnotationIds: [],
        isAnnotationEditMode: false,
        activePathCalculatorPluginId: null,
        pathCalculatorParams: {},
        calculatedPathSegments: null,
        autoRecalculatePath: true,
        pathColor: DEFAULT_PATH_COLOR,
        pathWidth: 0.1,
        pathOpacity: 0.7,
        syncPathWidthWithFootprint: false,
        exportRegions: [],
        optionsSchema: null,
        robotFootprint: DEFAULT_ROBOT_FOOTPRINT,
        occupancySettings: DEFAULT_OCCUPANCY_SETTINGS,
        defaultMapOpacity: DEFAULT_MAP_OPACITY,
        defaultExportFormats: DEFAULT_EXPORT_FORMATS,
        indexStartIndex: 0,
        decimalPrecision: 6,
        leftPanelViewMode: 'tabs',
        rightPanelViewMode: 'tabs',
        exportTemplates: state.exportTemplates.filter(t => t.scope !== 'local'),
        currentProjectPath: null,
        isDirty: false
      };
    });
  },

  loadProjectFromPath: async (pathStr: string): Promise<boolean> => {
    const { setLastDirectory, setProjectData, setIsDirty, recalculatePath, addRecentProject, runWithLoading } = get();
    try {
      const getDirName = (path: string) => {
        const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
        return lastSlash > -1 ? path.substring(0, lastSlash) : path;
      };

      setLastDirectory(getDirName(pathStr));
      const fileName = pathStr.split(/[/\\]/).pop() || pathStr;

      return await runWithLoading(
        {
          message: "プロジェクトを読み込み中...",
          detail: fileName,
          blocking: true,
        },
        async () => {
          const rawProjectData = await BackendAPI.loadProject(pathStr);
          setProjectData(rawProjectData);

          set({ currentProjectPath: pathStr });
          setIsDirty(false);
          addRecentProject(pathStr);

          if (get().activePathCalculatorPluginId) {
            recalculatePath();
          }
          return true;
        }
      );
    } catch (err) {
      console.error("Failed to load project:", err);
      alert(`プロジェクトの読み込みに失敗しました。\nエラー詳細: ${String(err)}`);
      return false;
    }
  },

  loadProject: async (): Promise<boolean> => {
    const { lastDirectory, loadProjectFromPath } = get();
    try {
      const selectedPath = await DialogAPI.open({
        multiple: false,
        defaultPath: lastDirectory || undefined,
        filters: [{ name: "Waypoint Project", extensions: ["wptroj"] }],
      });

      if (selectedPath) {
        const pathStr = typeof selectedPath === "string" ? selectedPath : (selectedPath as any).path;
        if (!pathStr) return false;
        return await loadProjectFromPath(pathStr);
      }
      return false;
    } catch (err) {
      console.error("Failed to open project dialog:", err);
      alert(`プロジェクト選択ダイアログの起動に失敗しました。\nエラー詳細: ${String(err)}`);
      return false;
    }
  },

  saveProjectAs: async () => {
    const { lastDirectory } = get();
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
        await executeSaveProject(finalPath);
      }
    } catch (err) {
      console.error("Failed to save project as:", err);
      alert(`プロジェクトの保存に失敗しました。\nエラー詳細: ${String(err)}`);
    }
  },

  saveProject: async () => {
    const { currentProjectPath, saveProjectAs } = get();
    try {
      if (!currentProjectPath) {
        await saveProjectAs();
        return;
      }

      const confirmed = await DialogAPI.ask(
        `現在のプロジェクトを上書き保存しますか？\n保存先: ${currentProjectPath}`,
        {
          title: "上書き保存の確認",
          kind: "info",
        }
      );

      if (!confirmed) {
        return;
      }

      await executeSaveProject(currentProjectPath);
    } catch (err) {
      console.error("Failed to overwrite save project:", err);
      alert(`プロジェクトの上書き保存に失敗しました。\nエラー詳細: ${String(err)}`);
    }
  },
  };
};
