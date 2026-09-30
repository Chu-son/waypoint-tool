import { describe, it, expect } from 'vitest';
import { layerStackState, makeManualCustomLayer, makeMap } from '../test/fixtures';
import {
  currentLayerVisibility,
  differsFromSet,
  resolveSetVisibility,
  undecidedLayerIds,
  uniqueSetName,
} from './layerVisibilitySets';

const stack = layerStackState(
  makeMap('map'),
  makeManualCustomLayer('wall', { visible: false }),
  makeManualCustomLayer('note', { is_reference: true }),
);

describe('layer visibility sets', () => {
  it('reads the visibility of map and custom layers together', () => {
    expect(currentLayerVisibility(stack)).toEqual({ map: true, wall: false, note: true });
  });

  it('resolves a set to its own decisions, with undecided layers as they are', () => {
    const set = { id: 's', name: 'S', visibility: { map: false, wall: true } };

    expect(resolveSetVisibility(set, stack)).toEqual({ map: false, wall: true, note: true });
  });

  it('ignores entries for layers that do not exist', () => {
    const set = { id: 's', name: 'S', visibility: { map: true, wall: false, note: true, gone: false } };

    expect(undecidedLayerIds(set, stack)).toEqual([]);
    expect(differsFromSet(set, stack)).toBe(false);
  });

  it('leaves reference layers out of the undecided layers of an export', () => {
    const set = { id: 's', name: 'S', visibility: { map: true } };

    expect(undecidedLayerIds(set, stack)).toEqual(['wall', 'note']);
    expect(undecidedLayerIds(set, stack, { exportableOnly: true })).toEqual(['wall']);
  });

  it.each([
    ['is free', 'Navigation', ['Localization'], 'Navigation'],
    ['is taken', 'Navigation', ['Navigation'], 'Navigation (2)'],
    ['is taken along with its numbered variants', 'Nav', ['Nav', 'Nav (2)'], 'Nav (3)'],
  ])('keeps a name unique when it %s', (_case, base, existing, expected) => {
    expect(uniqueSetName(base, existing)).toBe(expected);
  });
});
