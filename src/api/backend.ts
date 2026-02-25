import { invoke } from '@tauri-apps/api/core';
import { OptionsSchema, ProjectData, PluginInstance } from '../types/store';

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

export const BackendAPI = {
  loadROSMap: async (yamlPath: string): Promise<MapLoadResult> => {
    return invoke('load_ros_map', { yamlPath });
  },

  saveProject: async (path: string, data: ProjectData): Promise<void> => {
    return invoke('save_project', { path, data });
  },

  loadProject: async (path: string): Promise<ProjectData> => {
    return invoke('load_project', { path });
  },

  loadOptionsSchema: async (yamlPath: string): Promise<OptionsSchema> => {
    return invoke('load_options_schema', { yamlPath });
  },

  exportWaypoints: async (path: string, waypoints: Record<string, any>[], template?: string, imageB64?: string): Promise<void> => {
    return invoke('export_waypoints', { path, waypoints, template: template || null, imageDataB64: imageB64 || null });
  },

  fetchInstalledPlugins: async (): Promise<PluginInstance[]> => {
    return invoke('fetch_installed_plugins');
  },

  scanCustomPlugin: async (path: string): Promise<PluginInstance> => {
    return invoke('scan_custom_plugin', { path });
  },

  runPlugin: async (
    pluginInstance: PluginInstance,
    contextData: any,
    pythonPath?: string,
  ): Promise<Record<string, any>[]> => {
    return invoke('run_plugin', { pluginInstance, contextJson: JSON.stringify(contextData), pythonPath });
  },

  getPythonEnvironments: async (): Promise<string[]> => {
    return invoke('get_python_environments');
  },

  scaffoldPlugin: async (pluginName: string, targetDir: string): Promise<PluginInstance> => {
    return invoke('scaffold_plugin', { pluginName, targetDir });
  },

  checkSdkVersion: async (): Promise<string> => {
    return invoke('check_sdk_version');
  },

  updatePluginSdk: async (pluginFolderPath: string): Promise<string> => {
    return invoke('update_plugin_sdk', { pluginFolderPath });
  }
};

if (import.meta.env.DEV) {
  (window as any).__BackendAPI = BackendAPI;
}
