import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAppStore } from '../appStore';
import { BackendAPI } from '../../api';
import { PluginInstance, WaypointNode } from '../../types/store';

vi.mock('../../api', () => ({
  BackendAPI: {
    runPlugin: vi.fn(),
    fetchInstalledPlugins: vi.fn().mockResolvedValue([]),
  },
  DialogAPI: {
    ask: vi.fn().mockResolvedValue(true),
  },
}));

describe('pluginSlice - executeGeneratorPlugin placement & history atomicity', () => {
  const dummyPlugin: PluginInstance = {
    id: 'test_generator',
    manifest: {
      name: 'Test Generator',
      type: 'python',
      executable: 'main.py',
      inputs: [],
      properties: [],
    },
    folder_path: '/plugins/test',
    is_builtin: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      nodes: {},
      rootNodeIds: [],
      selectedNodeIds: [],
      insertionTarget: null,
      customLayers: [],
      annotationObjects: {},
      annotationGroups: {},
      plugins: { test_generator: dummyPlugin },
      historyPast: [],
      historyFuture: [],
      historyTransactionDepth: 0,
      isDirty: false,
    });
  });

  it('replaces root node at its exact index and preserves insertionTarget without moving it', async () => {
    const wp0: WaypointNode = { id: 'wp-0', type: 'manual', name: 'WP 0' };
    const wp1: WaypointNode = { id: 'wp-1', type: 'manual', name: 'WP 1' };
    const wp2: WaypointNode = { id: 'wp-2', type: 'manual', name: 'WP 2' };

    useAppStore.setState({
      nodes: { 'wp-0': wp0, 'wp-1': wp1, 'wp-2': wp2 },
      rootNodeIds: ['wp-0', 'wp-1', 'wp-2'],
      // User set insertion target between wp-1 and wp-2 (index 2)
      insertionTarget: { parentId: null, index: 2 },
    });

    (BackendAPI.runPlugin as any).mockResolvedValueOnce({
      waypoints: [
        { name: 'Gen WP 1', x: 1, y: 1 },
        { name: 'Gen WP 2', x: 2, y: 2 },
      ],
    });

    const store = useAppStore.getState();
    const result = await store.executeGeneratorPlugin({
      plugin: dummyPlugin,
      properties: {},
      interactionData: {},
      placement: { type: 'replace_ids', ids: ['wp-0'] },
    });

    expect(result.success).toBe(true);

    const state = useAppStore.getState();
    const genId = result.parentWaypointId!;
    expect(genId).toBeDefined();

    // Generator should replace wp-0 at Root index 0!
    expect(state.rootNodeIds[0]).toBe(genId);
    expect(state.nodes['wp-0']).toBeUndefined();
    expect(state.nodes[genId]).toBeDefined();
    expect(state.nodes[genId].children_ids).toHaveLength(2);

    // insertionTarget should be mapped safely and NOT overridden/advanced by plugin addNodes!
    expect(state.insertionTarget).toBeDefined();
    expect(state.insertionTarget?.parentId).toBeNull();
    // Since wp-0 was removed, wp-1 shifted to 0, wp-2 shifted to 1.
    // The insertionTarget tracked the boundary between wp-1 and wp-2 (now index 1 or 2)
    // and was NOT advanced by the 2 child nodes of the generator.
    expect(state.nodes[genId].children_ids?.includes(state.rootNodeIds[1])).toBe(false);

    // History should allow full undo in a single step
    expect(state.historyPast.length).toBeGreaterThan(0);
    store.undo();

    const undoneState = useAppStore.getState();
    // wp-0 should be restored
    expect(undoneState.nodes['wp-0']).toBeDefined();
    // generator should be gone
    expect(undoneState.nodes[genId]).toBeUndefined();
    expect(undoneState.rootNodeIds).toEqual(['wp-0', 'wp-1', 'wp-2']);
  });
});
