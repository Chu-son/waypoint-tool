import { invoke } from '@tauri-apps/api/core';
import { OptionsSchema, ProjectData, PluginInstance } from '../../types/store';
import { IBackendAPI, MapLoadResult } from '../types';

export class TauriBackendAPI implements IBackendAPI {
  async loadROSMap(yamlPath: string): Promise<MapLoadResult> {
    return invoke('load_ros_map', { yamlPath });
  }

  async saveProject(path: string, data: ProjectData): Promise<void> {
    return invoke('save_project', { path, data });
  }

  async loadProject(path: string): Promise<ProjectData> {
    return invoke('load_project', { path });
  }

  async loadOptionsSchema(yamlPath: string): Promise<OptionsSchema> {
    return invoke('load_options_schema', { yamlPath });
  }

  async exportWaypoints(path: string, waypoints: Record<string, any>[], template?: string, imageB64?: string): Promise<void> {
    return invoke('export_waypoints', { path, waypoints, template: template || null, imageDataB64: imageB64 || null });
  }

  async fetchInstalledPlugins(): Promise<PluginInstance[]> {
    return invoke('fetch_installed_plugins');
  }

  async scanCustomPlugin(path: string): Promise<PluginInstance> {
    return invoke('scan_custom_plugin', { path });
  }

  async runPlugin(
    pluginInstance: PluginInstance,
    contextData: any,
    pythonPath?: string,
  ): Promise<Record<string, any>[]> {
    return invoke('run_plugin', { pluginInstance, contextJson: JSON.stringify(contextData), pythonPath });
  }

  async getPythonEnvironments(): Promise<string[]> {
    return invoke('get_python_environments');
  }

  async scaffoldPlugin(pluginName: string, targetDir: string): Promise<PluginInstance> {
    return invoke('scaffold_plugin', { pluginName, targetDir });
  }

  async checkSdkVersion(): Promise<string> {
    return invoke('check_sdk_version');
  }

  async updatePluginSdk(pluginFolderPath: string): Promise<string> {
    return invoke('update_plugin_sdk', { pluginFolderPath });
  }

  async readImageBase64(path: string): Promise<string> {
    return invoke('read_image_base64', { path });
  }
}
