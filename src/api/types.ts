import { OptionsSchema, ProjectData, PluginInstance, ProjectMapLayer, ImportFieldMapping } from '../types/store';

export type MapLoadResult = {
  info: {
    image: string;
    resolution: number;
    origin: [number, number, number];
    negate: number;
    occupied_thresh: number;
    free_thresh: number;
  };
  image_data_b64: string;
  width: number;
  height: number;
};

export type ExportMapsOptions = {
  saveDir: string;
  format: 'ros_standard' | 'png_only';
  mapListFilename: string | null;
  regions: {
    name: string;
    rect: { x: number; y: number; width: number; height: number };
    layerVisibility: Record<string, boolean>;
  }[];
  layers: {
    id: string;
    name: string;
    image_base64?: string;
    info?: any;
    opacity: number;
    blend_mode: string;
    z_index: number;
  }[];
};

export type BlendPreviewLayerInput = {
  id: string;
  image_base64?: string;
  info?: any;
  blend_mode: string;
  z_index: number;
  visible: boolean;
};

export type BlendPreviewResult = {
  image_data_b64: string;
  width: number;
  height: number;
  origin: [number, number, number];
  resolution: number;
};

export interface IBackendAPI {
  loadROSMap(yamlPath: string): Promise<MapLoadResult>;
  saveProject(path: string, data: ProjectData): Promise<void>;
  loadProject(path: string): Promise<ProjectData>;
  loadOptionsSchema(yamlPath: string): Promise<OptionsSchema>;
  exportWaypoints(path: string, waypoints: Record<string, any>[], template?: string, imageB64?: string): Promise<void>;
  importWaypointsRaw(path: string): Promise<any>;
  inferImportMapping(templateContent: string): Promise<ImportFieldMapping>;
  fetchInstalledPlugins(): Promise<PluginInstance[]>;
  scanCustomPlugin(path: string): Promise<PluginInstance>;
  runPlugin(
    pluginInstance: PluginInstance,
    contextData: any,
    pythonPath?: string,
    mapLayers?: (ProjectMapLayer | BlendPreviewLayerInput)[],
  ): Promise<any>;
  getPythonEnvironments(): Promise<string[]>;
  scaffoldPlugin(pluginName: string, targetDir: string): Promise<PluginInstance>;
  checkSdkVersion(): Promise<string>;
  updatePluginSdk(pluginFolderPath: string): Promise<string>;
  readImageBase64(path: string): Promise<string>;
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, content: string): Promise<void>;
  exportMaps(options: ExportMapsOptions): Promise<void>;
  blendMapPreview(layers: BlendPreviewLayerInput[]): Promise<BlendPreviewResult>;
  loadCustomUiConfig(): Promise<any>;
}

export interface OpenDialogOptions {
  multiple?: boolean;
  directory?: boolean;
  defaultPath?: string;
  filters?: {
    name: string;
    extensions: string[];
  }[];
}

export interface SaveDialogOptions {
  defaultPath?: string;
  filters?: {
    name: string;
    extensions: string[];
  }[];
}

export interface IDialogAPI {
  open(options?: OpenDialogOptions): Promise<string | string[] | null>;
  save(options?: SaveDialogOptions): Promise<string | null>;
  ask(message: string, options?: any): Promise<boolean>;
}
