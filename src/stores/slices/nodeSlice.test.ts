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
