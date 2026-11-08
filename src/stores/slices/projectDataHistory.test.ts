/** Map poses, export regions, visibility sets and the base map: every panel operation is one undo step. */
import { beforeEach, describe, expect, it } from 'vitest';
import { getAppState, resetAppStore } from '../../test/store';
import { layerStackState, makeMap } from '../../test/fixtures';
import type { ExportRegion, LayerVisibilitySet } from '../../types/layer';

const region: ExportRegion = {
  id: 'region',
  name: 'Region 1',
  rect: { x: 0, y: 0, width: 2, height: 2 },
  visible: true,
  layerVisibility: {},
};
const set: LayerVisibilitySet = { id: 'set', name: 'Set', visibility: { top: false, mapA: true } };

const shared = makeMap('mapA', { info: { origin: [1, 2, 0], occupied_thresh: 0.65 } });
const twin = { source: shared.source, layer: { ...shared.layer, id: 'twin', name: 'twin' } };
const stack = () => ({
  ...layerStackState(makeMap('top'), shared, twin),
  exportRegions: [region],
  layerVisibilitySets: [set],
});

const projectData = () => {
  const { mapLayers, mapSources, exportRegions, layerVisibilitySets, activeLayerVisibilitySetId, geoMap } =
    getAppState();
  return structuredClone({
    mapLayers,
    mapSources,
    exportRegions,
    layerVisibilitySets,
    activeLayerVisibilitySetId,
    geoMap,
  });
};

const earlierEdit = () => getAppState().updateMapLayer('top', { name: 'renamed earlier' });
const sourceOfMapA = () => getAppState().mapSources.find((s) => s.id === shared.source.id)!;

const operations: Array<[string, () => void]> = [
  ['moves a linked map', () => getAppState().setMapLayerOrigin('mapA', [5, 6, 0])],
  ['unlinks a pose', () => getAppState().setMapLayerPoseLinked('mapA', false)],
  [
    'edits occupancy thresholds',
    () =>
      getAppState().updateMapSource(shared.source.id, {
        info: { ...sourceOfMapA().info, occupied_thresh: 0.9 },
      }),
  ],
  ['adds an export region', () => getAppState().addExportRegion({ ...region, id: 'new' })],
  ['resizes an export region', () => getAppState().updateExportRegion('region', { rect: { ...region.rect, x: 3 } })],
  ['removes an export region', () => getAppState().removeExportRegion('region')],
  ['saves a visibility set', () => getAppState().saveLayerVisibilitySet('Saved')],
  ['overwrites a visibility set', () => getAppState().overwriteLayerVisibilitySet('set')],
  ['renames a visibility set', () => getAppState().renameLayerVisibilitySet('set', 'Renamed')],
  ['deletes a visibility set', () => getAppState().deleteLayerVisibilitySet('set')],
  ['applies a visibility set', () => getAppState().applyLayerVisibilitySet('set')],
  ['turns the base map on', () => getAppState().setGeoMapEnabled(true)],
  ['changes the base map opacity', () => getAppState().setGeoMapOpacity(0.2)],
  ['switches the base map', () => getAppState().setBasemap('custom')],
  ['edits the custom base map', () => getAppState().updateCustomBasemap({ urlTemplate: 'https://x/{z}/{x}/{y}' })],
  ['moves the geographic origin', () => getAppState().setGeoOrigin({ kind: 'latlon', lat: 10, lon: 20 })],
  ['switches the origin format', () => getAppState().setGeoOriginKind('utm')],
];

const noOps: Array<[string, () => void]> = [
  ['moving a map to where it is', () => getAppState().setMapLayerOrigin('mapA', [1, 2, 0])],
  ['moving a missing map', () => getAppState().setMapLayerOrigin('gone', [1, 2, 0])],
  ['linking a pose that is linked', () => getAppState().setMapLayerPoseLinked('mapA', true)],
  [
    'setting the thresholds a map has',
    () => getAppState().updateMapSource(shared.source.id, { info: { ...sourceOfMapA().info } }),
  ],
  ['updating a missing region', () => getAppState().updateExportRegion('gone', { name: 'x' })],
  ['setting the bounds a region has', () => getAppState().updateExportRegion('region', { rect: { ...region.rect } })],
  ['removing a missing region', () => getAppState().removeExportRegion('gone')],
  ['overwriting a missing set', () => getAppState().overwriteLayerVisibilitySet('gone')],
  ['renaming a set to its own name', () => getAppState().renameLayerVisibilitySet('set', 'Set')],
  ['deleting a missing set', () => getAppState().deleteLayerVisibilitySet('gone')],
  ['applying a missing set', () => getAppState().applyLayerVisibilitySet('gone')],
  ['setting the base map state it has', () => getAppState().setGeoMapEnabled(false)],
  ['choosing the current base map', () => getAppState().setBasemap('osm')],
  ['setting the custom base map it has', () => getAppState().updateCustomBasemap({})],
  ['setting the origin it has', () => getAppState().setGeoOrigin({ ...getAppState().geoMap.origin })],
  ['choosing the current origin format', () => getAppState().setGeoOriginKind(getAppState().geoMap.origin.kind)],
];

describe('undo of maps, export regions, visibility sets and the base map', () => {
  beforeEach(() => resetAppStore(stack()));

  describe.each(operations)('%s', (_name, operate) => {
    it('undoes and redoes in one step', () => {
      const before = projectData();

      operate();
      const after = projectData();
      expect(after).not.toEqual(before);
      expect(getAppState().historyPast).toHaveLength(1);

      getAppState().undo();
      expect(projectData()).toEqual(before);

      getAppState().redo();
      expect(projectData()).toEqual(after);
    });

    it('is undone alone, leaving an earlier edit in place', () => {
      earlierEdit();
      operate();

      getAppState().undo();

      expect(getAppState().mapLayers.find((l) => l.id === 'top')!.name).toBe('renamed earlier');
    });

    it('stays when a later edit is undone', () => {
      operate();
      const after = projectData();
      getAppState().addExportRegion({ ...region, id: 'later' });

      getAppState().undo();

      expect(projectData()).toEqual(after);
    });
  });

  it.each(noOps)('leaves no undo step for %s', (_name, operate) => {
    earlierEdit();
    getAppState().undo();
    const redoable = getAppState().historyFuture.length;

    operate();

    expect(getAppState().historyPast).toHaveLength(0);
    expect(getAppState().historyFuture).toHaveLength(redoable);
  });

  it('leaves no undo step for re-applying the set that is in effect', () => {
    getAppState().applyLayerVisibilitySet('set');
    const steps = getAppState().historyPast.length;

    getAppState().applyLayerVisibilitySet('set');

    expect(getAppState().historyPast).toHaveLength(steps);
  });

  it('moves every linked instance and undoes them together', () => {
    getAppState().updateMapLayer('twin', { clip: { rects: [{ x: 1, y: 2, width: 1, height: 1 }] } });
    getAppState().setMapLayerOrigin('mapA', [2, 2, 0]);
    expect(getAppState().mapLayers.find((l) => l.id === 'twin')!.clip!.rects[0].x).toBe(2);

    getAppState().undo();

    expect(sourceOfMapA().info.origin).toEqual([1, 2, 0]);
    expect(getAppState().mapLayers.find((l) => l.id === 'twin')!.clip!.rects[0].x).toBe(1);
  });

  it('does not undo the settings screen', () => {
    getAppState().setDefaultMapOpacity(0.9);
    getAppState().setGeoMapEnabled(true);

    getAppState().undo();

    expect(getAppState().geoMap.enabled).toBe(false);
    expect(getAppState().defaultMapOpacity).toBe(0.9);
  });
});
