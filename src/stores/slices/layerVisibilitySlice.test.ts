import { describe, it, expect, beforeEach } from 'vitest';
import { getAppState, resetAppStore } from '../../test/store';
import { layerStackState, makeManualCustomLayer, makeMap } from '../../test/fixtures';
import { differsFromSet, undecidedLayerIds } from '../../utils/layerVisibilitySets';

const visibleIds = () =>
  [...getAppState().mapLayers, ...getAppState().customLayers].filter((l) => l.visible).map((l) => l.id);

const setNamed = (name: string) => getAppState().layerVisibilitySets.find((s) => s.name === name)!;

describe('layer visibility sets', () => {
  beforeEach(() => {
    resetAppStore(layerStackState(makeMap('map'), makeManualCustomLayer('keepout'), makeManualCustomLayer('obstacle')));
  });

  it('applies a saved set to bring back the layers that were shown when it was saved', () => {
    getAppState().updateCustomLayer('keepout', { visible: false });
    getAppState().updateCustomLayer('obstacle', { visible: false });
    getAppState().saveLayerVisibilitySet('Localization');

    getAppState().updateCustomLayer('keepout', { visible: true });
    getAppState().updateMapLayer('map', { visible: false });
    getAppState().applyLayerVisibilitySet(setNamed('Localization').id);

    expect(visibleIds()).toEqual(['map']);
  });

  it('switches between two saved sets', () => {
    getAppState().updateCustomLayer('keepout', { visible: false });
    getAppState().updateCustomLayer('obstacle', { visible: false });
    getAppState().saveLayerVisibilitySet('Localization');
    getAppState().updateCustomLayer('keepout', { visible: true });
    getAppState().updateCustomLayer('obstacle', { visible: true });
    getAppState().saveLayerVisibilitySet('Navigation');

    getAppState().applyLayerVisibilitySet(setNamed('Localization').id);
    expect(visibleIds()).toEqual(['map']);

    getAppState().applyLayerVisibilitySet(setNamed('Navigation').id);
    expect(visibleIds().sort()).toEqual(['keepout', 'map', 'obstacle']);
  });

  it('keeps stack order, opacity and blend mode untouched when applying a set', () => {
    getAppState().updateMapLayer('map', { opacity: 0.4, blend_mode: 'merge_obstacles' });
    getAppState().saveLayerVisibilitySet('Any');
    const orderBefore = [...getAppState().layerOrder];

    getAppState().updateCustomLayer('keepout', { visible: false });
    getAppState().reorderLayers(0, 2);
    const reordered = [...getAppState().layerOrder];
    getAppState().applyLayerVisibilitySet(setNamed('Any').id);

    expect(getAppState().layerOrder).toEqual(reordered);
    expect(reordered).not.toEqual(orderBefore);
    expect(getAppState().mapLayers[0]).toMatchObject({ opacity: 0.4, blend_mode: 'merge_obstacles' });
  });

  describe('when the layers change after a set was saved', () => {
    beforeEach(() => {
      getAppState().updateCustomLayer('obstacle', { visible: false });
      getAppState().saveLayerVisibilitySet('Localization');
    });

    it('reports a layer added later as undecided, and leaves it as it is when the set is applied', () => {
      getAppState().addMapLayer('New map', { resolution: 0.05 }, 'img', 10, 10);
      const newId = getAppState().mapLayers[0].id;
      getAppState().updateMapLayer(newId, { visible: false });

      expect(undecidedLayerIds(setNamed('Localization'), getAppState())).toEqual([newId]);

      getAppState().applyLayerVisibilitySet(setNamed('Localization').id);
      expect(getAppState().mapLayers.find((l) => l.id === newId)?.visible).toBe(false);
    });

    it('does not count a removed layer as an update to the set', () => {
      getAppState().removeCustomLayer('obstacle');

      expect(undecidedLayerIds(setNamed('Localization'), getAppState())).toEqual([]);
    });

    it('decides the undecided layers when the set is overwritten with the current display', () => {
      getAppState().addMapLayer('New map', { resolution: 0.05 }, 'img', 10, 10);
      getAppState().updateCustomLayer('keepout', { visible: false });

      getAppState().overwriteLayerVisibilitySet(setNamed('Localization').id);

      expect(undecidedLayerIds(setNamed('Localization'), getAppState())).toEqual([]);
      expect(differsFromSet(setNamed('Localization'), getAppState())).toBe(false);
    });
  });

  it('notices when the display was changed by hand after applying a set', () => {
    getAppState().saveLayerVisibilitySet('Navigation');
    const navigation = setNamed('Navigation');
    expect(differsFromSet(navigation, getAppState())).toBe(false);

    getAppState().updateCustomLayer('keepout', { visible: false });

    expect(differsFromSet(navigation, getAppState())).toBe(true);
  });

  describe('undo', () => {
    it('restores the map and custom layers shown before a set was applied, in one step', () => {
      getAppState().updateCustomLayer('keepout', { visible: false });
      getAppState().saveLayerVisibilitySet('Only base');
      getAppState().updateCustomLayer('keepout', { visible: true });
      getAppState().updateMapLayer('map', { visible: false });
      const before = visibleIds();

      getAppState().applyLayerVisibilitySet(setNamed('Only base').id);
      expect(visibleIds()).not.toEqual(before);

      getAppState().undo();
      expect(visibleIds()).toEqual(before);

      getAppState().redo();
      expect(visibleIds().sort()).toEqual(['map', 'obstacle']);
    });

    it('does not leave an undo step when the set changes nothing', () => {
      getAppState().saveLayerVisibilitySet('As is');
      const pastBefore = getAppState().historyPast.length;

      getAppState().applyLayerVisibilitySet(setNamed('As is').id);

      expect(getAppState().historyPast).toHaveLength(pastBefore);
    });

    it('does not bring back a map visibility toggle when an unrelated edit is undone', () => {
      getAppState().pushHistorySnapshot();
      getAppState().updateMapLayer('map', { visible: false });

      getAppState().undo();

      expect(getAppState().mapLayers[0].visible).toBe(false);
    });
  });

  describe('managing sets', () => {
    it('gives a set a different name when the name is already taken', () => {
      getAppState().saveLayerVisibilitySet('Navigation');
      getAppState().saveLayerVisibilitySet('Navigation');

      expect(getAppState().layerVisibilitySets.map((s) => s.name)).toEqual(['Navigation', 'Navigation (2)']);
    });

    it('renames a set, keeping names unique', () => {
      getAppState().saveLayerVisibilitySet('A');
      getAppState().saveLayerVisibilitySet('B');

      getAppState().renameLayerVisibilitySet(setNamed('B').id, 'A');

      expect(getAppState().layerVisibilitySets.map((s) => s.name)).toEqual(['A', 'A (2)']);
    });

    it('stops treating a deleted set as the one in use', () => {
      const id = getAppState().saveLayerVisibilitySet('Navigation');
      expect(getAppState().activeLayerVisibilitySetId).toBe(id);

      getAppState().deleteLayerVisibilitySet(id);

      expect(getAppState().layerVisibilitySets).toEqual([]);
      expect(getAppState().activeLayerVisibilitySetId).toBeNull();
    });

    it('marks the project as changed', () => {
      getAppState().saveLayerVisibilitySet('Navigation');

      expect(getAppState().isDirty).toBe(true);
    });
  });
});
