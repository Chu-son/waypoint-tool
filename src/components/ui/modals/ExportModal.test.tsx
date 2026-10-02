import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExportModal } from './ExportModal';
import { LoadingOverlay } from '../common/LoadingOverlay';
import { BackendAPI, DialogAPI } from '../../../api';
import { resetAppStore } from '../../../test/store';
import { useAppStore } from '../../../stores/appStore';
import { layerStackState, makeMap } from '../../../test/fixtures';
import type { ExportMapList, LayerVisibilitySet } from '../../../types/store';

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

  it('shows a progress overlay over the modal while the export runs, then clears it', async () => {
    let finishExport: (value: any) => void = () => {};
    vi.spyOn(BackendAPI, 'executeExportPackage').mockReturnValue(
      new Promise((resolve) => {
        finishExport = resolve;
      }),
    );
    const mockOnClose = vi.fn();
    render(
      <>
        <ExportModal isOpen={true} onClose={mockOnClose} />
        <LoadingOverlay />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: /保存してエクスポート/ }));

    const overlay = await screen.findByRole('status', { name: 'エクスポートを実行中...' });
    await waitFor(() => expect(overlay).toHaveTextContent('ファイルを書き出し中...'));
    expect(mockOnClose).not.toHaveBeenCalled();

    finishExport({ exported_files_count: 1, backed_up_files: [] });

    await waitFor(() => expect(mockOnClose).toHaveBeenCalled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
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
      globals: {},
      geo: expect.objectContaining({ lat: expect.any(Number), lon: expect.any(Number) }),
      float_numbers: true,
      integer_keys: [],
      waypoints: [expect.objectContaining({ id: 'wp1', x: 1, y: 2 })],
      map_image_b64: undefined,
      layers: [],
      waypoint_items: [
        expect.objectContaining({
          path: expect.stringMatching(/^\/mock\/export\/dir\/waypoints\/\d{8}_waypoints\.yaml$/),
          include_map_image: false,
        }),
      ],
      map_items: [
        expect.objectContaining({
          save_path: '/mock/export/dir/Map/area_1',
          region: expect.objectContaining({ name: 'area_1' }),
        }),
      ],
      map_lists: [],
    });
    expect(DialogAPI.message).toHaveBeenCalledWith(expect.stringContaining('出力ファイル数: 2 件'), undefined);
  });

  it('passes the aligned map origin to templates as geo, even when the background map is hidden', async () => {
    useAppStore.setState({
      geoMap: {
        ...useAppStore.getState().geoMap,
        enabled: false,
        origin: { kind: 'utm', zone: 54, hemisphere: 'N', easting: 500000, northing: 3950000 },
        alignment: { dx: 0, dy: 0, yawDeg: 90 },
      },
    });
    const mockOnClose = vi.fn();
    render(<ExportModal isOpen={true} onClose={mockOnClose} />);
    fireEvent.click(screen.getByRole('button', { name: /保存してエクスポート/ }));
    await waitFor(() => expect(mockOnClose).toHaveBeenCalled());

    expect(BackendAPI.executeExportPackage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        geo: expect.objectContaining({
          utm: { zone: 54, hemisphere: 'N', easting: 500000, northing: 3950000 },
          heading_deg: -90,
        }),
      }),
    );
  });

  it('asks the backend to write integers as floats unless the setting is turned off', async () => {
    const mockOnClose = vi.fn();
    const { unmount } = render(<ExportModal isOpen={true} onClose={mockOnClose} />);
    fireEvent.click(screen.getByRole('button', { name: /保存してエクスポート/ }));
    await waitFor(() => expect(mockOnClose).toHaveBeenCalled());
    expect(BackendAPI.executeExportPackage).toHaveBeenLastCalledWith(expect.objectContaining({ float_numbers: true }));
    unmount();

    useAppStore.setState({ exportIntegersAsFloat: false });
    const secondClose = vi.fn();
    render(<ExportModal isOpen={true} onClose={secondClose} />);
    fireEvent.click(screen.getByRole('button', { name: /保存してエクスポート/ }));
    await waitFor(() => expect(secondClose).toHaveBeenCalled());
    expect(BackendAPI.executeExportPackage).toHaveBeenLastCalledWith(expect.objectContaining({ float_numbers: false }));
  });

  it('tells the backend which schema options are integers so they stay integers', async () => {
    useAppStore.setState({
      optionsSchema: {
        options: [
          { name: 'countdown_ms', label: 'Countdown', type: 'integer' },
          { name: 'speed', label: 'Speed', type: 'float' },
        ],
        globals: [],
      },
    });
    const mockOnClose = vi.fn();
    render(<ExportModal isOpen={true} onClose={mockOnClose} />);

    fireEvent.click(screen.getByRole('button', { name: /保存してエクスポート/ }));

    await waitFor(() => expect(mockOnClose).toHaveBeenCalled());
    expect(BackendAPI.executeExportPackage).toHaveBeenCalledWith(
      expect.objectContaining({ integer_keys: ['countdown_ms'] }),
    );
  });

  it('hands the project global fields to the backend so templates can use them', async () => {
    useAppStore.setState({
      optionsSchema: {
        options: [],
        globals: [
          { name: 'default_speed', label: 'Default Speed', type: 'float', value: 0.5 },
          { name: 'unset', label: 'Unset', type: 'string' },
        ],
      },
    });
    const mockOnClose = vi.fn();
    render(<ExportModal isOpen={true} onClose={mockOnClose} />);

    fireEvent.click(screen.getByRole('button', { name: /保存してエクスポート/ }));

    await waitFor(() => expect(mockOnClose).toHaveBeenCalled());
    expect(BackendAPI.executeExportPackage).toHaveBeenCalledWith(
      expect.objectContaining({ globals: { default_speed: 0.5 } }),
    );
  });

  it('asks for confirmation before exporting when a required option is missing, and exports on confirm', async () => {
    useAppStore.setState({
      optionsSchema: { options: [{ name: 'service', label: 'Service', type: 'string', required: true }], globals: [] },
    });
    const ask = vi.spyOn(DialogAPI, 'ask').mockResolvedValue(true);
    const mockOnClose = vi.fn();
    render(<ExportModal isOpen={true} onClose={mockOnClose} />);

    fireEvent.click(screen.getByRole('button', { name: /保存してエクスポート/ }));

    await waitFor(() => expect(ask).toHaveBeenCalledWith(expect.stringContaining('1 件'), expect.anything()));
    await waitFor(() => expect(BackendAPI.executeExportPackage).toHaveBeenCalled());
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('cancels the export when the user declines the missing-required-option confirmation', async () => {
    useAppStore.setState({
      optionsSchema: { options: [{ name: 'service', label: 'Service', type: 'string', required: true }], globals: [] },
    });
    vi.spyOn(DialogAPI, 'ask').mockResolvedValue(false);
    const mockOnClose = vi.fn();
    render(<ExportModal isOpen={true} onClose={mockOnClose} />);

    fireEvent.click(screen.getByRole('button', { name: /保存してエクスポート/ }));

    await waitFor(() => expect(DialogAPI.ask).toHaveBeenCalled());
    expect(BackendAPI.executeExportPackage).not.toHaveBeenCalled();
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  describe('layer visibility sets', () => {
    const mapItem = (id: string, visibilitySetId: string | undefined, pattern = 'Map/{{name}}_{{set}}.pgm') => ({
      id,
      type: 'map_region' as const,
      sourceId: 'reg1',
      relativePathPattern: pattern,
      mapFormat: 'ros_standard' as const,
      ...(visibilitySetId ? { visibilitySetId } : {}),
      enabled: true,
    });
    const setUp = (items: ReturnType<typeof mapItem>[], sets: LayerVisibilitySet[] = [localization, navigation]) =>
      useAppStore.setState({
        ...layerStackState(makeMap('base'), makeMap('obstacles')),
        layerVisibilitySets: sets,
        exportProfiles: [
          {
            id: 'test_prof',
            name: '標準エクスポート',
            conflictResolution: 'backup_file',
            outputRootDir: '/mock/export/dir',
            items,
          },
        ],
      });
    const localization = { id: 'loc', name: 'Localization', visibility: { base: true, obstacles: false } };
    const navigation = { id: 'nav', name: 'Navigation', visibility: { base: true, obstacles: true } };
    const exportNow = async () => {
      const onClose = vi.fn();
      render(<ExportModal isOpen={true} onClose={onClose} />);
      fireEvent.click(screen.getByRole('button', { name: /保存してエクスポート/ }));
      return onClose;
    };

    it('exports one region under two sets to separate files, each with its own layers', async () => {
      setUp([mapItem('m1', 'loc'), mapItem('m2', 'nav')]);

      const onClose = await exportNow();

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      const { map_items, layers } = vi.mocked(BackendAPI.executeExportPackage).mock.calls[0][0];
      expect(map_items.map((m) => [m.save_path, m.region.layerVisibility])).toEqual([
        ['/mock/export/dir/Map/area_1_Localization', { base: true, obstacles: false }],
        ['/mock/export/dir/Map/area_1_Navigation', { base: true, obstacles: true }],
      ]);
      // Layers hidden on the canvas are still handed over for the items whose set shows them.
      expect(layers.map((l) => l.id).sort()).toEqual(['base', 'obstacles']);
    });

    it('draws the layers shown on the canvas for an item that names no set', async () => {
      setUp([mapItem('m1', undefined)]);
      useAppStore.getState().updateMapLayer('obstacles', { visible: false });

      const onClose = await exportNow();

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      const { map_items } = vi.mocked(BackendAPI.executeExportPackage).mock.calls[0][0];
      expect(map_items[0].save_path).toBe('/mock/export/dir/Map/area_1_current');
      expect(map_items[0].region.layerVisibility).toEqual({ base: true, obstacles: false });
    });

    it('refuses to export when two maps would be written to the same file', async () => {
      setUp([mapItem('m1', 'loc', 'Map/{{name}}.pgm'), mapItem('m2', 'nav', 'Map/{{name}}.pgm')]);

      await exportNow();

      await waitFor(() =>
        expect(DialogAPI.message).toHaveBeenCalledWith(
          expect.stringContaining('/mock/export/dir/Map/area_1.pgm'),
          undefined,
        ),
      );
      expect(BackendAPI.executeExportPackage).not.toHaveBeenCalled();
    });

    it('refuses to export when the set an item uses has been deleted', async () => {
      setUp([mapItem('m1', 'gone')]);

      await exportNow();

      await waitFor(() => expect(DialogAPI.message).toHaveBeenCalledWith(expect.stringContaining('削除'), undefined));
      expect(BackendAPI.executeExportPackage).not.toHaveBeenCalled();
    });

    it('asks before exporting a set that does not cover a layer added later, and exports on confirm', async () => {
      setUp([mapItem('m1', 'loc')], [{ ...localization, visibility: { base: true } }]);
      const ask = vi.spyOn(DialogAPI, 'ask').mockResolvedValue(true);

      const onClose = await exportNow();

      await waitFor(() => expect(ask).toHaveBeenCalledWith(expect.stringContaining('Localization'), expect.anything()));
      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(BackendAPI.executeExportPackage).toHaveBeenCalled();
    });

    it('does not export when that confirmation is declined', async () => {
      setUp([mapItem('m1', 'loc')], [{ ...localization, visibility: { base: true } }]);
      vi.spyOn(DialogAPI, 'ask').mockResolvedValue(false);

      await exportNow();

      await waitFor(() => expect(DialogAPI.ask).toHaveBeenCalled());
      expect(BackendAPI.executeExportPackage).not.toHaveBeenCalled();
    });

    it('lets a map item be assigned to a set, and keeps it once saved', () => {
      setUp([mapItem('m1', undefined)]);
      render(<ExportModal isOpen={true} onClose={vi.fn()} />);

      fireEvent.change(screen.getByRole('combobox', { name: 'レイヤー表示セット' }), { target: { value: 'nav' } });
      fireEvent.click(screen.getByRole('button', { name: '保存のみ' }));

      expect(useAppStore.getState().exportProfiles[0].items[0].visibilitySetId).toBe('nav');
    });

    it('does not offer a set for a waypoint item', () => {
      render(<ExportModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.queryByRole('combobox', { name: 'レイヤー表示セット' })).not.toBeInTheDocument();
    });
  });

  describe('map list file', () => {
    const mapItem = (id: string, pattern: string, mapList?: ExportMapList) => ({
      id,
      type: 'map_region' as const,
      sourceId: 'reg1',
      relativePathPattern: pattern,
      mapFormat: 'ros_standard' as const,
      ...(mapList ? { mapList } : {}),
      enabled: true,
    });
    const setUp = (items: ReturnType<typeof mapItem>[]) =>
      useAppStore.setState({
        exportProfiles: [
          {
            id: 'test_prof',
            name: '標準エクスポート',
            conflictResolution: 'backup_file',
            outputRootDir: '/mock/export/dir',
            items,
          },
        ],
      });
    const exportNow = () => {
      const onClose = vi.fn();
      render(<ExportModal isOpen={true} onClose={onClose} />);
      fireEvent.click(screen.getByRole('button', { name: /保存してエクスポート/ }));
      return onClose;
    };
    const list = (existing: 'append' | 'conflict_setting' = 'append'): ExportMapList => ({
      fileName: 'map_list.txt',
      existing,
    });

    it('hands the backend one list holding the maps of every item that shares a folder', async () => {
      setUp([mapItem('m1', 'Map/a_{{name}}.pgm', list()), mapItem('m2', 'Map/b_{{name}}.pgm', list())]);

      const onClose = exportNow();

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(vi.mocked(BackendAPI.executeExportPackage).mock.calls[0][0].map_lists).toEqual([
        { path: '/mock/export/dir/Map/map_list.txt', entries: ['a_area_1.yaml', 'b_area_1.yaml'], append: true },
      ]);
    });

    it('shows the list file in the output tree', () => {
      setUp([mapItem('m1', 'Map/{{name}}.pgm', list())]);
      render(<ExportModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('map_list.txt')).toBeInTheDocument();
    });

    it('writes no list for an item that does not ask for one', async () => {
      setUp([mapItem('m1', 'Map/{{name}}.pgm')]);

      const onClose = exportNow();

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(vi.mocked(BackendAPI.executeExportPackage).mock.calls[0][0].map_lists).toEqual([]);
    });

    it('refuses to export when items sharing a list disagree on how to treat an existing one', async () => {
      setUp([
        mapItem('m1', 'Map/a_{{name}}.pgm', list('append')),
        mapItem('m2', 'Map/b_{{name}}.pgm', list('conflict_setting')),
      ]);

      exportNow();

      await waitFor(() =>
        expect(DialogAPI.message).toHaveBeenCalledWith(
          expect.stringContaining('/mock/export/dir/Map/map_list.txt'),
          undefined,
        ),
      );
      expect(BackendAPI.executeExportPackage).not.toHaveBeenCalled();
    });

    it('does not flag an existing list as a conflict when it is appended to, but does when it is replaced', async () => {
      vi.mocked(BackendAPI.checkExportConflicts).mockImplementation(async (files) =>
        files.filter((f) => f.endsWith('map_list.txt')),
      );

      setUp([mapItem('m1', 'Map/{{name}}.pgm', list('append'))]);
      const { unmount } = render(<ExportModal isOpen={true} onClose={vi.fn()} />);
      await waitFor(() => expect(BackendAPI.checkExportConflicts).toHaveBeenCalled());
      expect(screen.queryByText(/件の同名ファイルが存在/)).not.toBeInTheDocument();
      unmount();

      setUp([mapItem('m1', 'Map/{{name}}.pgm', list('conflict_setting'))]);
      render(<ExportModal isOpen={true} onClose={vi.fn()} />);
      expect(await screen.findByText(/1 件の同名ファイルが存在/)).toBeInTheDocument();
    });

    it('shows the conflicts of the current paths even when an older check answers last', async () => {
      let answerFirstCheck: () => void = () => {};
      vi.mocked(BackendAPI.checkExportConflicts).mockImplementationOnce(
        (files) =>
          new Promise((resolve) => {
            answerFirstCheck = () => resolve(files); // every file of the old paths "exists"
          }),
      );
      render(<ExportModal isOpen={true} onClose={vi.fn()} />);
      await waitFor(() => expect(BackendAPI.checkExportConflicts).toHaveBeenCalledTimes(1));

      fireEvent.change(screen.getByDisplayValue('waypoints/{{yyyymmdd}}_waypoints.yaml'), {
        target: { value: 'renamed/{{yyyymmdd}}_waypoints.yaml' },
      });
      await waitFor(() => expect(BackendAPI.checkExportConflicts).toHaveBeenCalledTimes(2));
      await act(async () => answerFirstCheck());

      expect(screen.queryByText(/件の同名ファイルが存在/)).not.toBeInTheDocument();
    });

    it('lets a map item turn the list on, rename it and choose how an existing one is treated, and keeps it once saved', () => {
      setUp([mapItem('m1', 'Map/{{name}}.pgm')]);
      render(<ExportModal isOpen={true} onClose={vi.fn()} />);

      fireEvent.click(screen.getByRole('checkbox', { name: 'マップ一覧ファイルを出力' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'マップ一覧のファイル名' }), {
        target: { value: 'maps.txt' },
      });
      fireEvent.click(screen.getByRole('radio', { name: '競合設定に従って作り直す' }));
      fireEvent.click(screen.getByRole('button', { name: '保存のみ' }));

      expect(useAppStore.getState().exportProfiles[0].items[0].mapList).toEqual({
        fileName: 'maps.txt',
        existing: 'conflict_setting',
      });
    });

    it('does not offer a list for a waypoint item', () => {
      render(<ExportModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.queryByRole('checkbox', { name: 'マップ一覧ファイルを出力' })).not.toBeInTheDocument();
    });
  });

  describe('reopening', () => {
    const exportOnce = async (onClose: () => void) => {
      fireEvent.click(screen.getByRole('button', { name: /保存してエクスポート/ }));
      await waitFor(() => expect(onClose).toHaveBeenCalled());
    };

    it('shows the item that was selected when the dialog was closed', () => {
      const onClose = vi.fn();
      const { rerender } = render(<ExportModal isOpen={true} onClose={onClose} />);
      expect(screen.getByDisplayValue('waypoints/{{yyyymmdd}}_waypoints.yaml')).toBeInTheDocument();

      fireEvent.click(screen.getByText('area_1.pgm'));
      expect(screen.getByDisplayValue('Map/{{name}}.pgm')).toBeInTheDocument();

      rerender(<ExportModal isOpen={false} onClose={onClose} />);
      rerender(<ExportModal isOpen={true} onClose={onClose} />);
      expect(screen.getByDisplayValue('Map/{{name}}.pgm')).toBeInTheDocument();
    });

    it('keeps the date in file names from the first opening, however much later it reopens', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        vi.setSystemTime(new Date(2026, 0, 2, 3, 4, 5));
        const onClose = vi.fn();
        const { rerender } = render(<ExportModal isOpen={true} onClose={onClose} />);
        await exportOnce(onClose);
        rerender(<ExportModal isOpen={false} onClose={onClose} />);

        vi.setSystemTime(new Date(2026, 0, 3, 9, 0, 0));
        onClose.mockClear();
        rerender(<ExportModal isOpen={true} onClose={onClose} />);
        await exportOnce(onClose);

        const calls = vi.mocked(BackendAPI.executeExportPackage).mock.calls.map(([options]) => options);
        expect(calls.map((o) => o.session_timestamp)).toEqual(['20260102_030405', '20260102_030405']);
        expect(calls.map((o) => o.waypoint_items[0].path)).toEqual([
          '/mock/export/dir/waypoints/20260102_waypoints.yaml',
          '/mock/export/dir/waypoints/20260102_waypoints.yaml',
        ]);
      } finally {
        vi.useRealTimers();
      }
    });
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
