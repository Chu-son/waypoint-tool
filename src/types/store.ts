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
};

export type OptionsSchema = {
  options: OptionDef[];
};

export type ExportTemplate = {
  id: string;
  name: string;
  extension: string;
  suffix: string;
  content: string;
};

export interface PluginSetting {
  id: string;
  path?: string;
  enabled: boolean;
  order: number;
  isBuiltin: boolean;
  pythonOverridePath?: string;
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

// --- Plugin Architecture Types ---
export type PluginInputType = 'point' | 'rectangle' | 'polygon' | 'path' | 'node_select';

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
  needs?: ('map_image' | 'waypoints' | 'layers')[];
  properties: OptionDef[];
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
}

export interface ProjectData {
  root_node_ids: string[];
  nodes: Record<string, ObjectNode>;
  map_layers?: ProjectMapLayer[];
}
export interface AppState {
  nodes: Record<string, ObjectNode>;
  rootNodeIds: string[];
  selectedNodeIds: string[];
  activeTool: 'select' | 'add_point' | 'add_rect_sweep';
  
  // Maps & Layers
  mapLayers: MapLayer[];
  defaultMapOpacity: number;
  lastDirectory: string | null;

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
