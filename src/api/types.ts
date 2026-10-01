import { PluginInstance, MapLayerClip, ImportFieldMapping, TemplateEngine } from '../types/store';
import type { ExportGeoOrigin } from '../utils/exportWaypointUtils';

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
    clip?: MapLayerClip | null;
  }[];
};

export type BlendPreviewLayerInput = {
  id: string;
  image_base64?: string;
  info?: any;
  blend_mode: string;
  z_index: number;
  visible: boolean;
  clip?: MapLayerClip | null;
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
  saveProject(path: string, data: any): Promise<void>;
  loadProject(path: string): Promise<any>;
  /** 構造検証済みだが未正規化の生 JSON を返す。呼び出し側で `normalizeOptionsSchema` を通すこと。 */
  loadOptionsSchema(yamlPath: string): Promise<unknown>;
  exportWaypoints(path: string, waypoints: Record<string, any>[], template?: string, imageB64?: string): Promise<void>;
  importWaypointsRaw(path: string): Promise<any>;
  inferImportMapping(templateContent: string, engine?: TemplateEngine): Promise<ImportFieldMapping>;
  fetchInstalledPlugins(): Promise<PluginInstance[]>;
  scanCustomPlugin(path: string): Promise<PluginInstance>;
  scanCustomPlugins(path: string): Promise<PluginInstance[]>;
  runPlugin(
    pluginInstance: PluginInstance,
    contextData: any,
    pythonPath?: string,
    mapLayers?: BlendPreviewLayerInput[],
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
  loadCustomUiPreset(): Promise<{ type: 'dev' | 'sample'; path: string; config: any } | null>;
  checkPythonPackages(pythonPath: string, packages: string[]): Promise<Record<string, boolean>>;
  createVirtualenv(targetDir: string, basePython?: string): Promise<string>;
  installPipPackages(pythonPath: string, packages: string[]): Promise<string>;
  checkExportConflicts(files: string[]): Promise<string[]>;
  executeExportPackage(options: ExecuteExportPackageOptions): Promise<ExportResultSummary>;
  /** 背景地図タイルを取得（ディスクキャッシュ優先）し、`data:` URL で返す。 */
  fetchMapTile(url: string): Promise<string>;
}

export type PackageExportWaypointItem = {
  path: string;
  waypoints: Record<string, any>[];
  template?: string;
  /** 省略時はバックエンド側で 'handlebars' として扱われる。 */
  engine?: TemplateEngine;
  image_data_b64?: string;
};

export type PackageExportMapItem = {
  save_path: string;
  format: 'ros_standard' | 'png_only';
  region: {
    name: string;
    rect: { x: number; y: number; width: number; height: number };
    layerVisibility: Record<string, boolean>;
  };
  layers: {
    id: string;
    name: string;
    image_base64?: string;
    info?: any;
    opacity: number;
    blend_mode: string;
    z_index: number;
    clip?: MapLayerClip | null;
  }[];
};

export type ExecuteExportPackageOptions = {
  root_dir: string;
  conflict_resolution: 'overwrite' | 'backup_file';
  session_timestamp: string;
  /** Project-wide values exposed to waypoint templates as `globals`. */
  globals: Record<string, any>;
  /** Aligned map origin (lat/lon, UTM, heading) exposed to waypoint templates as `geo`. */
  geo: ExportGeoOrigin;
  /** true の場合、整数値も float 形式（0 → 0.0）で出力する（`index` と `integer_keys` を除く）。 */
  float_numbers: boolean;
  /** float 化から除外する、スキーマ上 integer 型のオプション名。 */
  integer_keys: string[];
  waypoint_items: PackageExportWaypointItem[];
  map_items: PackageExportMapItem[];
};

export type ExportResultSummary = {
  exported_files_count: number;
  backed_up_files: string[];
};

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
  /** Show an informational message box and wait until the user dismisses it. */
  message(message: string, options?: MessageDialogOptions): Promise<void>;
}

export type MessageDialogOptions = {
  title?: string;
  kind?: 'info' | 'warning' | 'error';
};

/** Application process and main-window control. */
export interface IAppAPI {
  getVersion(): Promise<string>;
  /** Quit immediately, bypassing the close-requested handler. */
  forceExit(): Promise<void>;
  openDevtools(): Promise<void>;
  setWindowTitle(title: string): Promise<void>;
  minimizeWindow(): Promise<void>;
  toggleMaximizeWindow(): Promise<void>;
  /** Persist window size/position so it is restored on next launch. */
  saveWindowState(): Promise<void>;
  /**
   * Intercept the window close button. The default close is always prevented; the handler
   * decides whether to quit (e.g. by calling `forceExit`). Resolves to an unsubscribe function.
   */
  onCloseRequested(handler: () => void | Promise<void>): Promise<() => void>;
}
