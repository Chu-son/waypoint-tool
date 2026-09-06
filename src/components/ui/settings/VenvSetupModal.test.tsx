import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VenvSetupModal } from './VenvSetupModal';
import { useAppStore } from '../../../stores/appStore';
import { BackendAPI } from '../../../api';
import { PluginInstance } from '../../../types/store';

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
    getPythonEnvironments: vi.fn(),
    createVirtualenv: vi.fn(),
    installPipPackages: vi.fn(),
  },
}));

describe('VenvSetupModal', () => {
  const mockPlugin: PluginInstance = {
    id: 'geo-plugin',
    is_builtin: false,
    manifest: {
      name: 'Geo Analyzer',
      type: 'python',
      executable: 'main.py',
      inputs: [],
      properties: [],
      python_dependencies: [
        { name: 'numpy', version: '>=1.20', description: 'Matrix operations' },
        { name: 'shapely', version: '2.0.0', optional: true },
      ],
    },
    folder_path: '/home/user/plugins/geo-plugin',
  };

  const mockUpdatePluginSetting = vi.fn();
  const mockOnClose = vi.fn();
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (BackendAPI.getPythonEnvironments as any).mockResolvedValue([
      '/usr/bin/python3',
      '/opt/conda/bin/python',
    ]);
    (BackendAPI.createVirtualenv as any).mockResolvedValue(
      '/home/user/plugins/geo-plugin/.venv/bin/python'
    );
    (BackendAPI.installPipPackages as any).mockResolvedValue(
      'Successfully installed numpy-1.24.0 shapely-2.0.0'
    );

    (useAppStore as any).mockImplementation((selector: any) =>
      selector({
        updatePluginSetting: mockUpdatePluginSetting,
      })
    );
  });

  it('renders base interpreter, target directory, and package list', async () => {
    render(
      <VenvSetupModal
        isOpen={true}
        onClose={mockOnClose}
        plugin={mockPlugin}
        globalPythonPath="/usr/local/bin/python3"
      />
    );

    expect(screen.getByText(/Virtual Environment Setup - Geo Analyzer/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('/usr/local/bin/python3')).toBeInTheDocument();
    expect(screen.getByDisplayValue('/home/user/plugins/geo-plugin/.venv')).toBeInTheDocument();

    expect(screen.getByText('numpy>=1.20')).toBeInTheDocument();
    expect(screen.getByText('- Matrix operations')).toBeInTheDocument();
    expect(screen.getByText('shapely==2.0.0')).toBeInTheDocument();
    expect(screen.getByText('optional')).toBeInTheDocument();

    await waitFor(() => {
      expect(BackendAPI.getPythonEnvironments).toHaveBeenCalled();
    });
  });

  it('creates venv, installs dependencies, and updates plugin setting on Create & Install', async () => {
    render(
      <VenvSetupModal
        isOpen={true}
        onClose={mockOnClose}
        plugin={mockPlugin}
        globalPythonPath="/usr/bin/python3"
        onComplete={mockOnComplete}
      />
    );

    const createBtn = screen.getByRole('button', { name: /Create & Install/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(BackendAPI.createVirtualenv).toHaveBeenCalledWith(
        '/home/user/plugins/geo-plugin/.venv',
        '/usr/bin/python3'
      );
      expect(BackendAPI.installPipPackages).toHaveBeenCalledWith(
        '/home/user/plugins/geo-plugin/.venv/bin/python',
        ['numpy>=1.20', 'shapely==2.0.0']
      );
      expect(mockUpdatePluginSetting).toHaveBeenCalledWith('geo-plugin', {
        pythonOverridePath: '/home/user/plugins/geo-plugin/.venv/bin/python',
      });
      expect(mockOnComplete).toHaveBeenCalledWith(
        '/home/user/plugins/geo-plugin/.venv/bin/python'
      );
    });

    expect(screen.getByText('Setup Completed')).toBeInTheDocument();
  });

  it('handles error during venv creation or installation gracefully', async () => {
    (BackendAPI.createVirtualenv as any).mockRejectedValueOnce(
      new Error('Failed to execute python -m venv')
    );

    render(
      <VenvSetupModal
        isOpen={true}
        onClose={mockOnClose}
        plugin={mockPlugin}
        globalPythonPath="/usr/bin/python3"
      />
    );

    const createBtn = screen.getByRole('button', { name: /Create & Install/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(screen.getByText('Setup Failed')).toBeInTheDocument();
      expect(screen.getByText('Failed to execute python -m venv')).toBeInTheDocument();
    });

    expect(mockUpdatePluginSetting).not.toHaveBeenCalled();
  });
});
