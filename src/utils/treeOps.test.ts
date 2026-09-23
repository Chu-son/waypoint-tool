import { describe, it, expect } from 'vitest';
import { detachFromTree, insertIntoTree, type TreeShape } from './treeOps';

// root: a, g1(b, c), d
const tree = (): TreeShape<{ children_ids?: string[] }> => ({
  rootIds: ['a', 'g1', 'd'],
  containers: { g1: { children_ids: ['b', 'c'] }, a: {} },
});

describe('detachFromTree', () => {
  it('removes items from the root and from any container, leaving the input untouched', () => {
    const input = tree();
    const result = detachFromTree(input, ['a', 'c']);
    expect(result.rootIds).toEqual(['g1', 'd']);
    expect(result.containers.g1.children_ids).toEqual(['b']);
    expect(input.rootIds).toEqual(['a', 'g1', 'd']);
    expect(input.containers.g1.children_ids).toEqual(['b', 'c']);
  });
});

describe('insertIntoTree', () => {
  it.each([
    ['before a root item', 'd', 'before', undefined, ['a', 'g1', 'X', 'd'], undefined],
    ['after a root item', 'd', 'after', undefined, ['a', 'g1', 'd', 'X'], undefined],
    ['before a nested item', 'b', 'before', 'g1', undefined, ['X', 'b', 'c']],
    ['after a nested item', 'b', 'after', 'g1', undefined, ['b', 'X', 'c']],
    ['inside a container', 'g1', 'inside', undefined, undefined, ['b', 'c', 'X']],
  ] as const)('places the item %s', (_name, target, position, parent, rootIds, g1Children) => {
    const result = insertIntoTree(tree(), ['X'], target, position, parent);
    if (rootIds) expect(result.rootIds).toEqual(rootIds);
    if (g1Children) expect(result.containers.g1.children_ids).toEqual(g1Children);
  });

  it('reports the parent the items ended up under', () => {
    expect(insertIntoTree(tree(), ['X'], 'b', 'after', 'g1').parentId).toBe('g1');
    expect(insertIntoTree(tree(), ['X'], 'g1', 'inside', undefined).parentId).toBe('g1');
    expect(insertIntoTree(tree(), ['X'], 'd', 'after', undefined).parentId).toBeUndefined();
  });

  it('appends to the end when the target is not found among its siblings', () => {
    expect(insertIntoTree(tree(), ['X'], 'zzz', 'before', undefined).rootIds).toEqual(['a', 'g1', 'd', 'X']);
  });

  it('keeps several moved items in order', () => {
    expect(insertIntoTree(tree(), ['X', 'Y'], 'a', 'after', undefined).rootIds).toEqual(['a', 'X', 'Y', 'g1', 'd']);
  });
});
