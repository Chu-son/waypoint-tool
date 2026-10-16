import { describe, it, expect } from 'vitest';
import { computeDropTarget, treeAncestorIds, treeParentIndex, visibleTreeRows, type TreeModel } from './treeCore';

/** a, [g: b, [h: c]], d */
const children: Record<string, string[]> = { g: ['b', 'h'], h: ['c'], empty: [] };
const model: TreeModel = { rootIds: ['a', 'g', 'd'], childrenOf: (id) => children[id] };
const INDENT = 12;
const rowsWith = (...expanded: string[]) => visibleTreeRows(model, new Set(expanded));

describe('visible rows', () => {
  it('shows only top-level rows while nothing is expanded', () => {
    expect(rowsWith().map((r) => r.id)).toEqual(['a', 'g', 'd']);
  });

  it('shows the children of expanded containers with their depth and parent', () => {
    expect(rowsWith('g', 'h').map((r) => [r.id, r.depth, r.parentId])).toEqual([
      ['a', 0, null],
      ['g', 0, null],
      ['b', 1, 'g'],
      ['h', 1, 'g'],
      ['c', 2, 'h'],
      ['d', 0, null],
    ]);
  });

  it('hides the children of a collapsed container even when deeper ones are expanded', () => {
    expect(rowsWith('h').map((r) => r.id)).toEqual(['a', 'g', 'd']);
  });

  it('lists the containers above an item, nearest first', () => {
    expect(treeAncestorIds(treeParentIndex(model), 'c')).toEqual(['h', 'g']);
  });
});

describe('drop target', () => {
  const at = (offsetYFraction: number, depth = 10) => ({
    offsetY: offsetYFraction * 20,
    height: 20,
    offsetX: depth * INDENT + 1,
  });

  it.each<[string, number, 'before' | 'after']>([
    ['top half', 0.2, 'before'],
    ['bottom half', 0.7, 'after'],
  ])('drops before or after a layer row by its %s', (_name, y, position) => {
    expect(computeDropTarget(model, rowsWith(), 'a', at(y), INDENT)).toEqual({ targetId: 'a', position });
  });

  it.each<[number, 'before' | 'inside' | 'after']>([
    [0.1, 'before'],
    [0.5, 'inside'],
    [0.9, 'after'],
  ])('drops onto a collapsed group by thirds (at %s of its height: %s)', (y, position) => {
    expect(computeDropTarget(model, rowsWith(), 'g', at(y), INDENT)).toEqual({ targetId: 'g', position });
  });

  it('puts items dropped right below an expanded group at the top of its children', () => {
    expect(computeDropTarget(model, rowsWith('g'), 'g', at(0.9), INDENT)).toEqual({
      targetId: 'g',
      position: 'inside',
    });
  });

  it('lets the pointer leave the groups that the last row closes by moving left', () => {
    const rows = rowsWith('g', 'h');

    expect(computeDropTarget(model, rows, 'c', at(0.9, 2), INDENT)).toEqual({ targetId: 'c', position: 'after' });
    expect(computeDropTarget(model, rows, 'c', at(0.9, 1), INDENT)).toEqual({ targetId: 'h', position: 'after' });
    expect(computeDropTarget(model, rows, 'c', at(0.9, 0), INDENT)).toEqual({ targetId: 'g', position: 'after' });
  });

  it('keeps a row that is not the last of its group inside it', () => {
    expect(computeDropTarget(model, rowsWith('g', 'h'), 'b', at(0.9, 0), INDENT)).toEqual({
      targetId: 'b',
      position: 'after',
    });
  });

  it('has no target over an unknown row', () => {
    expect(computeDropTarget(model, rowsWith(), 'ghost', at(0.5), INDENT)).toBeNull();
  });
});
