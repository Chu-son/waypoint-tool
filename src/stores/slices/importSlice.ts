import { StateCreator } from 'zustand';
import type { AppState } from '../appStore';
import type { StrictProjectData } from '../../types/project';
import type { ProjectImportPlan } from '../../utils/import/projectImportPlan';

export type ImportSlice = {
  /**
   * 他のプロジェクトから取り込む内容（`buildProjectImportPlan` の結果）を今のプロジェクトへ適用する。
   * `plan.optionsSchema` は検証と確認が要るため、呼び出し側が先に `applyOptionsSchema` で適用しておく。
   *
   * 設定 → 履歴スナップショット → データ の順に反映するので、Undo 1 回で戻るのはデータ（ウェイポイント、
   * アノテーション、カスタムレイヤー）だけで、設定とマップは戻らない（マップの追加は元々 Undo の対象外）。
   */
  applyProjectImport: (plan: ProjectImportPlan) => void;
};

/** `StrictProjectData` のキーを、ストアの状態名へ対応づける。 */
function settingsPatchToState(patch: Partial<StrictProjectData>): Partial<AppState> {
  const out: Partial<AppState> = {};
  if (patch.default_export_formats !== undefined) out.defaultExportFormats = patch.default_export_formats;
  if (patch.index_start_index !== undefined) out.indexStartIndex = patch.index_start_index;
  if (patch.export_integers_as_float !== undefined) out.exportIntegersAsFloat = patch.export_integers_as_float;
  if (patch.decimal_precision !== undefined) out.decimalPrecision = patch.decimal_precision;
  if (patch.robot_footprint !== undefined) out.robotFootprint = patch.robot_footprint;
  if (patch.active_path_calculator_plugin_id !== undefined) {
    out.activePathCalculatorPluginId = patch.active_path_calculator_plugin_id;
  }
  if (patch.path_calculator_params !== undefined) out.pathCalculatorParams = patch.path_calculator_params;
  if (patch.auto_recalculate_path !== undefined) out.autoRecalculatePath = patch.auto_recalculate_path;
  if (patch.path_color !== undefined) out.pathColor = patch.path_color;
  if (patch.path_width !== undefined) out.pathWidth = patch.path_width;
  if (patch.path_opacity !== undefined) out.pathOpacity = patch.path_opacity;
  if (patch.sync_path_width_with_footprint !== undefined) {
    out.syncPathWidthWithFootprint = patch.sync_path_width_with_footprint;
  }
  if (patch.conditional_styles !== undefined) out.conditionalStyles = patch.conditional_styles;
  if (patch.conditional_styles_enabled !== undefined) out.conditionalStylesEnabled = patch.conditional_styles_enabled;
  if (patch.occupancy_settings !== undefined) out.occupancySettings = patch.occupancy_settings;
  if (patch.default_map_opacity !== undefined) out.defaultMapOpacity = patch.default_map_opacity;
  if (patch.geo_map !== undefined) out.geoMap = patch.geo_map;
  return out;
}

export const createImportSlice: StateCreator<AppState, [], [], ImportSlice> = (set, get) => ({
  applyProjectImport: (plan) => {
    get().abortCanvasGestures?.();
    const { data } = plan;

    // 1. 設定・テンプレート・プロファイル（Undo の対象外）。アクティブなプロファイルは切り替えない。
    set((state) => {
      const updatedTemplates = new Map(plan.templates.update.map((u) => [u.id, u.template]));
      const updatedProfiles = new Map(plan.exportProfiles.update.map((u) => [u.id, u.profile]));
      return {
        ...settingsPatchToState(plan.settingsPatch),
        exportTemplates: [...state.exportTemplates.map((t) => updatedTemplates.get(t.id) ?? t), ...plan.templates.add],
        exportProfiles: [
          ...state.exportProfiles.map((p) => updatedProfiles.get(p.id) ?? p),
          ...plan.exportProfiles.add,
        ],
        exportRegions: [...state.exportRegions, ...data.exportRegions],
        mapSources: [...state.mapSources, ...data.mapSources],
        mapLayers: [...data.mapLayers, ...state.mapLayers],
        // 取り込んだレイヤーは積み順の一番上に置く。
        layerOrder: [...data.layerOrder, ...state.layerOrder],
        layerVisibilitySets: [...state.layerVisibilitySets, ...data.layerVisibilitySets],
        isDirty: true,
      };
    });

    // 2. Undo で戻せるデータ。設定を先に反映してからスナップショットを取るので、Undo が設定を巻き戻すことはない。
    const hasUndoableData =
      data.rootNodeIds.length > 0 ||
      data.annotationObjects.length > 0 ||
      Object.keys(data.annotationGroups).length > 0 ||
      data.customLayers.length > 0;
    if (hasUndoableData) {
      get().pushHistorySnapshot();
      set((state) => ({
        nodes: { ...state.nodes, ...data.nodes },
        rootNodeIds: [...state.rootNodeIds, ...data.rootNodeIds],
        annotationObjects: {
          ...state.annotationObjects,
          ...Object.fromEntries(data.annotationObjects.map((a) => [a.id, a])),
        },
        annotationGroups: { ...state.annotationGroups, ...data.annotationGroups },
        rootAnnotationIds: [...state.rootAnnotationIds, ...data.rootAnnotationIds],
        annotationOrder: [...state.annotationOrder, ...data.annotationObjects.map((a) => a.id)],
        customLayers: [...state.customLayers, ...data.customLayers],
        isDirty: true,
      }));
    }

    const pathChanged = 'active_path_calculator_plugin_id' in plan.settingsPatch || data.rootNodeIds.length > 0;
    if (pathChanged && get().activePathCalculatorPluginId) {
      void get().recalculatePath({ immediate: true });
    }
  },
});
