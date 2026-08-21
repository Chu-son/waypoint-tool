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

export type WaypointNode = {
  id: string;
  type: 'manual' | 'generator';
  transform?: Transform;
  generator_params?: Record<string, any>;
  options?: WaypointOptions;
  children_ids?: string[];
  plugin_id?: string; // Add plugin reference for generator nodes
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
export type PluginInputType = 'point' | 'rectangle' | 'waypoint';

export type PluginInputDef = {
  id: string;
  name: string; // The property key name
  label: string; // The display label
  description?: string;
  type: PluginInputType | 'boolean' | 'integer' | 'float' | 'string';
  default?: any;
  required?: boolean;
};

export type PluginManifest = {
  name: string;
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
// ---------------------------------

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

export type EditObjectType = 'rect' | 'circle' | 'freehand';

interface EditObjectBase {
  id: string;
  type: EditObjectType;
  fillValue: number; // 0~255 (0=black=obstacle, 255=white=free space)
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

export type EditObject = RectEditObject | CircleEditObject | FreehandEditObject;

export interface EditLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  z_index: number; // Index within EditLayers
  targetMapLayerId?: string | null; // Optional / Deprecated
  editObjects: EditObject[];
}

export interface ProjectData {
  root_node_ids: string[];
  nodes: Record<string, ObjectNode>;
  map_layers?: ProjectMapLayer[];
  robot_footprint?: RobotFootprint;
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
