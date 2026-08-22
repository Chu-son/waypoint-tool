import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAppStore } from '../appStore';
import { normalizeProjectData } from './projectSlice';
import { BackendAPI } from '../../api';
import { PluginCustomLayer } from '../../types/store';

vi.mock('../../api', () => ({
  BackendAPI: {
    runPlugin: vi.fn(),
    fetchInstalledPlugins: vi.fn().mockResolvedValue([]),
  },
}));

describe('customLayers and pathCalculator in appStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      customLayers: [],
      activeCustomLayerId: null,
      activePathCalculatorPluginId: null,
      pathCalculatorParams: {},
      autoRecalculatePath: true,
      calculatedPathSegments: null,
      isCalculatingPath: false,
      nodes: {},
      rootNodeIds: [],
      plugins: {},
      pluginSettings: [],
    });
  });

  it('manages customLayers lifecycle (manual & plugin, add, update, reorder, remove)', () => {
    const manualLayer = useAppStore.getState().addManualCustomLayer('Manual 1');
    expect(useAppStore.getState().customLayers).toHaveLength(1);
    expect(useAppStore.getState().customLayers[0].id).toBe(manualLayer.id);
    expect(useAppStore.getState().customLayers[0].type).toBe('manual');

    const pluginLayer: PluginCustomLayer = {
      id: 'plugin-layer-1',
      name: 'Plugin Layer 1',
      type: 'plugin',
      plugin_id: 'plugin-gen',
      params: { radius: 10 },
      image_base64: 'data:image/png;base64,aaa',
      info: { resolution: 0.05, origin: [0, 0, 0], width: 100, height: 100 },
      visible: true,
      opacity: 0.8,
      z_index: 0,
      blend_mode: 'overwrite',
    };

    useAppStore.getState().addPluginCustomLayer(pluginLayer);
    expect(useAppStore.getState().customLayers).toHaveLength(2);
    expect(useAppStore.getState().customLayers[0].id).toBe('plugin-layer-1');
    expect(useAppStore.getState().customLayers[1].id).toBe(manualLayer.id);

    useAppStore.getState().updateCustomLayer('plugin-layer-1', { opacity: 0.9 });
    expect(useAppStore.getState().customLayers[0].opacity).toBe(0.9);

    useAppStore.getState().reorderCustomLayers(0, 1);
    expect(useAppStore.getState().customLayers[0].id).toBe(manualLayer.id);
    expect(useAppStore.getState().customLayers[1].id).toBe('plugin-layer-1');

    useAppStore.getState().removeCustomLayer('plugin-layer-1');
    expect(useAppStore.getState().customLayers).toHaveLength(1);
    expect(useAppStore.getState().customLayers[0].id).toBe(manualLayer.id);
  });

  it('migrates legacy edit_layers and generated_layers on ingress', () => {
    const legacyProjectData = {
      edit_layers: [
        {
          id: 'old-edit-1',
          name: 'Old Edit Layer',
          visible: true,
          opacity: 1.0,
          z_index: 0,
          editObjects: [
            { id: 'obj-1', type: 'rect', fillValue: 0, cx: 0, cy: 0, width: 2, height: 2, angle: 0 },
          ],
        },
      ],
      generated_layers: [
        {
          id: 'old-gen-1',
          name: 'Old Gen Layer',
          plugin_id: 'gen-plugin',
          params: { radius: 5 },
          image_base64: 'base64str',
          info: { resolution: 0.05, origin: [0, 0, 0] },
          visible: true,
          opacity: 0.7,
          z_index: 1,
        },
      ],
    };

    const { customLayers } = normalizeProjectData(legacyProjectData);
    expect(customLayers).toHaveLength(2);
    expect(customLayers[0].type).toBe('manual');
    expect(customLayers[0].name).toBe('Old Edit Layer');
    expect((customLayers[0] as any).editObjects).toHaveLength(1);

    expect(customLayers[1].type).toBe('plugin');
    expect(customLayers[1].name).toBe('Old Gen Layer');
    expect((customLayers[1] as any).image_base64).toBe('base64str');
  });

  it('recalculates path when waypoints and path calculator are set', async () => {
    const mockPlugin = {
      id: 'dijkstra-calc',
      folder_path: '/dummy/path',
      manifest: {
        name: 'Dijkstra',
        category: 'path_calculator',
        type: 'python',
        description: 'Dijkstra router',
      },
    };

    useAppStore.setState({
      plugins: { 'dijkstra-calc': mockPlugin as any },
      activePathCalculatorPluginId: 'dijkstra-calc',
      nodes: {
        'wpt-1': { id: 'wpt-1', type: 'manual', transform: { x: 0, y: 0, qx: 0, qy: 0, qz: 0, qw: 1 } },
        'wpt-2': { id: 'wpt-2', type: 'manual', transform: { x: 5, y: 5, qx: 0, qy: 0, qz: 0, qw: 1 } },
      },
      rootNodeIds: ['wpt-1', 'wpt-2'],
    });

    (BackendAPI.runPlugin as any).mockResolvedValue({
      segments: [
        [{ x: 0, y: 0 }, { x: 2.5, y: 2.5 }, { x: 5, y: 5 }]
      ]
    });

    await useAppStore.getState().recalculatePath({ immediate: true });

    expect(useAppStore.getState().calculatedPathSegments).toEqual([
      [{ x: 0, y: 0 }, { x: 2.5, y: 2.5 }, { x: 5, y: 5 }]
    ]);
  });

  it('debounces rapid path recalculations', async () => {
    vi.useFakeTimers();
    (BackendAPI.runPlugin as any).mockClear();
    (BackendAPI.runPlugin as any).mockResolvedValue({
      segments: [[{ x: 0, y: 0 }, { x: 5, y: 5 }]]
    });

    const mockPlugin = {
      id: 'dijkstra-calc',
      folder_path: '/dummy/path',
      manifest: {
        name: 'Dijkstra',
        category: 'path_calculator',
        type: 'python',
      },
    };

    useAppStore.setState({
      plugins: { 'dijkstra-calc': mockPlugin as any },
      activePathCalculatorPluginId: 'dijkstra-calc',
      nodes: {
        'wpt-1': { id: 'wpt-1', type: 'manual', transform: { x: 0, y: 0, qx: 0, qy: 0, qz: 0, qw: 1 } },
        'wpt-2': { id: 'wpt-2', type: 'manual', transform: { x: 5, y: 5, qx: 0, qy: 0, qz: 0, qw: 1 } },
      },
      rootNodeIds: ['wpt-1', 'wpt-2'],
    });

    useAppStore.getState().debouncedRecalculatePath(100);
    useAppStore.getState().debouncedRecalculatePath(100);
    useAppStore.getState().debouncedRecalculatePath(100);

    expect(BackendAPI.runPlugin).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(150);

    expect(BackendAPI.runPlugin).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
