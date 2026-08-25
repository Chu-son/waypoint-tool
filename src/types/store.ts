export type Transform = {
  x: number;
  y: number;
  z?: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
};

export type OptionDef = {
  name: string;
  label: string;
  type: string;
  item_type?: string;
  default?: any;
  enum_values?: string[];
  interaction_hint?: {
    type: 'start_corner' | 'sweep_direction';
    target_input: string;
  };
};

export type OptionsSchema = {
  options: OptionDef[];
};

export type ImportFieldMapping = {
  itemsPath?: string;
  id?: string;
  x: string;
  y: string;
  z?: string;
  yaw?: string;
  qx?: string;
  qy?: string;
  qz?: string;
  qw?: string;
  optionsPath?: string;
};

export type ExportTemplate = {
  id: string;
  name: string;
  extension: string;
  suffix: string;
  content: string;
  scope?: 'global' | 'local';
  importMapping?: ImportFieldMapping;
};

export interface RecentProjectItem {
  path: string;
  name: string;
  lastOpened: number;
}

export interface PluginSetting {
  id: string;
  path?: string;
  enabled: boolean;
  order: number;
  isBuiltin: boolean;
  pythonOverridePath?: string;
  icon?: string;
}

export type WaypointOptions = Record<string, string | number | boolean | Array<string | number | boolean>>;

export interface GeneratorMetadata {
  /** 1回の生成セッションを一意に識別するUUID。複合出力されたオブジェクト間で共有される */
  source_execution_id?: string;
  /** 実行されたプラグインのID */
  plugin_id?: string;
  /** 実行時に渡されたパラメータおよびインタラクション入力のスナップショット */
  generator_params?: {
    properties?: Record<string, any>;
    interaction_data?: Record<string, any>;
    [key: string]: any;
  };
  /** プラグインが出力した内部計算データ（ベクトル場、探索グラフ、数値メトリクスなど） */
  plugin_data?: Record<string, any>;
}

export type WaypointNode = {
  id: string;
  type: 'manual' | 'generator';
  name?: string;
  transform?: Transform;
  generator_params?: Record<string, any>;
  options?: WaypointOptions;
  children_ids?: string[];
  plugin_id?: string; // Add plugin reference for generator nodes
  source_execution_id?: string;
  plugin_data?: Record<string, any>;
};

// --- Robot Footprint Types ---
export type CircularFootprint = {
  type: 'circular';
  radius: number; // in meters
};

export type RectangularFootprint = {
  type: 'rectangular';
  length: number;    // X direction (front-to-back, in meters)
  width: number;     // Y direction (left-to-right, in meters)
  offset_x?: number; // Offset of robot center from footprint origin (in meters)
  offset_y?: number; // Offset of robot center from footprint origin (in meters)
};

export type PolygonFootprint = {
  type: 'polygon';
  points: Array<[number, number]>; // [[x, y], ...] in robot local frame (in meters)
};

export type RobotFootprint = CircularFootprint | RectangularFootprint | PolygonFootprint;
// -----------------------------

// --- Plugin Architecture Types ---
export type PluginPrimaryOutput = 'waypoints' | 'custom_layer' | 'annotations' | 'path_calculator';
export type PluginCategory = 'waypoint_generator' | 'map_layer_generator' | 'path_calculator' | PluginPrimaryOutput;
export type PluginInputType = 'point' | 'points' | 'point_list' | 'rectangle' | 'waypoint' | 'annotation' | 'custom_layer';

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
  type: 'python' | 'wasm';
  executable: string;
  inputs: PluginInputDef[];
  needs?: ('selected_points' | 'occupancy_grid' | 'occupancy_grid_in_region' | 'robot_footprint')[];
  properties: OptionDef[];
  icon?: string;
};

export type DefaultExportFormat = {
  id: string; // e.g. '__default_yaml__'
  name: string;
  extension: string;
  suffix: string;
  enabled: boolean;
};

export type PluginInstance = {
  id: string;
  manifest: PluginManifest;
  folder_path: string;
  is_builtin: boolean;
  sdk_version?: string;
};

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
  cx: number;     // Center world coordinate X (meters)
  cy: number;     // Center world coordinate Y (meters)
  width: number;  // Width in world units (meters)
  height: number; // Height in world units (meters)
  angle: number;  // Radians (relative to center point)
}

export interface CircleEditObject extends EditObjectBase {
  type: 'circle';
  cx: number;     // Center world coordinate X (meters)
  cy: number;     // Center world coordinate Y (meters)
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
}

export type CustomLayer = ManualCustomLayer | PluginCustomLayer;

// Aliases for type compatibility if needed
export type EditLayer = ManualCustomLayer;
export type GeneratedMapLayer = PluginCustomLayer;
// --- Annotation Objects Types ---
export type AnnotationType = 'point' | 'oriented_point' | 'line' | 'rect' | 'circle';

export interface AnnotationBase {
  id: string;
  name: string;
  type: AnnotationType;
  visible: boolean;
  labelVisible: boolean;
  color?: string; // HEX color (e.g. '#3B82F6')
  group_id?: string; // 親グループID（存在する場合）
  source_execution_id?: string;
  plugin_data?: Record<string, any>;
}

export interface PointAnnotation extends AnnotationBase {
  type: 'point';
  x: number;
  y: number;
}

export interface OrientedPointAnnotation extends AnnotationBase {
  type: 'oriented_point';
  x: number;
  y: number;
  yaw: number; // radians
}

export interface LineAnnotation extends AnnotationBase {
  type: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface RectAnnotation extends AnnotationBase {
  type: 'rect';
  cx: number;
  cy: number;
  width: number;
  height: number;
  angle: number; // radians
}

export interface CircleAnnotation extends AnnotationBase {
  type: 'circle';
  cx: number;
  cy: number;
  radius: number;
}

export type AnnotationObject =
  | PointAnnotation
  | OrientedPointAnnotation
  | LineAnnotation
  | RectAnnotation
  | CircleAnnotation;

export interface AnnotationGroup {
  id: string;
  name: string;
  type: 'generator' | 'manual_group';
  visible: boolean;
  color?: string;
  children_ids: string[];
  plugin_id?: string;
  source_execution_id?: string;
  generator_params?: Record<string, any>;
  plugin_data?: Record<string, any>;
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
  waypoints?: {
    name?: string;
    items: PluginWaypointOutputItem[];
    plugin_data?: Record<string, any>;
  } | PluginWaypointOutputItem[];
  custom_layers?: PluginCustomLayerOutputItem[];
  annotations?: {
    name?: string;
    items: PluginAnnotationOutputItem[];
    plugin_data?: Record<string, any>;
  } | PluginAnnotationOutputItem[];
  plugin_data?: Record<string, any>;
  segments?: Array<Array<{ x: number; y: number }>>; // For path calculators
}
// ---------------------------------------

export type ObjectNode = WaypointNode;

export type MapLayer = {
  id: string;
  name: string;
  info: any;
  imageBase64: string;
  width: number;
  height: number;
  visible: boolean;
  opacity: number;
  zIndex: number;
  blendMode?: 'normal' | 'darken' | 'lighten';
};

export type ExportRegion = {
  id: string;
  name: string;
  rect: { x: number; y: number; width: number; height: number };
  visible: boolean;
  layerVisibility?: Record<string, boolean>; // Deprecated
};

// In a real app, this is what the global state looks like
export interface ProjectMapLayer {
  id: string;
  name: string;
  info: any;
  image_base64: string;
  width: number;
  height: number;
  visible: boolean;
  opacity: number;
  z_index: number;
  blend_mode?: 'overwrite' | 'merge_obstacles' | 'merge_free';
}

// --- Occupancy Settings Types ---
export interface OccupancySettings {
  defaultOccupiedThresh: number; // 0.0 ~ 1.0 (default 0.65)
  defaultFreeThresh: number;     // 0.0 ~ 1.0 (default 0.25)
  defaultNegate: 0 | 1;          // 0: normal, 1: inverted
}
// --------------------------------

export interface ProjectData {
  root_node_ids: string[];
  nodes: Record<string, ObjectNode>;
  map_layers?: ProjectMapLayer[];
  custom_layers?: CustomLayer[];
  annotation_objects?: AnnotationObject[];
  annotation_groups?: Record<string, AnnotationGroup>;
  root_annotation_ids?: string[];
  edit_layers?: any[]; // Legacy
  generated_layers?: any[]; // Legacy
  robot_footprint?: RobotFootprint;
  occupancy_settings?: OccupancySettings;
  default_map_opacity?: number;
  left_panel_view_mode?: 'tabs' | 'split';
  right_panel_view_mode?: 'tabs' | 'split';
  active_path_calculator_plugin_id?: string | null;
  path_calculator_params?: Record<string, any>;
  auto_recalculate_path?: boolean;
}
export interface AppState {
  nodes: Record<string, ObjectNode>;
  rootNodeIds: string[];
  selectedNodeIds: string[];
  activeTool: 'select' | 'add_point' | 'add_rect_sweep' | 'add_export_region';
  
  // Maps & Layers
  mapLayers: MapLayer[];
  defaultMapOpacity: number;
  lastDirectory: string | null;

  enableSnapping: boolean;

  optionsSchema: OptionsSchema | null;
  exportTemplates: ExportTemplate[];
  defaultExportFormats: DefaultExportFormat[];
  globalPythonPath: string;
  
  // Unsaved changes tracker
  isDirty: boolean;
  
  // Actions
  setDirty: (dirty: boolean) => void;
  addMapLayer: (name: string, info: any, base64: string, width: number, height: number) => void;
  updateMapLayer: (id: string, updates: Partial<MapLayer>) => void;
  removeMapLayer: (id: string) => void;
  reorderMapLayers: (fromIndex: number, toIndex: number) => void;
  setDefaultMapOpacity: (opacity: number) => void;
  setLastDirectory: (dir: string | null) => void;
  setGlobalPythonPath: (path: string) => void;
  setEnableSnapping: (enable: boolean) => void;

  setOptionsSchema: (schema: OptionsSchema) => void;
  addExportTemplate: (template: Omit<ExportTemplate, 'id'>) => void;
  updateExportTemplate: (id: string, updates: Partial<ExportTemplate>) => void;
  removeExportTemplate: (id: string) => void;
  updateDefaultExportFormat: (id: string, updates: Partial<DefaultExportFormat>) => void;

  setActiveTool: (tool: AppState['activeTool']) => void;
  selectNodes: (ids: string[], multi?: boolean) => void;
  addNode: (node: ObjectNode, parentId?: string) => void;
  updateNode: (id: string, updates: Partial<ObjectNode>) => void;
  removeNodes: (ids: string[]) => void;
}
