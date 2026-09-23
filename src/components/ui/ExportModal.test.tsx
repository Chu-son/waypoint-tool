import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExportModal } from './ExportModal';
import { useAppStore } from '../../stores/appStore';

// Mock Tauri modules
vi.mock('../../api', () => ({
  BackendAPI: {
    checkExportConflicts: vi.fn().mockResolvedValue([]),
    executeExportPackage: vi.fn().mockResolvedValue({
      exported_files_count: 2,
      backed_up_files: [],
    }),
  },
  DialogAPI: {
    open: vi.fn().mockResolvedValue('/mock/export/dir'),
    save: vi.fn().mockResolvedValue('/mock/export/file'),
  },
}));

describe('ExportModal UI', () => {
  beforeEach(() => {
    useAppStore.setState({
      nodes: {
        wp1: { id: 'wp1', type: 'manual', transform: { x: 1, y: 2, qx: 0, qy: 0, qz: 0, qw: 1 } },
      },
      rootNodeIds: ['wp1'],
      selectedNodeIds: [],
      exportRegions: [{ id: 'reg1', name: 'area_1', rect: { x: 0, y: 0, width: 10, height: 10 }, visible: true }],
      exportTemplates: [],
      defaultExportFormats: [
        { id: '__default_yaml__', name: 'YAML Document', extension: 'yaml', suffix: '_yaml', enabled: true },
      ],
      exportProfiles: [
        {
          id: 'test_prof',
          name: '標準エクスポート',
          conflictResolution: 'backup_file',
          outputRootDir: '/mock/export/dir',
          items: [
            {
              id: 'item1',
              type: 'waypoint_default',
              sourceId: '__default_yaml__',
              relativePathPattern: 'waypoints/{{yyyymmdd}}_waypoints.yaml',
              enabled: true,
            },
            {
              id: 'item2',
              type: 'map_all_regions',
              sourceId: 'all',
              relativePathPattern: 'Map/{{name}}.pgm',
              mapFormat: 'ros_standard',
              enabled: true,
            },
          ],
        },
      ],
      activeExportProfileId: 'test_prof',
    });
  });

  it('renders integrated export modal with profile name, virtual directory tree, and variable chips', () => {
    render(<ExportModal isOpen={true} onClose={vi.fn()} />);

    // Header title
    expect(screen.getByText('統合エクスポート (Integrated Export)')).toBeInTheDocument();

    // Profile selector and name input
    expect(screen.getAllByDisplayValue('標準エクスポート').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByPlaceholderText('プロファイル名')).toHaveValue('標準エクスポート');

    // Tree view title
    expect(screen.getByText(/Virtual Directory/)).toBeInTheDocument();

    // Virtual directory folders
    expect(screen.getByText('waypoints/')).toBeInTheDocument();
    expect(screen.getByText('Map/')).toBeInTheDocument();

    // Variable chips in the inspector
    expect(screen.getByText('{{YYYYMMDD}}')).toBeInTheDocument();
    expect(screen.getByText('{{MM}}')).toBeInTheDocument();
    expect(screen.getByText('{{mm}}')).toBeInTheDocument();
    expect(screen.getByText('{{HH}}')).toBeInTheDocument();
    expect(screen.getByText('{{project_name}}')).toBeInTheDocument();
    expect(screen.getByText('{{name}}')).toBeInTheDocument();

    // Conflict resolution options
    expect(screen.getByText('リネームバックアップ (.bak)')).toBeInTheDocument();
    expect(screen.getByText('上書き')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(<ExportModal isOpen={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('triggers executeExportPackage when clicking the export button', async () => {
    const mockOnClose = vi.fn();
    window.alert = vi.fn();

    render(<ExportModal isOpen={true} onClose={mockOnClose} />);

    const exportBtn = screen.getByRole('button', { name: /エクスポート実行/ });
    expect(exportBtn).not.toBeDisabled();

    fireEvent.click(exportBtn);

    const { BackendAPI } = await import('../../api');
    await waitFor(() => {
      expect(BackendAPI.executeExportPackage).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
