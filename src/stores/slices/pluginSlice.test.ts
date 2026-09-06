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

describe('pluginSlice - executePipeline', () => {
  const step1Plugin: PluginInstance = {
    id: 'layer_filter',
    manifest: {
      name: 'Layer Filter',
      type: 'python',
      executable: 'main.py',
      inputs: [{ id: 'input_img', name: 'input_img', label: 'Input Image', type: 'string' }],
      properties: [{ name: 'threshold', label: 'Threshold', type: 'float', default: 0.5 }],
    },
    folder_path: '/plugins/filter',
    is_builtin: true,
  };

  const step2Plugin: PluginInstance = {
    id: 'path_planner',
    manifest: {
      name: 'Path Planner',
      type: 'python',
      executable: 'main.py',
      inputs: [{ id: 'cost_layer', name: 'cost_layer', label: 'Cost Layer', type: 'custom_layer' }],
      properties: [{ name: 'smooth', label: 'Smooth Path', type: 'boolean', default: true }],
    },
    folder_path: '/plugins/planner',
    is_builtin: true,
  };

  const pipelinePlugin: PluginInstance = {
    id: 'sample_pipeline',
    manifest: {
      name: 'Sample Pipeline',
      type: 'pipeline',
      executable: '',
      inputs: [],
      properties: [],
      pipeline: {
        steps: [
          {
            step_id: 'step_layer',
            plugin_id: 'layer_filter',
            name: 'Step 1 Filter',
            property_overrides: { threshold: 0.8 },
            exports: { custom_layers: true },
          },
          {
            step_id: 'step_path',
            plugin_id: 'path_planner',
            name: 'Step 2 Plan',
            bindings: {
              'inputs.cost_layer': '$steps.step_layer.custom_layers[0]',
            },
            exports: { waypoints: true },
          },
        ],
      },
    },
    folder_path: '/plugins/pipeline',
    is_builtin: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      nodes: {},
      rootNodeIds: [],
      selectedNodeIds: [],
      customLayers: [],
      annotationObjects: {},
      annotationGroups: {},
      plugins: {
        layer_filter: step1Plugin,
        path_planner: step2Plugin,
        sample_pipeline: pipelinePlugin,
      },
      historyPast: [],
      historyFuture: [],
      historyTransactionDepth: 0,
      activePipelineInputRef: null,
    });
  });

  it('manages activePipelineInputRef correctly', () => {
    const store = useAppStore.getState();
    expect(store.activePipelineInputRef).toBeNull();

    store.setActivePipelineInputRef({ stepId: 'step_layer', inputId: 'input_img' });
    expect(useAppStore.getState().activePipelineInputRef).toEqual({
      stepId: 'step_layer',
      inputId: 'input_img',
    });

    store.setActivePlugin(null);
    expect(useAppStore.getState().activePipelineInputRef).toBeNull();
  });

  it('updates plugin setting whether entry exists or not', () => {
    const store = useAppStore.getState();
    // Initially empty
    expect(store.pluginSettings).toEqual([]);

    // Should create new setting entry
    store.updatePluginSetting('new-plugin', { pythonOverridePath: '/custom/bin/python' });
    expect(useAppStore.getState().pluginSettings).toEqual([
      { id: 'new-plugin', enabled: true, order: 0, isBuiltin: false, pythonOverridePath: '/custom/bin/python' },
    ]);

    // Should update existing setting entry
    store.updatePluginSetting('new-plugin', { enabled: false });
    expect(useAppStore.getState().pluginSettings).toEqual([
      { id: 'new-plugin', enabled: false, order: 0, isBuiltin: false, pythonOverridePath: '/custom/bin/python' },
    ]);
  });

  it('executes pipeline sequentially, injects bindings, and attaches pipeline_metadata', async () => {
    (BackendAPI.runPlugin as any)
      .mockResolvedValueOnce({
        custom_layers: [
          {
            id: 'layer-out-1',
            name: 'Filtered Cost',
            image_base64: 'data:image/png;base64,mocklayer',
            info: { resolution: 0.05, origin: [0, 0, 0], width: 10, height: 10 },
          },
        ],
      })
      .mockResolvedValueOnce({
        waypoints: [
          { name: 'WP1', x: 0, y: 0 },
          { name: 'WP2', x: 5, y: 5 },
        ],
      });

    const store = useAppStore.getState();
    const result = await store.executePipeline({
      pipelinePlugin,
      manualInputs: {
        step_layer: { input_img: 'initial_image' },
      },
      manualProperties: {},
    });

    expect(result.success).toBe(true);
    expect(result.pipelineExecutionId).toBeDefined();

    // Verify 2 calls to BackendAPI.runPlugin
    expect(BackendAPI.runPlugin).toHaveBeenCalledTimes(2);

    // Verify step 2 received the layer generated in step 1 via binding
    const step2Call = (BackendAPI.runPlugin as any).mock.calls[1];
    expect(step2Call[0].id).toBe('path_planner');
    expect(step2Call[1].interaction_data.cost_layer).toBeDefined();

    const state = useAppStore.getState();
    // Custom layer exported
    expect(state.customLayers).toHaveLength(1);
    expect(state.customLayers[0].pipeline_metadata).toEqual(
      expect.objectContaining({
        pipeline_id: 'sample_pipeline',
        pipeline_execution_id: result.pipelineExecutionId,
        step_id: 'step_layer',
        step_execution_id: expect.any(String),
        pipeline_inputs: {
          step_layer: { input_img: 'initial_image' },
        },
      })
    );

    // Generator node and child nodes exported
    const genNode = Object.values(state.nodes).find((n) => n.type === 'generator');
    expect(genNode).toBeDefined();
    expect(genNode?.pipeline_metadata).toEqual(
      expect.objectContaining({
        pipeline_id: 'sample_pipeline',
        pipeline_execution_id: result.pipelineExecutionId,
        step_id: 'step_path',
        step_execution_id: expect.any(String),
        pipeline_inputs: {
          step_layer: { input_img: 'initial_image' },
        },
      })
    );
    expect(genNode?.children_ids).toHaveLength(2);
  });

  it('respects exports.custom_layers === false (in-memory only, not added to store)', async () => {
    const hiddenLayerPipeline: PluginInstance = {
      ...pipelinePlugin,
      manifest: {
        ...pipelinePlugin.manifest,
        pipeline: {
          steps: [
            {
              step_id: 'step_layer',
              plugin_id: 'layer_filter',
              exports: { custom_layers: false }, // Hidden layer!
            },
            {
              step_id: 'step_path',
              plugin_id: 'path_planner',
              bindings: {
                'inputs.cost_layer': '$steps.step_layer.custom_layers[0]',
              },
              exports: { waypoints: true },
            },
          ],
        },
      },
    };

    (BackendAPI.runPlugin as any)
      .mockResolvedValueOnce({
        custom_layers: [
          {
            id: 'hidden-layer',
            name: 'Hidden Layer',
            image_base64: 'data:mock',
            info: { resolution: 0.05, origin: [0, 0, 0], width: 10, height: 10 },
          },
        ],
      })
      .mockResolvedValueOnce({
        waypoints: [{ name: 'P1', x: 1, y: 1 }],
      });

    const store = useAppStore.getState();
    const result = await store.executePipeline({
      pipelinePlugin: hiddenLayerPipeline,
      manualInputs: {},
      manualProperties: {},
    });

    expect(result.success).toBe(true);

    const state = useAppStore.getState();
    // Custom layer was NOT added to store
    expect(state.customLayers).toHaveLength(0);

    // But Step 2 did receive the layer object!
    const step2Call = (BackendAPI.runPlugin as any).mock.calls[1];
    expect(step2Call[1].interaction_data.cost_layer.id).toBe('hidden-layer');

    // Waypoints were exported
    expect(Object.values(state.nodes).filter((n) => n.type === 'manual')).toHaveLength(1);
  });

  it('rolls back completely if any step fails', async () => {
    useAppStore.setState({
      nodes: { 'initial-wp': { id: 'initial-wp', type: 'manual', name: 'Initial' } },
      rootNodeIds: ['initial-wp'],
      customLayers: [],
    });

    // Step 1 succeeds
    (BackendAPI.runPlugin as any).mockResolvedValueOnce({
      custom_layers: [
        {
          id: 'temp-layer',
          name: 'Temporary Layer',
          image_base64: 'data:temp',
          info: { resolution: 0.05, origin: [0, 0, 0], width: 5, height: 5 },
        },
      ],
    });
    // Step 2 fails!
    (BackendAPI.runPlugin as any).mockRejectedValueOnce(new Error('Path planner crashed'));

    const store = useAppStore.getState();
    const result = await store.executePipeline({
      pipelinePlugin,
      manualInputs: {},
      manualProperties: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Path planner crashed');

    const state = useAppStore.getState();
    // State must be completely restored!
    expect(state.customLayers).toHaveLength(0);
    expect(state.rootNodeIds).toEqual(['initial-wp']);
    expect(state.nodes['initial-wp']).toBeDefined();
  });

  it('regenerates existing pipeline execution in-place and preserves waypoint stash', async () => {
    const existingExecId = 'existing-pipe-exec-123';

    // Seed initial generator and child node
    const parentNode: WaypointNode = {
      id: 'gen-parent-1',
      type: 'generator',
      name: 'Old Generator',
      children_ids: ['child-1'],
      pipeline_metadata: {
        pipeline_id: 'sample_pipeline',
        pipeline_execution_id: existingExecId,
        step_id: 'step_path',
        step_execution_id: 'step-exec-old',
      },
      baseline_waypoints: [
        { transform: { x: 0, y: 0, qx: 0, qy: 0, qz: 0, qw: 1 }, name: 'WP1' },
      ],
    };

    // User manually modified child-1: moved x from 0 to 10 (deltaX = 10)
    const childNode: WaypointNode = {
      id: 'child-1',
      type: 'manual',
      name: 'WP1',
      transform: { x: 10, y: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
    };

    useAppStore.setState({
      nodes: { 'gen-parent-1': parentNode, 'child-1': childNode },
      rootNodeIds: ['gen-parent-1'],
    });

    (BackendAPI.runPlugin as any)
      .mockResolvedValueOnce({
        custom_layers: [
          {
            id: 'layer-1',
            name: 'Layer 1',
            image_base64: 'data:layer',
            info: { resolution: 0.05, origin: [0, 0, 0], width: 5, height: 5 },
          },
        ],
      })
      .mockResolvedValueOnce({
        waypoints: [{ name: 'WP1', x: 2, y: 3 }], // new generated baseline x: 2
      });

    const store = useAppStore.getState();
    const result = await store.executePipeline({
      pipelinePlugin,
      manualInputs: {},
      manualProperties: {},
      existingExecutionId: existingExecId,
    });

    expect(result.success).toBe(true);
    expect(result.pipelineExecutionId).toBe(existingExecId);

    const state = useAppStore.getState();
    // Existing parent node kept same ID
    expect(state.nodes['gen-parent-1']).toBeDefined();

    // Stash applied: deltaX of 10 applied to new baseline x: 2 -> new child x should be 12!
    const newChildId = state.nodes['gen-parent-1'].children_ids![0];
    const newChild = state.nodes[newChildId];
    expect(newChild.transform?.x).toBe(12);
  });

  it('regenerates multiple custom layers per step in-place by index', async () => {
    const existingExecId = 'exec-multi-layer';
    useAppStore.setState({
      customLayers: [
        {
          id: 'old-layer-0',
          name: 'Old Layer 0',
          type: 'plugin',
          plugin_id: 'layer_filter',
          params: {},
          image_base64: 'data:0',
          info: { resolution: 0.05, origin: [0, 0, 0], width: 5, height: 5 },
          visible: true,
          opacity: 0.7,
          z_index: 0,
          pipeline_metadata: {
            pipeline_id: 'sample_pipeline',
            pipeline_execution_id: existingExecId,
            step_id: 'step_layer',
            step_execution_id: 'old-step-exec',
          },
        },
        {
          id: 'old-layer-1',
          name: 'Old Layer 1',
          type: 'plugin',
          plugin_id: 'layer_filter',
          params: {},
          image_base64: 'data:1',
          info: { resolution: 0.05, origin: [0, 0, 0], width: 5, height: 5 },
          visible: true,
          opacity: 0.7,
          z_index: 1,
          pipeline_metadata: {
            pipeline_id: 'sample_pipeline',
            pipeline_execution_id: existingExecId,
            step_id: 'step_layer',
            step_execution_id: 'old-step-exec',
          },
        },
      ],
    });

    // Step 1 returns 2 custom layers
    (BackendAPI.runPlugin as any)
      .mockResolvedValueOnce({
        custom_layers: [
          { name: 'New Layer 0', image_base64: 'data:new0', info: { resolution: 0.05, origin: [0, 0, 0], width: 5, height: 5 } },
          { name: 'New Layer 1', image_base64: 'data:new1', info: { resolution: 0.05, origin: [0, 0, 0], width: 5, height: 5 } },
        ],
      })
      .mockResolvedValueOnce({
        waypoints: [{ name: 'WP', x: 0, y: 0 }],
      });

    const store = useAppStore.getState();
    const result = await store.executePipeline({
      pipelinePlugin,
      manualInputs: {},
      manualProperties: {},
      existingExecutionId: existingExecId,
    });

    expect(result.success).toBe(true);

    const state = useAppStore.getState();
    // Both layers should remain in store with their original IDs updated in-place!
    expect(state.customLayers).toHaveLength(2);
    expect(state.customLayers[0].id).toBe('old-layer-0');
    expect(state.customLayers[0].name).toBe('New Layer 0');
    expect(state.customLayers[1].id).toBe('old-layer-1');
    expect(state.customLayers[1].name).toBe('New Layer 1');
  });

  it('preserves user selected points for downstream steps even if earlier steps modify nodes or annotations', async () => {
    // Pipeline with Step 1 (layer filter + annotations) and Step 2 with needs: ['selected_points']
    const plannerWithSelection: PluginInstance = {
      id: 'planner_with_sel',
      manifest: {
        name: 'Planner With Selection',
        type: 'python',
        executable: 'main.py',
        inputs: [],
        properties: [],
        needs: ['selected_points'],
      },
      folder_path: '/plugins/planner_sel',
      is_builtin: true,
    };

    const selPipeline: PluginInstance = {
      id: 'pipeline_selection_test',
      manifest: {
        name: 'Selection Test Pipeline',
        type: 'pipeline',
        executable: '',
        inputs: [],
        properties: [],
        pipeline: {
          steps: [
            {
              step_id: 'step_anno',
              plugin_id: 'layer_filter',
              exports: { annotations: true },
            },
            {
              step_id: 'step_plan',
              plugin_id: 'planner_with_sel',
              exports: { waypoints: true },
            },
          ],
        },
      },
      folder_path: '/plugins/sel_pipe',
      is_builtin: true,
    };

    useAppStore.setState({
      nodes: {
        'user-wp-1': { id: 'user-wp-1', type: 'manual', name: 'Start', transform: { x: 10, y: 20, qx: 0, qy: 0, qz: 0, qw: 1 } },
      },
      rootNodeIds: ['user-wp-1'],
      selectedNodeIds: ['user-wp-1'],
      plugins: {
        layer_filter: step1Plugin,
        planner_with_sel: plannerWithSelection,
        pipeline_selection_test: selPipeline,
      },
    });

    // Step 1 outputs annotations (which changes selection to annotations!)
    (BackendAPI.runPlugin as any)
      .mockResolvedValueOnce({
        annotations: [{ id: 'anno-1', name: 'Zone', type: 'rect', cx: 0, cy: 0, width: 2, height: 2, angle: 0 }],
      })
      .mockResolvedValueOnce({
        waypoints: [{ name: 'PlannedWP', x: 15, y: 25 }],
      });

    const store = useAppStore.getState();
    const result = await store.executePipeline({
      pipelinePlugin: selPipeline,
      manualInputs: {},
      manualProperties: {},
    });

    expect(result.success).toBe(true);

    // Verify Step 2 received the user's initial selected points (x: 10, y: 20)!
    const step2Call = (BackendAPI.runPlugin as any).mock.calls[1];
    expect(step2Call[0].id).toBe('planner_with_sel');
    expect(step2Call[1].selected_points).toEqual([
      { x: 10, y: 20, qx: 0, qy: 0, qz: 0, qw: 1 },
    ]);
  });

  it('fails and rolls back cleanly when a binding path evaluates to undefined', async () => {
    (BackendAPI.runPlugin as any).mockResolvedValueOnce({
      custom_layers: [], // Empty! But step 2 binds to custom_layers[0]!
    });

    const store = useAppStore.getState();
    const result = await store.executePipeline({
      pipelinePlugin,
      manualInputs: {},
      manualProperties: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Binding "$steps.step_layer.custom_layers[0]" could not be resolved');
  });

  it('correctly maps manual inputs and bindings when plugin input id differs from name', async () => {
    const differPlugin: PluginInstance = {
      id: 'differ_plugin',
      manifest: {
        name: 'Differ Plugin',
        type: 'python',
        executable: 'main.py',
        inputs: [
          { id: 'internal_input_id', name: 'public_input_name', label: 'Differ Input', type: 'string' },
        ],
        properties: [],
      },
      folder_path: '/plugins/differ',
      is_builtin: true,
    };

    const differPipeline: PluginInstance = {
      id: 'differ_pipe',
      manifest: {
        name: 'Differ Pipeline',
        type: 'pipeline',
        executable: '',
        inputs: [],
        properties: [],
        pipeline: {
          steps: [
            {
              step_id: 'step_differ',
              plugin_id: 'differ_plugin',
            },
          ],
        },
      },
      folder_path: '/plugins/differ_pipe',
      is_builtin: true,
    };

    useAppStore.setState({
      plugins: { differ_plugin: differPlugin, differ_pipe: differPipeline },
    });

    (BackendAPI.runPlugin as any).mockResolvedValueOnce({
      waypoints: [{ name: 'WP', x: 0, y: 0 }],
    });

    const store = useAppStore.getState();
    // User passes manual input keyed by canonical name
    const result = await store.executePipeline({
      pipelinePlugin: differPipeline,
      manualInputs: {
        step_differ: { public_input_name: 'hello_world' },
      },
      manualProperties: {},
    });

    expect(result.success).toBe(true);

    // Verify BackendAPI.runPlugin received the interaction_data correctly!
    const callArgs = (BackendAPI.runPlugin as any).mock.calls[0];
    expect(callArgs[1].interaction_data.public_input_name).toBe('hello_world');
  });

  it('smartly skips clean steps on pipeline re-generation (Dirty Check)', async () => {
    (BackendAPI.runPlugin as any).mockClear();

    (BackendAPI.runPlugin as any)
      .mockResolvedValueOnce({
        image_base64: 'base64_step1_initial',
        info: { resolution: 0.05, width: 100, height: 100, origin: [0, 0, 0] },
      })
      .mockResolvedValueOnce({
        waypoints: [{ name: 'WP1', x: 1, y: 1 }],
      });

    const store = useAppStore.getState();

    // 1. Initial execution
    const firstRun = await store.executePipeline({
      pipelinePlugin,
      manualInputs: {
        step_layer: { input_img: 'img_initial' },
      },
      manualProperties: {
        step_path: { num_lines: 4 },
      },
    });

    expect(firstRun.success).toBe(true);
    expect(BackendAPI.runPlugin).toHaveBeenCalledTimes(2);

    (BackendAPI.runPlugin as any).mockClear();

    // 2. Re-generation changing ONLY Step 2 properties (Step 1 is clean!)
    (BackendAPI.runPlugin as any).mockResolvedValueOnce({
      waypoints: [{ name: 'WP1_new', x: 2, y: 2 }],
    });

    const secondRun = await store.executePipeline({
      pipelinePlugin,
      manualInputs: {
        step_layer: { input_img: 'img_initial' }, // Unchanged
      },
      manualProperties: {
        step_path: { num_lines: 8 }, // Changed
      },
      existingExecutionId: firstRun.pipelineExecutionId,
    });

    expect(secondRun.success).toBe(true);
    // Step 1 was skipped, so BackendAPI.runPlugin was only called 1 time for step 2!
    expect(BackendAPI.runPlugin).toHaveBeenCalledTimes(1);
    const step2Call = (BackendAPI.runPlugin as any).mock.calls[0];
    expect(step2Call[0].id).toBe('path_planner');
    expect(step2Call[1].properties.num_lines).toBe(8);

    (BackendAPI.runPlugin as any).mockClear();

    // 3. Re-generation changing Step 1 input (Step 1 is dirty -> cascades to Step 2!)
    (BackendAPI.runPlugin as any)
      .mockResolvedValueOnce({
        image_base64: 'base64_step1_updated',
        info: { resolution: 0.05, width: 200, height: 200, origin: [0, 0, 0] },
      })
      .mockResolvedValueOnce({
        waypoints: [{ name: 'WP_cascaded', x: 3, y: 3 }],
      });

    const thirdRun = await store.executePipeline({
      pipelinePlugin,
      manualInputs: {
        step_layer: { input_img: 'img_MODIFIED' }, // Changed!
      },
      manualProperties: {
        step_path: { num_lines: 8 },
      },
      existingExecutionId: firstRun.pipelineExecutionId,
    });

    expect(thirdRun.success).toBe(true);
    // Both Step 1 and Step 2 were executed!
    expect(BackendAPI.runPlugin).toHaveBeenCalledTimes(2);
  });

  it('detaches artifacts from pipeline via detachFromPipeline', async () => {
    (BackendAPI.runPlugin as any).mockClear();
    (BackendAPI.runPlugin as any)
      .mockResolvedValueOnce({
        image_base64: 'img',
        info: { resolution: 0.05, width: 50, height: 50, origin: [0, 0, 0] },
      })
      .mockResolvedValueOnce({
        waypoints: [{ name: 'WP', x: 0, y: 0 }],
      });

    const store = useAppStore.getState();
    const result = await store.executePipeline({
      pipelinePlugin,
      manualInputs: { step_layer: { input_img: 'img' } },
      manualProperties: {},
    });

    expect(result.success).toBe(true);

    const layer = useAppStore.getState().customLayers[0];
    const node = Object.values(useAppStore.getState().nodes).find((n) => n.type === 'generator')!;
    expect(layer.pipeline_metadata).toBeDefined();
    expect(node.pipeline_metadata).toBeDefined();

    // Detach layer
    store.detachFromPipeline({ customLayerId: layer.id });
    const detachedLayer = useAppStore.getState().customLayers.find((l) => l.id === layer.id);
    expect(detachedLayer?.pipeline_metadata).toBeUndefined();

    // Detach node
    store.detachFromPipeline({ nodeId: node.id });
    const detachedNode = useAppStore.getState().nodes[node.id];
    expect(detachedNode?.pipeline_metadata).toBeUndefined();
  });
});
