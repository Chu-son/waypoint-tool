import { describe, it, expect } from 'vitest';
import {
  baseMapResolution,
  insertBelowCustomLayers,
  orderedMapLayers,
  reconcileLayerOrder,
  resolveMapLayers,
  stackEntries,
  stackZIndexes,
} from './layerStack';
import { layerOrderOf } from './layerTree';
import { layerStackState, makeLayerGroup, makeManualCustomLayer, makeMap } from '../test/fixtures';

describe('resolveMapLayers', () => {
  it('joins each instance with the image and pose of its source', () => {
    const a = makeMap('a', { image_base64: 'img-a', info: { origin: [1, 2, 0] } });
    const copy = { source: a.source, layer: { ...a.layer, id: 'a-copy' } };

    const resolved = resolveMapLayers([a.source], [a.layer, copy.layer]);

    expect(resolved.map((l) => [l.id, l.image_base64, l.info.origin])).toEqual([
      ['a', 'img-a', [1, 2, 0]],
      ['a-copy', 'img-a', [1, 2, 0]],
    ]);
  });

  it('gives an instance with its own pose that pose, keeping the rest of the source metadata', () => {
    const a = makeMap('a', { info: { origin: [1, 2, 0], resolution: 0.1 } });
    const own = { ...a.layer, id: 'a-own', origin_override: [5, 6, 1] as [number, number, number] };

    const resolved = resolveMapLayers([a.source], [a.layer, own]);

    expect(resolved.map((l) => [l.id, l.info.origin, l.info.resolution])).toEqual([
      ['a', [1, 2, 0], 0.1],
      ['a-own', [5, 6, 1], 0.1],
    ]);
    expect(a.source.info.origin).toEqual([1, 2, 0]);
  });

  it('leaves out instances whose source is missing', () => {
    const a = makeMap('a');
    expect(resolveMapLayers([], [a.layer])).toEqual([]);
  });
});

describe('stack order', () => {
  const stack = layerStackState(makeMap('top'), makeManualCustomLayer('wall'), makeMap('bottom'));

  it('lists layers of both kinds from the top of the stack', () => {
    expect(stackEntries(stack).map((e) => [e.kind, e.layer.id])).toEqual([
      ['map', 'top'],
      ['custom', 'wall'],
      ['map', 'bottom'],
    ]);
  });

  it('skips ids that no longer exist', () => {
    const entries = stackEntries({ ...stack, rootLayerIds: ['top', 'ghost', 'bottom'] });
    expect(entries.map((e) => e.layer.id)).toEqual(['top', 'bottom']);
  });

  it('numbers compositing z-indexes from the bottom', () => {
    const z = stackZIndexes(layerOrderOf(stack));
    expect(z.get('bottom')).toBe(0);
    expect(z.get('wall')).toBe(1);
    expect(z.get('top')).toBe(2);
  });

  it('resolves maps in stack order, and takes the base resolution from the top visible map', () => {
    const fine = makeMap('fine', { info: { resolution: 0.02 }, visible: false });
    const coarse = makeMap('coarse', { info: { resolution: 0.1 } });
    const s = layerStackState(fine, coarse);

    expect(orderedMapLayers(s).map((l) => l.id)).toEqual(['fine', 'coarse']);
    expect(baseMapResolution(s)).toBe(0.1);
    expect(baseMapResolution(layerStackState())).toBe(0.05);
  });
});

describe('layers inside groups', () => {
  const stack = layerStackState(
    makeMap('top'),
    makeLayerGroup('floor', [makeManualCustomLayer('wall'), makeLayerGroup('zone', [makeMap('inner')])], {
      visible: false,
    }),
    makeMap('bottom'),
  );

  it('composites the stack in tree order, groups flattened', () => {
    expect(stackEntries(stack).map((e) => e.layer.id)).toEqual(['top', 'wall', 'inner', 'bottom']);
    expect(orderedMapLayers(stack).map((l) => l.id)).toEqual(['top', 'inner', 'bottom']);
  });

  it('hides every layer below a hidden group, without touching the layers themselves', () => {
    const shown = stackEntries(stack).map((e) => [e.layer.id, e.layer.visible]);

    expect(shown).toEqual([
      ['top', true],
      ['wall', false],
      ['inner', false],
      ['bottom', true],
    ]);
    expect(stack.customLayers.find((l) => l.id === 'wall')?.visible).toBe(true);
  });

  it('takes the base resolution from the top map that is actually shown', () => {
    const s = layerStackState(
      makeLayerGroup('hidden', [makeMap('fine', { info: { resolution: 0.02 } })], { visible: false }),
      makeMap('coarse', { info: { resolution: 0.1 } }),
    );
    expect(baseMapResolution(s)).toBe(0.1);
  });
});

describe('order edits', () => {
  it('reconciles an order with the layers that exist', () => {
    expect(reconcileLayerOrder(['b', 'ghost', 'b', 'a'], ['a', 'b', 'c'])).toEqual(['c', 'b', 'a']);
  });

  it('places temporary layers just below the lowest custom layer', () => {
    const wall = makeManualCustomLayer('wall');
    const temp = makeManualCustomLayer('temp');
    const flat = layerStackState(wall, makeMap('map'));
    expect(layerOrderOf(insertBelowCustomLayers(flat, [wall], [temp]))).toEqual(['wall', 'temp', 'map']);
    expect(layerOrderOf(insertBelowCustomLayers(layerStackState(makeMap('map')), [], [temp]))).toEqual(['temp', 'map']);
  });

  it('places temporary layers inside the group of the lowest custom layer', () => {
    const wall = makeManualCustomLayer('wall');
    const temp = makeManualCustomLayer('temp');
    const grouped = layerStackState(makeLayerGroup('g', [wall]), makeMap('map'));

    const tree = insertBelowCustomLayers(grouped, [wall], [temp]);

    expect(tree.layerGroups.g.children_ids).toEqual(['wall', 'temp']);
    expect(layerOrderOf(tree)).toEqual(['wall', 'temp', 'map']);
  });
});
