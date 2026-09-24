import type { Transform } from './geometry';
import type { OptionDef, WaypointOptions } from './options';
import type { AnnotationType } from './annotation';
import type { PipelineRecipeDef, PluginDependencyDef, PythonDependencyDef } from './pipeline';

export type PluginPrimaryOutput = 'waypoints' | 'custom_layer' | 'annotations' | 'path_calculator';
export type PluginCategory = 'waypoint_generator' | 'map_layer_generator' | 'path_calculator' | PluginPrimaryOutput;
export type PluginInputType =
  'point' | 'points' | 'point_list' | 'rectangle' | 'waypoint' | 'annotation' | 'custom_layer';

export interface PluginInteractionPointItem {
  id: string;
  x: number;
  y: number;
  yaw?: number;
  qx?: number;
  qy?: number;
  qz?: number;
  qw?: number;
}

export type PluginInputDef = {
  id: string;
  name: string; // The property key name
  label: string; // The display label
  description?: string;
  type: PluginInputType | 'boolean' | 'integer' | 'float' | 'string';
  object_type?: 'point' | 'oriented_point' | 'line' | 'rect' | 'circle' | 'any';
  multiple?: boolean;
  min_points?: number;
  max_points?: number;
  allow_yaw?: boolean;
  default?: any;
  required?: boolean;
};

export type PluginManifest = {
  name: string;
  category?: PluginCategory;
  primary_output?: PluginPrimaryOutput;
  version?: string;
  description?: string;
  type: 'python' | 'wasm' | 'python_library' | 'pipeline';
  executable: string;
  module_name?: string;
  inputs: PluginInputDef[];
  needs?: ('selected_points' | 'occupancy_grid' | 'occupancy_grid_in_region' | 'robot_footprint')[];
  properties: OptionDef[];
  icon?: string;
  legacy_ids?: string[];
  plugin_dependencies?: PluginDependencyDef[];
  python_dependencies?: PythonDependencyDef[];
  pipeline?: PipelineRecipeDef;
};

export type PluginInstance = {
  id: string;
  manifest: PluginManifest;
  folder_path: string;
  is_builtin: boolean;
  sdk_version?: string;
};

export interface PluginSetting {
  id: string;
  path?: string;
  enabled: boolean;
  order: number;
  isBuiltin: boolean;
  pythonOverridePath?: string;
  icon?: string;
}

// --- Unified Plugin Run Result Types ---
export interface PluginWaypointOutputItem {
  x?: number;
  y?: number;
  yaw?: number;
  qx?: number;
  qy?: number;
  qz?: number;
  qw?: number;
  transform?: Transform;
  options?: WaypointOptions;
}

export interface PluginCustomLayerOutputItem {
  id?: string;
  name: string;
  image_base64: string;
  info: {
    resolution: number;
    origin: [number, number, number];
    width: number;
    height: number;
    negate?: number;
    occupied_thresh?: number;
    free_thresh?: number;
  };
  blend_mode?: 'overwrite' | 'merge_obstacles' | 'merge_free';
  opacity?: number;
  plugin_data?: Record<string, any>;
}

export interface PluginAnnotationOutputItem {
  id?: string;
  name?: string;
  type: AnnotationType;
  visible?: boolean;
  labelVisible?: boolean;
  color?: string;
  x?: number;
  y?: number;
  yaw?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  cx?: number;
  cy?: number;
  width?: number;
  height?: number;
  angle?: number;
  radius?: number;
  plugin_data?: Record<string, any>;
}

export interface PluginUnifiedResult {
  waypoints?:
    | {
        name?: string;
        items: PluginWaypointOutputItem[];
        plugin_data?: Record<string, any>;
      }
    | PluginWaypointOutputItem[];
  custom_layers?: PluginCustomLayerOutputItem[];
  annotations?:
    | {
        name?: string;
        items: PluginAnnotationOutputItem[];
        plugin_data?: Record<string, any>;
      }
    | PluginAnnotationOutputItem[];
  plugin_data?: Record<string, any>;
  segments?: Array<Array<{ x: number; y: number }>>; // For path calculators
}
