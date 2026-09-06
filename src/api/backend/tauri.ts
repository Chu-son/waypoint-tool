import { invoke } from '@tauri-apps/api/core';
import { OptionsSchema, PluginInstance, ProjectMapLayer, ImportFieldMapping } from '../../types/store';
import { IBackendAPI, MapLoadResult, BlendPreviewLayerInput, BlendPreviewResult } from '../types';

export class TauriBackendAPI implements IBackendAPI {
  async loadROSMap(yamlPath: string): Promise<MapLoadResult> {
    return invoke('load_ros_map', { yamlPath });
  }

  async saveProject(path: string, data: any): Promise<void> {
    return invoke('save_project', { path, data });
  }

  async loadProject(path: string): Promise<any> {
    return invoke('load_project', { path });
  }

  async loadOptionsSchema(yamlPath: string): Promise<OptionsSchema> {
    return invoke('load_options_schema', { yamlPath });
  }

  async exportWaypoints(path: string, waypoints: Record<string, any>[], template?: string, imageB64?: string): Promise<void> {
    return invoke('export_waypoints', { path, waypoints, template: template || null, imageDataB64: imageB64 || null });
  }

  async importWaypointsRaw(path: string): Promise<any> {
    return invoke('import_waypoints', { path });
  }

  async inferImportMapping(templateContent: string): Promise<ImportFieldMapping> {
    return invoke('infer_import_mapping', { template: templateContent });
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
    mapLayers?: (ProjectMapLayer | BlendPreviewLayerInput)[],
  ): Promise<any> {
    return invoke('run_plugin', {
      pluginInstance,
      contextJson: JSON.stringify(contextData),
      pythonPath,
      mapLayers,
    });
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

  async readTextFile(path: string): Promise<string> {
    return invoke('read_text_file', { path });
  }

  async writeTextFile(path: string, content: String): Promise<void> {
    return invoke('write_text_file', { path, content });
  }

  async exportMaps(options: any): Promise<void> {
    return invoke('export_maps', { options });
  }

  async blendMapPreview(layers: BlendPreviewLayerInput[]): Promise<BlendPreviewResult> {
    return invoke('blend_map_preview', { layers });
  }

  async loadCustomUiConfig(): Promise<any> {
    return invoke('load_custom_ui_config');
  }

  async loadCustomUiPreset(): Promise<any> {
    return invoke('load_custom_ui_preset');
  }

  async checkPythonPackages(pythonPath: string, packages: string[]): Promise<Record<string, boolean>> {
    return invoke('check_python_packages', { pythonPath, packages });
  }

  async createVirtualenv(targetDir: string, basePython?: string): Promise<string> {
    return invoke('create_virtualenv', { targetDir, basePython });
  }

  async installPipPackages(pythonPath: string, packages: string[]): Promise<string> {
    return invoke('install_pip_packages', { pythonPath, packages });
  }
}
