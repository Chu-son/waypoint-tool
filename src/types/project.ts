import type { OptionsSchema } from './options';
import type { WaypointNode } from './waypoint';
import type { AnnotationGroup, AnnotationObject } from './annotation';
import type { CustomLayer, ExportRegion, OccupancySettings, ProjectMapLayer } from './layer';
import type { DefaultExportFormat, ExportProfile, ExportTemplate } from './export';
import type { RobotFootprint } from './footprint';
import type { ConditionalStyleRule } from './style';

export interface RecentProjectItem {
  path: string;
  name: string;
  lastOpened: number;
}

/**
 * プロジェクトファイル（.wptroj）から読み込んだ未正規化データ。
 * 旧バージョン形式を含むため、`projectMigration.ts` で `StrictProjectData` に正規化してから使う。
 */
export interface ProjectData {
  version?: number;
  root_node_ids?: string[];
  nodes?: Record<string, WaypointNode>;
  map_layers?: ProjectMapLayer[];
  custom_layers?: CustomLayer[];
  annotation_objects?: AnnotationObject[];
  annotation_groups?: Record<string, AnnotationGroup>;
  root_annotation_ids?: string[];
  edit_layers?: any[]; // Legacy
  generated_layers?: any[]; // Legacy
  options_schema?: any;
  export_templates?: any;
  default_export_formats?: DefaultExportFormat[] | string[];
  export_regions?: any[];
  robot_footprint?: RobotFootprint;
  occupancy_settings?: OccupancySettings;
  default_map_opacity?: number;
  left_panel_view_mode?: 'tabs' | 'split';
  right_panel_view_mode?: 'tabs' | 'split';
  active_path_calculator_plugin_id?: string | null;
  path_calculator_params?: Record<string, any>;
  auto_recalculate_path?: boolean;
  path_color?: string;
  path_width?: number;
  path_opacity?: number;
  sync_path_width_with_footprint?: boolean;
  index_start_index?: 0 | 1;
  decimal_precision?: number;
  workflow_state?: any; // Legacy
  custom_ui_data?: any;
  conditional_styles?: ConditionalStyleRule[];
  conditional_styles_enabled?: boolean;
}

/**
 * アプリケーション内部標準・保存用の厳格型。
 * レガシー互換フィールドを除き、すべてのプロパティを具象型で必須定義。
 */
export interface StrictProjectData {
  version: number;
  root_node_ids: string[];
  nodes: Record<string, WaypointNode>;
  map_layers: ProjectMapLayer[];
  custom_layers: CustomLayer[];
  annotation_objects: AnnotationObject[];
  annotation_groups: Record<string, AnnotationGroup>;
  root_annotation_ids: string[];
  export_regions: ExportRegion[];
  options_schema: OptionsSchema | null;
  export_templates: ExportTemplate[];
  default_export_formats: DefaultExportFormat[];
  robot_footprint: RobotFootprint;
  occupancy_settings: OccupancySettings;
  default_map_opacity: number;
  left_panel_view_mode: 'tabs' | 'split';
  right_panel_view_mode: 'tabs' | 'split';
  active_path_calculator_plugin_id: string | null;
  path_calculator_params: Record<string, any>;
  auto_recalculate_path: boolean;
  path_color: string;
  path_width: number;
  path_opacity: number;
  sync_path_width_with_footprint: boolean;
  index_start_index: 0 | 1;
  decimal_precision: number;
  conditional_styles: ConditionalStyleRule[];
  conditional_styles_enabled: boolean;
  export_profiles: ExportProfile[];
  active_export_profile_id: string | null;
  custom_ui_data: {
    workflow_state?: {
      current_step_index: number;
      max_reached_step_index: number;
      workflow_variables: Record<string, any>;
      step_execution_ids: Record<string, string>;
    };
    [key: string]: any;
  };
}
