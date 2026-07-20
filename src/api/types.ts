import { OptionsSchema, ProjectData, PluginInstance, ProjectMapLayer } from '../types/store';

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

export interface IBackendAPI {
  loadROSMap(yamlPath: string): Promise<MapLoadResult>;
  saveProject(path: string, data: ProjectData): Promise<void>;
  loadProject(path: string): Promise<ProjectData>;
  loadOptionsSchema(yamlPath: string): Promise<OptionsSchema>;
  exportWaypoints(path: string, waypoints: Record<string, any>[], template?: string, imageB64?: string): Promise<void>;
  fetchInstalledPlugins(): Promise<PluginInstance[]>;
  scanCustomPlugin(path: string): Promise<PluginInstance>;
  runPlugin(
    pluginInstance: PluginInstance,
    contextData: any,
    pythonPath?: string,
    mapLayers?: ProjectMapLayer[],
  ): Promise<Record<string, any>[]>;
  getPythonEnvironments(): Promise<string[]>;
  scaffoldPlugin(pluginName: string, targetDir: string): Promise<PluginInstance>;
  checkSdkVersion(): Promise<string>;
  updatePluginSdk(pluginFolderPath: string): Promise<string>;
  readImageBase64(path: string): Promise<string>;
  exportMaps(options: ExportMapsOptions): Promise<void>;
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
