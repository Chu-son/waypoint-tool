import { StateCreator } from 'zustand';
import type { AppState } from '../appStore';
import {
  OptionsSchema,
  ExportTemplate,
  DefaultExportFormat,
  AnnotationObject,
  RobotFootprint,
  OccupancySettings,
  RecentProjectItem,
  ConditionalStyleRule,
  ExportProfile,
} from '../../types/store';
import { BackendAPI, DialogAPI } from '../../api';
import { DEFAULT_PATH_COLOR } from '../../utils/colorPresets';
import { v4 as uuidv4 } from 'uuid';
import {
  DEFAULT_ROBOT_FOOTPRINT,
  DEFAULT_OCCUPANCY_SETTINGS,
  DEFAULT_MAP_OPACITY,
  DEFAULT_EXPORT_FORMATS,
  DEFAULT_EXPORT_PROFILES,
  DEFAULT_ACTIVE_EXPORT_PROFILE_ID,
  DEFAULT_CONDITIONAL_STYLES,
  DEFAULT_CONDITIONAL_STYLES_ENABLED,
  migrateAndNormalizeProjectData,
} from '../migrations/projectMigration';
import { DEFAULT_GEO_MAP } from '../migrations/geoMapNormalization';
import { notify, notifyError } from '../../services/notify';
import { buildProjectData } from '../serialization/projectSerializer';

export {
  DEFAULT_ROBOT_FOOTPRINT,
  DEFAULT_OCCUPANCY_SETTINGS,
  DEFAULT_MAP_OPACITY,
  DEFAULT_EXPORT_FORMATS,
  DEFAULT_EXPORT_PROFILES,
  DEFAULT_ACTIVE_EXPORT_PROFILE_ID,
  DEFAULT_CONDITIONAL_STYLES,
  DEFAULT_CONDITIONAL_STYLES_ENABLED,
};

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
  conditionalStyles: ConditionalStyleRule[];
  conditionalStylesEnabled: boolean;

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
  setConditionalStyles: (rules: ConditionalStyleRule[]) => void;
  setConditionalStylesEnabled: (enabled: boolean) => void;
  addConditionalStyleRule: (rule: ConditionalStyleRule) => void;
  updateConditionalStyleRule: (id: string, updates: Partial<ConditionalStyleRule>) => void;
  removeConditionalStyleRule: (id: string) => void;
  reorderConditionalStyleRules: (startIndex: number, endIndex: number) => void;
  addExportTemplate: (template: ExportTemplate) => void;
  updateExportTemplate: (id: string, updates: Partial<ExportTemplate>) => void;
  removeExportTemplate: (id: string) => void;
  updateDefaultExportFormat: (id: string, updates: Partial<DefaultExportFormat>) => void;
  exportProfiles: ExportProfile[];
  activeExportProfileId: string | null;
  addExportProfile: (profile: ExportProfile) => void;
  updateExportProfile: (id: string, updates: Partial<ExportProfile>) => void;
  removeExportProfile: (id: string) => void;
  setActiveExportProfileId: (id: string | null) => void;
  duplicateExportProfile: (id: string) => void;
  replaceExportProfiles: (profiles: ExportProfile[], activeId: string | null) => void;
  setProjectData: (data: any) => void;

  loadProject: () => Promise<boolean>;
  loadProjectFromPath: (pathStr: string) => Promise<boolean>;
  saveProject: () => Promise<void>;
  saveProjectAs: () => Promise<void>;
  resetProject: () => void;
};

export const createProjectSlice: StateCreator<AppState, [], [], ProjectSlice> = (set, get) => {
  const executeSaveProject = async (finalPath: string) => {
    const getDirName = (path: string) => {
      const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
      return lastSlash > -1 ? path.substring(0, lastSlash) : path;
    };

    const { setLastDirectory, setIsDirty, addRecentProject } = get();
    setLastDirectory(getDirName(finalPath));

    const projectData = buildProjectData(get());
    await BackendAPI.saveProject(finalPath, projectData);
    setIsDirty(false);
    addRecentProject(finalPath);
    set({ currentProjectPath: finalPath });
    void notify('プロジェクトを保存しました。');
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
    conditionalStyles: DEFAULT_CONDITIONAL_STYLES,
    conditionalStylesEnabled: DEFAULT_CONDITIONAL_STYLES_ENABLED,
    exportProfiles: DEFAULT_EXPORT_PROFILES,
    activeExportProfileId: DEFAULT_ACTIVE_EXPORT_PROFILE_ID,
    currentProjectPath: null,

    setCurrentProjectPath: (path: string | null) => set({ currentProjectPath: path }),
    setLastDirectory: (dir: string | null) => set({ lastDirectory: dir }),
    addRecentProject: (pathStr: string) =>
      set((state) => {
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
    updateOccupancySettings: (updates: Partial<OccupancySettings>) =>
      set((state) => ({
        occupancySettings: { ...state.occupancySettings, ...updates },
        isDirty: true,
      })),
    setPathColor: (color: string) => set({ pathColor: color, isDirty: true }),
    setPathWidth: (width: number) => set({ pathWidth: width, isDirty: true }),
    setPathOpacity: (opacity: number) => set({ pathOpacity: opacity, isDirty: true }),
    setSyncPathWidthWithFootprint: (sync: boolean) => set({ syncPathWidthWithFootprint: sync, isDirty: true }),
    setConditionalStyles: (rules: ConditionalStyleRule[]) => set({ conditionalStyles: rules, isDirty: true }),
    setConditionalStylesEnabled: (enabled: boolean) => set({ conditionalStylesEnabled: enabled, isDirty: true }),
    addConditionalStyleRule: (rule: ConditionalStyleRule) =>
      set((state) => ({
        conditionalStyles: [...state.conditionalStyles, rule],
        isDirty: true,
      })),
    updateConditionalStyleRule: (id: string, updates: Partial<ConditionalStyleRule>) =>
      set((state) => ({
        conditionalStyles: state.conditionalStyles.map((r) => (r.id === id ? { ...r, ...updates } : r)),
        isDirty: true,
      })),
    removeConditionalStyleRule: (id: string) =>
      set((state) => ({
        conditionalStyles: state.conditionalStyles.filter((r) => r.id !== id),
        isDirty: true,
      })),
    reorderConditionalStyleRules: (startIndex: number, endIndex: number) =>
      set((state) => {
        const next = [...state.conditionalStyles];
        const [removed] = next.splice(startIndex, 1);
        next.splice(endIndex, 0, removed);
        return { conditionalStyles: next, isDirty: true };
      }),

    addExportTemplate: (template: ExportTemplate) =>
      set((state) => ({
        exportTemplates: [...state.exportTemplates, template],
        isDirty: true,
      })),

    updateExportTemplate: (id: string, updates: Partial<ExportTemplate>) =>
      set((state) => ({
        exportTemplates: state.exportTemplates.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        isDirty: true,
      })),

    removeExportTemplate: (id: string) =>
      set((state) => ({
        exportTemplates: state.exportTemplates.filter((t) => t.id !== id),
        isDirty: true,
      })),

    updateDefaultExportFormat: (id: string, updates: Partial<DefaultExportFormat>) =>
      set((state) => ({
        defaultExportFormats: state.defaultExportFormats.map((f: DefaultExportFormat) =>
          f.id === id ? { ...f, ...updates } : f,
        ),
        isDirty: true,
      })),

    addExportProfile: (profile: ExportProfile) =>
      set((state) => ({
        exportProfiles: [...state.exportProfiles, profile],
        activeExportProfileId: profile.id,
        isDirty: true,
      })),

    updateExportProfile: (id: string, updates: Partial<ExportProfile>) =>
      set((state) => ({
        exportProfiles: state.exportProfiles.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        isDirty: true,
      })),

    removeExportProfile: (id: string) =>
      set((state) => {
        const filtered = state.exportProfiles.filter((p) => p.id !== id);
        const nextActiveId =
          state.activeExportProfileId === id ? (filtered[0]?.id ?? null) : state.activeExportProfileId;
        return {
          exportProfiles: filtered,
          activeExportProfileId: nextActiveId,
          isDirty: true,
        };
      }),

    setActiveExportProfileId: (id: string | null) => set({ activeExportProfileId: id }),

    duplicateExportProfile: (id: string) => {
      const profile = get().exportProfiles.find((p) => p.id === id);
      if (!profile) return;
      const newProfile: ExportProfile = {
        ...profile,
        id: uuidv4(),
        name: `${profile.name} (Copy)`,
        items: profile.items.map((item) => ({ ...item, id: uuidv4() })),
      };
      set((state) => ({
        exportProfiles: [...state.exportProfiles, newProfile],
        activeExportProfileId: newProfile.id,
        isDirty: true,
      }));
    },

    replaceExportProfiles: (profiles: ExportProfile[], activeId: string | null) =>
      set({ exportProfiles: profiles, activeExportProfileId: activeId, isDirty: true }),

    setProjectData: (rawData: any) => {
      get().abortCanvasGestures?.();
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
          selection: { type: 'none' },
          appMode: { mode: 'select' },
          modalStack: state.isWelcomeModalOpen ? ['welcome'] : [],
          activeTool: 'select',
          isMapEditMode: false,
          selectedEditObjectId: null,
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
          conditionalStyles: data.conditional_styles,
          conditionalStylesEnabled: data.conditional_styles_enabled,
          exportProfiles: data.export_profiles,
          activeExportProfileId: data.active_export_profile_id,
          geoMap: data.geo_map,
          isDirty: false,
        };
      });
    },

    resetProject: () => {
      get().abortCanvasGestures?.();
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
          selection: { type: 'none' },
          appMode: { mode: 'select' },
          modalStack: state.isWelcomeModalOpen ? ['welcome'] : [],
          activeTool: 'select',
          isMapEditMode: false,
          selectedEditObjectId: null,
          isAnnotationEditMode: false,
          activePathCalculatorPluginId: null,
          pathCalculatorParams: {},
          calculatedPathSegments: null,
          autoRecalculatePath: true,
          pathColor: DEFAULT_PATH_COLOR,
          pathWidth: 0.1,
          pathOpacity: 0.7,
          syncPathWidthWithFootprint: false,
          conditionalStyles: DEFAULT_CONDITIONAL_STYLES,
          conditionalStylesEnabled: DEFAULT_CONDITIONAL_STYLES_ENABLED,
          exportProfiles: DEFAULT_EXPORT_PROFILES,
          activeExportProfileId: DEFAULT_ACTIVE_EXPORT_PROFILE_ID,
          geoMap: DEFAULT_GEO_MAP,
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
          exportTemplates: state.exportTemplates.filter((t) => t.scope !== 'local'),
          currentProjectPath: null,
          isDirty: false,
        };
      });
    },

    loadProjectFromPath: async (pathStr: string): Promise<boolean> => {
      const { setLastDirectory, setProjectData, setIsDirty, recalculatePath, addRecentProject, runWithLoading } = get();
      try {
        const getDirName = (path: string) => {
          const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
          return lastSlash > -1 ? path.substring(0, lastSlash) : path;
        };

        setLastDirectory(getDirName(pathStr));
        const fileName = pathStr.split(/[/\\]/).pop() || pathStr;

        return await runWithLoading(
          {
            message: 'プロジェクトを読み込み中...',
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
          },
        );
      } catch (err) {
        console.error('Failed to load project:', err);
        void notifyError(`プロジェクトの読み込みに失敗しました。\nエラー詳細: ${String(err)}`);
        return false;
      }
    },

    loadProject: async (): Promise<boolean> => {
      const { lastDirectory, loadProjectFromPath } = get();
      try {
        const selectedPath = await DialogAPI.open({
          multiple: false,
          defaultPath: lastDirectory || undefined,
          filters: [{ name: 'Waypoint Project', extensions: ['wptroj'] }],
        });

        if (selectedPath) {
          const pathStr = typeof selectedPath === 'string' ? selectedPath : (selectedPath as any).path;
          if (!pathStr) return false;
          return await loadProjectFromPath(pathStr);
        }
        return false;
      } catch (err) {
        console.error('Failed to open project dialog:', err);
        void notifyError(`プロジェクト選択ダイアログの起動に失敗しました。\nエラー詳細: ${String(err)}`);
        return false;
      }
    },

    saveProjectAs: async () => {
      const { lastDirectory } = get();
      try {
        const savePath = await DialogAPI.save({
          defaultPath: lastDirectory || undefined,
          filters: [{ name: 'Waypoint Project', extensions: ['wptroj'] }],
        });

        if (savePath) {
          let finalPath = savePath;
          if (!finalPath.toLowerCase().endsWith('.wptroj')) {
            finalPath += '.wptroj';
          }
          await executeSaveProject(finalPath);
        }
      } catch (err) {
        console.error('Failed to save project as:', err);
        void notifyError(`プロジェクトの保存に失敗しました。\nエラー詳細: ${String(err)}`);
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
            title: '上書き保存の確認',
            kind: 'info',
          },
        );

        if (!confirmed) {
          return;
        }

        await executeSaveProject(currentProjectPath);
      } catch (err) {
        console.error('Failed to overwrite save project:', err);
        void notifyError(`プロジェクトの上書き保存に失敗しました。\nエラー詳細: ${String(err)}`);
      }
    },
  };
};
