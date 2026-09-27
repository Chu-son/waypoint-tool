import { describe, it, expect } from 'vitest';
import { prepareLayersForExport, getEditLayerBoundingBox } from './mapRasterize';
import { layerStackState, makeManualCustomLayer, makeMap } from '../test/fixtures';
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

    const reordered = { ...stack, layerOrder: ['map-2', 'map-1'] };
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
