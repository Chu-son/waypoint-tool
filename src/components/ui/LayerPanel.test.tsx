import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LayerPanel } from './LayerPanel';
import { BackendAPI, DialogAPI } from '../../api';
import { renderWithStore } from '../../test/render';
import { getAppState } from '../../test/store';
import { makeManualCustomLayer, makeMapLayer } from '../../test/fixtures';

const EDIT_MAP_LAYER = 'Edit Map Layer (Pose, Opacity, Blend, Thresholds)';
const EDIT_CUSTOM_LAYER = 'Edit Layer Settings (Opacity, Blend Mode)';

const twoMaps = () => ({
  mapLayers: [
    makeMapLayer('l1', { name: 'Map 1', z_index: 0 }),
    makeMapLayer('l2', { name: 'Map 2', visible: false, opacity: 0.5, z_index: 1 }),
  ],
});

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

    expect(getAppState().mapLayers.map((l) => l.id)).toEqual(['l2', 'l1']);
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
    expect(getAppState().mapLayers[0]).toMatchObject({
      name: 'test_map.yaml',
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
    renderWithStore(<LayerPanel />, {
      customLayers: [
        makeManualCustomLayer('cl1', { name: 'Ref Layer', is_reference: true, blend_mode: 'overwrite' }),
        makeManualCustomLayer('cl2', { name: 'Normal Layer', z_index: 1, blend_mode: 'overwrite' }),
      ],
    });

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
    renderWithStore(<LayerPanel />, {
      customLayers: [makeManualCustomLayer('cl1', { name: 'Custom Layer 1', opacity: 0.7 })],
    });

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
    const rotatedMap = (origin: [number, number, number]) => ({
      mapLayers: [
        makeMapLayer('l1', {
          name: 'Map 1',
          opacity: 0.8,
          info: { resolution: 0.05, origin, initial_origin: [10, 20, 0] },
        }),
      ],
    });

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

      expect(getAppState().mapLayers[0].info).toMatchObject({
        origin: [10, 20, Math.PI / 2],
        initial_origin: [10, 20, 0],
      });
    });

    it('resets the pose to the origin from the YAML file', () => {
      renderWithStore(<LayerPanel />, rotatedMap([15, 25, Math.PI / 4]));

      fireEvent.click(screen.getByTitle(EDIT_MAP_LAYER));
      fireEvent.click(screen.getByTitle('Reset pose to YAML origin'));

      expect(getAppState().mapLayers[0].info).toMatchObject({ origin: [10, 20, 0], initial_origin: [10, 20, 0] });
    });
  });
});
