import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../appStore';
import { WaypointNode } from '../../types/store';

describe('NodeSlice - duplicateNodes', () => {
  beforeEach(() => {
    useAppStore.setState({
      nodes: {},
      rootNodeIds: [],
      selectedNodeIds: [],
      historyPast: [],
      historyFuture: [],
    });
  });

  it('duplicates a single manual waypoint with offset and new id', () => {
    const original: WaypointNode = {
      id: 'node-1',
      type: 'manual',
      name: 'WP 1',
      transform: { x: 10, y: 20, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
      options: { speed: 1.2 },
    };

    useAppStore.setState({
      nodes: { 'node-1': original },
      rootNodeIds: ['node-1'],
      selectedNodeIds: ['node-1'],
    });

    const createdIds = useAppStore.getState().duplicateNodes(['node-1']);

    expect(createdIds).toHaveLength(1);
    const newId = createdIds[0];
    expect(newId).not.toBe('node-1');

    const state = useAppStore.getState();
    expect(state.rootNodeIds).toEqual(['node-1', newId]);
    expect(state.selectedNodeIds).toEqual([newId]);

    const duplicated = state.nodes[newId];
    expect(duplicated).toBeDefined();
    expect(duplicated.transform?.x).toBe(10.5);
    expect(duplicated.transform?.y).toBe(20.5);
    expect(duplicated.options?.speed).toBe(1.2);
    expect(duplicated.name).toBe('WP 1 (Copy)');
  });

  it('duplicates multiple manual waypoints maintaining order', () => {
    const node1: WaypointNode = {
      id: 'node-1',
      type: 'manual',
      transform: { x: 1, y: 1, qx: 0, qy: 0, qz: 0, qw: 1 },
    };
    const node2: WaypointNode = {
      id: 'node-2',
      type: 'manual',
      transform: { x: 2, y: 2, qx: 0, qy: 0, qz: 0, qw: 1 },
    };
    const node3: WaypointNode = {
      id: 'node-3',
      type: 'manual',
      transform: { x: 3, y: 3, qx: 0, qy: 0, qz: 0, qw: 1 },
    };

    useAppStore.setState({
      nodes: { 'node-1': node1, 'node-2': node2, 'node-3': node3 },
      rootNodeIds: ['node-1', 'node-2', 'node-3'],
      selectedNodeIds: ['node-1', 'node-2'],
    });

    const createdIds = useAppStore.getState().duplicateNodes(['node-1', 'node-2']);

    expect(createdIds).toHaveLength(2);
    const [dup1, dup2] = createdIds;

    const state = useAppStore.getState();
    // node-1 should be followed by dup1, and node-2 by dup2, then node-3
    expect(state.rootNodeIds).toEqual(['node-1', dup1, 'node-2', dup2, 'node-3']);
    expect(state.selectedNodeIds).toEqual([dup1, dup2]);
    expect(state.nodes[dup1].transform?.x).toBe(1.5);
    expect(state.nodes[dup2].transform?.x).toBe(2.5);
  });

  it('duplicates generator node along with its child waypoints', () => {
    const child1: WaypointNode = {
      id: 'child-1',
      type: 'manual',
      transform: { x: 5, y: 5, qx: 0, qy: 0, qz: 0, qw: 1 },
    };
    const gen1: WaypointNode = {
      id: 'gen-1',
      type: 'generator',
      plugin_id: 'sample_plugin',
      children_ids: ['child-1'],
    };

    useAppStore.setState({
      nodes: { 'gen-1': gen1, 'child-1': child1 },
      rootNodeIds: ['gen-1'],
      selectedNodeIds: ['gen-1'],
    });

    const createdIds = useAppStore.getState().duplicateNodes(['gen-1']);

    expect(createdIds).toHaveLength(1);
    const newGenId = createdIds[0];

    const state = useAppStore.getState();
    expect(state.rootNodeIds).toEqual(['gen-1', newGenId]);
    expect(state.selectedNodeIds).toEqual([newGenId]);

    const dupGen = state.nodes[newGenId];
    expect(dupGen.type).toBe('generator');
    expect(dupGen.children_ids).toHaveLength(1);

    const newChildId = dupGen.children_ids![0];
    expect(newChildId).not.toBe('child-1');
    const dupChild = state.nodes[newChildId];
    expect(dupChild.transform?.x).toBe(5.5);
    expect(dupChild.transform?.y).toBe(5.5);
  });

  it('updates multiple nodes simultaneously using updateNodes', () => {
    const node1: WaypointNode = {
      id: 'node-1',
      type: 'manual',
      transform: { x: 1, y: 1, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
    };
    const node2: WaypointNode = {
      id: 'node-2',
      type: 'manual',
      transform: { x: 2, y: 2, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
    };

    useAppStore.setState({
      nodes: { 'node-1': node1, 'node-2': node2 },
      rootNodeIds: ['node-1', 'node-2'],
    });

    useAppStore.getState().updateNodes({
      'node-1': { transform: { x: 10, y: 11, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 } },
      'node-2': { transform: { x: 20, y: 21, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 } },
    });

    const state = useAppStore.getState();
    expect(state.nodes['node-1'].transform?.x).toBe(10);
    expect(state.nodes['node-1'].transform?.y).toBe(11);
    expect(state.nodes['node-2'].transform?.x).toBe(20);
    expect(state.nodes['node-2'].transform?.y).toBe(21);
    expect(state.isDirty).toBe(true);
  });

  describe('reorderMultipleNodes', () => {
    it('moves non-contiguous nodes to after a target node in contiguous block', () => {
      // Setup [node-1, node-2, node-3, node-4, node-5, node-6, node-7]
      const ids = ['node-1', 'node-2', 'node-3', 'node-4', 'node-5', 'node-6', 'node-7'];
      const nodes: Record<string, WaypointNode> = {};
      ids.forEach((id) => {
        nodes[id] = { id, type: 'manual', transform: { x: 0, y: 0, qx: 0, qy: 0, qz: 0, qw: 1 } };
      });

      useAppStore.setState({
        nodes,
        rootNodeIds: [...ids],
        selectedNodeIds: ['node-2', 'node-4', 'node-6'],
      });

      // Move [node-2, node-4, node-6] to after node-7
      useAppStore.getState().reorderMultipleNodes(['node-2', 'node-4', 'node-6'], 'node-7', 'after');

      const state = useAppStore.getState();
      expect(state.rootNodeIds).toEqual([
        'node-1',
        'node-3',
        'node-5',
        'node-7',
        'node-2',
        'node-4',
        'node-6',
      ]);
      expect(state.isDirty).toBe(true);
    });

    it('moves non-contiguous nodes to before a target node', () => {
      const ids = ['node-1', 'node-2', 'node-3', 'node-4', 'node-5', 'node-6', 'node-7'];
      const nodes: Record<string, WaypointNode> = {};
      ids.forEach((id) => {
        nodes[id] = { id, type: 'manual', transform: { x: 0, y: 0, qx: 0, qy: 0, qz: 0, qw: 1 } };
      });

      useAppStore.setState({
        nodes,
        rootNodeIds: [...ids],
        selectedNodeIds: ['node-2', 'node-4', 'node-6'],
      });

      // Move [node-2, node-4, node-6] to before node-1
      useAppStore.getState().reorderMultipleNodes(['node-2', 'node-4', 'node-6'], 'node-1', 'before');

      const state = useAppStore.getState();
      expect(state.rootNodeIds).toEqual([
        'node-2',
        'node-4',
        'node-6',
        'node-1',
        'node-3',
        'node-5',
        'node-7',
      ]);
    });

    it('moves nodes to intermediate position correctly', () => {
      const ids = ['node-1', 'node-2', 'node-3', 'node-4', 'node-5'];
      const nodes: Record<string, WaypointNode> = {};
      ids.forEach((id) => {
        nodes[id] = { id, type: 'manual', transform: { x: 0, y: 0, qx: 0, qy: 0, qz: 0, qw: 1 } };
      });

      useAppStore.setState({
        nodes,
        rootNodeIds: [...ids],
      });

      // Move [node-1, node-5] to before node-3 -> [node-2, node-1, node-5, node-3, node-4]
      useAppStore.getState().reorderMultipleNodes(['node-1', 'node-5'], 'node-3', 'before');

      expect(useAppStore.getState().rootNodeIds).toEqual([
        'node-2',
        'node-1',
        'node-5',
        'node-3',
        'node-4',
      ]);
    });
  });
});

describe('NodeSlice - groupNodes and ungroupNode', () => {
  beforeEach(() => {
    useAppStore.setState({
      nodes: {},
      rootNodeIds: [],
      selectedNodeIds: [],
      historyPast: [],
      historyFuture: [],
    });
  });

  it('groups multiple manual waypoints into a new manual_group', () => {
    const node1: WaypointNode = { id: 'wp-1', type: 'manual', name: 'WP 1' };
    const node2: WaypointNode = { id: 'wp-2', type: 'manual', name: 'WP 2' };
    const node3: WaypointNode = { id: 'wp-3', type: 'manual', name: 'WP 3' };

    useAppStore.setState({
      nodes: { 'wp-1': node1, 'wp-2': node2, 'wp-3': node3 },
      rootNodeIds: ['wp-1', 'wp-2', 'wp-3'],
      selectedNodeIds: ['wp-1', 'wp-2'],
    });

    const newGroupId = useAppStore.getState().groupNodes(['wp-1', 'wp-2']);
    expect(newGroupId).toBeTruthy();

    const state = useAppStore.getState();
    expect(state.rootNodeIds).toEqual([newGroupId!, 'wp-3']);
    expect(state.selectedNodeIds).toEqual([newGroupId!]);

    const groupNode = state.nodes[newGroupId!];
    expect(groupNode).toBeDefined();
    expect(groupNode.type).toBe('manual_group');
    expect(groupNode.name).toBe('Group 1');
    expect(groupNode.children_ids).toEqual(['wp-1', 'wp-2']);
  });

  it('groups nested nodes at the shallowest level', () => {
    const wp1: WaypointNode = { id: 'wp-1', type: 'manual' };
    const wp2: WaypointNode = { id: 'wp-2', type: 'manual' };
    const subWp1: WaypointNode = { id: 'sub-wp-1', type: 'manual' };
    const subWp2: WaypointNode = { id: 'sub-wp-2', type: 'manual' };
    const group1: WaypointNode = { id: 'group-1', type: 'manual_group', name: 'Group 1', children_ids: ['sub-wp-1', 'sub-wp-2'] };

    useAppStore.setState({
      nodes: { 'wp-1': wp1, 'wp-2': wp2, 'group-1': group1, 'sub-wp-1': subWp1, 'sub-wp-2': subWp2 },
      rootNodeIds: ['wp-1', 'group-1', 'wp-2'],
    });

    // Select wp-2 (root) and group-1 (root) -> placed at root
    const newGroupId = useAppStore.getState().groupNodes(['group-1', 'wp-2']);
    expect(newGroupId).toBeTruthy();

    const state = useAppStore.getState();
    expect(state.rootNodeIds).toEqual(['wp-1', newGroupId!]);
    const createdGroup = state.nodes[newGroupId!];
    expect(createdGroup.children_ids).toEqual(['group-1', 'wp-2']);
    expect(createdGroup.name).toBe('Group 2'); // Group 1 already existed
  });

  it('ungroups a group and expands its children into the parent list', () => {
    const wp1: WaypointNode = { id: 'wp-1', type: 'manual' };
    const wp2: WaypointNode = { id: 'wp-2', type: 'manual' };
    const wp3: WaypointNode = { id: 'wp-3', type: 'manual' };
    const group1: WaypointNode = { id: 'group-1', type: 'manual_group', children_ids: ['wp-1', 'wp-2'] };

    useAppStore.setState({
      nodes: { 'group-1': group1, 'wp-1': wp1, 'wp-2': wp2, 'wp-3': wp3 },
      rootNodeIds: ['group-1', 'wp-3'],
    });

    useAppStore.getState().ungroupNode('group-1');

    const state = useAppStore.getState();
    expect(state.rootNodeIds).toEqual(['wp-1', 'wp-2', 'wp-3']);
    expect(state.nodes['group-1']).toBeUndefined();
    expect(state.selectedNodeIds).toEqual(['wp-1', 'wp-2']);
  });

  it('renames a node using renameNode', () => {
    const wp1: WaypointNode = { id: 'wp-1', type: 'manual', name: 'Old Name' };
    useAppStore.setState({
      nodes: { 'wp-1': wp1 },
      rootNodeIds: ['wp-1'],
    });

    useAppStore.getState().renameNode('wp-1', 'New Name');
    expect(useAppStore.getState().nodes['wp-1'].name).toBe('New Name');
  });

  it('removes group and all its descendants recursively', () => {
    const wp1: WaypointNode = { id: 'wp-1', type: 'manual' };
    const wp2: WaypointNode = { id: 'wp-2', type: 'manual' };
    const wp3: WaypointNode = { id: 'wp-3', type: 'manual' };
    const subGroup: WaypointNode = { id: 'sub-g', type: 'manual_group', children_ids: ['wp-2'] };
    const topGroup: WaypointNode = { id: 'top-g', type: 'manual_group', children_ids: ['wp-1', 'sub-g'] };

    useAppStore.setState({
      nodes: { 'top-g': topGroup, 'sub-g': subGroup, 'wp-1': wp1, 'wp-2': wp2, 'wp-3': wp3 },
      rootNodeIds: ['top-g', 'wp-3'],
    });

    useAppStore.getState().removeNodes(['top-g']);

    const state = useAppStore.getState();
    expect(state.rootNodeIds).toEqual(['wp-3']);
    expect(state.nodes['top-g']).toBeUndefined();
    expect(state.nodes['sub-g']).toBeUndefined();
    expect(state.nodes['wp-1']).toBeUndefined();
    expect(state.nodes['wp-2']).toBeUndefined();
    expect(state.nodes['wp-3']).toBeDefined();
  });
});

describe('NodeSlice - moveNodesInTree', () => {
  beforeEach(() => {
    useAppStore.setState({
      nodes: {},
      rootNodeIds: [],
      selectedNodeIds: [],
      historyPast: [],
      historyFuture: [],
    });
  });

  it('moves nodes within the same group', () => {
    const wp1: WaypointNode = { id: 'wp-1', type: 'manual' };
    const wp2: WaypointNode = { id: 'wp-2', type: 'manual' };
    const wp3: WaypointNode = { id: 'wp-3', type: 'manual' };
    const grp: WaypointNode = { id: 'grp-1', type: 'manual_group', children_ids: ['wp-1', 'wp-2', 'wp-3'] };

    useAppStore.setState({
      nodes: { 'wp-1': wp1, 'wp-2': wp2, 'wp-3': wp3, 'grp-1': grp },
      rootNodeIds: ['grp-1'],
    });

    // Move wp-3 before wp-1 in grp-1
    useAppStore.getState().moveNodesInTree(['wp-3'], 'wp-1', 'before');

    const updatedGrp = useAppStore.getState().nodes['grp-1'];
    expect(updatedGrp.children_ids).toEqual(['wp-3', 'wp-1', 'wp-2']);
  });

  it('moves a node from root into a group', () => {
    const wp1: WaypointNode = { id: 'wp-1', type: 'manual' };
    const wp2: WaypointNode = { id: 'wp-2', type: 'manual' };
    const grp: WaypointNode = { id: 'grp-1', type: 'manual_group', children_ids: ['wp-2'] };

    useAppStore.setState({
      nodes: { 'wp-1': wp1, 'wp-2': wp2, 'grp-1': grp },
      rootNodeIds: ['wp-1', 'grp-1'],
    });

    // Move wp-1 before wp-2 (which is inside grp-1)
    useAppStore.getState().moveNodesInTree(['wp-1'], 'wp-2', 'before');

    const state = useAppStore.getState();
    expect(state.rootNodeIds).toEqual(['grp-1']);
    expect(state.nodes['grp-1'].children_ids).toEqual(['wp-1', 'wp-2']);
  });

  it('moves a node from a group out to root', () => {
    const wp1: WaypointNode = { id: 'wp-1', type: 'manual' };
    const wp2: WaypointNode = { id: 'wp-2', type: 'manual' };
    const grp: WaypointNode = { id: 'grp-1', type: 'manual_group', children_ids: ['wp-1', 'wp-2'] };

    useAppStore.setState({
      nodes: { 'wp-1': wp1, 'wp-2': wp2, 'grp-1': grp },
      rootNodeIds: ['grp-1'],
    });

    // Move wp-2 after grp-1 (at root)
    useAppStore.getState().moveNodesInTree(['wp-2'], 'grp-1', 'after');

    const state = useAppStore.getState();
    expect(state.rootNodeIds).toEqual(['grp-1', 'wp-2']);
    expect(state.nodes['grp-1'].children_ids).toEqual(['wp-1']);
  });

  it('prevents circular reference when moving a parent into its child', () => {
    const wp1: WaypointNode = { id: 'wp-1', type: 'manual' };
    const grp: WaypointNode = { id: 'grp-1', type: 'manual_group', children_ids: ['wp-1'] };

    useAppStore.setState({
      nodes: { 'wp-1': wp1, 'grp-1': grp },
      rootNodeIds: ['grp-1'],
    });

    // Attempt to move grp-1 into wp-1 -> should be blocked
    useAppStore.getState().moveNodesInTree(['grp-1'], 'wp-1', 'inside');

    const state = useAppStore.getState();
    expect(state.rootNodeIds).toEqual(['grp-1']);
    expect(state.nodes['grp-1'].children_ids).toEqual(['wp-1']);
  });
});

describe('NodeSlice - insertionTarget & group selection', () => {
  beforeEach(() => {
    useAppStore.setState({
      nodes: {},
      rootNodeIds: [],
      selectedNodeIds: [],
      insertionTarget: null,
      insertionIndex: -1,
      historyPast: [],
      historyFuture: [],
    });
  });

  it('inserts node at root index specified by insertionTarget and advances index', () => {
    const nodeA: WaypointNode = { id: 'wp-a', type: 'manual' };
    const nodeB: WaypointNode = { id: 'wp-b', type: 'manual' };

    useAppStore.setState({
      nodes: { 'wp-a': nodeA, 'wp-b': nodeB },
      rootNodeIds: ['wp-a', 'wp-b'],
    });

    useAppStore.getState().setInsertionTarget({ parentId: null, index: 1 });

    useAppStore.getState().addNode({
      id: 'wp-new',
      type: 'manual',
      transform: { x: 5, y: 5, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
    });

    const state = useAppStore.getState();
    expect(state.rootNodeIds).toEqual(['wp-a', 'wp-new', 'wp-b']);
    expect(state.insertionTarget).toEqual({ parentId: null, index: 2 });
  });

  it('inserts node inside a group specified by insertionTarget and advances index', () => {
    const child1: WaypointNode = { id: 'c-1', type: 'manual' };
    const group: WaypointNode = { id: 'grp-1', type: 'manual_group', children_ids: ['c-1'] };

    useAppStore.setState({
      nodes: { 'c-1': child1, 'grp-1': group },
      rootNodeIds: ['grp-1'],
    });

    useAppStore.getState().setInsertionTarget({ parentId: 'grp-1', index: 0 });

    useAppStore.getState().addNode({
      id: 'wp-child-new',
      type: 'manual',
      transform: { x: 3, y: 3, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
    });

    const state = useAppStore.getState();
    expect(state.nodes['grp-1'].children_ids).toEqual(['wp-child-new', 'c-1']);
    expect(state.insertionTarget).toEqual({ parentId: 'grp-1', index: 1 });
  });

  it('automatically selects all descendant nodes when a group is selected', () => {
    const leaf1: WaypointNode = { id: 'leaf-1', type: 'manual' };
    const leaf2: WaypointNode = { id: 'leaf-2', type: 'manual' };
    const subGrp: WaypointNode = { id: 'sub-grp', type: 'manual_group', children_ids: ['leaf-2'] };
    const parentGrp: WaypointNode = { id: 'parent-grp', type: 'manual_group', children_ids: ['leaf-1', 'sub-grp'] };

    useAppStore.setState({
      nodes: {
        'leaf-1': leaf1,
        'leaf-2': leaf2,
        'sub-grp': subGrp,
        'parent-grp': parentGrp,
      },
      rootNodeIds: ['parent-grp'],
      selectedNodeIds: [],
    });

    useAppStore.getState().selectNodes(['parent-grp']);

    const state = useAppStore.getState();
    expect(state.selectedNodeIds).toContain('parent-grp');
    expect(state.selectedNodeIds).toContain('leaf-1');
    expect(state.selectedNodeIds).toContain('sub-grp');
    expect(state.selectedNodeIds).toContain('leaf-2');
  });
});
