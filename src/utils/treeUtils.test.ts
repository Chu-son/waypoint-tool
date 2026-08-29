import { describe, it, expect } from 'vitest';
import {
  getFlattenedWaypointIds,
  getFlattenedNodeIds,
  findNodeParentId,
  getNodeDepth,
  collectDescendantIds,
  findHighestLevelParent,
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
});
