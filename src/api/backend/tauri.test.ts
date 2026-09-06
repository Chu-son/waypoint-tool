import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TauriBackendAPI } from './tauri';
import { invoke } from '@tauri-apps/api/core';

// Mock tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('TauriBackendAPI', () => {
  const api = new TauriBackendAPI();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls load_ros_map with yamlPath', async () => {
    (invoke as any).mockResolvedValue({ success: true });
    const result = await api.loadROSMap('/path/to/map.yaml');
    expect(invoke).toHaveBeenCalledWith('load_ros_map', { yamlPath: '/path/to/map.yaml' });
    expect(result).toEqual({ success: true });
  });

  it('calls save_project with path and data', async () => {
    const data: any = { nodes: {} };
    await api.saveProject('/path/to/proj', data);
    expect(invoke).toHaveBeenCalledWith('save_project', { path: '/path/to/proj', data });
  });

  it('calls run_plugin with correct arguments and stringified context', async () => {
    const plugin: any = { id: 'p1' };
    const context = { key: 'val' };
    await api.runPlugin(plugin, context, 'python3');
    expect(invoke).toHaveBeenCalledWith('run_plugin', {
      pluginInstance: plugin,
      contextJson: JSON.stringify(context),
      pythonPath: 'python3'
    });
  });

  it('calls export_waypoints with optional arguments handling', async () => {
    await api.exportWaypoints('/path/to/export', []);
    expect(invoke).toHaveBeenCalledWith('export_waypoints', {
      path: '/path/to/export',
      waypoints: [],
      template: null,
      imageDataB64: null
    });
  });

  it('calls check_python_packages with pythonPath and packages', async () => {
    (invoke as any).mockResolvedValue({ numpy: true, scipy: false });
    const result = await api.checkPythonPackages('/usr/bin/python3', ['numpy', 'scipy']);
    expect(invoke).toHaveBeenCalledWith('check_python_packages', {
      pythonPath: '/usr/bin/python3',
      packages: ['numpy', 'scipy'],
    });
    expect(result).toEqual({ numpy: true, scipy: false });
  });

  it('calls create_virtualenv with targetDir and basePython', async () => {
    (invoke as any).mockResolvedValue('/path/to/venv/bin/python');
    const result = await api.createVirtualenv('/path/to/venv', '/usr/bin/python3');
    expect(invoke).toHaveBeenCalledWith('create_virtualenv', {
      targetDir: '/path/to/venv',
      basePython: '/usr/bin/python3',
    });
    expect(result).toBe('/path/to/venv/bin/python');
  });

  it('calls install_pip_packages with pythonPath and packages', async () => {
    (invoke as any).mockResolvedValue('Successfully installed numpy');
    const result = await api.installPipPackages('/path/to/venv/bin/python', ['numpy']);
    expect(invoke).toHaveBeenCalledWith('install_pip_packages', {
      pythonPath: '/path/to/venv/bin/python',
      packages: ['numpy'],
    });
    expect(result).toBe('Successfully installed numpy');
  });
});
