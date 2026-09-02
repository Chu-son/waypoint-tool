import { StateCreator } from 'zustand';
import { AppState } from '../appStore';
import { OptionsSchema, ExportTemplate, DefaultExportFormat, WaypointNode, ProjectMapLayer, CustomLayer, AnnotationObject, AnnotationGroup, RobotFootprint, OccupancySettings, RecentProjectItem } from '../../types/store';
import { BackendAPI, DialogAPI } from '../../api';
import { DEFAULT_PATH_COLOR } from '../../utils/colorPresets';
import { v4 as uuidv4 } from 'uuid';

export const DEFAULT_ROBOT_FOOTPRINT: RobotFootprint = {
  type: 'circular',
  radius: 0.3,
};

export const DEFAULT_OCCUPANCY_SETTINGS: OccupancySettings = {
  defaultOccupiedThresh: 0.65,
  defaultFreeThresh: 0.196,
  defaultNegate: 0,
};

/**
 * Normalizes raw project data from file/JSON into the latest schema.
 * Handles isolated ingress migration from legacy edit_layers / generated_layers to custom_layers.
 */
export function normalizeProjectData(data: any): {
  customLayers: CustomLayer[];
  workflowState: {
    currentStepIndex?: number;
    maxReachedStepIndex?: number;
    workflowVariables?: Record<string, any>;
    stepExecutionIds?: Record<string, string>;
  } | null;
} {
  // --- カスタムUIデータのフォールバック解決 ---
  // 優先順位: custom_ui_data.workflow_state > トップレベル workflow_state > null
  let workflowState = null;
  const customUiData = data.custom_ui_data || data.customUiData;
  const legacyWorkflow = data.workflow_state || data.workflowState;

  if (customUiData?.workflow_state && typeof customUiData.workflow_state === 'object') {
    const ws = customUiData.workflow_state;
    workflowState = {
      currentStepIndex: ws.current_step_index ?? ws.currentStepIndex,
      maxReachedStepIndex: ws.max_reached_step_index ?? ws.maxReachedStepIndex,
      workflowVariables: ws.workflow_variables ?? ws.workflowVariables,
      stepExecutionIds: ws.step_execution_ids ?? ws.stepExecutionIds,
    };
  } else if (legacyWorkflow && typeof legacyWorkflow === 'object') {
    workflowState = {
      currentStepIndex: legacyWorkflow.current_step_index ?? legacyWorkflow.currentStepIndex,
      maxReachedStepIndex: legacyWorkflow.max_reached_step_index ?? legacyWorkflow.maxReachedStepIndex,
      workflowVariables: legacyWorkflow.workflow_variables ?? legacyWorkflow.workflowVariables,
      stepExecutionIds: legacyWorkflow.step_execution_ids ?? legacyWorkflow.stepExecutionIds,
    };
  }

  if (data.custom_layers || data.customLayers) {
    const raw = data.custom_layers || data.customLayers;
    const layers: CustomLayer[] = raw.map((l: any, i: number) => ({
      ...l,
      id: l.id || uuidv4(),
      is_reference: l.is_reference ?? false,
      z_index: typeof l.z_index === 'number' ? l.z_index : i,
      editObjects: l.type === 'manual' ? (l.editObjects || l.edit_objects || []).map((o: any) => ({ ...o, id: o.id || uuidv4() })) : undefined,
    }));
    return { customLayers: layers, workflowState };
  }

  // Legacy ingress migration
  const migrated: CustomLayer[] = [];

  const rawEdit = data.edit_layers || data.editLayers || [];
  rawEdit.forEach((el: any) => {
    migrated.push({
      id: el.id || uuidv4(),
      name: el.name || 'Manual Layer',
      type: 'manual',
      visible: el.visible ?? true,
      opacity: el.opacity ?? 1.0,
      z_index: el.z_index ?? migrated.length,
      blend_mode: el.blend_mode || 'overwrite',
      is_reference: el.is_reference ?? false,
      editObjects: (el.editObjects || el.edit_objects || []).map((obj: any) => ({
        ...obj,
        id: obj.id || uuidv4(),
      })),
    });
  });

  const rawGen = data.generated_layers || data.generatedLayers || [];
  rawGen.forEach((gl: any) => {
    migrated.push({
      id: gl.id || uuidv4(),
      name: gl.name || 'Generated Layer',
      type: 'plugin',
      plugin_id: gl.plugin_id || '',
      params: gl.params || {},
      interaction_data: gl.interaction_data || {},
      image_base64: gl.image_base64 || '',
      info: gl.info || {},
      visible: gl.visible ?? true,
      opacity: gl.opacity ?? 0.7,
      z_index: gl.z_index ?? migrated.length,
      blend_mode: gl.blend_mode || 'overwrite',
      is_reference: gl.is_reference ?? false,
    });
  });

  migrated.sort((a, b) => a.z_index - b.z_index);
  return { customLayers: migrated.map((l, i) => ({ ...l, z_index: i })), workflowState };
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
  setProjectData: (data: {
    rootNodeIds?: string[];
    root_node_ids?: string[];
    nodes?: Record<string, WaypointNode>;
    mapLayers?: ProjectMapLayer[];
    map_layers?: ProjectMapLayer[];
    customLayers?: CustomLayer[];
    custom_layers?: CustomLayer[];
    annotation_objects?: AnnotationObject[];
    annotationObjects?: Record<string, AnnotationObject> | AnnotationObject[];
    annotation_groups?: Record<string, AnnotationGroup>;
    annotationGroups?: Record<string, AnnotationGroup>;
    root_annotation_ids?: string[];
    rootAnnotationIds?: string[];
    edit_layers?: any[];
    generated_layers?: any[];
    export_templates?: ExportTemplate[];
    default_export_formats?: DefaultExportFormat[];
    index_start_index?: 0 | 1;
    decimal_precision?: number;
    options_schema?: OptionsSchema | null;
    export_regions?: any[];
    robot_footprint?: RobotFootprint;
    robotFootprint?: RobotFootprint;
    occupancy_settings?: OccupancySettings;
    occupancySettings?: OccupancySettings;
    active_path_calculator_plugin_id?: string | null;
    activePathCalculatorPluginId?: string | null;
    path_calculator_params?: Record<string, any>;
    pathCalculatorParams?: Record<string, any>;
    auto_recalculate_path?: boolean;
    autoRecalculatePath?: boolean;
    default_map_opacity?: number;
    defaultMapOpacity?: number;
    left_panel_view_mode?: 'tabs' | 'split';
    leftPanelViewMode?: 'tabs' | 'split';
    right_panel_view_mode?: 'tabs' | 'split';
    rightPanelViewMode?: 'tabs' | 'split';
    path_color?: string;
    pathColor?: string;
    path_width?: number;
    pathWidth?: number;
    path_opacity?: number;
    pathOpacity?: number;
    sync_path_width_with_footprint?: boolean;
    syncPathWidthWithFootprint?: boolean;
    workflow_state?: any;
    workflowState?: any;
    custom_ui_data?: any;
    customUiData?: any;
  }) => void;
  
  loadProject: () => Promise<boolean>;
  loadProjectFromPath: (pathStr: string) => Promise<boolean>;
  saveProject: () => Promise<void>;
  saveProjectAs: () => Promise<void>;
  resetProject: () => void;
};

export function buildProjectData(state: AppState) {
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
    // カスタムUIアディショナル領域（ネスト構造）
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
  defaultExportFormats: [
    { id: '__default_yaml__', name: 'YAML Document', extension: 'yaml', suffix: '_yaml', enabled: true },
    { id: '__default_json__', name: 'JSON Document', extension: 'json', suffix: '_json', enabled: true },
  ],
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

  setProjectData: (data: any) =>
    set((state) => {
      // Merge global export templates with loaded local ones
      const globalTemplates = state.exportTemplates.filter(t => t.scope !== 'local');
      const localTemplates = (data.export_templates || []).map((t: any) => ({ ...t, scope: 'local' }));
      
      // プロジェクト境界を跨いだUndo/Redoを防ぐため履歴をクリア
      state.clearHistory();

      const { customLayers, workflowState: normalizedWorkflow } = normalizeProjectData(data);

      const rawAnnotations: AnnotationObject[] = data.annotation_objects || data.annotationObjects || [];
      const annotationMap: Record<string, AnnotationObject> = {};
      const annotationOrder: string[] = [];
      rawAnnotations.forEach((obj: AnnotationObject) => {
        if (obj && obj.id) {
          annotationMap[obj.id] = obj;
          annotationOrder.push(obj.id);
        }
      });

      const annotationGroups: Record<string, AnnotationGroup> = data.annotation_groups || data.annotationGroups || {};
      const rootAnnotationIds: string[] = data.root_annotation_ids || data.rootAnnotationIds || (
        Object.keys(annotationGroups).length > 0
          ? [
              ...Object.keys(annotationGroups),
              ...rawAnnotations.filter(a => !a.group_id).map(a => a.id)
            ]
          : annotationOrder
      );

      // Restore workflow state (resolved centrally in normalizeProjectData)
      if (normalizedWorkflow) {
        state.setWorkflowState(normalizedWorkflow);
      }

      const customUiLayout = state.isCustomUiMode && state.customUiConfig ? state.customUiConfig.layout : null;
      const effectiveLeftViewMode = customUiLayout?.leftPanel?.viewMode ?? (data.left_panel_view_mode || data.leftPanelViewMode || state.leftPanelViewMode);
      const effectiveRightViewMode = customUiLayout?.rightPanel?.viewMode ?? (data.right_panel_view_mode || data.rightPanelViewMode || state.rightPanelViewMode);

      return {
        rootNodeIds: data.root_node_ids || data.rootNodeIds || [],
        nodes: data.nodes || {},
        selectedNodeIds: [],
        mapLayers: data.map_layers || data.mapLayers || state.mapLayers,
        customLayers,
        activeCustomLayerId: null,
        annotationObjects: annotationMap,
        annotationGroups,
        rootAnnotationIds,
        annotationOrder: annotationOrder,
        selectedAnnotationIds: [],
        isAnnotationEditMode: false,
        exportTemplates: [...globalTemplates, ...localTemplates],
        exportRegions: data.export_regions || [],
        optionsSchema: data.options_schema || null,
        robotFootprint: data.robot_footprint || data.robotFootprint || DEFAULT_ROBOT_FOOTPRINT,
        occupancySettings: data.occupancy_settings || data.occupancySettings || DEFAULT_OCCUPANCY_SETTINGS,
        defaultMapOpacity: typeof data.default_map_opacity === 'number' ? data.default_map_opacity : (typeof data.defaultMapOpacity === 'number' ? data.defaultMapOpacity : state.defaultMapOpacity),
        leftPanelViewMode: effectiveLeftViewMode,
        rightPanelViewMode: effectiveRightViewMode,
        activePathCalculatorPluginId: data.active_path_calculator_plugin_id || data.activePathCalculatorPluginId || null,
        pathCalculatorParams: data.path_calculator_params || data.pathCalculatorParams || {},
        autoRecalculatePath: data.auto_recalculate_path ?? data.autoRecalculatePath ?? true,
        pathColor: data.path_color || data.pathColor || DEFAULT_PATH_COLOR,
        pathWidth: data.path_width ?? data.pathWidth ?? 0.1,
        pathOpacity: data.path_opacity ?? data.pathOpacity ?? 0.7,
        syncPathWidthWithFootprint: data.sync_path_width_with_footprint ?? data.syncPathWidthWithFootprint ?? false,
        defaultExportFormats: data.default_export_formats || state.defaultExportFormats,
        indexStartIndex: data.index_start_index ?? state.indexStartIndex,
        decimalPrecision: data.decimal_precision ?? state.decimalPrecision,
        isDirty: false,
      };
    }),

  resetProject: () => set((state) => {
    // プロジェクト境界を跨いだUndo/Redoを防ぐため履歴をクリア
    state.clearHistory();

    return {
      rootNodeIds: [],
      nodes: {},
      selectedNodeIds: [],
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
      pathColor: DEFAULT_PATH_COLOR,
      pathWidth: 0.1,
      pathOpacity: 0.7,
      syncPathWidthWithFootprint: false,
      exportRegions: [],
      optionsSchema: null,
      robotFootprint: DEFAULT_ROBOT_FOOTPRINT,
      occupancySettings: DEFAULT_OCCUPANCY_SETTINGS,
      leftPanelViewMode: 'tabs',
      rightPanelViewMode: 'tabs',
      exportTemplates: state.exportTemplates.filter(t => t.scope !== 'local'),
      currentProjectPath: null,
      isDirty: false
    };
  }),

  loadProjectFromPath: async (pathStr: string): Promise<boolean> => {
    const { setLastDirectory, setProjectData, setIsDirty, defaultMapOpacity, recalculatePath, addRecentProject, runWithLoading } = get();
    try {
      const getDirName = (path: string) => {
        const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
        return lastSlash > -1 ? path.substring(0, lastSlash) : path;
      };

      setLastDirectory(getDirName(pathStr));
      const fileName = pathStr.split('/').pop() || pathStr;

      return await runWithLoading(
        {
          message: "プロジェクトを読み込み中...",
          detail: fileName,
          blocking: true,
        },
        async () => {
          const projectData: any = await BackendAPI.loadProject(pathStr);

          setProjectData({
            nodes: projectData.nodes,
            rootNodeIds: projectData.root_node_ids,
            mapLayers: projectData.map_layers?.map((layer: any) => ({
              id: layer.id || uuidv4(),
              name: layer.name || "Restored Map",
              info: layer.info || {},
              image_base64: layer.image_base64 || "",
              width: layer.width || 1000,
              height: layer.height || 1000,
              visible: typeof layer.visible === 'boolean' ? layer.visible : true,
              opacity: typeof layer.opacity === 'number' ? layer.opacity : (projectData.default_map_opacity ?? defaultMapOpacity),
              z_index: typeof layer.z_index === 'number' ? layer.z_index : 0,
              blend_mode: layer.blend_mode || 'overwrite'
            })),
            custom_layers: projectData.custom_layers,
            annotation_objects: projectData.annotation_objects,
            annotation_groups: projectData.annotation_groups,
            root_annotation_ids: projectData.root_annotation_ids,
            generated_layers: projectData.generated_layers,
            edit_layers: projectData.edit_layers,
            export_regions: projectData.export_regions,
            options_schema: projectData.options_schema,
            export_templates: projectData.export_templates,
            default_export_formats: projectData.default_export_formats,
            robot_footprint: projectData.robot_footprint,
            occupancy_settings: projectData.occupancy_settings,
            default_map_opacity: projectData.default_map_opacity,
            left_panel_view_mode: projectData.left_panel_view_mode,
            right_panel_view_mode: projectData.right_panel_view_mode,
            active_path_calculator_plugin_id: projectData.active_path_calculator_plugin_id,
            path_calculator_params: projectData.path_calculator_params,
            auto_recalculate_path: projectData.auto_recalculate_path,
            path_color: projectData.path_color,
            path_width: projectData.path_width,
            path_opacity: projectData.path_opacity,
            sync_path_width_with_footprint: projectData.sync_path_width_with_footprint,
            workflow_state: projectData.workflow_state,
            custom_ui_data: projectData.custom_ui_data,
          });
          set({ currentProjectPath: pathStr });
          setIsDirty(false);
          addRecentProject(pathStr);

          // Recalculate path if active plugin was loaded
          if (projectData.active_path_calculator_plugin_id) {
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
