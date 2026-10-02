import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LayerPanel } from './LayerPanel';
import { BackendAPI, DialogAPI } from '../../../api';
import { renderWithStore } from '../../../test/render';
import { getAppState } from '../../../test/store';
import { layerStackState, makeManualCustomLayer, makeMap } from '../../../test/fixtures';

const EDIT_MAP_LAYER = 'Edit Map Layer (Pose, Opacity, Blend, Use Area, Thresholds)';
const EDIT_CUSTOM_LAYER = 'Edit Layer Settings (Opacity, Blend Mode)';
const DUPLICATE_MAP = 'Duplicate Map (to use a different area of it)';

const twoMaps = () =>
  layerStackState(makeMap('l1', { name: 'Map 1' }), makeMap('l2', { name: 'Map 2', visible: false, opacity: 0.5 }));

describe('LayerPanel', () => {
  it('shows an empty state when there are no layers', () => {
    renderWithStore(<LayerPanel />);
    expect(screen.getByText(/no maps or custom layers/i)).toBeInTheDocument();
  });

  it('toggles map layer visibility', () => {
    renderWithStore(<LayerPanel />, twoMaps());
    expect(screen.getByText('Map 1')).toBeInTheDocument();

    fireEvent.click(screen.getAllByTitle('Toggle Visibility')[0]);

    expect(getAppState().mapLayers.find((l) => l.id === 'l1')?.visible).toBe(false);
  });

  it('moves a map layer down in the stack', () => {
    renderWithStore(<LayerPanel />, twoMaps());

    fireEvent.click(screen.getAllByTitle('Move Down')[0]);

    expect(getAppState().layerOrder).toEqual(['l2', 'l1']);
  });

  it('lets a custom layer sit between two maps', () => {
    renderWithStore(<LayerPanel />, layerStackState(makeMap('a'), makeManualCustomLayer('wall'), makeMap('b')));

    // Move the bottom map above the custom layer.
    fireEvent.click(screen.getAllByTitle('Move Up')[2]);

    expect(getAppState().layerOrder).toEqual(['a', 'b', 'wall']);
  });

  it('loads a ROS map chosen in the file dialog as a new layer', async () => {
    vi.spyOn(DialogAPI, 'open').mockResolvedValue('/path/to/test_map.yaml');
    const loadROSMap = vi.spyOn(BackendAPI, 'loadROSMap').mockResolvedValue({
      info: {
        image: 'test_map.pgm',
        resolution: 0.05,
        origin: [1, 2, 0],
        negate: 0,
        occupied_thresh: 0.65,
        free_thresh: 0.25,
      },
      image_data_b64: 'fake-base64',
      width: 100,
      height: 80,
    });
    renderWithStore(<LayerPanel />, { lastDirectory: '/test/dir' });

    fireEvent.click(screen.getByText('Load Map'));

    await waitFor(() => expect(getAppState().mapLayers).toHaveLength(1));
    expect(loadROSMap).toHaveBeenCalledWith('/path/to/test_map.yaml');
    expect(getAppState().mapLayers[0]).toMatchObject({ name: 'test_map.yaml', clip: null });
    expect(getAppState().mapSources[0]).toMatchObject({
      image_base64: 'fake-base64',
      width: 100,
      height: 80,
      info: { resolution: 0.05, origin: [1, 2, 0] },
    });
    expect(getAppState().lastDirectory).toBe('/path/to');
    expect(await screen.findByText('test_map.yaml')).toBeInTheDocument();
  });

  it('removes a map layer after the user confirms', async () => {
    vi.spyOn(DialogAPI, 'ask').mockResolvedValue(true);
    renderWithStore(<LayerPanel />, twoMaps());

    fireEvent.click(screen.getAllByTitle('Remove Map')[0]);

    await waitFor(() => expect(getAppState().mapLayers.map((l) => l.id)).toEqual(['l2']));
  });

  it('keeps the map layer when the user cancels removal', async () => {
    const ask = vi.spyOn(DialogAPI, 'ask').mockResolvedValue(false);
    renderWithStore(<LayerPanel />, twoMaps());

    fireEvent.click(screen.getAllByTitle('Remove Map')[0]);

    await waitFor(() => expect(ask).toHaveBeenCalled());
    expect(getAppState().mapLayers).toHaveLength(2);
  });

  it('toggles whether a custom layer is a reference layer', () => {
    renderWithStore(
      <LayerPanel />,
      layerStackState(
        makeManualCustomLayer('cl1', { name: 'Ref Layer', is_reference: true, blend_mode: 'overwrite' }),
        makeManualCustomLayer('cl2', { name: 'Normal Layer', blend_mode: 'overwrite' }),
      ),
    );

    expect(screen.getByDisplayValue('Ref Layer')).toBeInTheDocument();
    expect(screen.getByText('REF')).toBeInTheDocument();
    expect(screen.queryByText(/※ 参照レイヤーのため合成されません/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByTitle(EDIT_CUSTOM_LAYER)[0]);
    expect(screen.getByText(/※ 参照レイヤーのため合成されません/i)).toBeInTheDocument();

    const refToggles = screen.getAllByTitle(/Reference Layer:/i);
    fireEvent.click(refToggles[1]);
    fireEvent.click(refToggles[0]);

    const byId = Object.fromEntries(getAppState().customLayers.map((l) => [l.id, l]));
    expect(byId.cl1.is_reference).toBe(false);
    expect(byId.cl2.is_reference).toBe(true);
  });

  it('reveals custom layer opacity and blend mode only after opening its settings', () => {
    renderWithStore(
      <LayerPanel />,
      layerStackState(makeManualCustomLayer('cl1', { name: 'Custom Layer 1', opacity: 0.7 })),
    );

    expect(screen.queryByText('Opacity')).not.toBeInTheDocument();
    expect(screen.queryByText('Blend Mode')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle(EDIT_CUSTOM_LAYER));

    expect(screen.getByText('Opacity')).toBeInTheDocument();
    expect(screen.getByText('Blend Mode')).toBeInTheDocument();
  });

  it('reveals export region bounds only after opening its settings', () => {
    renderWithStore(<LayerPanel />, {
      exportRegions: [
        { id: 'r1', name: 'Export Zone', rect: { x: 1.5, y: 2.5, width: 10, height: 20 }, visible: true },
      ],
    });

    expect(screen.getByDisplayValue('Export Zone')).toBeInTheDocument();
    expect(screen.getByText('Region 1')).toBeInTheDocument();
    expect(screen.queryByText('Region Bounds')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Region Bounds Settings'));

    expect(screen.getByText('Region Bounds')).toBeInTheDocument();
    for (const label of ['X (m)', 'Y (m)', 'Width (m)', 'Height (m)']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  describe('map layer pose', () => {
    const rotatedMap = (origin: [number, number, number]) =>
      layerStackState(
        makeMap('l1', {
          name: 'Map 1',
          opacity: 0.8,
          info: { resolution: 0.05, origin, initial_origin: [10, 20, 0] },
        }),
      );

    it('reveals pose, opacity, blend and threshold settings, and rotates the map by +90°', () => {
      renderWithStore(<LayerPanel />, rotatedMap([10, 20, 0]));

      expect(screen.queryByText('Layer Opacity')).not.toBeInTheDocument();
      expect(screen.queryByText(/Relative Pose/i)).not.toBeInTheDocument();

      fireEvent.click(screen.getByTitle(EDIT_MAP_LAYER));

      expect(screen.getByText('Layer Opacity')).toBeInTheDocument();
      expect(screen.getByText('Blend Mode')).toBeInTheDocument();
      expect(screen.getByText(/Relative Pose/i)).toBeInTheDocument();
      expect(screen.getByText('Occupancy Thresholds')).toBeInTheDocument();
      expect(screen.getByText(/YAML Origin:/i)).toBeInTheDocument();

      fireEvent.click(screen.getByTitle('Rotate +90° (Clockwise)'));

      expect(getAppState().mapSources[0].info).toMatchObject({
        origin: [10, 20, Math.PI / 2],
        initial_origin: [10, 20, 0],
      });
    });

    it('lets a map layer replace the cells below it, unknown ones included', () => {
      renderWithStore(<LayerPanel />, twoMaps());

      fireEvent.click(screen.getAllByTitle(EDIT_MAP_LAYER)[0]);
      fireEvent.change(screen.getByDisplayValue('Overwrite (Ignore Unknown)'), { target: { value: 'replace' } });

      expect(getAppState().mapLayers.find((l) => l.id === 'l1')?.blend_mode).toBe('replace');
      expect(getAppState().mapLayers.find((l) => l.id === 'l2')?.blend_mode).toBe('overwrite');
    });

    it('resets the pose to the origin from the YAML file', () => {
      renderWithStore(<LayerPanel />, rotatedMap([15, 25, Math.PI / 4]));

      fireEvent.click(screen.getByTitle(EDIT_MAP_LAYER));
      fireEvent.click(screen.getByTitle('Reset pose to YAML origin'));

      expect(getAppState().mapSources[0].info).toMatchObject({ origin: [10, 20, 0], initial_origin: [10, 20, 0] });
    });

    it('nudges the pose with the adjuster buttons and arrow keys', () => {
      renderWithStore(<LayerPanel />, rotatedMap([10, 20, 0]));
      fireEvent.click(screen.getByTitle(EDIT_MAP_LAYER));

      fireEvent.click(screen.getByRole('button', { name: /Move right/ }));
      fireEvent.click(screen.getByRole('button', { name: /Move up/ }));
      expect(getAppState().mapSources[0].info.origin).toEqual([10.1, 20.1, 0]);

      fireEvent.keyDown(screen.getByRole('group', { name: 'Pose adjuster' }), { key: 'ArrowLeft', shiftKey: true });
      expect(getAppState().mapSources[0].info.origin[0]).toBeCloseTo(9.1);

      fireEvent.click(screen.getByRole('button', { name: /counter-clockwise/ }));
      expect(getAppState().mapSources[0].info.origin[2]).toBeCloseTo(Math.PI / 180);
    });
  });

  describe('duplicating a map', () => {
    it('adds another layer of the same map right above it, without copying the image', () => {
      renderWithStore(
        <LayerPanel />,
        layerStackState(makeMap('l1', { name: 'Map 1' }), makeMap('l2', { name: 'Map 2' })),
      );

      fireEvent.click(screen.getAllByTitle(DUPLICATE_MAP)[1]);

      const { mapLayers, mapSources, layerOrder } = getAppState();
      expect(mapLayers).toHaveLength(3);
      expect(mapSources).toHaveLength(2);
      expect(layerOrder.slice(0, 2)).toEqual(['l1', layerOrder[1]]);
      expect(layerOrder[2]).toBe('l2');
      expect(screen.getByText('Map 2 (copy)')).toBeInTheDocument();
    });

    it('applies a pose change made on one copy to every copy of the map', () => {
      renderWithStore(<LayerPanel />, layerStackState(makeMap('l1', { name: 'Map 1' })));
      fireEvent.click(screen.getByTitle(DUPLICATE_MAP));
      expect(screen.getAllByText(/Shared ×2/)).toHaveLength(2);

      fireEvent.click(screen.getAllByTitle(EDIT_MAP_LAYER)[0]);
      fireEvent.click(screen.getByTitle('Rotate +90° (Clockwise)'));

      const { mapSources } = getAppState();
      expect(mapSources).toHaveLength(1);
      expect(mapSources[0].info.origin[2]).toBeCloseTo(Math.PI / 2);
    });

    it('keeps the map data while another copy still uses it, and drops it with the last copy', async () => {
      vi.spyOn(DialogAPI, 'ask').mockResolvedValue(true);
      renderWithStore(<LayerPanel />, layerStackState(makeMap('l1', { name: 'Map 1' })));
      fireEvent.click(screen.getByTitle(DUPLICATE_MAP));

      fireEvent.click(screen.getAllByTitle('Remove Map')[0]);
      await waitFor(() => expect(getAppState().mapLayers).toHaveLength(1));
      expect(getAppState().mapSources).toHaveLength(1);

      fireEvent.click(screen.getByTitle('Remove Map'));
      await waitFor(() => expect(getAppState().mapLayers).toHaveLength(0));
      expect(getAppState().mapSources).toHaveLength(0);
    });
  });

  describe('using only part of a map', () => {
    // 100 × 100 px at 0.05 m/px with origin (0, 0): the map covers (0, 0)–(5, 5) m.
    const openClipSettings = () => {
      renderWithStore(<LayerPanel />, layerStackState(makeMap('l1', { name: 'Map 1' })));
      fireEvent.click(screen.getByTitle(EDIT_MAP_LAYER));
    };

    it('starts using the whole map and can be limited to one half of it', () => {
      openClipSettings();
      expect(getAppState().mapLayers[0].clip).toBeNull();

      fireEvent.click(screen.getByRole('switch', { name: 'Use only part of this map' }));
      expect(getAppState().mapLayers[0].clip).toEqual({ rects: [{ x: 0, y: 0, width: 5, height: 5 }] });

      fireEvent.click(screen.getByRole('button', { name: 'Right half' }));
      expect(getAppState().mapLayers[0].clip).toEqual({ rects: [{ x: 2.5, y: 0, width: 2.5, height: 5 }] });
    });

    it('builds an L-shaped area from several rectangles', () => {
      openClipSettings();
      fireEvent.click(screen.getByRole('switch', { name: 'Use only part of this map' }));

      fireEvent.click(screen.getByRole('button', { name: 'Add area' }));

      expect(getAppState().mapLayers[0].clip?.rects).toHaveLength(2);
      expect(screen.getByRole('group', { name: 'Area 2' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Remove area 2' }));
      expect(getAppState().mapLayers[0].clip?.rects).toHaveLength(1);
    });

    it('goes back to the whole map when switched off', () => {
      openClipSettings();
      fireEvent.click(screen.getByRole('switch', { name: 'Use only part of this map' }));
      fireEvent.click(screen.getByRole('button', { name: 'Left half' }));

      fireEvent.click(screen.getByRole('switch', { name: 'Use only part of this map' }));

      expect(getAppState().mapLayers[0].clip).toBeNull();
    });

    it('undoes a preset and typed changes to the area, each in one step', () => {
      openClipSettings();
      fireEvent.click(screen.getByRole('switch', { name: 'Use only part of this map' }));
      fireEvent.click(screen.getByRole('button', { name: 'Left half' }));

      const area = within(screen.getByRole('group', { name: 'Area 1' }));
      const width = area.getByLabelText('W');
      fireEvent.focus(width);
      fireEvent.change(width, { target: { value: '1' } });
      fireEvent.blur(width);
      expect(getAppState().mapLayers[0].clip?.rects[0].width).toBe(1);

      getAppState().undo();
      expect(getAppState().mapLayers[0].clip?.rects[0].width).toBe(2.5);

      getAppState().undo();
      expect(getAppState().mapLayers[0].clip).toEqual({ rects: [{ x: 0, y: 0, width: 5, height: 5 }] });
    });

    it('switches to drawing the area on the canvas and back', () => {
      openClipSettings();
      fireEvent.click(screen.getByRole('switch', { name: 'Use only part of this map' }));

      fireEvent.click(screen.getByRole('button', { name: 'Draw on canvas' }));
      expect(getAppState().appMode).toEqual({ mode: 'map_clip_edit', layerId: 'l1' });

      fireEvent.click(screen.getByRole('button', { name: 'Done drawing' }));
      expect(getAppState().appMode.mode).toBe('select');
    });

    it('stops drawing when the area is switched off', () => {
      openClipSettings();
      fireEvent.click(screen.getByRole('switch', { name: 'Use only part of this map' }));
      fireEvent.click(screen.getByRole('button', { name: 'Draw on canvas' }));

      fireEvent.click(screen.getByRole('switch', { name: 'Use only part of this map' }));

      expect(getAppState().appMode.mode).toBe('select');
      expect(getAppState().mapLayers[0].clip).toBeNull();
    });
  });

  describe('renaming a map layer', () => {
    const oneMap = () => renderWithStore(<LayerPanel />, layerStackState(makeMap('l1', { name: 'Map 1' })));

    it('renames by double-clicking the name and pressing Enter', () => {
      oneMap();

      fireEvent.doubleClick(screen.getByText('Map 1'));
      const input = screen.getByDisplayValue('Map 1');
      fireEvent.change(input, { target: { value: 'Warehouse 1F' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(getAppState().mapLayers[0].name).toBe('Warehouse 1F');
      expect(screen.getByText('Warehouse 1F')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('Warehouse 1F')).not.toBeInTheDocument();
    });

    it('keeps the old name when renaming is cancelled with Escape or left empty', () => {
      oneMap();

      fireEvent.doubleClick(screen.getByText('Map 1'));
      fireEvent.change(screen.getByDisplayValue('Map 1'), { target: { value: 'Other' } });
      fireEvent.keyDown(screen.getByDisplayValue('Other'), { key: 'Escape' });
      expect(getAppState().mapLayers[0].name).toBe('Map 1');

      fireEvent.doubleClick(screen.getByText('Map 1'));
      const input = screen.getByDisplayValue('Map 1');
      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(getAppState().mapLayers[0].name).toBe('Map 1');
    });

    it('renames from the context menu', () => {
      oneMap();

      fireEvent.contextMenu(screen.getByText('Map 1'));
      fireEvent.click(screen.getByText('名前を変更'));
      const input = screen.getByDisplayValue('Map 1');
      fireEvent.change(input, { target: { value: 'Annex' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(getAppState().mapLayers[0].name).toBe('Annex');
    });
  });
});
