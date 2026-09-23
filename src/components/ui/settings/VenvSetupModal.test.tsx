import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VenvSetupModal } from './VenvSetupModal';
import { BackendAPI } from '../../../api';
import { renderWithStore } from '../../../test/render';
import { getAppState } from '../../../test/store';
import { makePlugin } from '../../../test/fixtures';
import type { PluginSetting } from '../../../types/store';

const VENV_PYTHON = '/home/user/plugins/geo-plugin/.venv/bin/python';

const plugin = {
  ...makePlugin('geo-plugin', {
    name: 'Geo Analyzer',
    python_dependencies: [
      { name: 'numpy', version: '>=1.20', description: 'Matrix operations' },
      { name: 'shapely', version: '2.0.0', optional: true },
    ],
  }),
  folder_path: '/home/user/plugins/geo-plugin',
};

const renderModal = (props: { globalPythonPath?: string; onComplete?: (path: string) => void } = {}) =>
  renderWithStore(
    <VenvSetupModal
      isOpen={true}
      onClose={vi.fn()}
      plugin={plugin}
      globalPythonPath={props.globalPythonPath ?? '/usr/bin/python3'}
      onComplete={props.onComplete}
    />,
    {
      plugins: { [plugin.id]: plugin },
      pluginSettings: [
        { id: plugin.id, enabled: true, order: 0, isBuiltin: false, path: plugin.folder_path } as PluginSetting,
      ],
    },
  );

const overrideFor = (id: string) => getAppState().pluginSettings.find((s) => s.id === id)?.pythonOverridePath;

describe('VenvSetupModal', () => {
  beforeEach(() => {
    vi.spyOn(BackendAPI, 'getPythonEnvironments').mockResolvedValue(['/usr/bin/python3', '/opt/conda/bin/python']);
    vi.spyOn(BackendAPI, 'createVirtualenv').mockResolvedValue(VENV_PYTHON);
    vi.spyOn(BackendAPI, 'installPipPackages').mockResolvedValue('Successfully installed numpy-1.24.0 shapely-2.0.0');
  });

  it('shows the base interpreter, target directory and packages to install', async () => {
    renderModal({ globalPythonPath: '/usr/local/bin/python3' });

    expect(screen.getByText(/Virtual Environment Setup - Geo Analyzer/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('/usr/local/bin/python3')).toBeInTheDocument();
    expect(screen.getByDisplayValue('/home/user/plugins/geo-plugin/.venv')).toBeInTheDocument();
    expect(screen.getByText('numpy>=1.20')).toBeInTheDocument();
    expect(screen.getByText('- Matrix operations')).toBeInTheDocument();
    expect(screen.getByText('shapely==2.0.0')).toBeInTheDocument();
    expect(screen.getByText('optional')).toBeInTheDocument();
    await waitFor(() => expect(BackendAPI.getPythonEnvironments).toHaveBeenCalled());
  });

  it('creates the venv, installs the packages and points the plugin at the new interpreter', async () => {
    const onComplete = vi.fn();
    renderModal({ onComplete });

    fireEvent.click(screen.getByRole('button', { name: /Create & Install/i }));

    expect(await screen.findByText('Setup Completed')).toBeInTheDocument();
    expect(BackendAPI.createVirtualenv).toHaveBeenCalledWith('/home/user/plugins/geo-plugin/.venv', '/usr/bin/python3');
    expect(BackendAPI.installPipPackages).toHaveBeenCalledWith(VENV_PYTHON, ['numpy>=1.20', 'shapely==2.0.0']);
    expect(overrideFor('geo-plugin')).toBe(VENV_PYTHON);
    expect(onComplete).toHaveBeenCalledWith(VENV_PYTHON);
  });

  it('reports a failure and leaves the plugin interpreter unchanged', async () => {
    vi.spyOn(BackendAPI, 'createVirtualenv').mockRejectedValueOnce(new Error('Failed to execute python -m venv'));
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /Create & Install/i }));

    expect(await screen.findByText('Setup Failed')).toBeInTheDocument();
    expect(screen.getByText('Failed to execute python -m venv')).toBeInTheDocument();
    expect(overrideFor('geo-plugin')).toBeUndefined();
  });
});
