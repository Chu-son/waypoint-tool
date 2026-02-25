import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './appStore';

describe('AppStore Zustand Store', () => {
  // Reset store before each test
  beforeEach(() => {
    // We can just call set directly from getState to reset the store
    const store = useAppStore.getState();
    store.nodes = {};
    store.rootNodeIds = [];
    store.selectedNodeIds = [];
    store.mapLayers = [];
    store.optionsSchema = null;
    store.exportTemplates = [];
    store.isDirty = false;
  });

  it('should initially have empty nodes and schema', () => {
    const state = useAppStore.getState();
    expect(state.nodes).toEqual({});
    expect(state.optionsSchema).toBeNull();
    expect(state.isDirty).toBe(false);
  });

  it('should set options schema and mark as dirty', () => {
    const { setOptionsSchema } = useAppStore.getState();
    
    setOptionsSchema({ options: [{ name: 'speed', label: 'Speed', type: 'float' }] });
    
    const state = useAppStore.getState();
    expect(state.optionsSchema?.options[0].name).toBe('speed');
    expect(state.isDirty).toBe(true);
  });

  it('should manage export templates', () => {
    const { addExportTemplate, updateExportTemplate, removeExportTemplate } = useAppStore.getState();
    
    // Add template
    addExportTemplate({ id: 'template-id-1', name: 'Template 1', extension: 'txt', suffix: '', content: 'test content' });
    let state = useAppStore.getState();
    expect(state.exportTemplates.length).toBe(1);
    expect(state.exportTemplates[0].name).toBe('Template 1');
    expect(state.isDirty).toBe(true);
    
    const tId = state.exportTemplates[0].id;

    // Update template
    updateExportTemplate(tId, { name: 'Updated Template' });
    state = useAppStore.getState();
    expect(state.exportTemplates[0].name).toBe('Updated Template');

    // Remove template
    removeExportTemplate(tId);
    state = useAppStore.getState();
    expect(state.exportTemplates.length).toBe(0);
  });

  it('should add a manual node to the tree', () => {
    const { addNode } = useAppStore.getState();
    
    const newNode = {
      id: 'node-1',
      type: 'manual' as const,
      transform: { x: 10, y: 20, qx: 0, qy: 0, qz: 0, qw: 1 },
    };

    addNode(newNode);
    
    const state = useAppStore.getState();
    expect(state.nodes['node-1']).toBeDefined();
    expect(state.rootNodeIds).toContain('node-1');
    expect(state.isDirty).toBe(true);
  });

  it('should remove a node from the tree', () => {
    const { addNode, removeNodes } = useAppStore.getState();
    addNode({ id: 'node-2', type: 'manual' });
    
    removeNodes(['node-2']);
    
    const state = useAppStore.getState();
    expect(state.nodes['node-2']).toBeUndefined();
    expect(state.rootNodeIds).not.toContain('node-2');
  });

  it('should recursively remove child nodes', () => {
    const { addNode, removeNodes } = useAppStore.getState();
    addNode({ id: 'parent-1', type: 'generator' });
    addNode({ id: 'child-1', type: 'manual' }, 'parent-1');
    addNode({ id: 'child-2', type: 'manual' }, 'parent-1');
    
    let state = useAppStore.getState();
    expect(state.nodes['parent-1'].children_ids).toEqual(['child-1', 'child-2']);
    
    // Remove parent should remove children
    removeNodes(['parent-1']);
    
    state = useAppStore.getState();
    expect(state.nodes['parent-1']).toBeUndefined();
    expect(state.nodes['child-1']).toBeUndefined();
    expect(state.nodes['child-2']).toBeUndefined();
  });

  it('should handle multi-selection logic correctly', () => {
    const { selectNodes } = useAppStore.getState();
    
    // Select single
    selectNodes(['node-1']);
    expect(useAppStore.getState().selectedNodeIds).toEqual(['node-1']);
    
    // Multi-select adding
    selectNodes(['node-2'], true);
    expect(useAppStore.getState().selectedNodeIds).toContain('node-1');
    expect(useAppStore.getState().selectedNodeIds).toContain('node-2');
    
    // Multi-select toggling (removing)
    selectNodes(['node-1'], true);
    expect(useAppStore.getState().selectedNodeIds).not.toContain('node-1');
    expect(useAppStore.getState().selectedNodeIds).toContain('node-2');
  });

  it('should handle map layer operations', () => {
    const { addMapLayer, updateMapLayer, removeMapLayer, reorderMapLayers } = useAppStore.getState();
    
    addMapLayer('Map 1', null, 'base1', 100, 100);
    const id1 = useAppStore.getState().mapLayers[0].id;

    addMapLayer('Map 2', null, 'base2', 100, 100);
    const id2 = useAppStore.getState().mapLayers[0].id; // Map 2 is at index 0 now
    
    let state = useAppStore.getState();
    expect(state.mapLayers.length).toBe(2);
    expect(state.isDirty).toBe(true);
    
    updateMapLayer(id1, { visible: false });
    expect(useAppStore.getState().mapLayers[1].visible).toBe(false);
    
    reorderMapLayers(0, 1);
    state = useAppStore.getState();
    // Before: [id2, id1]. Move 0 to 1 -> [id1, id2]
    expect(state.mapLayers[0].id).toBe(id1);
    expect(state.mapLayers[1].id).toBe(id2);
    
    removeMapLayer(id2);
    expect(useAppStore.getState().mapLayers.length).toBe(1);
    expect(useAppStore.getState().mapLayers[0].id).toBe(id1);
  });

  it('should reset isDirty when loading project data', () => {
    const { setProjectData, setIsDirty } = useAppStore.getState();
    setIsDirty(true);
    expect(useAppStore.getState().isDirty).toBe(true);
    
    setProjectData({
      rootNodeIds: [],
      nodes: {},
      mapLayers: [],
    });
    
    expect(useAppStore.getState().isDirty).toBe(false);
  });

  // --- 要件2: Waypoint編集 ---

  it('should mark isDirty when updating a node transform', () => {
    const { addNode, updateNode } = useAppStore.getState();
    addNode({ id: 'n1', type: 'manual', transform: { x: 0, y: 0, qx: 0, qy: 0, qz: 0, qw: 1 } });
    useAppStore.setState({ isDirty: false });

    updateNode('n1', { transform: { x: 5, y: 10, qx: 0, qy: 0, qz: 0, qw: 1 } });

    const state = useAppStore.getState();
    expect(state.nodes['n1'].transform?.x).toBe(5);
    expect(state.isDirty).toBe(true);
  });

  it('should reorder root nodes via reorderNodes', () => {
    const { addNode, reorderNodes } = useAppStore.getState();
    addNode({ id: 'r1', type: 'manual' });
    addNode({ id: 'r2', type: 'manual' });
    addNode({ id: 'r3', type: 'manual' });

    expect(useAppStore.getState().rootNodeIds).toEqual(['r1', 'r2', 'r3']);

    reorderNodes(0, 2);

    expect(useAppStore.getState().rootNodeIds).toEqual(['r2', 'r3', 'r1']);
  });

  it('should add child nodes to a generator parent', () => {
    const { addNode } = useAppStore.getState();
    addNode({ id: 'gen-1', type: 'generator' });
    addNode({ id: 'child-a', type: 'manual' }, 'gen-1');
    addNode({ id: 'child-b', type: 'manual' }, 'gen-1');

    const state = useAppStore.getState();
    expect(state.nodes['gen-1'].children_ids).toEqual(['child-a', 'child-b']);
    expect(state.rootNodeIds).toContain('gen-1');
    expect(state.rootNodeIds).not.toContain('child-a');
  });

  // --- 要件3: オプションプロパティ ---

  it('should set and update options on a waypoint node', () => {
    const { addNode, updateNode } = useAppStore.getState();
    addNode({ id: 'opt-node', type: 'manual' });

    updateNode('opt-node', { options: { speed: 1.5, mode: 'docking' } });

    const node = useAppStore.getState().nodes['opt-node'];
    expect(node.options?.speed).toBe(1.5);
    expect(node.options?.mode).toBe('docking');
  });

  // --- 要件9: プラグイン ---

  it('should set active plugin id', () => {
    const { setActivePlugin } = useAppStore.getState();
    setActivePlugin('plugin-sweep');

    expect(useAppStore.getState().activePluginId).toBe('plugin-sweep');
    expect(useAppStore.getState().pluginInteractionData).toEqual({});
  });

  it('should accumulate plugin interaction data', () => {
    const { updatePluginInteractionData } = useAppStore.getState();

    updatePluginInteractionData('start_point', { x: 1, y: 2 });
    updatePluginInteractionData('end_point', { x: 3, y: 4 });

    const data = useAppStore.getState().pluginInteractionData;
    expect(data['start_point']).toEqual({ x: 1, y: 2 });
    expect(data['end_point']).toEqual({ x: 3, y: 4 });
  });

  it('should clear plugin interaction data', () => {
    const { updatePluginInteractionData, clearPluginInteractionData } = useAppStore.getState();
    updatePluginInteractionData('start_point', { x: 1, y: 2 });

    clearPluginInteractionData();

    expect(useAppStore.getState().pluginInteractionData).toEqual({});
  });

  // --- 要件10: エクスポートサフィックス ---

  it('should update default export format suffix', () => {
    const { updateDefaultExportFormat } = useAppStore.getState();
    updateDefaultExportFormat('__default_yaml__', { suffix: '_waypoints' });

    const fmt = useAppStore.getState().defaultExportFormats.find(f => f.id === '__default_yaml__');
    expect(fmt?.suffix).toBe('_waypoints');
    expect(useAppStore.getState().isDirty).toBe(true);
  });

  // --- 要件5: プロジェクトデータ復元 ---

  it('should fully restore nodes, rootNodeIds, and mapLayers from setProjectData', () => {
    const { setProjectData } = useAppStore.getState();
    setProjectData({
      root_node_ids: ['wp1', 'wp2'],
      nodes: {
        'wp1': { id: 'wp1', type: 'manual', transform: { x: 10, y: 20, qx: 0, qy: 0, qz: 0, qw: 1 } },
        'wp2': { id: 'wp2', type: 'generator', children_ids: [] },
      },
      map_layers: [
        { id: 'ml1', name: 'Floor', info: null, image_base64: 'b64', visible: true, opacity: 1, z_index: 0, width: 100, height: 100 },
      ],
    } as any);

    const state = useAppStore.getState();
    expect(state.rootNodeIds).toEqual(['wp1', 'wp2']);
    expect(state.nodes['wp1'].transform?.x).toBe(10);
    expect(state.nodes['wp2'].type).toBe('generator');
    expect(state.mapLayers.length).toBe(1);
    expect(state.mapLayers[0].name).toBe('Floor');
    expect(state.selectedNodeIds).toEqual([]);
    expect(state.isDirty).toBe(false);
  });
});
