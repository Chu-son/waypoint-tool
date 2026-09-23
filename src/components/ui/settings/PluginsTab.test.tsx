import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginsTab } from './PluginsTab';
import { BackendAPI, DialogAPI } from '../../../api';
import { renderWithStore } from '../../../test/render';
import { getAppState } from '../../../test/store';
import { makePlugin } from '../../../test/fixtures';
import type { PluginInstance, PluginSetting } from '../../../types/store';

const libPlugin = makePlugin('lib-plugin', { name: 'Shared Math Library', type: 'python_library', version: '1.0.0' });
const pipelinePlugin = makePlugin('pipe-plugin', {
  name: 'My Pipeline Plugin',
  type: 'pipeline',
  pipeline: { steps: [{ step_id: 's1', plugin_id: 'py-plugin' }] } as any,
});
const pythonPlugin = makePlugin('py-plugin', {
  name: 'Python Generator',
  plugin_dependencies: [{ id: 'lib-plugin', version: '>=1.0.0' }],
  python_dependencies: [{ name: 'numpy', version: '1.24.0' }],
});

const settingFor = (plugin: PluginInstance, order: number): PluginSetting =>
  ({ id: plugin.id, enabled: true, order, isBuiltin: false, path: plugin.folder_path }) as PluginSetting;

function renderTab(plugins: PluginInstance[] = [libPlugin, pipelinePlugin, pythonPlugin]) {
  return renderWithStore(<PluginsTab bundledSdkVersion="1.0.0" globalPythonPath="/usr/bin/python3" />, {
    plugins: Object.fromEntries(plugins.map((p) => [p.id, p])),
    pluginSettings: plugins.map(settingFor),
    lastDirectory: '/home/user',
  });
}

describe('PluginsTab', () => {
  beforeEach(() => {
    vi.spyOn(BackendAPI, 'checkPythonPackages').mockResolvedValue({ numpy: false });
  });

  it('labels shared libraries and pipelines distinctly', () => {
    renderTab();
    expect(screen.getByText('Shared Library')).toBeInTheDocument();
    expect(screen.getByText('Pipeline')).toBeInTheDocument();
  });

  it('reports satisfied plugin dependencies', () => {
    renderTab();
    expect(screen.getAllByText('Dependencies OK').length).toBeGreaterThan(0);
  });

  it('explains missing plugin dependencies on demand', () => {
    const brokenPipeline = makePlugin('broken-pipe', {
      name: 'Broken Pipeline',
      type: 'pipeline',
      pipeline: { steps: [{ step_id: 's1', plugin_id: 'non-existent-plugin' }] } as any,
    });
    renderTab([libPlugin, pipelinePlugin, pythonPlugin, brokenPipeline]);

    fireEvent.click(screen.getByRole('button', { name: /Dependency Issues/i }));

    expect(screen.getByText(/Plugin "non-existent-plugin" is required/i)).toBeInTheDocument();
  });

  it('offers virtualenv setup when a required Python package is missing', async () => {
    renderTab();

    await waitFor(() => expect(BackendAPI.checkPythonPackages).toHaveBeenCalledWith('/usr/bin/python3', ['numpy']));

    fireEvent.click(await screen.findByRole('button', { name: /Setup venv \(仮想環境の作成\)/i }));

    expect(screen.getByText(/Virtual Environment Setup - Python Generator/i)).toBeInTheDocument();
  });

  it('stores a Python interpreter override for that plugin only', () => {
    renderTab();

    const overrideInputs = screen.getAllByPlaceholderText('Global: /usr/bin/python3');
    expect(overrideInputs).toHaveLength(2);
    fireEvent.change(overrideInputs[1], { target: { value: '/custom/venv/bin/python' } });

    const byId = Object.fromEntries(getAppState().pluginSettings.map((s) => [s.id, s]));
    expect(byId['py-plugin'].pythonOverridePath).toBe('/custom/venv/bin/python');
    expect(byId['lib-plugin'].pythonOverridePath).toBeUndefined();
  });

  it('checks the Python dependencies of shared libraries too', async () => {
    vi.spyOn(BackendAPI, 'checkPythonPackages').mockResolvedValue({ numpy: true, scipy: false });
    const libWithDeps = makePlugin('lib-plugin', {
      ...libPlugin.manifest,
      python_dependencies: [{ name: 'scipy', version: '1.10.0' }],
    });
    renderTab([libWithDeps, pipelinePlugin, pythonPlugin]);

    await waitFor(() => expect(BackendAPI.checkPythonPackages).toHaveBeenCalledWith('/usr/bin/python3', ['scipy']));
    expect(screen.getByText('scipy@1.10.0')).toBeInTheDocument();
  });

  describe('Add Folder', () => {
    const scanned = (id: string, name: string, folder: string): PluginInstance => ({
      ...makePlugin(id, { name }),
      folder_path: folder,
    });

    beforeEach(() => {
      vi.spyOn(DialogAPI, 'ask').mockResolvedValue(true);
    });

    it('imports a single plugin folder', async () => {
      const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
      const open = vi.spyOn(DialogAPI, 'open').mockResolvedValue('/path/to/new_plugin');
      const newPlugin = scanned('new_plugin', 'New Custom Plugin', '/path/to/new_plugin');
      vi.spyOn(BackendAPI, 'scanCustomPlugins').mockResolvedValue([newPlugin]);
      renderTab();

      fireEvent.click(screen.getByRole('button', { name: /Add Folder/i }));

      await waitFor(() => expect(getAppState().plugins.new_plugin).toEqual(newPlugin));
      expect(open).toHaveBeenCalledWith({ multiple: true, directory: true, defaultPath: '/home/user' });
      expect(getAppState().pluginSettings).toContainEqual(
        expect.objectContaining({ id: 'new_plugin', path: '/path/to/new_plugin' }),
      );
      expect(alert).toHaveBeenCalledWith("Plugin 'New Custom Plugin' をインポートしました。");
    });

    it('imports every plugin found under a parent directory', async () => {
      const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
      vi.spyOn(DialogAPI, 'open').mockResolvedValue('/path/to/plugins_parent');
      const pluginA = scanned('plugin_a', 'Plugin A', '/path/to/plugins_parent/plugin_a');
      const pluginB = scanned('plugin_b', 'Plugin B', '/path/to/plugins_parent/plugin_b');
      vi.spyOn(BackendAPI, 'scanCustomPlugins').mockResolvedValue([pluginA, pluginB]);
      renderTab();

      fireEvent.click(screen.getByRole('button', { name: /Add Folder/i }));

      await waitFor(() => expect(getAppState().plugins.plugin_b).toEqual(pluginB));
      expect(getAppState().plugins.plugin_a).toEqual(pluginA);
      expect(getAppState().pluginSettings.map((s) => s.id)).toEqual(expect.arrayContaining(['plugin_a', 'plugin_b']));
      expect(alert).toHaveBeenCalledWith(expect.stringContaining('2 個のプラグインを一括インポートしました'));
    });

    it('tells the user when the folder contains no plugins', async () => {
      const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
      vi.spyOn(DialogAPI, 'open').mockResolvedValue('/path/to/empty_dir');
      vi.spyOn(BackendAPI, 'scanCustomPlugins').mockResolvedValue([]);
      renderTab();

      fireEvent.click(screen.getByRole('button', { name: /Add Folder/i }));

      await waitFor(() =>
        expect(alert).toHaveBeenCalledWith(
          '指定されたディレクトリに有効なプラグイン (manifest.json) が見つかりませんでした。',
        ),
      );
      expect(Object.keys(getAppState().plugins)).toHaveLength(3);
    });
  });
});
