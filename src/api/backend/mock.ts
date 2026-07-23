import { OptionsSchema, ProjectData, PluginInstance, ProjectMapLayer } from '../../types/store';
import { IBackendAPI, MapLoadResult, BlendPreviewLayerInput, BlendPreviewResult } from '../types';

export class MockBackendAPI implements IBackendAPI {
  async loadROSMap(yamlPath: string): Promise<MapLoadResult> {
    console.log('[Mock Backend] loadROSMap called with path:', yamlPath);
    return {
      info: {
        image: "dummy_image.png",
        resolution: 0.05,
        origin: [0, 0, 0],
        negate: 0,
        occupied_thresh: 0.65,
        free_thresh: 0.196
      },
      image_data_b64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      width: 1,
      height: 1
    };
  }

  async saveProject(_path: string, _data: ProjectData): Promise<void> {
    console.log('[Mock Backend] saveProject called with path:', _path);
  }

  async loadProject(path: string): Promise<ProjectData> {
    console.log('[Mock Backend] loadProject called with path:', path);
    return { root_node_ids: [], nodes: {}, map_layers: [] };
  }

  async loadOptionsSchema(yamlPath: string): Promise<OptionsSchema> {
    console.log('[Mock Backend] loadOptionsSchema called with path:', yamlPath);
    return { options: [] };
  }

  async exportWaypoints(_path: string, _waypoints: Record<string, any>[], _template?: string, _imageB64?: string): Promise<void> {
    console.log('[Mock Backend] exportWaypoints called to path:', _path, _waypoints.length, 'points');
  }

  async fetchInstalledPlugins(): Promise<PluginInstance[]> {
    console.log('[Mock Backend] fetchInstalledPlugins called');
    return [{
      id: 'mock-plugin',
      folder_path: '/mock/path',
      is_builtin: false,
      manifest: { name: 'Mock Plugin', description: 'A dummy plugin for testing', type: 'python', executable: 'main.py', inputs: [], properties: [] }
    }];
  }

  async scanCustomPlugin(path: string): Promise<PluginInstance> {
    console.log('[Mock Backend] scanCustomPlugin called with path:', path);
    return {
      id: 'scanned-plugin',
      folder_path: path,
      is_builtin: false,
      manifest: { name: 'Scanned Plugin', description: 'Mock', type: 'python', executable: 'main.py', inputs: [], properties: [] }
    };
  }

  async runPlugin(
    pluginInstance: PluginInstance,
    _contextData: any,
    _pythonPath?: string,
    _mapLayers?: ProjectMapLayer[]
  ): Promise<Record<string, any>[]> {
    console.log('[Mock Backend] runPlugin called for:', pluginInstance.manifest.name);
    return [];
  }

  async getPythonEnvironments(): Promise<string[]> {
    console.log('[Mock Backend] getPythonEnvironments called');
    return ['/usr/bin/python3', '/mock/env/bin/python'];
  }

  async scaffoldPlugin(pluginName: string, targetDir: string): Promise<PluginInstance> {
    console.log('[Mock Backend] scaffoldPlugin called with name:', pluginName, 'dir:', targetDir);
    return {
      id: pluginName,
      folder_path: targetDir,
      is_builtin: false,
      manifest: { name: pluginName, type: 'python', executable: 'main.py', inputs: [], properties: [] }
    };
  }

  async checkSdkVersion(): Promise<string> {
    console.log('[Mock Backend] checkSdkVersion called');
    return "0.1.0-mock";
  }

  async updatePluginSdk(pluginFolderPath: string): Promise<string> {
    console.log('[Mock Backend] updatePluginSdk called for:', pluginFolderPath);
    return "Mock SDK Updated successfully";
  }

  async readImageBase64(path: string): Promise<string> {
    console.log('[Mock Backend] readImageBase64 called for:', path);
    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  }

  async exportMaps(options: any): Promise<void> {
    console.log('[Mock Backend] exportMaps called with options:', options);
  }

  async blendMapPreview(_layers: BlendPreviewLayerInput[]): Promise<BlendPreviewResult> {
    console.log('[Mock Backend] blendMapPreview called');
    return {
      image_data_b64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      width: 1,
      height: 1,
      origin: [0, 0, 0],
      resolution: 0.05,
    };
  }
}
