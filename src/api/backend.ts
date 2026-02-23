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

  exportWaypoints: async (path: string, waypoints: Record<string, any>[], template?: string): Promise<void> => {
    return invoke('export_waypoints', { path, waypoints, template: template || null });
  },

  fetchInstalledPlugins: async (): Promise<PluginInstance[]> => {
    return invoke('fetch_installed_plugins');
  },

  runPlugin: async (pluginInstance: PluginInstance, contextData: any): Promise<Record<string, any>[]> => {
    const contextJson = JSON.stringify(contextData);
    return invoke('run_plugin', { pluginInstance, contextJson });
  }
};

if (import.meta.env.DEV) {
  (window as any).__BackendAPI = BackendAPI;
}
