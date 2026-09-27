import { describe, it, expect } from 'vitest';
import {
  baseMapResolution,
  insertAbove,
  insertBelowCustomLayers,
  moveInOrder,
  orderedMapLayers,
  reconcileLayerOrder,
  resolveMapLayers,
  stackEntries,
  stackZIndexes,
} from './layerStack';
import { layerStackState, makeManualCustomLayer, makeMap } from '../test/fixtures';

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
    const entries = stackEntries({ ...stack, layerOrder: ['top', 'ghost', 'bottom'] });
    expect(entries.map((e) => e.layer.id)).toEqual(['top', 'bottom']);
  });

  it('numbers compositing z-indexes from the bottom', () => {
    const z = stackZIndexes(stack.layerOrder);
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

describe('order edits', () => {
  it('inserts a layer directly above another, or on top', () => {
    expect(insertAbove(['a', 'b'], 'x', 'b')).toEqual(['a', 'x', 'b']);
    expect(insertAbove(['a', 'b'], 'x', null)).toEqual(['x', 'a', 'b']);
    expect(insertAbove(['a', 'b'], 'x', 'unknown')).toEqual(['x', 'a', 'b']);
  });

  it('moves a layer and clamps the target', () => {
    expect(moveInOrder(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveInOrder(['a', 'b', 'c'], 2, -5)).toEqual(['c', 'a', 'b']);
    expect(moveInOrder(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
  });

  it('reconciles an order with the layers that exist', () => {
    expect(reconcileLayerOrder(['b', 'ghost', 'b', 'a'], ['a', 'b', 'c'])).toEqual(['c', 'b', 'a']);
  });

  it('places temporary layers just below the lowest custom layer', () => {
    const wall = makeManualCustomLayer('wall');
    const temp = makeManualCustomLayer('temp');
    expect(insertBelowCustomLayers(['wall', 'map'], [wall], [temp])).toEqual(['wall', 'temp', 'map']);
    expect(insertBelowCustomLayers(['map'], [], [temp])).toEqual(['temp', 'map']);
  });
});
