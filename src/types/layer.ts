import type { PipelineMetadata } from './pipeline';

// --- Custom Layers (Manual & Plugin) ---
export type CustomLayerType = 'manual' | 'plugin';

export interface CustomLayerBase {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  z_index: number;
  blend_mode?: 'overwrite' | 'merge_obstacles' | 'merge_free';
  is_reference?: boolean;
  pipeline_metadata?: PipelineMetadata;
}

export type EditObjectType = 'rect' | 'circle' | 'freehand' | 'line';

interface EditObjectBase {
  id: string;
  type: EditObjectType;
  fillValue: number; // 0~255 (0=black=obstacle, 255=white=free space)
}

export interface LineEditObject extends EditObjectBase {
  type: 'line';
  x1: number; // Start world coordinate X (meters)
  y1: number; // Start world coordinate Y (meters)
  x2: number; // End world coordinate X (meters)
  y2: number; // End world coordinate Y (meters)
  lineWidth?: number; // Line width in world units (meters, optional)
}

export interface RectEditObject extends EditObjectBase {
  type: 'rect';
  cx: number; // Center world coordinate X (meters)
  cy: number; // Center world coordinate Y (meters)
  width: number; // Width in world units (meters)
  height: number; // Height in world units (meters)
  angle: number; // Radians (relative to center point)
}

export interface CircleEditObject extends EditObjectBase {
  type: 'circle';
  cx: number; // Center world coordinate X (meters)
  cy: number; // Center world coordinate Y (meters)
  radius: number; // Radius in world units (meters)
}

export interface FreehandEditObject extends EditObjectBase {
  type: 'freehand';
  points: Array<{ x: number; y: number }>; // World coordinate point sequence
  brushRadius: number; // Brush radius in world units (meters)
}

export type EditObject = RectEditObject | CircleEditObject | FreehandEditObject | LineEditObject;

/** Manual Vector Edit Layer */
export interface ManualCustomLayer extends CustomLayerBase {
  type: 'manual';
  editObjects: EditObject[];
}

/** Plugin Generated Overlay Layer */
export interface PluginCustomLayer extends CustomLayerBase {
  type: 'plugin';
  plugin_id: string;
  source_execution_id?: string;
  plugin_data?: Record<string, any>;
  params: Record<string, any>;
  interaction_data?: Record<string, any>;
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
  pipeline_metadata?: PipelineMetadata;
}

export type CustomLayer = ManualCustomLayer | PluginCustomLayer;

// --- ROS Map Layers ---
export interface MapLayerInfo {
  image?: string;
  resolution?: number;
  origin?: [number, number, number];
  initial_origin?: [number, number, number];
  negate?: number;
  occupied_thresh?: number;
  free_thresh?: number;
  width?: number;
  height?: number;
  [key: string]: any;
}

/** A loaded ROS map layer as held in the store and saved in the project file. */
export interface ProjectMapLayer {
  id: string;
  name: string;
  info: MapLayerInfo | any;
  image_base64: string;
  width: number;
  height: number;
  visible: boolean;
  opacity: number;
  z_index: number;
  blend_mode?: 'overwrite' | 'merge_obstacles' | 'merge_free';
}

export type ExportRegion = {
  id: string;
  name: string;
  rect: { x: number; y: number; width: number; height: number };
  visible: boolean;
  layerVisibility?: Record<string, boolean>; // Deprecated
};

export interface OccupancySettings {
  defaultOccupiedThresh: number; // 0.0 ~ 1.0 (default 0.65)
  defaultFreeThresh: number; // 0.0 ~ 1.0 (default 0.25)
  defaultNegate: 0 | 1; // 0: normal, 1: inverted
}
