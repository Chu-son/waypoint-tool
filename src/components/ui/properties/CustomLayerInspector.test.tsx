import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CustomLayerInspector } from './CustomLayerInspector';
import { useAppStore } from '../../../stores/appStore';
import { PluginInstance, ManualCustomLayer, PluginCustomLayer } from '../../../types/store';
import { BackendAPI } from '../../../api';

vi.mock('../../../api', () => ({
  BackendAPI: {
    runPlugin: vi.fn().mockResolvedValue({
      name: 'Generated Overlay',
      image_base64: 'data:image/png;base64,mock',
      info: { resolution: 0.05, origin: [0, 0, 0] },
      blend_mode: 'overwrite',
    }),
  },
  DialogAPI: {
    ask: vi.fn().mockResolvedValue(true),
  },
}));

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
      properties: [
        { name: 'radius', type: 'number', default: 0.5, label: 'Inflation Radius' },
      ],
      inputs: [
        { id: 'seed_point', name: 'seed_point', type: 'point', label: 'Seed Point', required: true },
      ],
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
      z_index: 0,
      blend_mode: 'overwrite',
      editObjects: [
        { id: 'obj-1', type: 'rect', fillValue: 0, cx: 1, cy: 1, width: 2, height: 2, angle: 0 },
      ],
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
      z_index: 0,
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
});
