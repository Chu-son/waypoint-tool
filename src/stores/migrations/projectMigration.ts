import { StrictProjectData, CustomLayer, RobotFootprint, OccupancySettings, DefaultExportFormat, RectangularFootprint, CircularFootprint } from '../../types/store';
import { DEFAULT_PATH_COLOR } from '../../utils/colorPresets';
import { v4 as uuidv4 } from 'uuid';

export const DEFAULT_ROBOT_FOOTPRINT: CircularFootprint = {
  type: 'circular',
  radius: 0.3,
};

export const DEFAULT_OCCUPANCY_SETTINGS: OccupancySettings = {
  defaultOccupiedThresh: 0.65,
  defaultFreeThresh: 0.196,
  defaultNegate: 0,
};

export const DEFAULT_MAP_OPACITY = 0.5;

export const DEFAULT_EXPORT_FORMATS: DefaultExportFormat[] = [
  { id: '__default_yaml__', name: 'YAML Document', extension: 'yaml', suffix: '_yaml', enabled: true },
  { id: '__default_json__', name: 'JSON Document', extension: 'json', suffix: '_json', enabled: true },
];

/**
 * ロボットフットプリントの型別厳格正規化。
 * rectangular / polygon 型に radius などの別形状プロパティが混入するのを防ぐ。
 */
export function normalizeRobotFootprint(rawFootprint: any): RobotFootprint {
  if (!rawFootprint || typeof rawFootprint !== 'object') {
    return { ...DEFAULT_ROBOT_FOOTPRINT };
  }

  if (rawFootprint.type === 'rectangular') {
    const length = typeof rawFootprint.length === 'number' ? rawFootprint.length : 0.6;
    const width = typeof rawFootprint.width === 'number' ? rawFootprint.width : 0.4;
    const res: RectangularFootprint = {
      type: 'rectangular',
      length,
      width,
    };
    if (typeof rawFootprint.offset_x === 'number') {
      res.offset_x = rawFootprint.offset_x;
    } else if (typeof rawFootprint.offsetX === 'number') {
      res.offset_x = rawFootprint.offsetX;
    }
    if (typeof rawFootprint.offset_y === 'number') {
      res.offset_y = rawFootprint.offset_y;
    } else if (typeof rawFootprint.offsetY === 'number') {
      res.offset_y = rawFootprint.offsetY;
    }
    return res;
  }

  if (rawFootprint.type === 'polygon') {
    const points = Array.isArray(rawFootprint.points)
      ? rawFootprint.points.map((pt: any) => [Number(pt[0]) || 0, Number(pt[1]) || 0] as [number, number])
      : [
          [0.3, 0.2],
          [-0.3, 0.2],
          [-0.3, -0.2],
          [0.3, -0.2],
        ];
    return {
      type: 'polygon',
      points,
    };
  }

  return {
    type: 'circular',
    radius: typeof rawFootprint.radius === 'number' ? rawFootprint.radius : DEFAULT_ROBOT_FOOTPRINT.radius,
  };
}

/**
 * v1 データの正規化パイプライン。
 * 全27フィールドを厳格に検証・補完し、型安全な StrictProjectData を生成する。
 */
export function normalizeV1(raw: any): StrictProjectData {
  const data = (raw && typeof raw === 'object') ? raw : {};

  // 1. ノード・ID
  const rawRootNodeIds = data.root_node_ids ?? data.rootNodeIds;
  const rootNodeIds: string[] = Array.isArray(rawRootNodeIds) ? rawRootNodeIds : [];
  const nodes = (data.nodes && typeof data.nodes === 'object' && !Array.isArray(data.nodes))
    ? data.nodes
    : {};

  // 2. デフォルトマップ透過度
  const defaultMapOpacity = typeof data.default_map_opacity === 'number'
    ? data.default_map_opacity
    : (typeof data.defaultMapOpacity === 'number' ? data.defaultMapOpacity : DEFAULT_MAP_OPACITY);

  // 3. マップレイヤー
  const rawMapLayers = data.map_layers ?? data.mapLayers;
  const mapLayersList = Array.isArray(rawMapLayers) ? rawMapLayers : [];
  const mapLayers = mapLayersList.map((layer: any, index: number) => ({
    id: layer?.id || uuidv4(),
    name: layer?.name || `Map Layer ${index + 1}`,
    info: layer?.info || {},
    image_base64: layer?.image_base64 || layer?.imageBase64 || '',
    width: typeof layer?.width === 'number' ? layer.width : 1000,
    height: typeof layer?.height === 'number' ? layer.height : 1000,
    visible: typeof layer?.visible === 'boolean' ? layer.visible : true,
    opacity: typeof layer?.opacity === 'number' ? layer.opacity : defaultMapOpacity,
    z_index: typeof layer?.z_index === 'number' ? layer.z_index : index,
    blend_mode: layer?.blend_mode || 'overwrite',
  }));

  // 4. カスタムレイヤー (edit_layers / generated_layers の吸収)
  let customLayers: CustomLayer[] = [];
  const rawCustomLayers = data.custom_layers ?? data.customLayers;
  if (Array.isArray(rawCustomLayers)) {
    customLayers = rawCustomLayers.map((l: any, i: number) => ({
      ...l,
      id: l?.id || uuidv4(),
      is_reference: l?.is_reference ?? false,
      z_index: typeof l?.z_index === 'number' ? l.z_index : i,
      editObjects: l?.type === 'manual'
        ? (Array.isArray(l.editObjects ?? l.edit_objects)
            ? (l.editObjects ?? l.edit_objects).map((o: any) => ({ ...o, id: o?.id || uuidv4() }))
            : [])
        : undefined,
    }));
  } else {
    const rawEdit = data.edit_layers ?? data.editLayers;
    if (Array.isArray(rawEdit)) {
      rawEdit.forEach((el: any) => {
        customLayers.push({
          id: el?.id || uuidv4(),
          name: el?.name || 'Manual Layer',
          type: 'manual',
          visible: el?.visible ?? true,
          opacity: typeof el?.opacity === 'number' ? el.opacity : 1.0,
          z_index: typeof el?.z_index === 'number' ? el.z_index : customLayers.length,
          blend_mode: el?.blend_mode || 'overwrite',
          is_reference: el?.is_reference ?? false,
          editObjects: Array.isArray(el?.editObjects ?? el?.edit_objects)
            ? (el.editObjects ?? el.edit_objects).map((obj: any) => ({ ...obj, id: obj?.id || uuidv4() }))
            : [],
        });
      });
    }
    const rawGen = data.generated_layers ?? data.generatedLayers;
    if (Array.isArray(rawGen)) {
      rawGen.forEach((gl: any) => {
        customLayers.push({
          id: gl?.id || uuidv4(),
          name: gl?.name || 'Generated Layer',
          type: 'plugin',
          plugin_id: gl?.plugin_id || '',
          params: gl?.params || {},
          interaction_data: gl?.interaction_data || {},
          image_base64: gl?.image_base64 || '',
          info: gl?.info || {},
          visible: gl?.visible ?? true,
          opacity: typeof gl?.opacity === 'number' ? gl.opacity : 0.7,
          z_index: typeof gl?.z_index === 'number' ? gl.z_index : customLayers.length,
          blend_mode: gl?.blend_mode || 'overwrite',
          is_reference: gl?.is_reference ?? false,
        });
      });
    }
  }
  customLayers.sort((a, b) => a.z_index - b.z_index);
  customLayers = customLayers.map((l, i) => ({ ...l, z_index: i }));

  // 5. アノテーション
  const rawAnnotations = data.annotation_objects ?? data.annotationObjects;
  let rawAnnotationList: any[] = [];
  if (Array.isArray(rawAnnotations)) {
    rawAnnotationList = rawAnnotations;
  } else if (rawAnnotations && typeof rawAnnotations === 'object') {
    rawAnnotationList = Object.values(rawAnnotations);
  }
  const annotationObjects = rawAnnotationList.map((a: any) => ({
    ...a,
    id: a?.id || uuidv4(),
  }));

  const rawAnnotationGroups = data.annotation_groups ?? data.annotationGroups;
  const annotationGroups = (rawAnnotationGroups && typeof rawAnnotationGroups === 'object' && !Array.isArray(rawAnnotationGroups))
    ? rawAnnotationGroups
    : {};

  const rawRootAnnotationIds = data.root_annotation_ids ?? data.rootAnnotationIds;
  const rootAnnotationIds: string[] = Array.isArray(rawRootAnnotationIds)
    ? rawRootAnnotationIds
    : (
      Object.keys(annotationGroups).length > 0
        ? [...Object.keys(annotationGroups), ...annotationObjects.filter((a: any) => !a.group_id).map((a: any) => a.id)]
        : annotationObjects.map((a: any) => a.id)
    );

  // 6. エクスポート領域・テンプレート
  const rawExportRegions = data.export_regions ?? data.exportRegions;
  const exportRegions = Array.isArray(rawExportRegions) ? rawExportRegions : [];

  const rawOptionsSchema = data.options_schema ?? data.optionsSchema;
  const optionsSchema = (rawOptionsSchema && typeof rawOptionsSchema === 'object') ? rawOptionsSchema : null;

  const rawExportTemplates = data.export_templates ?? data.exportTemplates;
  const exportTemplates = Array.isArray(rawExportTemplates) ? rawExportTemplates : [];

  // 7. エクスポートフォーマット
  let defaultExportFormats: DefaultExportFormat[] = DEFAULT_EXPORT_FORMATS;
  const rawFormats = data.default_export_formats ?? data.defaultExportFormats;
  if (Array.isArray(rawFormats) && rawFormats.length > 0) {
    defaultExportFormats = rawFormats.map((f: any) => {
      if (typeof f === 'string') {
        const ext = f.toLowerCase().replace(/^\./, '');
        return {
          id: `__default_${ext}__`,
          name: `${ext.toUpperCase()} Document`,
          extension: ext,
          suffix: `_${ext}`,
          enabled: true,
        };
      }
      return f;
    });
  }

  // 8. ロボットフットプリント & 占有グリッド設定
  const robotFootprint = normalizeRobotFootprint(data.robot_footprint ?? data.robotFootprint);

  const rawOcc = data.occupancy_settings ?? data.occupancySettings ?? {};
  const occupancySettings: OccupancySettings = {
    defaultOccupiedThresh: typeof rawOcc.defaultOccupiedThresh === 'number'
      ? rawOcc.defaultOccupiedThresh
      : DEFAULT_OCCUPANCY_SETTINGS.defaultOccupiedThresh,
    defaultFreeThresh: typeof rawOcc.defaultFreeThresh === 'number'
      ? rawOcc.defaultFreeThresh
      : DEFAULT_OCCUPANCY_SETTINGS.defaultFreeThresh,
    defaultNegate: (rawOcc.defaultNegate === 1 || rawOcc.defaultNegate === 0)
      ? rawOcc.defaultNegate
      : DEFAULT_OCCUPANCY_SETTINGS.defaultNegate,
  };

  // 9. パネルビューモード & 経路計算
  const leftPanelViewMode = (data.left_panel_view_mode === 'split' || data.leftPanelViewMode === 'split') ? 'split' : 'tabs';
  const rightPanelViewMode = (data.right_panel_view_mode === 'split' || data.rightPanelViewMode === 'split') ? 'split' : 'tabs';

  const activePathCalculatorPluginId = typeof (data.active_path_calculator_plugin_id ?? data.activePathCalculatorPluginId) === 'string'
    ? (data.active_path_calculator_plugin_id ?? data.activePathCalculatorPluginId)
    : null;

  const rawPathCalcParams = data.path_calculator_params ?? data.pathCalculatorParams;
  const pathCalculatorParams = (rawPathCalcParams && typeof rawPathCalcParams === 'object' && !Array.isArray(rawPathCalcParams))
    ? rawPathCalcParams
    : {};

  const autoRecalculatePath = data.auto_recalculate_path ?? data.autoRecalculatePath ?? true;
  const pathColor = data.path_color || data.pathColor || DEFAULT_PATH_COLOR;
  const pathWidth = typeof (data.path_width ?? data.pathWidth) === 'number' ? (data.path_width ?? data.pathWidth) : 0.1;
  const pathOpacity = typeof (data.path_opacity ?? data.pathOpacity) === 'number' ? (data.path_opacity ?? data.pathOpacity) : 0.7;
  const syncPathWidthWithFootprint = data.sync_path_width_with_footprint ?? data.syncPathWidthWithFootprint ?? false;

  const rawIndex = data.index_start_index ?? data.indexStartIndex;
  const indexStartIndex: 0 | 1 = (Number(rawIndex) === 1) ? 1 : 0;

  const decimalPrecision = typeof (data.decimal_precision ?? data.decimalPrecision) === 'number'
    ? (data.decimal_precision ?? data.decimalPrecision)
    : 6;

  // 10. カスタムUI & ワークフロー状態 (camelCase 解決とクリーンアップ)
  const rawCustomUi = data.custom_ui_data ?? data.customUiData ?? {};
  const customUiData: Record<string, any> = (rawCustomUi && typeof rawCustomUi === 'object' && !Array.isArray(rawCustomUi))
    ? { ...rawCustomUi }
    : {};

  const legacyWorkflow = data.workflow_state ?? data.workflowState;
  const wsSource = customUiData.workflow_state ?? customUiData.workflowState ?? legacyWorkflow;

  delete customUiData.workflowState;
  delete customUiData.workflow_state;

  if (wsSource && typeof wsSource === 'object') {
    customUiData.workflow_state = {
      current_step_index: typeof (wsSource.current_step_index ?? wsSource.currentStepIndex) === 'number'
        ? (wsSource.current_step_index ?? wsSource.currentStepIndex)
        : 0,
      max_reached_step_index: typeof (wsSource.max_reached_step_index ?? wsSource.maxReachedStepIndex) === 'number'
        ? (wsSource.max_reached_step_index ?? wsSource.maxReachedStepIndex)
        : 0,
      workflow_variables: (wsSource.workflow_variables ?? wsSource.workflowVariables) && typeof (wsSource.workflow_variables ?? wsSource.workflowVariables) === 'object'
        ? { ...(wsSource.workflow_variables ?? wsSource.workflowVariables) }
        : {},
      step_execution_ids: (wsSource.step_execution_ids ?? wsSource.stepExecutionIds) && typeof (wsSource.step_execution_ids ?? wsSource.stepExecutionIds) === 'object'
        ? { ...(wsSource.step_execution_ids ?? wsSource.stepExecutionIds) }
        : {},
    };
  }

  return {
    version: 1,
    root_node_ids: rootNodeIds,
    nodes,
    map_layers: mapLayers,
    custom_layers: customLayers,
    annotation_objects: annotationObjects,
    annotation_groups: annotationGroups,
    root_annotation_ids: rootAnnotationIds,
    export_regions: exportRegions,
    options_schema: optionsSchema,
    export_templates: exportTemplates,
    default_export_formats: defaultExportFormats,
    robot_footprint: robotFootprint,
    occupancy_settings: occupancySettings,
    default_map_opacity: defaultMapOpacity,
    left_panel_view_mode: leftPanelViewMode,
    right_panel_view_mode: rightPanelViewMode,
    active_path_calculator_plugin_id: activePathCalculatorPluginId,
    path_calculator_params: pathCalculatorParams,
    auto_recalculate_path: autoRecalculatePath,
    path_color: pathColor,
    path_width: pathWidth,
    path_opacity: pathOpacity,
    sync_path_width_with_footprint: syncPathWidthWithFootprint,
    index_start_index: indexStartIndex,
    decimal_precision: decimalPrecision,
    custom_ui_data: customUiData,
  };
}

/**
 * v0 (レガシー形式: edit_layers, generated_layers, キャメルケース混在, versionなし) から v1 へのマイグレーション
 */
export function migrateV0ToV1(raw: any): StrictProjectData {
  return normalizeV1({
    ...raw,
    version: 1,
  });
}

/**
 * 外部から読み込まれた生のプロジェクトデータを最新スキーマの StrictProjectData へ完全正規化する。
 * すべての後方互換・キー名揺れ・デフォルト値補完はこの関数（およびマイグレータ）で完結する。
 */
export function migrateAndNormalizeProjectData(raw: any): StrictProjectData {
  if (!raw || typeof raw !== 'object') {
    return createDefaultProjectData();
  }

  // バージョン判定: version フィールドが存在しない、または 0 の場合は v0 (レガシー) として扱う
  let current = { ...raw };
  const currentVersion = typeof current.version === 'number' ? current.version : 0;

  if (currentVersion === 0) {
    current = migrateV0ToV1(current);
  }
  // 将来 version 2 が登場した場合はここで if (current.version === 1) current = migrateV1ToV2(current);

  return normalizeV1(current);
}

export function createDefaultProjectData(): StrictProjectData {
  return normalizeV1({ version: 1 });
}
