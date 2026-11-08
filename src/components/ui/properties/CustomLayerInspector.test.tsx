import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { CustomLayerInspector } from './CustomLayerInspector';
import { useAppStore } from '../../../stores/appStore';
import { PluginInstance, ManualCustomLayer, PluginCustomLayer } from '../../../types/store';
import { BackendAPI, DialogAPI } from '../../../api';
import { getAppState, resetAppStore } from '../../../test/store';
import { makePluginLayer } from '../../../test/fixtures';

beforeEach(() => {
  vi.spyOn(BackendAPI, 'runPlugin').mockResolvedValue({
    name: 'Generated Overlay',
    image_base64: 'data:image/png;base64,mock',
    info: { resolution: 0.05, origin: [0, 0, 0] },
    blend_mode: 'overwrite',
  });
  vi.spyOn(DialogAPI, 'ask').mockResolvedValue(true);
});

describe('CustomLayerInspector', () => {
  const mockPlugin: PluginInstance = {
    id: 'test-layer-plugin',
    folder_path: '/plugins/test-layer-plugin',
    is_builtin: true,
    manifest: {
      name: 'Costmap Inflator',
      category: 'map_layer_generator',
      type: 'python',
      executable: 'main.py',
      description: 'Inflates obstacles in the map',
      properties: [{ name: 'radius', type: 'float', default: 0.5, label: 'Inflation Radius' }],
      inputs: [{ id: 'seed_point', name: 'seed_point', type: 'point', label: 'Seed Point', required: true }],
    },
  };

  beforeEach(() => {
    useAppStore.setState({
      plugins: { 'test-layer-plugin': mockPlugin },
      customLayers: [],
      activeCustomLayerId: 'new',
      activePluginId: 'test-layer-plugin',
      pluginInteractionData: {},
      isMapEditMode: false,
    });
  });

  it('renders creation mode for plugin layer and generates layer on click', async () => {
    render(<CustomLayerInspector />);

    expect(screen.getByText('Generate Plugin Layer')).toBeInTheDocument();
    expect(screen.getByText('Inflation Radius')).toBeInTheDocument();

    const generateBtn = screen.getByText('Generate Layer');
    fireEvent.click(generateBtn);

    // After async run, layer should be added and execution finished
    await vi.waitFor(() => {
      const layers = useAppStore.getState().customLayers;
      expect(layers.length).toBeGreaterThan(0);
      expect(layers[0].type).toBe('plugin');
      expect(screen.queryByText('Generating...')).not.toBeInTheDocument();
    });
  });

  it('renders manual layer tools and edit mode controls', () => {
    const manualLayer: ManualCustomLayer = {
      id: 'manual-1',
      name: 'Forbidden Area',
      type: 'manual',
      visible: true,
      opacity: 1.0,
      blend_mode: 'overwrite',
      editObjects: [{ id: 'obj-1', type: 'rect', fillValue: 0, cx: 1, cy: 1, width: 2, height: 2, angle: 0 }],
    };

    useAppStore.setState({
      customLayers: [manualLayer],
      activeCustomLayerId: 'manual-1',
    });

    render(<CustomLayerInspector />);

    expect(screen.getByText('Manual Custom Layer')).toBeInTheDocument();
    expect(screen.getByText('Vector Drawing Tools')).toBeInTheDocument();
    expect(screen.getByText('Rectangle')).toBeInTheDocument();
    expect(screen.getByText('Circle')).toBeInTheDocument();
    expect(screen.getByText('Brush')).toBeInTheDocument();
    expect(screen.getByText('Obstacle (0)')).toBeInTheDocument();
    expect(screen.getByText('Free (255)')).toBeInTheDocument();
    expect(screen.getByText(/rect #1/i)).toBeInTheDocument();
  });

  it('does not exit map edit mode when mounted right after entering edit mode for a manual layer', () => {
    const manualLayer: ManualCustomLayer = {
      id: 'manual-1',
      name: 'Forbidden Area',
      type: 'manual',
      visible: true,
      opacity: 1.0,
      blend_mode: 'overwrite',
      editObjects: [],
    };

    useAppStore.setState({
      customLayers: [manualLayer],
      activeCustomLayerId: 'manual-1',
      isMapEditMode: true,
    });

    render(<CustomLayerInspector />);

    expect(useAppStore.getState().isMapEditMode).toBe(true);
    expect(useAppStore.getState().activeCustomLayerId).toBe('manual-1');
  });

  it('renders existing plugin layer and allows re-generation', async () => {
    const pluginLayer: PluginCustomLayer = {
      id: 'plugin-layer-1',
      name: 'Custom Drivable Area',
      type: 'plugin',
      plugin_id: 'test-layer-plugin',
      params: { radius: 0.8 },
      image_base64: 'data:image/png;base64,mock',
      info: { resolution: 0.05, origin: [0, 0, 0], width: 100, height: 100 },
      visible: true,
      opacity: 0.7,
      blend_mode: 'overwrite',
    };

    useAppStore.setState({
      plugins: { 'test-layer-plugin': mockPlugin },
      customLayers: [pluginLayer],
      activeCustomLayerId: 'plugin-layer-1',
      activePluginId: 'test-layer-plugin',
    });

    render(<CustomLayerInspector />);

    expect(screen.getByText('Plugin Custom Layer')).toBeInTheDocument();
    expect(screen.getByText('Re-generate Layer')).toBeInTheDocument();

    const regenBtn = screen.getByText('Re-generate Layer');
    fireEvent.click(regenBtn);

    await vi.waitFor(() => {
      expect(BackendAPI.runPlugin).toHaveBeenCalled();
      expect(screen.queryByText('Generating...')).not.toBeInTheDocument();
    });
  });

  describe('undo', () => {
    const layer = makePluginLayer('generated', {
      name: 'Drivable',
      plugin_id: 'test-layer-plugin',
      opacity: 0.7,
      image_base64: 'before',
    });
    const storedLayer = () => getAppState().customLayers[0] as PluginCustomLayer;

    beforeEach(() =>
      resetAppStore({
        plugins: { 'test-layer-plugin': mockPlugin },
        customLayers: [layer],
        selection: { type: 'layers', ids: ['generated'], selectedObjectId: null },
        activeCustomLayerId: 'generated',
        activePluginId: 'test-layer-plugin',
      }),
    );

    it('undoes typing a name in one step and shows the restored name', () => {
      render(<CustomLayerInspector />);
      const input = screen.getByPlaceholderText('Layer Name');

      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'D' } });
      fireEvent.change(input, { target: { value: 'Dr' } });
      fireEvent.blur(input);

      expect(getAppState().historyPast).toHaveLength(1);
      act(() => getAppState().undo());
      expect(storedLayer().name).toBe('Drivable');
      expect(input).toHaveValue('Drivable');
    });

    it('undoes an opacity drag in one step and shows the restored opacity', () => {
      render(<CustomLayerInspector />);
      const slider = screen.getByRole('slider');

      fireEvent.pointerDown(slider, { button: 0 });
      fireEvent.change(slider, { target: { value: '0.5' } });
      fireEvent.change(slider, { target: { value: '0.2' } });
      fireEvent.pointerUp(window);

      expect(getAppState().historyPast).toHaveLength(1);
      act(() => getAppState().undo());
      expect(storedLayer().opacity).toBe(0.7);
      expect(slider).toHaveValue('0.7');
    });

    it('undoes a re-generation and the appearance kept across it in one step', async () => {
      vi.mocked(BackendAPI.runPlugin).mockResolvedValue({
        name: 'Generated Overlay',
        image_base64: 'after',
        info: { resolution: 0.05, origin: [0, 0, 0] },
      });
      render(<CustomLayerInspector />);

      fireEvent.click(screen.getByText('Re-generate Layer'));

      await vi.waitFor(() => expect(storedLayer().image_base64).toBe('after'));
      await vi.waitFor(() => expect(getAppState().historyTransactionDepth).toBe(0));
      expect(storedLayer().name).toBe('Drivable');
      expect(getAppState().historyPast).toHaveLength(1);

      act(() => getAppState().undo());

      expect(storedLayer().image_base64).toBe('before');
    });

    it('leaves no undo step and no open transaction when the generation fails', async () => {
      vi.mocked(BackendAPI.runPlugin).mockRejectedValue(new Error('plugin crashed'));
      render(<CustomLayerInspector />);

      fireEvent.click(screen.getByText('Re-generate Layer'));

      await vi.waitFor(() => expect(BackendAPI.runPlugin).toHaveBeenCalled());
      await vi.waitFor(() => expect(getAppState().historyTransactionDepth).toBe(0));
      expect(getAppState().historyPast).toHaveLength(0);
    });
  });
});
