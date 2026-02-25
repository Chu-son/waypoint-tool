import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolPanel } from './ToolPanel';
import { useAppStore } from '../../stores/appStore';

// Mock Tauri modules used by child components (SettingsModal, ExportModal)
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock('../../api/backend', () => ({
  BackendAPI: {
    fetchInstalledPlugins: vi.fn().mockResolvedValue([]),
    exportWaypoints: vi.fn().mockResolvedValue(undefined),
    getPythonEnvironments: vi.fn().mockResolvedValue([]),
  },
}));

describe('ToolPanel UI', () => {
  beforeEach(() => {
    useAppStore.setState({
      activeTool: 'select',
      activePluginId: null,
      plugins: {},
      pluginSettings: [],
      toolPanelMaxColumns: 1,
      optionsSchema: null,
      exportTemplates: [],
      defaultExportFormats: [],
      nodes: {},
      rootNodeIds: [],
      selectedNodeIds: [],
    });
  });

  // --- 要件2: Waypoint編集 ---

  it('renders Select and Add Waypoint tool buttons', () => {
    render(<ToolPanel />);

    expect(screen.getByTitle('Select (V)')).toBeInTheDocument();
    expect(screen.getByTitle('Add Waypoint (P)')).toBeInTheDocument();
  });

  it('changes activeTool when a tool button is clicked', () => {
    render(<ToolPanel />);

    const addPointBtn = screen.getByTitle('Add Waypoint (P)');
    act(() => {
      addPointBtn.click();
    });

    expect(useAppStore.getState().activeTool).toBe('add_point');
  });

  // --- 要件9: プラグイン ---

  it('displays generator tools when plugins are registered', () => {
    useAppStore.setState({
      plugins: {
        'sweep': {
          id: 'sweep',
          manifest: { name: 'Sweep Generator', type: 'python', executable: 'main.py', inputs: [], needs: [], properties: [] },
          folder_path: '/plugins/sweep',
          is_builtin: true,
        },
      },
      pluginSettings: [
        { id: 'sweep', enabled: true, order: 0, isBuiltin: true },
      ],
    });

    render(<ToolPanel />);

    expect(screen.getByTitle('Sweep Generator')).toBeInTheDocument();
  });
});
