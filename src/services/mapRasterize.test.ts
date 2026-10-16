import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prepareLayersForExport, getEditLayerBoundingBox, createRasterCache } from './mapRasterize';
import { layerStackState, makeLayerGroup, makeManualCustomLayer, makeMap } from '../test/fixtures';
import type { PluginCustomLayer } from '../types/store';

const pluginLayer = (id: string, overrides: Partial<PluginCustomLayer> = {}): PluginCustomLayer => ({
  id,
  name: id,
  type: 'plugin',
  plugin_id: 'test',
  params: {},
  image_base64: `data:image/png;base64,${id}`,
  info: { resolution: 0.05, origin: [0, 0, 0], width: 100, height: 100 },
  visible: true,
  opacity: 1,
  ...overrides,
});

/** Ids of the prepared layers from the bottom of the stack to the top. */
const bottomToTop = async (stack: ReturnType<typeof layerStackState>) =>
  (await prepareLayersForExport(stack)).sort((a, b) => a.z_index - b.z_index).map((l) => l.id);

describe('prepareLayersForExport', () => {
  it('orders layers so that the top of the stack is blended last', async () => {
    const stack = layerStackState(
      makeMap('map-top', { image_base64: 'data:image/png;base64,top' }),
      makeMap('map-bottom', { image_base64: 'data:image/png;base64,bottom' }),
    );

    expect(await bottomToTop(stack)).toEqual(['map-bottom', 'map-top']);
  });

  it('follows a reordered stack', async () => {
    const stack = layerStackState(makeMap('map-1'), makeMap('map-2'));
    expect(await bottomToTop(stack)).toEqual(['map-2', 'map-1']);

    const reordered = { ...stack, rootLayerIds: ['map-2', 'map-1'] };
    expect(await bottomToTop(reordered)).toEqual(['map-1', 'map-2']);
  });

  it('blends a custom layer that sits between two maps above the lower map and below the upper one', async () => {
    const stack = layerStackState(
      makeMap('map-top', { image_base64: 'data:image/png;base64,top' }),
      pluginLayer('between'),
      makeMap('map-bottom', { image_base64: 'data:image/png;base64,bottom' }),
    );

    expect(await bottomToTop(stack)).toEqual(['map-bottom', 'between', 'map-top']);
  });

  it('skips hidden layers and reference layers', async () => {
    const stack = layerStackState(
      makeMap('shown'),
      makeMap('hidden', { visible: false }),
      pluginLayer('reference', { is_reference: true }),
      pluginLayer('hidden-plugin', { visible: false }),
    );

    expect(await bottomToTop(stack)).toEqual(['shown']);
  });

  it('gives every copy of a map its own clip while they share the same image', async () => {
    const shared = makeMap('left', { image_base64: 'data:image/png;base64,shared' });
    const right = makeMap('right', { image_base64: 'data:image/png;base64,shared' });
    const stack = layerStackState(
      { source: shared.source, layer: { ...shared.layer, clip: { rects: [{ x: 0, y: 0, width: 2, height: 5 }] } } },
      {
        source: shared.source,
        layer: { ...right.layer, sourceId: shared.source.id, clip: { rects: [{ x: 2, y: 0, width: 3, height: 5 }] } },
      },
    );

    const prepared = await prepareLayersForExport(stack);

    expect(prepared.map((l) => l.image_base64)).toEqual([
      'data:image/png;base64,shared',
      'data:image/png;base64,shared',
    ]);
    expect(prepared.find((l) => l.id === 'left')?.clip).toEqual({ rects: [{ x: 0, y: 0, width: 2, height: 5 }] });
    expect(prepared.find((l) => l.id === 'right')?.clip).toEqual({ rects: [{ x: 2, y: 0, width: 3, height: 5 }] });
  });

  it('uses the pose shared by all copies of a map', async () => {
    const map = makeMap('m', { info: { resolution: 0.05, origin: [1, 2, 0.5] } });
    const stack = layerStackState(map);

    const [prepared] = await prepareLayersForExport(stack);

    expect(prepared.info.origin).toEqual([1, 2, 0.5]);
  });
});

describe('getEditLayerBoundingBox', () => {
  it('calculates bounding box correctly for line edit objects', () => {
    const editLayer = makeManualCustomLayer('manual-1', {
      name: 'Manual Layer',
      editObjects: [
        {
          id: 'line-1',
          type: 'line',
          x1: 2.0,
          y1: 3.0,
          x2: 8.0,
          y2: 7.0,
          fillValue: 0,
          lineWidth: 0.2,
        },
      ],
    });

    const bbox = getEditLayerBoundingBox(editLayer);
    expect(bbox.minX).toBeLessThanOrEqual(2.0);
    expect(bbox.maxX).toBeGreaterThanOrEqual(8.0);
    expect(bbox.minY).toBeLessThanOrEqual(3.0);
    expect(bbox.maxY).toBeGreaterThanOrEqual(7.0);
  });
});

describe('prepareLayersForExport with a raster cache', () => {
  const rect = (id: string, cx: number) =>
    ({ id, type: 'rect', cx, cy: 0, width: 1, height: 1, angle: 0, fillValue: 0 }) as const;

  /** jsdom has no canvas: stand in for the drawing surface and give every picture a number of its own. */
  let pictures = 0;
  beforeEach(() => {
    pictures = 0;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      new Proxy({}, { get: () => () => {}, set: () => true }) as never,
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(
      () => `data:image/png;base64,picture-${++pictures}`,
    );
  });

  const stackOf = (...layers: ReturnType<typeof makeManualCustomLayer>[]) => layerStackState(makeMap('map'), ...layers);
  const pictureOf = async (
    stack: ReturnType<typeof layerStackState>,
    id: string,
    options?: Parameters<typeof prepareLayersForExport>[1],
  ) => (await prepareLayersForExport(stack, options)).find((l) => l.id === id)?.image_base64;

  it('leaves out layers inside a hidden group, and prepares them when hidden layers are asked for', async () => {
    const stack = layerStackState(
      makeMap('shown'),
      makeLayerGroup('off', [makeMap('in-group'), makeManualCustomLayer('drawing', { editObjects: [rect('r', 0)] })], {
        visible: false,
      }),
    );

    expect(await bottomToTop(stack)).toEqual(['shown']);
    const all = await prepareLayersForExport(stack, { includeHidden: true });
    expect(all.map((l) => l.id).sort()).toEqual(['drawing', 'in-group', 'shown']);
  });

  it('prepares a hidden hand-drawn layer when hidden layers are asked for (an export set may show it)', async () => {
    const stack = stackOf(makeManualCustomLayer('drawing', { visible: false, editObjects: [rect('r', 0)] }));

    expect(await pictureOf(stack, 'drawing')).toBeUndefined();
    expect(await pictureOf(stack, 'drawing', { includeHidden: true })).toMatch(/^data:image\/png/);
  });

  it('draws a custom layer every time without a cache', async () => {
    const stack = stackOf(makeManualCustomLayer('drawing', { editObjects: [rect('r', 0)] }));

    const first = await pictureOf(stack, 'drawing');
    const second = await pictureOf(stack, 'drawing');

    expect(second).not.toBe(first);
  });

  it('reuses the picture of a layer that did not change', async () => {
    const cache = createRasterCache();
    const stack = stackOf(makeManualCustomLayer('drawing', { editObjects: [rect('r', 0)] }));

    const first = await pictureOf(stack, 'drawing', { rasterCache: cache });
    const second = await pictureOf(stack, 'drawing', { rasterCache: cache });

    expect(second).toBe(first);
  });

  it('draws a layer again once its objects change, and only that layer', async () => {
    const cache = createRasterCache();
    const untouched = makeManualCustomLayer('untouched', { editObjects: [rect('a', 0)] });
    const edited = makeManualCustomLayer('edited', { editObjects: [rect('b', 0)] });
    const before = stackOf(untouched, edited);
    const untouchedBefore = await pictureOf(before, 'untouched', { rasterCache: cache });
    const editedBefore = await pictureOf(before, 'edited', { rasterCache: cache });

    // The store replaces the objects array on every edit.
    const after = stackOf(untouched, { ...edited, editObjects: [rect('b', 3)] });

    expect(await pictureOf(after, 'untouched', { rasterCache: cache })).toBe(untouchedBefore);
    expect(await pictureOf(after, 'edited', { rasterCache: cache })).not.toBe(editedBefore);
  });

  it('keeps the new name and blend mode of a layer whose picture is reused', async () => {
    const cache = createRasterCache();
    const objects = [rect('r', 0)];
    const stack = stackOf(makeManualCustomLayer('drawing', { name: 'Old', editObjects: objects }));
    await prepareLayersForExport(stack, { rasterCache: cache });

    const renamed = stackOf(
      makeManualCustomLayer('drawing', { name: 'New name', blend_mode: 'merge_obstacles', editObjects: objects }),
    );
    const layer = (await prepareLayersForExport(renamed, { rasterCache: cache })).find((l) => l.id === 'drawing');

    expect(layer?.name).toBe('New name');
    expect(layer?.blend_mode).toBe('merge_obstacles');
    expect(layer?.info.image).toBe('new_name.png');
    expect(pictures).toBe(1);
  });

  it('draws a layer again when the resolution of the base map changes', async () => {
    const cache = createRasterCache();
    const objects = [rect('r', 0)];
    const layer = makeManualCustomLayer('drawing', { editObjects: objects });
    const coarse = layerStackState(makeMap('map', { info: { resolution: 0.1 } }), layer);
    const fine = layerStackState(makeMap('map', { info: { resolution: 0.05 } }), layer);

    const first = await pictureOf(coarse, 'drawing', { rasterCache: cache });
    const second = await pictureOf(fine, 'drawing', { rasterCache: cache });

    expect(second).not.toBe(first);
  });

  it('forgets the pictures of layers that were removed', async () => {
    const cache = createRasterCache();
    const objects = [rect('r', 0)];
    const withLayer = stackOf(makeManualCustomLayer('drawing', { editObjects: objects }));
    const first = await pictureOf(withLayer, 'drawing', { rasterCache: cache });

    await prepareLayersForExport(stackOf(), { rasterCache: cache });
    // The same layer comes back (an undo): the cache must not hand out the picture it had before.
    const second = await pictureOf(withLayer, 'drawing', { rasterCache: cache });

    expect(second).not.toBe(first);
  });
});
