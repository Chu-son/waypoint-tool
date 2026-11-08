/** Every edit of a custom layer or of the layer tree is one undo step, recorded before the change. */
import { beforeEach, describe, expect, it } from 'vitest';
import { getAppState, resetAppStore } from '../../test/store';
import { layerStackState, makeLayerGroup, makeManualCustomLayer, makeMap, makePluginLayer } from '../../test/fixtures';

/** top, [floor: wall, mapA] */
const stack = () =>
  layerStackState(
    makeMap('top'),
    makeLayerGroup('floor', [makeManualCustomLayer('wall'), makeMap('mapA')], { name: 'Floor' }),
  );

const layerState = () => {
  const { customLayers, layerGroups, rootLayerIds, mapLayers } = getAppState();
  return structuredClone({ customLayers, layerGroups, rootLayerIds, mapLayers });
};

const earlierEdit = () => getAppState().updateMapLayer('top', { name: 'renamed earlier' });

const operations: Array<[string, () => void]> = [
  ['adds a hand-drawn layer', () => getAppState().addManualCustomLayer('New')],
  ['adds a plugin layer', () => getAppState().addPluginCustomLayer(makePluginLayer('generated'))],
  ['renames a custom layer', () => getAppState().updateCustomLayer('wall', { name: 'Wall' })],
  ['changes the opacity of a custom layer', () => getAppState().updateCustomLayer('wall', { opacity: 0.2 })],
  ['toggles a custom layer', () => getAppState().updateCustomLayer('wall', { visible: false })],
  ['removes a custom layer', () => getAppState().removeCustomLayer('wall')],
  ['renames a group', () => getAppState().renameLayerGroup('floor', 'Basement')],
  ['hides a group', () => getAppState().setLayerGroupVisible('floor', false)],
  ['hides layers and groups together', () => getAppState().setLayerItemsVisible(['wall', 'mapA', 'floor'], false)],
];

const noOps: Array<[string, () => void]> = [
  ['updating a custom layer with its own values', () => getAppState().updateCustomLayer('wall', { name: 'wall' })],
  ['updating a missing custom layer', () => getAppState().updateCustomLayer('gone', { name: 'x' })],
  ['removing a missing custom layer', () => getAppState().removeCustomLayer('gone')],
  ['renaming a group to its own name', () => getAppState().renameLayerGroup('floor', 'Floor')],
  ['showing layers that are already shown', () => getAppState().setLayerItemsVisible(['wall', 'floor'], true)],
];

describe('undo of custom layers and the layer tree', () => {
  beforeEach(() => resetAppStore(stack()));

  describe.each(operations)('%s', (_name, operate) => {
    it('undoes and redoes in one step', () => {
      const before = layerState();

      operate();
      const after = layerState();
      expect(after).not.toEqual(before);
      expect(getAppState().historyPast).toHaveLength(1);

      getAppState().undo();
      expect(layerState()).toEqual(before);

      getAppState().redo();
      expect(layerState()).toEqual(after);
    });

    it('is taken back on its own, leaving the earlier operation in place', () => {
      earlierEdit();
      const afterEarlier = layerState();

      operate();
      getAppState().undo();

      expect(layerState()).toEqual(afterEarlier);
    });

    it('stays when a later operation is undone', () => {
      operate();
      const afterOperation = layerState();
      getAppState().updateMapLayer('top', { name: 'renamed later' });

      getAppState().undo();

      expect(layerState()).toEqual(afterOperation);
    });
  });

  it.each(noOps)('leaves no undo step for %s', (_name, operate) => {
    operate();

    expect(getAppState().historyPast).toHaveLength(0);
    expect(getAppState().isDirty).toBe(false);
  });

  it('undoes continuous edits inside a transaction in one step', () => {
    const before = layerState();

    getAppState().beginHistoryTransaction();
    [0.9, 0.5, 0.1].forEach((opacity) => getAppState().updateCustomLayer('wall', { opacity }));
    getAppState().endHistoryTransaction();

    expect(getAppState().historyPast).toHaveLength(1);
    getAppState().undo();
    expect(layerState()).toEqual(before);
  });

  it('removes the selection of a layer whose creation is undone', () => {
    getAppState().addManualCustomLayer('New');
    expect(getAppState().activeCustomLayerId).not.toBeNull();

    getAppState().undo();

    expect(getAppState().activeCustomLayerId).toBeNull();
    expect(getAppState().selection).toEqual({ type: 'none' });
  });
});
