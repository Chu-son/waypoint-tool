import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginsTab } from './PluginsTab';
import { useAppStore } from '../../../stores/appStore';
import { BackendAPI } from '../../../api';

// Mock the store
vi.mock('../../../stores/appStore', () => ({
  useAppStore: Object.assign(vi.fn(), {
    getState: vi.fn(),
    setState: vi.fn(),
    subscribe: vi.fn(),
  }),
}));

// Mock BackendAPI
vi.mock('../../../api', () => ({
  BackendAPI: {
    checkPythonPackages: vi.fn(),
    getPythonEnvironments: vi.fn().mockResolvedValue(['/usr/bin/python3']),
    createVirtualenv: vi.fn(),
    installPipPackages: vi.fn(),
    fetchInstalledPlugins: vi.fn().mockResolvedValue([]),
    updatePluginSdk: vi.fn(),
    scanCustomPlugins: vi.fn(),
  },
  DialogAPI: {
    ask: vi.fn(),
    open: vi.fn(),
  },
}));

describe('PluginsTab', () => {
  const mockPlugins = {
    'lib-plugin': {
      id: 'lib-plugin',
      manifest: {
        name: 'Shared Math Library',
        type: 'python_library',
        executable: '',
        version: '1.0.0',
        inputs: [],
        properties: [],
      },
      folder_path: '/path/to/lib',
    },
    'pipe-plugin': {
      id: 'pipe-plugin',
      manifest: {
        name: 'My Pipeline Plugin',
        type: 'pipeline',
        executable: '',
        inputs: [],
        properties: [],
        pipeline: {
          steps: [{ step_id: 's1', plugin_id: 'py-plugin' }],
        },
      },
      folder_path: '/path/to/pipe',
    },
    'py-plugin': {
      id: 'py-plugin',
      manifest: {
        name: 'Python Generator',
        type: 'python',
        executable: 'gen.py',
        inputs: [],
        properties: [],
        plugin_dependencies: [{ id: 'lib-plugin', version: '>=1.0.0' }],
        python_dependencies: [{ name: 'numpy', version: '1.24.0' }],
      },
      folder_path: '/path/to/gen',
    },
  };

  const mockSettings = [
    { id: 'lib-plugin', enabled: true, order: 0, isBuiltin: false, path: '/path/to/lib' },
    { id: 'pipe-plugin', enabled: true, order: 1, isBuiltin: false, path: '/path/to/pipe' },
    { id: 'py-plugin', enabled: true, order: 2, isBuiltin: false, path: '/path/to/gen' },
  ];

  const mockUpdatePluginSetting = vi.fn();
  const mockSetPluginSettings = vi.fn();
  const mockSetPlugins = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (BackendAPI.checkPythonPackages as any).mockResolvedValue({
      numpy: false, // numpy is missing
    });

    const state = {
      plugins: mockPlugins,
      pluginSettings: mockSettings,
      lastDirectory: '/home/user',
      updatePluginSetting: mockUpdatePluginSetting,
      setPluginSettings: mockSetPluginSettings,
      setPlugins: mockSetPlugins,
    };

    (useAppStore as any).mockImplementation((selector: any) => selector(state));
    (useAppStore.getState as any).mockReturnValue(state);
  });

  it('renders Shared Library and Pipeline badges distinctly', () => {
    render(<PluginsTab bundledSdkVersion="1.0.0" globalPythonPath="/usr/bin/python3" />);

    expect(screen.getByText('Shared Library')).toBeInTheDocument();
    expect(screen.getByText('Pipeline')).toBeInTheDocument();
  });

  it('displays dependency status OK when plugin dependencies are satisfied', () => {
    render(<PluginsTab bundledSdkVersion="1.0.0" globalPythonPath="/usr/bin/python3" />);

    // py-plugin depends on lib-plugin (>=1.0.0), which is installed at 1.0.0 -> Dependencies OK
    expect(screen.getAllByText('Dependencies OK').length).toBeGreaterThan(0);
  });

  it('displays dependency issues warning and expands details when dependencies are missing', () => {
    const pluginsWithMissing = {
      ...mockPlugins,
      'broken-pipe': {
        id: 'broken-pipe',
        manifest: {
          name: 'Broken Pipeline',
          type: 'pipeline',
          executable: '',
          inputs: [],
          properties: [],
          pipeline: {
            steps: [{ step_id: 's1', plugin_id: 'non-existent-plugin' }],
          },
        },
        folder_path: '/path/to/broken',
      },
    };
    const settingsWithBroken = [
      ...mockSettings,
      { id: 'broken-pipe', enabled: true, order: 3, isBuiltin: false, path: '/path/to/broken' },
    ];

    const state = {
      plugins: pluginsWithMissing,
      pluginSettings: settingsWithBroken,
      lastDirectory: '/home/user',
      updatePluginSetting: mockUpdatePluginSetting,
      setPluginSettings: mockSetPluginSettings,
      setPlugins: mockSetPlugins,
    };
    (useAppStore as any).mockImplementation((selector: any) => selector(state));
    (useAppStore.getState as any).mockReturnValue(state);

    render(<PluginsTab bundledSdkVersion="1.0.0" globalPythonPath="/usr/bin/python3" />);

    const issueButton = screen.getByRole('button', { name: /Dependency Issues/i });
    expect(issueButton).toBeInTheDocument();

    // Click to toggle details
    fireEvent.click(issueButton);
    expect(screen.getByText(/Plugin "non-existent-plugin" is required/i)).toBeInTheDocument();
  });

  it('checks python dependencies and shows Setup venv button when a package is missing', async () => {
    render(<PluginsTab bundledSdkVersion="1.0.0" globalPythonPath="/usr/bin/python3" />);

    await waitFor(() => {
      expect(BackendAPI.checkPythonPackages).toHaveBeenCalledWith('/usr/bin/python3', ['numpy']);
    });

    // Since numpy returned false, Setup venv button is displayed
    const setupVenvBtn = await screen.findByRole('button', {
      name: /Setup venv \(仮想環境の作成\)/i,
    });
    expect(setupVenvBtn).toBeInTheDocument();

    // Clicking Setup venv opens VenvSetupModal
    fireEvent.click(setupVenvBtn);
    expect(screen.getByText(/Virtual Environment Setup - Python Generator/i)).toBeInTheDocument();
  });

  it('updates only the specific plugin when python override changes', () => {
    render(<PluginsTab bundledSdkVersion="1.0.0" globalPythonPath="/usr/bin/python3" />);

    const overrideInputs = screen.getAllByPlaceholderText('Global: /usr/bin/python3');
    expect(overrideInputs.length).toBe(2);

    fireEvent.change(overrideInputs[1], {
      target: { value: '/custom/venv/bin/python' },
    });

    expect(mockUpdatePluginSetting).toHaveBeenCalledWith('py-plugin', {
      pythonOverridePath: '/custom/venv/bin/python',
    });
  });

  it('checks and displays python dependencies for python_library plugins', async () => {
    const libWithDeps = {
      ...mockPlugins,
      'lib-plugin': {
        ...mockPlugins['lib-plugin'],
        manifest: {
          ...mockPlugins['lib-plugin'].manifest,
          python_dependencies: [{ name: 'scipy', version: '1.10.0' }],
        },
      },
    };
    (BackendAPI.checkPythonPackages as any).mockResolvedValue({
      numpy: true,
      scipy: false,
    });

    const state = {
      plugins: libWithDeps,
      pluginSettings: mockSettings,
      lastDirectory: '/home/user',
      updatePluginSetting: mockUpdatePluginSetting,
      setPluginSettings: mockSetPluginSettings,
      setPlugins: mockSetPlugins,
    };
    (useAppStore as any).mockImplementation((selector: any) => selector(state));
    (useAppStore.getState as any).mockReturnValue(state);

    render(<PluginsTab bundledSdkVersion="1.0.0" globalPythonPath="/usr/bin/python3" />);

    await waitFor(() => {
      expect(BackendAPI.checkPythonPackages).toHaveBeenCalledWith('/usr/bin/python3', ['scipy']);
    });

    expect(screen.getByText('scipy@1.10.0')).toBeInTheDocument();
  });

  it('imports a single plugin folder when Add Folder is used', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { DialogAPI, BackendAPI } = await import('../../../api');
    (DialogAPI.ask as any).mockResolvedValue(true);
    (DialogAPI.open as any).mockResolvedValue('/path/to/new_plugin');
    const newPlugin = {
      id: 'new_plugin',
      folder_path: '/path/to/new_plugin',
      is_builtin: false,
      manifest: { name: 'New Custom Plugin', type: 'python', executable: 'main.py', inputs: [], properties: [] },
    };
    (BackendAPI.scanCustomPlugins as any).mockResolvedValue([newPlugin]);

    render(<PluginsTab bundledSdkVersion="1.0.0" globalPythonPath="/usr/bin/python3" />);

    const addFolderBtn = screen.getByRole('button', { name: /Add Folder/i });
    fireEvent.click(addFolderBtn);

    await waitFor(() => {
      expect(DialogAPI.open).toHaveBeenCalledWith({
        multiple: true,
        directory: true,
        defaultPath: '/home/user',
      });
      expect(BackendAPI.scanCustomPlugins).toHaveBeenCalledWith('/path/to/new_plugin');
      expect(mockSetPlugins).toHaveBeenCalledWith(expect.objectContaining({ new_plugin: newPlugin }));
      expect(mockSetPluginSettings).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 'new_plugin', path: '/path/to/new_plugin' })]),
      );
      expect(alertMock).toHaveBeenCalledWith("Plugin 'New Custom Plugin' をインポートしました。");
    });
    alertMock.mockRestore();
  });

  it('batch imports multiple plugins when a parent directory is selected', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { DialogAPI, BackendAPI } = await import('../../../api');
    (DialogAPI.ask as any).mockResolvedValue(true);
    (DialogAPI.open as any).mockResolvedValue('/path/to/plugins_parent');
    const pluginA = {
      id: 'plugin_a',
      folder_path: '/path/to/plugins_parent/plugin_a',
      is_builtin: false,
      manifest: { name: 'Plugin A', type: 'python', executable: 'main.py', inputs: [], properties: [] },
    };
    const pluginB = {
      id: 'plugin_b',
      folder_path: '/path/to/plugins_parent/plugin_b',
      is_builtin: false,
      manifest: { name: 'Plugin B', type: 'python', executable: 'main.py', inputs: [], properties: [] },
    };
    (BackendAPI.scanCustomPlugins as any).mockResolvedValue([pluginA, pluginB]);

    render(<PluginsTab bundledSdkVersion="1.0.0" globalPythonPath="/usr/bin/python3" />);

    const addFolderBtn = screen.getByRole('button', { name: /Add Folder/i });
    fireEvent.click(addFolderBtn);

    await waitFor(() => {
      expect(BackendAPI.scanCustomPlugins).toHaveBeenCalledWith('/path/to/plugins_parent');
      expect(mockSetPlugins).toHaveBeenCalledWith(
        expect.objectContaining({
          plugin_a: pluginA,
          plugin_b: pluginB,
        }),
      );
      expect(mockSetPluginSettings).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'plugin_a', path: '/path/to/plugins_parent/plugin_a' }),
          expect.objectContaining({ id: 'plugin_b', path: '/path/to/plugins_parent/plugin_b' }),
        ]),
      );
      expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('2 個のプラグインを一括インポートしました'));
    });
    alertMock.mockRestore();
  });

  it('shows alert when no plugins are found in selected directory', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { DialogAPI, BackendAPI } = await import('../../../api');
    (DialogAPI.ask as any).mockResolvedValue(true);
    (DialogAPI.open as any).mockResolvedValue('/path/to/empty_dir');
    (BackendAPI.scanCustomPlugins as any).mockResolvedValue([]);

    render(<PluginsTab bundledSdkVersion="1.0.0" globalPythonPath="/usr/bin/python3" />);

    const addFolderBtn = screen.getByRole('button', { name: /Add Folder/i });
    fireEvent.click(addFolderBtn);

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(
        '指定されたディレクトリに有効なプラグイン (manifest.json) が見つかりませんでした。',
      );
    });
    alertMock.mockRestore();
  });
});
