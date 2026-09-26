import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExportModal } from './ExportModal';
import { BackendAPI, DialogAPI } from '../../../api';
import { resetAppStore } from '../../../test/store';
import { useAppStore } from '../../../stores/appStore';

describe('ExportModal UI', () => {
  beforeEach(() => {
    vi.spyOn(BackendAPI, 'checkExportConflicts').mockResolvedValue([]);
    vi.spyOn(BackendAPI, 'executeExportPackage').mockResolvedValue({
      exported_files_count: 2,
      backed_up_files: [],
    } as any);
    vi.spyOn(DialogAPI, 'message').mockResolvedValue();
    resetAppStore({
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

    render(<ExportModal isOpen={true} onClose={mockOnClose} />);

    const exportBtn = screen.getByRole('button', { name: /保存してエクスポート/ });
    expect(exportBtn).not.toBeDisabled();

    fireEvent.click(exportBtn);

    await waitFor(() => expect(mockOnClose).toHaveBeenCalled());
    expect(BackendAPI.executeExportPackage).toHaveBeenCalledWith({
      root_dir: '/mock/export/dir',
      conflict_resolution: 'backup_file',
      session_timestamp: expect.stringMatching(/^\d{8}_\d{6}$/),
      waypoint_items: [
        expect.objectContaining({
          path: expect.stringMatching(/^\/mock\/export\/dir\/waypoints\/\d{8}_waypoints\.yaml$/),
          waypoints: [expect.objectContaining({ id: 'wp1', x: 1, y: 2 })],
        }),
      ],
      map_items: [
        expect.objectContaining({
          save_path: '/mock/export/dir/Map/area_1',
          region: expect.objectContaining({ name: 'area_1' }),
        }),
      ],
    });
    expect(DialogAPI.message).toHaveBeenCalledWith(expect.stringContaining('出力ファイル数: 2 件'), undefined);
  });

  describe('path pattern editing', () => {
    const PATTERN = 'waypoints/{{yyyymmdd}}_waypoints.yaml';
    const storedPattern = () => useAppStore.getState().exportProfiles[0].items[0].relativePathPattern;

    it.each([
      ['the start', 0, `{{name}}${PATTERN}`],
      ['the middle', 10, `${PATTERN.slice(0, 10)}{{name}}${PATTERN.slice(10)}`],
      ['the end', PATTERN.length, `${PATTERN}{{name}}`],
    ])('inserts a variable chip at the caret placed at %s', (_label, caret, expected) => {
      render(<ExportModal isOpen={true} onClose={vi.fn()} />);
      const input = screen.getByDisplayValue(PATTERN) as HTMLInputElement;

      input.setSelectionRange(caret, caret);
      fireEvent.select(input);
      fireEvent.click(screen.getByText('{{name}}'));

      expect(input).toHaveValue(expected);
    });

    it('replaces the selected text when a chip is inserted over a selection', () => {
      render(<ExportModal isOpen={true} onClose={vi.fn()} />);
      const input = screen.getByDisplayValue(PATTERN) as HTMLInputElement;

      input.setSelectionRange(0, 10);
      fireEvent.select(input);
      fireEvent.click(screen.getByText('{{name}}'));

      expect(input).toHaveValue(`{{name}}${PATTERN.slice(10)}`);
    });

    it('does not change the project until saved, and discards edits on cancel', () => {
      const onClose = vi.fn();
      const { rerender } = render(<ExportModal isOpen={true} onClose={onClose} />);

      fireEvent.change(screen.getByDisplayValue(PATTERN), { target: { value: 'edited.yaml' } });
      expect(storedPattern()).toBe(PATTERN);

      fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
      expect(onClose).toHaveBeenCalled();
      expect(storedPattern()).toBe(PATTERN);

      // Reopening starts again from the saved state
      rerender(<ExportModal isOpen={false} onClose={onClose} />);
      rerender(<ExportModal isOpen={true} onClose={onClose} />);
      expect(screen.getByDisplayValue(PATTERN)).toBeInTheDocument();
    });

    it('saves edits without exporting when clicking 保存のみ', () => {
      const onClose = vi.fn();
      render(<ExportModal isOpen={true} onClose={onClose} />);

      fireEvent.change(screen.getByDisplayValue(PATTERN), { target: { value: 'edited.yaml' } });
      fireEvent.click(screen.getByRole('button', { name: '保存のみ' }));

      expect(storedPattern()).toBe('edited.yaml');
      expect(useAppStore.getState().isDirty).toBe(true);
      expect(onClose).toHaveBeenCalled();
      expect(BackendAPI.executeExportPackage).not.toHaveBeenCalled();
    });

    it('saves edits and exports when clicking 保存してエクスポート', async () => {
      const onClose = vi.fn();
      render(<ExportModal isOpen={true} onClose={onClose} />);

      fireEvent.change(screen.getByDisplayValue(PATTERN), { target: { value: 'edited.yaml' } });
      fireEvent.click(screen.getByRole('button', { name: /保存してエクスポート/ }));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(storedPattern()).toBe('edited.yaml');
      expect(BackendAPI.executeExportPackage).toHaveBeenCalledWith(
        expect.objectContaining({
          waypoint_items: [expect.objectContaining({ path: '/mock/export/dir/edited.yaml' })],
        }),
      );
    });
  });
});
