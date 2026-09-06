import { describe, it, expect } from 'vitest';
import {
  getFlattenedWaypointIds,
  getFlattenedNodeIds,
  findNodeParentId,
  getNodeDepth,
  collectDescendantIds,
  findHighestLevelParent,
  computeRangeSelection,
  computeDragDropPosition,
  getNextSequentialName,
  getNodesAfterInsertionTarget,
  getPrecedingManualWaypoint,
  validateAndCorrectInsertionTarget,
  isInsertableContainer,
  expandSelectionWithDescendants,
  mapInsertionTarget,
  escapeCollapsedInsertionTarget,
  determineMultiDepthDropTarget,
  getAncestorIds,
  getHighlightedContainerIds,
  getAnnotationParentId,
} from './treeUtils';
import { WaypointNode, AnnotationGroup, AnnotationObject } from '../types/store';

describe('treeUtils', () => {
  const nodes: Record<string, WaypointNode> = {
    'wp-1': { id: 'wp-1', type: 'manual' },
    'group-1': { id: 'group-1', type: 'manual_group', children_ids: ['wp-2', 'subgroup-1'] },
    'wp-2': { id: 'wp-2', type: 'manual' },
    'subgroup-1': { id: 'subgroup-1', type: 'manual_group', children_ids: ['wp-3', 'wp-4'] },
    'wp-3': { id: 'wp-3', type: 'manual' },
    'wp-4': { id: 'wp-4', type: 'manual' },
    'wp-5': { id: 'wp-5', type: 'manual' },
  };
  const rootIds = ['wp-1', 'group-1', 'wp-5'];

  it('getFlattenedWaypointIds flattens nested waypoints in depth-first order', () => {
    const result = getFlattenedWaypointIds(rootIds, nodes);
    expect(result).toEqual(['wp-1', 'wp-2', 'wp-3', 'wp-4', 'wp-5']);
  });

  it('getFlattenedNodeIds returns all nodes in depth-first order', () => {
    const result = getFlattenedNodeIds(rootIds, nodes);
    expect(result).toEqual(['wp-1', 'group-1', 'wp-2', 'subgroup-1', 'wp-3', 'wp-4', 'wp-5']);
  });

  it('findNodeParentId finds parent or returns null for root', () => {
    expect(findNodeParentId('wp-1', rootIds, nodes)).toBeNull();
    expect(findNodeParentId('wp-2', rootIds, nodes)).toBe('group-1');
    expect(findNodeParentId('subgroup-1', rootIds, nodes)).toBe('group-1');
    expect(findNodeParentId('wp-3', rootIds, nodes)).toBe('subgroup-1');
  });

  it('getNodeDepth calculates correct depth levels', () => {
    expect(getNodeDepth('wp-1', rootIds, nodes)).toBe(0);
    expect(getNodeDepth('group-1', rootIds, nodes)).toBe(0);
    expect(getNodeDepth('wp-2', rootIds, nodes)).toBe(1);
    expect(getNodeDepth('subgroup-1', rootIds, nodes)).toBe(1);
    expect(getNodeDepth('wp-3', rootIds, nodes)).toBe(2);
  });

  it('collectDescendantIds collects all nested descendants', () => {
    expect(collectDescendantIds('subgroup-1', nodes)).toEqual(['wp-3', 'wp-4']);
    expect(collectDescendantIds('group-1', nodes)).toEqual(['wp-2', 'subgroup-1', 'wp-3', 'wp-4']);
    expect(collectDescendantIds('wp-1', nodes)).toEqual([]);
  });

  it('findHighestLevelParent identifies the shallowest level parent and position', () => {
    // When selecting wp-1 and group-1 (both at Root) -> parentId = null, index = 0
    const res1 = findHighestLevelParent(['wp-1', 'group-1'], rootIds, nodes);
    expect(res1.parentId).toBeNull();
    expect(res1.insertIndex).toBe(0);

    // When selecting wp-2 and wp-3 (wp-2 is depth 1 in group-1, wp-3 is depth 2 in subgroup-1)
    // -> shallowest is wp-2 in group-1 -> parentId = 'group-1', insertIndex = 0
    const res2 = findHighestLevelParent(['wp-2', 'wp-3'], rootIds, nodes);
    expect(res2.parentId).toBe('group-1');
    expect(res2.insertIndex).toBe(0);

    // When selecting wp-5 and wp-3 (wp-5 is depth 0 in Root, wp-3 is depth 2 in subgroup-1)
    // -> shallowest is wp-5 -> parentId = null
    const res3 = findHighestLevelParent(['wp-5', 'wp-3'], rootIds, nodes);
    expect(res3.parentId).toBeNull();
    expect(res3.insertIndex).toBe(2);
  });

  describe('computeRangeSelection', () => {
    const orderedIds = ['a', 'b', 'c', 'd', 'e'];

    it('selects range from lastSelectedId to targetId', () => {
      const res = computeRangeSelection('d', 'b', orderedIds, ['b'], false);
      expect(res).toEqual(['b', 'c', 'd']);
    });

    it('selects range backwards from lastSelectedId to targetId', () => {
      const res = computeRangeSelection('b', 'd', orderedIds, ['d'], false);
      expect(res).toEqual(['b', 'c', 'd']);
    });

    it('merges with existing selection when isCtrlOrMeta is true', () => {
      const res = computeRangeSelection('d', 'b', orderedIds, ['a', 'b'], true);
      expect(res).toEqual(['a', 'b', 'c', 'd']);
    });

    it('returns targetId if lastSelectedId is not in orderedIds', () => {
      const res = computeRangeSelection('c', 'unknown', orderedIds, [], false);
      expect(res).toEqual(['c']);
    });
  });

  describe('computeDragDropPosition', () => {
    const visibleIds = ['n1', 'n2', 'n3', 'n4'];

    it('returns "after" when moving downwards', () => {
      expect(computeDragDropPosition('n1', 'n3', visibleIds)).toBe('after');
    });

    it('returns "before" when moving upwards', () => {
      expect(computeDragDropPosition('n4', 'n2', visibleIds)).toBe('before');
    });
  });

  describe('getNextSequentialName', () => {
    it('returns prefix 1 when no names exist', () => {
      expect(getNextSequentialName('Point', [])).toBe('Point 1');
    });

    it('returns next incremented number when sequential names exist', () => {
      const names = ['Point 1', 'Point 2', 'Point 3', 'Point 4'];
      expect(getNextSequentialName('Point', names)).toBe('Point 5');
    });

    it('fills in the lowest gap when middle/tail numbers are deleted', () => {
      // 5-8 deleted from 1-8 -> remaining 1-4 -> next is 5
      const names = ['Point 1', 'Point 2', 'Point 3', 'Point 4'];
      expect(getNextSequentialName('Point', names)).toBe('Point 5');

      // 2 deleted -> remaining 1, 3, 4 -> next is 2
      const namesWithGap = ['Point 1', 'Point 3', 'Point 4'];
      expect(getNextSequentialName('Point', namesWithGap)).toBe('Point 2');
    });

    it('only matches exact prefix format and ignores other prefixes', () => {
      const names = ['Point 1', 'Line 1', 'Line 2', 'Oriented Point 1'];
      expect(getNextSequentialName('Point', names)).toBe('Point 2');
      expect(getNextSequentialName('Line', names)).toBe('Line 3');
      expect(getNextSequentialName('Oriented Point', names)).toBe('Oriented Point 2');
      expect(getNextSequentialName('Rectangle', names)).toBe('Rectangle 1');
    });

    it('handles Group prefix correctly', () => {
      const names = ['Group 1', 'Group 3'];
      expect(getNextSequentialName('Group', names)).toBe('Group 2');
    });
  });

  describe('getNodesAfterInsertionTarget', () => {
    it('returns empty set when insertionTarget is null', () => {
      const res = getNodesAfterInsertionTarget(rootIds, nodes, null);
      expect(res.size).toBe(0);
    });

    it('returns all nodes after a root insertion index', () => {
      // rootIds = ['wp-1', 'group-1', 'wp-5']
      // Insert at root index 1 (between wp-1 and group-1)
      const res = getNodesAfterInsertionTarget(rootIds, nodes, { parentId: null, index: 1 });
      // group-1 and all its descendants, plus wp-5, should be in the set
      expect(Array.from(res)).toEqual(['group-1', 'wp-2', 'subgroup-1', 'wp-3', 'wp-4', 'wp-5']);
    });

    it('returns empty set when insertion target is at the end of root', () => {
      const res = getNodesAfterInsertionTarget(rootIds, nodes, { parentId: null, index: 3 });
      expect(res.size).toBe(0);
    });

    it('returns nodes after an insertion inside a nested group', () => {
      // subgroup-1 children: ['wp-3', 'wp-4']
      // Insert inside subgroup-1 at index 1 (between wp-3 and wp-4)
      const res = getNodesAfterInsertionTarget(rootIds, nodes, { parentId: 'subgroup-1', index: 1 });
      // wp-4 and subsequent nodes in the tree (wp-5) should be in the set
      expect(Array.from(res)).toEqual(['wp-4', 'wp-5']);
    });
  });

  describe('getPrecedingManualWaypoint', () => {
    const dummyTransform = { x: 1, y: 2, qx: 0, qy: 0, qz: 0, qw: 1 };
    const testNodes: Record<string, WaypointNode> = {
      'wp-1': { id: 'wp-1', type: 'manual', transform: { ...dummyTransform, x: 1 } },
      'group-1': { id: 'group-1', type: 'manual_group', children_ids: ['wp-2', 'gen-1', 'subgroup-1'] },
      'wp-2': { id: 'wp-2', type: 'manual', transform: { ...dummyTransform, x: 2 } },
      'gen-1': { id: 'gen-1', type: 'generator', children_ids: [] },
      'subgroup-1': { id: 'subgroup-1', type: 'manual_group', children_ids: ['wp-3', 'wp-no-tf', 'wp-4'] },
      'wp-3': { id: 'wp-3', type: 'manual', transform: { ...dummyTransform, x: 3 } },
      'wp-no-tf': { id: 'wp-no-tf', type: 'manual' }, // no transform
      'wp-4': { id: 'wp-4', type: 'manual', transform: { ...dummyTransform, x: 4 } },
      'wp-5': { id: 'wp-5', type: 'manual', transform: { ...dummyTransform, x: 5 } },
    };
    const testRootIds = ['wp-1', 'group-1', 'wp-5'];

    it('returns null for empty tree', () => {
      expect(getPrecedingManualWaypoint([], {}, null)).toBeNull();
      expect(getPrecedingManualWaypoint([], {}, { parentId: null, index: 0 })).toBeNull();
    });

    it('returns null when insertionTarget is at the very beginning of root (index 0)', () => {
      const res = getPrecedingManualWaypoint(testRootIds, testNodes, { parentId: null, index: 0 });
      expect(res).toBeNull();
    });

    it('returns the preceding manual node at root index 1', () => {
      const res = getPrecedingManualWaypoint(testRootIds, testNodes, { parentId: null, index: 1 });
      expect(res?.id).toBe('wp-1');
    });

    it('returns the preceding manual node when target is at the start of a group (DFS precedes)', () => {
      const res = getPrecedingManualWaypoint(testRootIds, testNodes, { parentId: 'group-1', index: 0 });
      expect(res?.id).toBe('wp-1');
    });

    it('returns the preceding child when target is inside a group', () => {
      const res = getPrecedingManualWaypoint(testRootIds, testNodes, { parentId: 'group-1', index: 1 });
      expect(res?.id).toBe('wp-2');
    });

    it('skips generator node and returns wp-2 when inserting after generator in group-1', () => {
      // index 2 is after gen-1, before subgroup-1
      const res = getPrecedingManualWaypoint(testRootIds, testNodes, { parentId: 'group-1', index: 2 });
      expect(res?.id).toBe('wp-2');
    });

    it('resolves inside nested subgroup correctly', () => {
      // At index 0 of subgroup-1, preceding manual node in DFS is wp-2
      const res0 = getPrecedingManualWaypoint(testRootIds, testNodes, { parentId: 'subgroup-1', index: 0 });
      expect(res0?.id).toBe('wp-2');

      // At index 1 of subgroup-1 (after wp-3)
      const res1 = getPrecedingManualWaypoint(testRootIds, testNodes, { parentId: 'subgroup-1', index: 1 });
      expect(res1?.id).toBe('wp-3');

      // At index 2 of subgroup-1 (after wp-no-tf which lacks transform -> should resolve to wp-3)
      const res2 = getPrecedingManualWaypoint(testRootIds, testNodes, { parentId: 'subgroup-1', index: 2 });
      expect(res2?.id).toBe('wp-3');

      // At index 3 of subgroup-1 (after wp-4)
      const res3 = getPrecedingManualWaypoint(testRootIds, testNodes, { parentId: 'subgroup-1', index: 3 });
      expect(res3?.id).toBe('wp-4');
    });

    it('returns the last manual node when insertionTarget is at root end or null', () => {
      const resEnd = getPrecedingManualWaypoint(testRootIds, testNodes, { parentId: null, index: 3 });
      expect(resEnd?.id).toBe('wp-5');

      const resNull = getPrecedingManualWaypoint(testRootIds, testNodes, null);
      expect(resNull?.id).toBe('wp-5');
    });
  });

  describe('validateAndCorrectInsertionTarget', () => {
    const testNodes: Record<string, WaypointNode> = {
      'group-1': { id: 'group-1', type: 'manual_group', children_ids: ['c1', 'c2'] },
    };
    const testRootIds = ['w1', 'group-1', 'w2'];

    it('returns null when target is null', () => {
      expect(validateAndCorrectInsertionTarget(null, testRootIds, testNodes)).toBeNull();
    });

    it('preserves valid target at root', () => {
      expect(validateAndCorrectInsertionTarget({ parentId: null, index: 1 }, testRootIds, testNodes)).toEqual({
        parentId: null,
        index: 1,
      });
    });

    it('clamps negative index to 0', () => {
      expect(validateAndCorrectInsertionTarget({ parentId: null, index: -5 }, testRootIds, testNodes)).toEqual({
        parentId: null,
        index: 0,
      });
    });

    it('clamps index exceeding root length to root length', () => {
      expect(validateAndCorrectInsertionTarget({ parentId: null, index: 10 }, testRootIds, testNodes)).toEqual({
        parentId: null,
        index: 3,
      });
    });

    it('preserves valid target inside parent group', () => {
      expect(validateAndCorrectInsertionTarget({ parentId: 'group-1', index: 2 }, testRootIds, testNodes)).toEqual({
        parentId: 'group-1',
        index: 2,
      });
    });

    it('clamps index exceeding parent children length', () => {
      expect(validateAndCorrectInsertionTarget({ parentId: 'group-1', index: 99 }, testRootIds, testNodes)).toEqual({
        parentId: 'group-1',
        index: 2,
      });
    });

    it('falls back to root and clamps index when parent is deleted/missing', () => {
      expect(validateAndCorrectInsertionTarget({ parentId: 'deleted-group', index: 2 }, testRootIds, testNodes)).toEqual({
        parentId: null,
        index: 2,
      });

      expect(validateAndCorrectInsertionTarget({ parentId: 'deleted-group', index: 99 }, testRootIds, testNodes)).toEqual({
        parentId: null,
        index: 3,
      });
    });

    it('escapes generator parent to the position after the generator', () => {
      const genNodes: Record<string, WaypointNode> = {
        'wp-1': { id: 'wp-1', type: 'manual' },
        'gen-1': { id: 'gen-1', type: 'generator', children_ids: ['child-1', 'child-2'] },
        'child-1': { id: 'child-1', type: 'manual' },
        'child-2': { id: 'child-2', type: 'manual' },
        'wp-2': { id: 'wp-2', type: 'manual' },
      };
      const genRoots = ['wp-1', 'gen-1', 'wp-2'];

      // When target points inside generator 'gen-1'
      const corrected = validateAndCorrectInsertionTarget(
        { parentId: 'gen-1', index: 1 },
        genRoots,
        genNodes
      );
      // gen-1 is at root index 1, so escaping places target after gen-1 at root index 2
      expect(corrected).toEqual({
        parentId: null,
        index: 2,
      });
    });
  });

  describe('isInsertableContainer', () => {
    it('returns true for null/undefined (root)', () => {
      expect(isInsertableContainer(null)).toBe(true);
      expect(isInsertableContainer(undefined)).toBe(true);
    });

    it('returns true for manual_group and group', () => {
      expect(isInsertableContainer({ id: 'g1', type: 'manual_group' })).toBe(true);
      expect(isInsertableContainer({ id: 'g2', type: 'group' as any })).toBe(true);
    });

    it('returns false for manual waypoint and generator', () => {
      expect(isInsertableContainer({ id: 'wp1', type: 'manual' })).toBe(false);
      expect(isInsertableContainer({ id: 'gen1', type: 'generator' })).toBe(false);
    });
  });

  describe('expandSelectionWithDescendants', () => {
    const testNodes: Record<string, WaypointNode> = {
      'g1': { id: 'g1', type: 'manual_group', children_ids: ['w1', 'g2'] },
      'w1': { id: 'w1', type: 'manual' },
      'g2': { id: 'g2', type: 'manual_group', children_ids: ['w2'] },
      'w2': { id: 'w2', type: 'manual' },
      'gen': { id: 'gen', type: 'generator', children_ids: ['gw1'] },
      'gw1': { id: 'gw1', type: 'manual' },
      'root_w': { id: 'root_w', type: 'manual' },
    };

    it('expands manual_group descendants recursively', () => {
      const res = expandSelectionWithDescendants(['g1'], testNodes);
      expect(res).toEqual(['g1', 'w1', 'g2', 'w2']);
    });

    it('does not expand generator node children', () => {
      const res = expandSelectionWithDescendants(['gen'], testNodes);
      expect(res).toEqual(['gen']);
    });

    it('leaves leaf nodes untouched and eliminates duplicates', () => {
      const res = expandSelectionWithDescendants(['g1', 'w1', 'root_w'], testNodes);
      expect(res).toEqual(['g1', 'w1', 'g2', 'w2', 'root_w']);
    });
  });

  describe('mapInsertionTarget', () => {
    it('maps insertion target when anchor node survives after transformation', () => {
      const oldNodes: Record<string, WaypointNode> = {
        'w1': { id: 'w1', type: 'manual' },
        'w2': { id: 'w2', type: 'manual' },
        'w3': { id: 'w3', type: 'manual' },
      };
      const oldRoots = ['w1', 'w2', 'w3'];

      // Insertion target was after w2 (index: 2)
      const currentTarget = { parentId: null, index: 2 };

      // w1 is deleted, w2 moves to index 0
      const newNodes: Record<string, WaypointNode> = {
        'w2': { id: 'w2', type: 'manual' },
        'w3': { id: 'w3', type: 'manual' },
      };
      const newRoots = ['w2', 'w3'];

      const mapped = mapInsertionTarget(currentTarget, oldRoots, oldNodes, newRoots, newNodes);
      // w2 is now index 0, so insertion target after w2 becomes index 1
      expect(mapped).toEqual({ parentId: null, index: 1 });
    });

    it('tracks preceding sibling when anchor node is deleted', () => {
      const oldNodes: Record<string, WaypointNode> = {
        'w1': { id: 'w1', type: 'manual' },
        'w2': { id: 'w2', type: 'manual' },
        'w3': { id: 'w3', type: 'manual' },
      };
      const oldRoots = ['w1', 'w2', 'w3'];

      // Insertion target was after w2 (index: 2)
      const currentTarget = { parentId: null, index: 2 };

      // w2 is deleted, w1 and w3 remain
      const newNodes: Record<string, WaypointNode> = {
        'w1': { id: 'w1', type: 'manual' },
        'w3': { id: 'w3', type: 'manual' },
      };
      const newRoots = ['w1', 'w3'];

      const mapped = mapInsertionTarget(currentTarget, oldRoots, oldNodes, newRoots, newNodes);
      // Anchor w2 was deleted; backward scan finds w1 (at index 0), so target becomes index 1
      expect(mapped).toEqual({ parentId: null, index: 1 });
    });

    it('tracks ungrouped node when group is dissolved', () => {
      const oldNodes: Record<string, WaypointNode> = {
        'grp': { id: 'grp', type: 'manual_group', children_ids: ['w1', 'w2'] },
        'w1': { id: 'w1', type: 'manual' },
        'w2': { id: 'w2', type: 'manual' },
      };
      const oldRoots = ['grp'];

      // Insertion target was inside grp after w1 (index: 1)
      const currentTarget = { parentId: 'grp', index: 1 };

      // grp is ungrouped; w1 and w2 are now at root
      const newNodes: Record<string, WaypointNode> = {
        'w1': { id: 'w1', type: 'manual' },
        'w2': { id: 'w2', type: 'manual' },
      };
      const newRoots = ['w1', 'w2'];

      const mapped = mapInsertionTarget(currentTarget, oldRoots, oldNodes, newRoots, newNodes);
      // w1 is at root index 0, so target stays right after w1 (index 1) at root
      expect(mapped).toEqual({ parentId: null, index: 1 });
    });

    it('maintains position at Root index when Group is deleted after insertion target was set after Group', () => {
      // root: ['w0', 'w1', 'grp', 'w3']
      const oldNodes: Record<string, WaypointNode> = {
        'w0': { id: 'w0', type: 'manual' },
        'w1': { id: 'w1', type: 'manual' },
        'grp': { id: 'grp', type: 'manual_group', children_ids: ['c1'] },
        'c1': { id: 'c1', type: 'manual' },
        'w3': { id: 'w3', type: 'manual' },
      };
      const oldRoots = ['w0', 'w1', 'grp', 'w3'];

      // Insertion target was after grp (index: 3)
      const currentTarget = { parentId: null, index: 3 };

      // grp and its children are deleted
      const newNodes: Record<string, WaypointNode> = {
        'w0': { id: 'w0', type: 'manual' },
        'w1': { id: 'w1', type: 'manual' },
        'w3': { id: 'w3', type: 'manual' },
      };
      const newRoots = ['w0', 'w1', 'w3'];

      const mapped = mapInsertionTarget(currentTarget, oldRoots, oldNodes, newRoots, newNodes);
      // Stays after w1 at index 2 (where grp was), NOT jumping to index 0!
      expect(mapped).toEqual({ parentId: null, index: 2 });
    });

    it('falls back to Group position at Root when target was inside Group and Group is deleted', () => {
      // root: ['w0', 'w1', 'grp', 'w3']
      const oldNodes: Record<string, WaypointNode> = {
        'w0': { id: 'w0', type: 'manual' },
        'w1': { id: 'w1', type: 'manual' },
        'grp': { id: 'grp', type: 'manual_group', children_ids: ['c1', 'c2'] },
        'c1': { id: 'c1', type: 'manual' },
        'c2': { id: 'c2', type: 'manual' },
        'w3': { id: 'w3', type: 'manual' },
      };
      const oldRoots = ['w0', 'w1', 'grp', 'w3'];

      // Insertion target was inside grp at index 1
      const currentTarget = { parentId: 'grp', index: 1 };

      // grp and all children deleted
      const newNodes: Record<string, WaypointNode> = {
        'w0': { id: 'w0', type: 'manual' },
        'w1': { id: 'w1', type: 'manual' },
        'w3': { id: 'w3', type: 'manual' },
      };
      const newRoots = ['w0', 'w1', 'w3'];

      const mapped = mapInsertionTarget(currentTarget, oldRoots, oldNodes, newRoots, newNodes);
      // Falls back to root index 2 (after w1, where grp was), NOT index 0!
      expect(mapped).toEqual({ parentId: null, index: 2 });
    });

    it('resolves inside nested parent when deep subgroup is deleted', () => {
      // parentGrp has ['w_prev', 'subgrp', 'w_next']
      // subgrp has ['sub_c1', 'sub_c2']
      const oldNodes: Record<string, WaypointNode> = {
        'parentGrp': { id: 'parentGrp', type: 'manual_group', children_ids: ['w_prev', 'subgrp', 'w_next'] },
        'w_prev': { id: 'w_prev', type: 'manual' },
        'subgrp': { id: 'subgrp', type: 'manual_group', children_ids: ['sub_c1', 'sub_c2'] },
        'sub_c1': { id: 'sub_c1', type: 'manual' },
        'sub_c2': { id: 'sub_c2', type: 'manual' },
        'w_next': { id: 'w_next', type: 'manual' },
      };
      const oldRoots = ['parentGrp'];

      // Target was inside subgrp
      const currentTarget = { parentId: 'subgrp', index: 2 };

      // subgrp deleted, parentGrp remains with ['w_prev', 'w_next']
      const newNodes: Record<string, WaypointNode> = {
        'parentGrp': { id: 'parentGrp', type: 'manual_group', children_ids: ['w_prev', 'w_next'] },
        'w_prev': { id: 'w_prev', type: 'manual' },
        'w_next': { id: 'w_next', type: 'manual' },
      };
      const newRoots = ['parentGrp'];

      const mapped = mapInsertionTarget(currentTarget, oldRoots, oldNodes, newRoots, newNodes);
      // In parentGrp, should be after w_prev at index 1
      expect(mapped).toEqual({ parentId: 'parentGrp', index: 1 });
    });
  });

  describe('escapeCollapsedInsertionTarget', () => {
    const testNodes: Record<string, WaypointNode> = {
      'grp-1': { id: 'grp-1', type: 'manual_group', children_ids: ['c1', 'subgrp-1'] },
      'c1': { id: 'c1', type: 'manual' },
      'subgrp-1': { id: 'subgrp-1', type: 'manual_group', children_ids: ['sub-c1'] },
      'sub-c1': { id: 'sub-c1', type: 'manual' },
      'wp-end': { id: 'wp-end', type: 'manual' },
    };
    const testRoots = ['grp-1', 'wp-end'];

    it('returns null when target is null', () => {
      expect(escapeCollapsedInsertionTarget(null, new Set(), testRoots, testNodes)).toBeNull();
    });

    it('returns root target unchanged even if groups are collapsed', () => {
      const rootTarget = { parentId: null, index: 1 };
      expect(escapeCollapsedInsertionTarget(rootTarget, new Set(), testRoots, testNodes)).toEqual(rootTarget);
    });

    it('returns target unchanged when parent group is expanded', () => {
      const target = { parentId: 'grp-1', index: 1 };
      const expanded = new Set(['grp-1']);
      expect(escapeCollapsedInsertionTarget(target, expanded, testRoots, testNodes)).toEqual(target);
    });

    it('escapes target to outside group in root when parent group is collapsed', () => {
      const target = { parentId: 'grp-1', index: 2 };
      const expanded = new Set<string>(); // grp-1 is collapsed
      const escaped = escapeCollapsedInsertionTarget(target, expanded, testRoots, testNodes);
      // grp-1 is at root index 0, so escaped target is root index 1
      expect(escaped).toEqual({ parentId: null, index: 1 });
    });

    it('escapes nested target to intermediate expanded parent when subgroup is collapsed', () => {
      const target = { parentId: 'subgrp-1', index: 1 };
      // grp-1 is expanded, subgrp-1 is collapsed
      const expanded = new Set(['grp-1']);
      const escaped = escapeCollapsedInsertionTarget(target, expanded, testRoots, testNodes);
      // subgrp-1 is in grp-1 at index 1, so escaped target is inside grp-1 at index 2
      expect(escaped).toEqual({ parentId: 'grp-1', index: 2 });
    });

    it('escapes deeply nested target all the way to root when top group is also collapsed', () => {
      const target = { parentId: 'subgrp-1', index: 1 };
      // both grp-1 and subgrp-1 are collapsed
      const expanded = new Set<string>();
      const escaped = escapeCollapsedInsertionTarget(target, expanded, testRoots, testNodes);
      // grp-1 is at root index 0, so escaped target is root index 1
      expect(escaped).toEqual({ parentId: null, index: 1 });
    });
  });

  describe('determineMultiDepthDropTarget', () => {
    const testNodes: Record<string, WaypointNode> = {
      'wp-0': { id: 'wp-0', type: 'manual' },
      'grp-1': { id: 'grp-1', type: 'manual_group', children_ids: ['c1', 'c2'] },
      'c1': { id: 'c1', type: 'manual' },
      'c2': { id: 'c2', type: 'manual' },
      'wp-end': { id: 'wp-end', type: 'manual' },
    };
    const testRoots = ['wp-0', 'grp-1', 'wp-end'];

    it('selects inside group when dropping after last child with relativeX >= threshold', () => {
      const target = determineMultiDepthDropTarget({
        activeId: '__insertion_bar__',
        overId: 'c2', // last child of grp-1
        relativeX: 35, // >= 28
        position: 'after',
        rootNodeIds: testRoots,
        nodes: testNodes,
        expandedNodes: new Set(['grp-1']),
      });
      expect(target).toEqual({ parentId: 'grp-1', index: 2 });
    });

    it('selects outside group (parent level) when dropping after last child with relativeX < threshold', () => {
      const target = determineMultiDepthDropTarget({
        activeId: '__insertion_bar__',
        overId: 'c2', // last child of grp-1
        relativeX: 10, // < 28
        position: 'after',
        rootNodeIds: testRoots,
        nodes: testNodes,
        expandedNodes: new Set(['grp-1']),
      });
      // grp-1 is at root index 1, so outside after grp-1 is root index 2
      expect(target).toEqual({ parentId: null, index: 2 });
    });

    it('selects inside group when dropping after non-last child regardless of relativeX', () => {
      const target = determineMultiDepthDropTarget({
        activeId: '__insertion_bar__',
        overId: 'c1', // first of 2 children
        relativeX: 5,
        position: 'after',
        rootNodeIds: testRoots,
        nodes: testNodes,
        expandedNodes: new Set(['grp-1']),
      });
      expect(target).toEqual({ parentId: 'grp-1', index: 1 });
    });

    it('handles position before correctly', () => {
      const target = determineMultiDepthDropTarget({
        activeId: '__insertion_bar__',
        overId: 'c2',
        relativeX: 0,
        position: 'before',
        rootNodeIds: testRoots,
        nodes: testNodes,
        expandedNodes: new Set(['grp-1']),
      });
      expect(target).toEqual({ parentId: 'grp-1', index: 1 });
    });

    it('places target outside after collapsed group header', () => {
      const target = determineMultiDepthDropTarget({
        activeId: '__insertion_bar__',
        overId: 'grp-1',
        relativeX: 40,
        position: 'after',
        rootNodeIds: testRoots,
        nodes: testNodes,
        expandedNodes: new Set(), // collapsed
      });
      // Always outside collapsed group: root index 2
      expect(target).toEqual({ parentId: null, index: 2 });
    });

    it('allows dropping inside empty expanded group header with indent', () => {
      const emptyGroupNodes = {
        ...testNodes,
        'grp-empty': { id: 'grp-empty', type: 'manual_group' as const, children_ids: [] },
      };
      const emptyRoots = ['wp-0', 'grp-empty'];

      const targetInside = determineMultiDepthDropTarget({
        activeId: '__insertion_bar__',
        overId: 'grp-empty',
        relativeX: 30, // >= 28
        position: 'after',
        rootNodeIds: emptyRoots,
        nodes: emptyGroupNodes,
        expandedNodes: new Set(['grp-empty']),
      });
      expect(targetInside).toEqual({ parentId: 'grp-empty', index: 0 });

      const targetOutside = determineMultiDepthDropTarget({
        activeId: '__insertion_bar__',
        overId: 'grp-empty',
        relativeX: 10, // < 28
        position: 'after',
        rootNodeIds: emptyRoots,
        nodes: emptyGroupNodes,
        expandedNodes: new Set(['grp-empty']),
      });
      expect(targetOutside).toBeNull(); // root end
    });

    it('allows dropping inside expanded group header WITH children with indent', () => {
      const targetInside = determineMultiDepthDropTarget({
        activeId: '__insertion_bar__',
        overId: 'grp-1', // has children ['c1', 'c2']
        relativeX: 30, // >= 28
        position: 'after',
        rootNodeIds: testRoots,
        nodes: testNodes,
        expandedNodes: new Set(['grp-1']),
      });
      expect(targetInside).toEqual({ parentId: 'grp-1', index: 0 });

      const targetOutside = determineMultiDepthDropTarget({
        activeId: '__insertion_bar__',
        overId: 'grp-1',
        relativeX: 10, // < 28
        position: 'after',
        rootNodeIds: testRoots,
        nodes: testNodes,
        expandedNodes: new Set(['grp-1']),
      });
      // grp-1 is at root index 1, so outside after grp-1 is root index 2
      expect(targetOutside).toEqual({ parentId: null, index: 2 });
    });

    it('handles deeply nested groups boundary snapping', () => {
      const nestedNodes: Record<string, WaypointNode> = {
        'top-grp': { id: 'top-grp', type: 'manual_group', children_ids: ['sub-grp'] },
        'sub-grp': { id: 'sub-grp', type: 'manual_group', children_ids: ['deep-c'] },
        'deep-c': { id: 'deep-c', type: 'manual' },
        'wp-after': { id: 'wp-after', type: 'manual' },
      };
      const nestedRoots = ['top-grp', 'wp-after'];
      const expanded = new Set(['top-grp', 'sub-grp']);

      // Dropping after deep-c (innermost child) with high indent -> inside sub-grp (depth 2)
      const targetInnermost = determineMultiDepthDropTarget({
        activeId: '__insertion_bar__',
        overId: 'deep-c',
        relativeX: 35,
        position: 'after',
        rootNodeIds: nestedRoots,
        nodes: nestedNodes,
        expandedNodes: expanded,
      });
      expect(targetInnermost).toEqual({ parentId: 'sub-grp', index: 1 });

      // Dropping after deep-c with low indent -> outermost parent (root after top-grp, depth 0)
      const targetOutermost = determineMultiDepthDropTarget({
        activeId: '__insertion_bar__',
        overId: 'deep-c',
        relativeX: 5,
        position: 'after',
        rootNodeIds: nestedRoots,
        nodes: nestedNodes,
        expandedNodes: expanded,
      });
      expect(targetOutermost).toEqual({ parentId: null, index: 1 });
    });
  });

  describe('getAncestorIds & getHighlightedContainerIds', () => {
    const parentMap: Record<string, string | null> = {
      'root-1': null,
      'grp-1': null,
      'wp-1': 'grp-1',
      'subgrp-1': 'grp-1',
      'wp-nested': 'subgrp-1',
      'deep-grp': 'subgrp-1',
      'wp-deep': 'deep-grp',
    };
    const getParent = (id: string) => parentMap[id] ?? null;

    it('returns empty array for root items without ancestors', () => {
      expect(getAncestorIds('root-1', getParent)).toEqual([]);
      expect(getAncestorIds('grp-1', getParent)).toEqual([]);
    });

    it('returns direct parent for single-level child', () => {
      expect(getAncestorIds('wp-1', getParent)).toEqual(['grp-1']);
    });

    it('returns all ancestors in bottom-up order for deeply nested item', () => {
      expect(getAncestorIds('wp-deep', getParent)).toEqual(['deep-grp', 'subgrp-1', 'grp-1']);
    });

    it('prevents infinite loop on circular parent reference', () => {
      const circularMap: Record<string, string | null> = {
        'a': 'b',
        'b': 'c',
        'c': 'a',
      };
      expect(getAncestorIds('a', (id) => circularMap[id] ?? null)).toEqual(['b', 'c']);
    });

    it('getHighlightedContainerIds collects unique ancestors from multiple selected ids', () => {
      const selected = ['wp-1', 'wp-deep'];
      const highlighted = getHighlightedContainerIds(selected, getParent);
      expect(Array.from(highlighted)).toEqual(['grp-1', 'deep-grp', 'subgrp-1']);
    });

    it('returns empty set when no items or only root items are selected', () => {
      expect(getHighlightedContainerIds([], getParent).size).toBe(0);
      expect(getHighlightedContainerIds(['root-1'], getParent).size).toBe(0);
    });
  });

  describe('getAnnotationParentId', () => {
    const annotObjects: Record<string, AnnotationObject> = {
      'obj-1': { id: 'obj-1', type: 'point', name: 'Obj 1', color: '#ff0000', visible: true, labelVisible: true, x: 0, y: 0, group_id: 'grp-a' },
      'obj-root': { id: 'obj-root', type: 'point', name: 'Obj Root', color: '#ff0000', visible: true, labelVisible: true, x: 0, y: 0 },
    };
    const annotGroups: Record<string, AnnotationGroup> = {
      'grp-a': { id: 'grp-a', type: 'manual_group', name: 'Grp A', visible: true, children_ids: ['obj-1'], parent_id: 'grp-top' },
      'grp-top': { id: 'grp-top', type: 'manual_group', name: 'Grp Top', visible: true, children_ids: ['grp-a'] },
    };
    const rootAnnotIds = ['grp-top', 'obj-root'];

    it('returns group_id for annotation object inside a group', () => {
      expect(getAnnotationParentId('obj-1', rootAnnotIds, annotGroups, annotObjects)).toBe('grp-a');
    });

    it('returns null for root annotation object', () => {
      expect(getAnnotationParentId('obj-root', rootAnnotIds, annotGroups, annotObjects)).toBeNull();
    });

    it('returns parent_id for child annotation group', () => {
      expect(getAnnotationParentId('grp-a', rootAnnotIds, annotGroups, annotObjects)).toBe('grp-top');
    });

    it('returns null for root annotation group', () => {
      expect(getAnnotationParentId('grp-top', rootAnnotIds, annotGroups, annotObjects)).toBeNull();
    });
  });
});

