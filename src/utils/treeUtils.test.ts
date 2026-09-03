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
} from './treeUtils';
import { WaypointNode } from '../types/store';

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
  });
});

