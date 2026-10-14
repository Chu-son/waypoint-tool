import { describe, it, expect } from 'vitest';
import type { LayerGroup } from '../types/layer';
import {
  MAX_LAYER_GROUP_DEPTH,
  allTreeIds,
  ancestorGroupIds,
  canMoveInLayerTree,
  descendantLayerIds,
  flattenLayerTree,
  idsHiddenByGroups,
  insertIntoLayerTree,
  layerOrderOf,
  moveInLayerTree,
  normalizeLayerTree,
  placementAbove,
  removeGroupDeep,
  topLevelInStackOrder,
  ungroupInLayerTree,
  wrapInLayerGroup,
  type LayerTree,
} from './layerTree';

const group = (id: string, children_ids: string[], visible = true): LayerGroup => ({
  id,
  name: id,
  visible,
  children_ids,
});

/** top, [floor: wall, [zone: inner]], bottom */
const sample = (): LayerTree => ({
  rootLayerIds: ['top', 'floor', 'bottom'],
  layerGroups: { floor: group('floor', ['wall', 'zone']), zone: group('zone', ['inner']) },
});

describe('flattening', () => {
  it('lists layers depth-first from the top, without groups', () => {
    expect(flattenLayerTree(sample())).toEqual(['top', 'wall', 'inner', 'bottom']);
  });

  it('returns the same array until the tree changes', () => {
    const tree = sample();
    expect(layerOrderOf(tree)).toBe(layerOrderOf({ ...tree }));
    expect(layerOrderOf({ ...tree, rootLayerIds: ['bottom'] })).toEqual(['bottom']);
  });

  it('survives a cycle between groups', () => {
    const tree: LayerTree = { rootLayerIds: ['a'], layerGroups: { a: group('a', ['b', 'x']), b: group('b', ['a']) } };
    expect(flattenLayerTree(tree)).toEqual(['x']);
  });
});

describe('ancestors and descendants', () => {
  it('lists the groups above a layer, nearest first', () => {
    expect(ancestorGroupIds(sample(), 'inner')).toEqual(['zone', 'floor']);
    expect(ancestorGroupIds(sample(), 'top')).toEqual([]);
  });

  it('lists every layer inside a group, at any depth', () => {
    expect(descendantLayerIds(sample(), 'floor')).toEqual(['wall', 'inner']);
  });

  it('lists ids in tree order with groups before their contents', () => {
    expect(allTreeIds(sample())).toEqual(['top', 'floor', 'wall', 'zone', 'inner', 'bottom']);
  });
});

describe('visibility through groups', () => {
  it('hides everything below a hidden group', () => {
    const tree = sample();
    tree.layerGroups.floor = { ...tree.layerGroups.floor, visible: false };
    expect([...idsHiddenByGroups(tree)].sort()).toEqual(['inner', 'wall', 'zone']);
  });

  it('hides only the contents of a hidden inner group', () => {
    const tree = sample();
    tree.layerGroups.zone = { ...tree.layerGroups.zone, visible: false };
    expect([...idsHiddenByGroups(tree)]).toEqual(['inner']);
  });
});

describe('normalizing', () => {
  const existing = ['top', 'wall', 'inner', 'bottom'];

  it('keeps a well-formed tree as it is', () => {
    expect(normalizeLayerTree(sample(), existing)).toEqual(sample());
  });

  it.each<[string, LayerTree, string[], LayerTree]>([
    [
      'drops unknown and repeated references',
      { rootLayerIds: ['a', 'ghost', 'g', 'a'], layerGroups: { g: group('g', ['a', 'b']) } },
      ['a', 'b'],
      { rootLayerIds: ['a', 'g'], layerGroups: { g: group('g', ['b']) } },
    ],
    [
      'adds layers missing from the tree at the top',
      { rootLayerIds: ['a'], layerGroups: {} },
      ['new', 'a'],
      { rootLayerIds: ['new', 'a'], layerGroups: {} },
    ],
    [
      'puts groups referenced from nowhere back at the top with their contents',
      { rootLayerIds: ['a'], layerGroups: { lost: group('lost', ['b']) } },
      ['a', 'b'],
      { rootLayerIds: ['lost', 'a'], layerGroups: { lost: group('lost', ['b']) } },
    ],
    [
      'breaks a cycle between groups',
      { rootLayerIds: ['g1'], layerGroups: { g1: group('g1', ['g2']), g2: group('g2', ['g1', 'a']) } },
      ['a'],
      { rootLayerIds: ['g1'], layerGroups: { g1: group('g1', ['g2']), g2: group('g2', ['a']) } },
    ],
    [
      'keeps empty groups',
      { rootLayerIds: ['empty', 'a'], layerGroups: { empty: group('empty', []) } },
      ['a'],
      { rootLayerIds: ['empty', 'a'], layerGroups: { empty: group('empty', []) } },
    ],
    [
      'lets a layer win over a group with the same id',
      { rootLayerIds: ['x'], layerGroups: { x: group('x', []) } },
      ['x'],
      { rootLayerIds: ['x'], layerGroups: {} },
    ],
  ])('%s', (_name, input, layers, expected) => {
    expect(normalizeLayerTree(input, layers)).toEqual(expected);
  });

  it('dissolves groups nested deeper than the limit into their parent', () => {
    const groups: Record<string, LayerGroup> = {};
    for (let depth = 1; depth <= MAX_LAYER_GROUP_DEPTH + 1; depth++) {
      groups[`g${depth}`] = group(`g${depth}`, depth <= MAX_LAYER_GROUP_DEPTH ? [`g${depth + 1}`] : ['leaf']);
    }
    const normalized = normalizeLayerTree({ rootLayerIds: ['g1'], layerGroups: groups }, ['leaf']);

    expect(normalized.layerGroups[`g${MAX_LAYER_GROUP_DEPTH + 1}`]).toBeUndefined();
    expect(normalized.layerGroups[`g${MAX_LAYER_GROUP_DEPTH}`].children_ids).toEqual(['leaf']);
    expect(flattenLayerTree(normalized)).toEqual(['leaf']);
  });
});

describe('editing', () => {
  it('inserts directly above a layer, inside its group', () => {
    const tree = sample();
    const next = insertIntoLayerTree(tree, ['copy'], placementAbove(tree, 'inner'));
    expect(next.layerGroups.zone.children_ids).toEqual(['copy', 'inner']);
  });

  it('inserts at the top when the anchor is unknown', () => {
    const next = insertIntoLayerTree(sample(), ['new'], placementAbove(sample(), 'ghost'));
    expect(next.rootLayerIds[0]).toBe('new');
  });

  it('moves layers before, after and inside', () => {
    expect(flattenLayerTree(moveInLayerTree(sample(), ['bottom'], 'top', 'before')!)).toEqual([
      'bottom',
      'top',
      'wall',
      'inner',
    ]);
    const into = moveInLayerTree(sample(), ['top'], 'zone', 'inside')!;
    expect(into.layerGroups.zone.children_ids).toEqual(['top', 'inner']);
    const after = moveInLayerTree(sample(), ['bottom'], 'wall', 'after')!;
    expect(after.layerGroups.floor.children_ids).toEqual(['wall', 'bottom', 'zone']);
  });

  it('moves a group together with its contents, keeping the order of the moved items', () => {
    const moved = moveInLayerTree(sample(), ['bottom', 'zone', 'inner'], 'top', 'before')!;
    expect(moved.rootLayerIds).toEqual(['zone', 'bottom', 'top', 'floor']);
    expect(flattenLayerTree(moved)).toEqual(['inner', 'bottom', 'top', 'wall']);
  });

  it.each<[string, string[], string, 'before' | 'after' | 'inside']>([
    ['a group into itself', ['floor'], 'floor', 'inside'],
    ['a group into its own descendant', ['floor'], 'zone', 'inside'],
    ['next to an item being moved', ['top'], 'top', 'before'],
    ['inside a layer', ['top'], 'bottom', 'inside'],
    ['onto an unknown target', ['top'], 'ghost', 'before'],
  ])('refuses to move %s', (_name, ids, target, position) => {
    expect(canMoveInLayerTree(sample(), ids, target, position)).toBe(false);
    expect(moveInLayerTree(sample(), ids, target, position)).toBeNull();
  });

  it('refuses a move that would nest groups deeper than the limit', () => {
    const groups: Record<string, LayerGroup> = {};
    for (let depth = 1; depth <= MAX_LAYER_GROUP_DEPTH; depth++) {
      groups[`g${depth}`] = group(`g${depth}`, depth < MAX_LAYER_GROUP_DEPTH ? [`g${depth + 1}`] : []);
    }
    const tree: LayerTree = { rootLayerIds: ['g1', 'other'], layerGroups: { ...groups, other: group('other', []) } };

    expect(canMoveInLayerTree(tree, ['other'], `g${MAX_LAYER_GROUP_DEPTH}`, 'inside')).toBe(false);
    expect(canMoveInLayerTree(tree, ['other'], `g${MAX_LAYER_GROUP_DEPTH - 1}`, 'inside')).toBe(true);
  });

  it('wraps items in a new group where the topmost of them was', () => {
    const wrapped = wrapInLayerGroup(sample(), ['bottom', 'wall'], { id: 'new', name: 'New' })!;

    expect(wrapped.layerGroups.floor.children_ids).toEqual(['new', 'zone']);
    expect(wrapped.layerGroups.new).toEqual({
      id: 'new',
      name: 'New',
      visible: true,
      children_ids: ['wall', 'bottom'],
    });
    expect(wrapped.rootLayerIds).toEqual(['top', 'floor']);
  });

  it('lists only the outermost of nested selections, in stack order', () => {
    expect(topLevelInStackOrder(sample(), ['inner', 'bottom', 'floor'])).toEqual(['floor', 'bottom']);
  });

  it('ungroups in place', () => {
    const next = ungroupInLayerTree(sample(), 'floor');
    expect(next.rootLayerIds).toEqual(['top', 'wall', 'zone', 'bottom']);
    expect(next.layerGroups.floor).toBeUndefined();
    expect(flattenLayerTree(next)).toEqual(flattenLayerTree(sample()));
  });

  it('removes a group with everything inside and reports the layers that went', () => {
    const { tree, removedLayerIds } = removeGroupDeep(sample(), 'floor');
    expect(tree).toEqual({ rootLayerIds: ['top', 'bottom'], layerGroups: {} });
    expect(removedLayerIds).toEqual(['wall', 'inner']);
  });
});

describe('invariants under random edits', () => {
  // Deterministic pseudo-random sequence (mulberry32) so failures reproduce.
  const random = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const assertWellFormed = (tree: LayerTree, layers: string[]) => {
    const ids = allTreeIds(tree);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...flattenLayerTree(tree)].sort()).toEqual([...layers].sort());
    expect(Object.keys(tree.layerGroups).sort()).toEqual(ids.filter((id) => tree.layerGroups[id]).sort());
    expect(normalizeLayerTree(tree, flattenLayerTree(tree))).toEqual(tree);
  };

  it('keeps every layer exactly once and the tree well formed', () => {
    const next = random(42);
    const pick = <T>(list: T[]) => list[Math.floor(next() * list.length)];
    const layers = ['a', 'b', 'c', 'd', 'e', 'f'];
    let tree: LayerTree = { rootLayerIds: [...layers], layerGroups: {} };
    let groupCount = 0;

    for (let step = 0; step < 400; step++) {
      const ids = allTreeIds(tree);
      const groups = Object.keys(tree.layerGroups);
      const op = Math.floor(next() * 4);
      if (op === 0) {
        tree = wrapInLayerGroup(tree, [pick(ids), pick(ids)], { id: `g${groupCount++}`, name: 'G' }) ?? tree;
      } else if (op === 1 && groups.length > 0) {
        tree = ungroupInLayerTree(tree, pick(groups));
      } else {
        const position = pick(['before', 'after', 'inside'] as const);
        tree = moveInLayerTree(tree, [pick(ids)], pick(ids), position) ?? tree;
      }
      assertWellFormed(tree, layers);
    }
  });
});
