import { describe, it, expect, beforeEach } from 'vitest';
import { getAppState, getLayerOrder, resetAppStore } from '../../test/store';
import { layerStackState, makeLayerGroup, makeManualCustomLayer, makeMap } from '../../test/fixtures';
import { buildProjectData } from '../serialization/projectSerializer';
import { migrateAndNormalizeProjectData } from '../migrations/projectMigration';

/** top, [floor: wall, mapA], bottom */
const stackWithGroup = () =>
  layerStackState(
    makeMap('top'),
    makeLayerGroup('floor', [makeManualCustomLayer('wall'), makeMap('mapA')], { name: 'Floor' }),
    makeMap('bottom'),
  );

describe('layer groups', () => {
  beforeEach(() => resetAppStore(stackWithGroup()));

  it('wraps layers in a new, sequentially named group without changing the order', () => {
    const id = getAppState().groupLayerItems(['top', 'bottom'])!;

    const { rootLayerIds, layerGroups } = getAppState();
    expect(rootLayerIds).toEqual([id, 'floor']);
    expect(layerGroups[id]).toMatchObject({ name: 'Group 1', visible: true, children_ids: ['top', 'bottom'] });
    expect(getLayerOrder()).toEqual(['top', 'bottom', 'wall', 'mapA']);
  });

  it('moves layers into and out of groups as one undo step each', () => {
    expect(getAppState().moveLayerItems(['bottom'], 'floor', 'inside')).toBe(true);
    expect(getAppState().layerGroups.floor.children_ids).toEqual(['bottom', 'wall', 'mapA']);

    getAppState().undo();

    expect(getAppState().rootLayerIds).toEqual(['top', 'floor', 'bottom']);
    expect(getAppState().layerGroups.floor.children_ids).toEqual(['wall', 'mapA']);
  });

  it('refuses a move into a layer and leaves no undo step', () => {
    const depth = getAppState().historyPast.length;
    expect(getAppState().moveLayerItems(['top'], 'bottom', 'inside')).toBe(false);
    expect(getAppState().historyPast).toHaveLength(depth);
  });

  it('ungroups in place, and undo brings the group back', () => {
    getAppState().ungroupLayerGroup('floor');
    expect(getAppState().rootLayerIds).toEqual(['top', 'wall', 'mapA', 'bottom']);
    expect(getAppState().layerGroups).toEqual({});

    getAppState().undo();
    expect(getAppState().layerGroups.floor.children_ids).toEqual(['wall', 'mapA']);
  });

  it('deletes a group with its contents, including the map source no one uses any more', () => {
    getAppState().removeLayerGroup('floor', { withContents: true });

    const state = getAppState();
    expect(getLayerOrder()).toEqual(['top', 'bottom']);
    expect(state.customLayers).toEqual([]);
    expect(state.mapLayers.map((l) => l.id)).toEqual(['top', 'bottom']);
    expect(state.mapSources.map((s) => s.id)).toEqual(['top-source', 'bottom-source']);
  });

  it('deletes only the group when asked, leaving its contents in its place', () => {
    getAppState().removeLayerGroup('floor', { withContents: false });
    expect(getLayerOrder()).toEqual(['top', 'wall', 'mapA', 'bottom']);
    expect(getAppState().layerGroups).toEqual({});
  });

  it('brings back the custom layers of a deleted group with undo, but not its maps', () => {
    getAppState().removeLayerGroup('floor', { withContents: true });
    getAppState().undo();

    expect(getAppState().layerGroups.floor.children_ids).toEqual(['wall']);
    expect(getLayerOrder()).toEqual(['top', 'wall', 'bottom']);
  });

  it('keeps an empty group when its last layer is removed', () => {
    getAppState().removeCustomLayer('wall');
    getAppState().removeMapLayer('mapA');
    expect(getAppState().layerGroups.floor.children_ids).toEqual([]);
  });

  it('renames a group', () => {
    getAppState().renameLayerGroup('floor', '1F');
    expect(getAppState().layerGroups.floor.name).toBe('1F');
  });

  it('duplicates a map inside its group, right above the original', () => {
    const copy = getAppState().duplicateMapLayer('mapA')!;
    expect(getAppState().layerGroups.floor.children_ids).toEqual(['wall', copy, 'mapA']);
  });

  it('reorders by flat index, joining the group of the layer it lands on', () => {
    getAppState().reorderLayers(3, 1);
    expect(getAppState().layerGroups.floor.children_ids).toEqual(['bottom', 'wall', 'mapA']);
  });

  describe('hiding a group', () => {
    it('hides its layers from drawing without changing their own flags', () => {
      getAppState().setLayerGroupVisible('floor', false);

      expect(getAppState().customLayers.find((l) => l.id === 'wall')?.visible).toBe(true);
      expect(getAppState().mapLayers.find((l) => l.id === 'mapA')?.visible).toBe(true);
      expect(getAppState().layerGroups.floor.visible).toBe(false);
    });

    it('is not reverted by undoing an unrelated edit made before it', () => {
      getAppState().moveLayerItems(['bottom'], 'top', 'before');
      getAppState().setLayerGroupVisible('floor', false);

      getAppState().undo();

      expect(getAppState().rootLayerIds).toEqual(['top', 'floor', 'bottom']);
      expect(getAppState().layerGroups.floor.visible).toBe(false);
    });
  });
});

describe('layer groups in the project file', () => {
  it('saves and loads the tree, with the flat order written for older versions', () => {
    resetAppStore(stackWithGroup());
    getAppState().setLayerGroupVisible('floor', false);

    const saved = buildProjectData(getAppState());
    expect(saved.layer_order).toEqual(['top', 'wall', 'mapA', 'bottom']);

    resetAppStore();
    getAppState().setProjectData(saved);

    expect(getAppState().rootLayerIds).toEqual(['top', 'floor', 'bottom']);
    expect(getAppState().layerGroups.floor).toEqual({
      id: 'floor',
      name: 'Floor',
      visible: false,
      children_ids: ['wall', 'mapA'],
    });
  });

  it('reads a file without a tree as a stack without groups', () => {
    resetAppStore(stackWithGroup());
    const { layer_root_ids: _root, layer_groups: _groups, ...older } = buildProjectData(getAppState());

    const normalized = migrateAndNormalizeProjectData(older);

    expect(normalized.layer_root_ids).toEqual(['top', 'wall', 'mapA', 'bottom']);
    expect(normalized.layer_groups).toEqual({});
  });

  it('repairs a malformed tree: bad entries dropped, layers missing from it put on top', () => {
    resetAppStore(stackWithGroup());
    const data = buildProjectData(getAppState());

    const normalized = migrateAndNormalizeProjectData({
      ...data,
      layer_root_ids: ['floor', 'ghost', 42],
      layer_groups: { floor: { name: '', visible: 'yes', children_ids: ['wall', 'floor', null] }, junk: 'x' },
    });

    expect(normalized.layer_groups).toEqual({
      floor: { id: 'floor', name: 'Group', visible: true, children_ids: ['wall'] },
    });
    expect(normalized.layer_root_ids).toEqual(['top', 'mapA', 'bottom', 'floor']);
  });

  it('drops entries of a visibility set for groups that do not exist', () => {
    resetAppStore(stackWithGroup());
    const data = buildProjectData(getAppState());

    const normalized = migrateAndNormalizeProjectData({
      ...data,
      layer_visibility_sets: [{ id: 's', name: 'S', visibility: { floor: false, gone: true, top: true } }],
    });

    expect(normalized.layer_visibility_sets[0].visibility).toEqual({ floor: false, top: true });
  });
});
