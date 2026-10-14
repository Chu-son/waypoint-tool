import { describe, it, expect, beforeEach } from 'vitest';
import { getAppState, resetAppStore } from '../../test/store';
import { layerStackState, makeLayerGroup, makeManualCustomLayer, makeMap } from '../../test/fixtures';
import type { RigidTransform } from '../../utils/layerGroupTransform';
import type { PluginCustomLayer } from '../../types/layer';

const shift = (dx: number, dy: number): RigidTransform => ({ dx, dy, dyaw: 0, pivot: { x: 0, y: 0 } });
const originOf = (layerId: string) => {
  const layer = getAppState().mapLayers.find((l) => l.id === layerId)!;
  return layer.origin_override ?? getAppState().mapSources.find((s) => s.id === layer.sourceId)!.info.origin;
};

const plugin: PluginCustomLayer = {
  id: 'generated',
  name: 'generated',
  type: 'plugin',
  visible: true,
  opacity: 1,
  plugin_id: 'p',
  params: {},
  image_base64: '',
  info: { resolution: 0.05, origin: [1, 1, 0], width: 10, height: 10 },
};

describe('moving a layer group', () => {
  beforeEach(() => {
    resetAppStore(
      layerStackState(
        makeLayerGroup('site', [
          makeMap('mapA', { info: { origin: [1, 0, 0] } }),
          makeLayerGroup('inner', [makeManualCustomLayer('wall'), plugin]),
        ]),
        makeMap('outside', { info: { origin: [5, 5, 0] } }),
      ),
    );
    getAppState().updateCustomLayer('wall', {
      editObjects: [{ id: 'c', type: 'circle', fillValue: 0, cx: 2, cy: 2, radius: 1 }],
    });
  });

  it('moves maps, hand-drawn objects and plugin layers at any depth, and nothing outside', () => {
    expect(getAppState().transformLayerGroup('site', shift(10, -1))).toBe(true);

    expect(originOf('mapA')).toEqual([11, -1, 0]);
    expect(originOf('outside')).toEqual([5, 5, 0]);
    expect(getAppState().customLayers.find((l) => l.id === 'wall')).toMatchObject({
      editObjects: [{ cx: 12, cy: 1, radius: 1 }],
    });
    expect((getAppState().customLayers.find((l) => l.id === 'generated') as PluginCustomLayer).info.origin).toEqual([
      11, 0, 0,
    ]);
  });

  it('turns the group around the pivot', () => {
    getAppState().transformLayerGroup('site', { dx: 0, dy: 0, dyaw: Math.PI / 2, pivot: { x: 0, y: 0 } });

    const [x, y, yaw] = originOf('mapA');
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(1);
    expect(yaw).toBeCloseTo(Math.PI / 2);
  });

  it('brings the use area of a map along', () => {
    getAppState().updateMapLayer('mapA', { clip: { rects: [{ x: 1, y: 0, width: 2, height: 2 }] } });

    getAppState().transformLayerGroup('site', shift(3, 0));

    expect(getAppState().mapLayers.find((l) => l.id === 'mapA')!.clip).toEqual({
      rects: [{ x: 4, y: 0, width: 2, height: 2 }],
    });
  });

  it('is one undo step that restores maps, objects and plugin layers', () => {
    getAppState().transformLayerGroup('site', shift(10, 10));

    getAppState().undo();

    expect(originOf('mapA')).toEqual([1, 0, 0]);
    expect(getAppState().customLayers.find((l) => l.id === 'wall')).toMatchObject({
      editObjects: [{ cx: 2, cy: 2 }],
    });
    expect((getAppState().customLayers.find((l) => l.id === 'generated') as PluginCustomLayer).info.origin).toEqual([
      1, 1, 0,
    ]);

    getAppState().redo();
    expect(originOf('mapA')).toEqual([11, 10, 0]);
  });

  it('refuses a move that changes nothing', () => {
    expect(getAppState().transformLayerGroup('site', shift(0, 0))).toBe(false);
    expect(getAppState().transformLayerGroup('missing', shift(1, 1))).toBe(false);
    expect(getAppState().transformLayerGroup('empty', shift(1, 1))).toBe(false);
    expect(getAppState().historyPast).toHaveLength(0);
  });

  it('marks the project as changed', () => {
    getAppState().transformLayerGroup('site', shift(1, 0));

    expect(getAppState().isDirty).toBe(true);
  });

  describe('when a map is also used outside the group', () => {
    beforeEach(() => {
      const shared = makeMap('shared', { info: { origin: [0, 0, 0] } });
      resetAppStore(
        layerStackState(makeLayerGroup('site', [shared]), {
          source: shared.source,
          layer: { ...shared.layer, id: 'sharedCopy', name: 'copy' },
        }),
      );
    });

    it('moves every instance of the map by default, so they stay aligned', () => {
      getAppState().transformLayerGroup('site', shift(2, 0), { sharedPose: 'move_all' });

      expect(originOf('shared')).toEqual([2, 0, 0]);
      expect(originOf('sharedCopy')).toEqual([2, 0, 0]);
    });

    it('can unlink the instance in the group so that only it moves', () => {
      getAppState().transformLayerGroup('site', shift(2, 0), { sharedPose: 'unlink' });

      expect(originOf('shared')).toEqual([2, 0, 0]);
      expect(getAppState().mapLayers.find((l) => l.id === 'shared')!.origin_override).toEqual([2, 0, 0]);
      expect(originOf('sharedCopy')).toEqual([0, 0, 0]);
    });

    it('undoes either way', () => {
      getAppState().transformLayerGroup('site', shift(2, 0), { sharedPose: 'unlink' });
      getAppState().undo();

      expect(getAppState().mapLayers.find((l) => l.id === 'shared')!.origin_override).toBeNull();
      expect(originOf('shared')).toEqual([0, 0, 0]);
    });
  });

  it('moves a map shared by two instances inside the group only once', () => {
    const shared = makeMap('a', { info: { origin: [0, 0, 0] } });
    resetAppStore(
      layerStackState(
        makeLayerGroup('site', [shared, { source: shared.source, layer: { ...shared.layer, id: 'b', name: 'b' } }]),
      ),
    );

    getAppState().transformLayerGroup('site', shift(1, 1));

    expect(originOf('a')).toEqual([1, 1, 0]);
    expect(originOf('b')).toEqual([1, 1, 0]);
  });

  it('moves an unlinked instance on its own', () => {
    const shared = makeMap('a', { info: { origin: [0, 0, 0] } });
    resetAppStore(
      layerStackState(
        makeLayerGroup('site', [
          { source: shared.source, layer: { ...shared.layer, id: 'b', origin_override: [4, 4, 0] } },
        ]),
        shared,
      ),
    );

    getAppState().transformLayerGroup('site', shift(1, 0));

    expect(originOf('b')).toEqual([5, 4, 0]);
    expect(originOf('a')).toEqual([0, 0, 0]);
  });
});
