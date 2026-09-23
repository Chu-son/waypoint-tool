import type { AppState } from '../appStore';
import { ExportTemplate, StrictProjectData } from '../../types/store';
import { migrateAndNormalizeProjectData } from '../migrations/projectMigration';

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
    conditional_styles: state.conditionalStyles,
    conditional_styles_enabled: state.conditionalStylesEnabled,
    export_profiles: state.exportProfiles,
    active_export_profile_id: state.activeExportProfileId,
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
