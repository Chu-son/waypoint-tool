import { describe, it, expect } from 'vitest';
import { layerStackState, makeLayerGroup, makeManualCustomLayer, makeMap } from '../test/fixtures';
import {
  currentLayerVisibility,
  differsFromSet,
  effectiveLayerVisibility,
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

  describe('with groups', () => {
    const grouped = layerStackState(
      makeMap('map'),
      makeLayerGroup('walls', [makeManualCustomLayer('wall'), makeManualCustomLayer('door')], { visible: false }),
    );

    it('keeps the flag of a group apart from those of its layers', () => {
      expect(currentLayerVisibility(grouped)).toEqual({ map: true, walls: false, wall: true, door: true });
    });

    it('draws a layer only when its group is shown too', () => {
      const own = currentLayerVisibility(grouped);

      expect(effectiveLayerVisibility(own, grouped)).toEqual({ map: true, wall: false, door: false });
      expect(effectiveLayerVisibility({ ...own, walls: true, door: false }, grouped)).toEqual({
        map: true,
        wall: true,
        door: false,
      });
    });

    it('does not call a layer undecided when the set hides its group', () => {
      const hides = { id: 's', name: 'S', visibility: { map: true, walls: false } };
      const silent = { id: 't', name: 'T', visibility: { map: true } };

      expect(undecidedLayerIds(hides, grouped)).toEqual([]);
      expect(undecidedLayerIds(silent, grouped)).toEqual(['wall', 'door']);
    });

    it('notices a group shown differently from the set', () => {
      const set = { id: 's', name: 'S', visibility: { walls: true } };

      expect(differsFromSet(set, grouped)).toBe(true);
    });
  });

  it.each([
    ['is free', 'Navigation', ['Localization'], 'Navigation'],
    ['is taken', 'Navigation', ['Navigation'], 'Navigation (2)'],
    ['is taken along with its numbered variants', 'Nav', ['Nav', 'Nav (2)'], 'Nav (3)'],
  ])('keeps a name unique when it %s', (_case, base, existing, expected) => {
    expect(uniqueSetName(base, existing)).toBe(expected);
  });
});
