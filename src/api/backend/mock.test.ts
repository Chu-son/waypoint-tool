import { describe, it, expect } from 'vitest';
import { MockBackendAPI } from './mock';

describe('MockBackendAPI', () => {
  const api = new MockBackendAPI();

  it('provides a mock map on loadROSMap', async () => {
    const result = await api.loadROSMap('test.yaml');
    expect(result.image_data_b64).toBeDefined();
    expect(result.info).toBeDefined();
  });

  it('returns mock plugins list', async () => {
    const plugins = await api.fetchInstalledPlugins();
    expect(plugins.length).toBeGreaterThan(0);
    expect(plugins[0].id).toBeDefined();
  });

  it('runPlugin returns a simple waypoint', async () => {
    const plugin: any = { 
      id: 'test',
      manifest: { name: 'Test Plugin', inputs: [], properties: [] }
    };
    const res = await api.runPlugin(plugin, {});
    expect(res).toBeInstanceOf(Array);
  });

  it('getPythonEnvironments returns a dummy list', async () => {
    const envs = await api.getPythonEnvironments();
    expect(envs.some(e => e.includes('python3'))).toBe(true);
  });

  it('checkPythonPackages returns a map of package statuses', async () => {
    const res = await api.checkPythonPackages('/usr/bin/python3', ['numpy', 'shapely']);
    expect(res).toEqual({ numpy: true, shapely: true });
  });

  it('createVirtualenv returns a path to python in targetDir', async () => {
    const res = await api.createVirtualenv('/path/to/venv');
    expect(res).toBe('/path/to/venv/bin/python');
  });

  it('installPipPackages returns success message', async () => {
    const res = await api.installPipPackages('/path/to/venv/bin/python', ['numpy']);
    expect(res).toContain('Successfully installed numpy');
  });
});
