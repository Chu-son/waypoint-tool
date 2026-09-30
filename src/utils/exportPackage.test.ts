import { describe, it, expect } from 'vitest';
import { buildExportPackageItems, findMapVisibilityProblems, formatSessionTimestamp } from './exportPackage';
import { resolveExportFiles } from './exportTemplateEngine';
import { layerStackState, makeManualCustomLayer, makeMap } from '../test/fixtures';
import type { ExportRegion, ExportTargetItem, ExportTemplate, LayerVisibilitySet } from '../types/store';

const regions: ExportRegion[] = [
  { id: 'r1', name: 'north', rect: { x: 0, y: 0, width: 10, height: 10 }, visible: true },
  { id: 'r2', name: 'south', rect: { x: 0, y: -10, width: 10, height: 10 }, visible: true },
];
const templates: ExportTemplate[] = [
  { id: 't1', name: 'CSV', extension: 'csv', suffix: '', content: '{{#each}}' },
  {
    id: 't2',
    name: 'YAML (Jinja)',
    extension: 'yaml',
    suffix: '',
    content: '{% for wp in waypoints %}',
    engine: 'jinja',
  },
];

const item = (overrides: Partial<ExportTargetItem>): ExportTargetItem => ({
  id: 'i',
  type: 'waypoint_default',
  sourceId: '__default_yaml__',
  relativePathPattern: 'wp.yaml',
  enabled: true,
  ...overrides,
});

function build(
  items: ExportTargetItem[],
  mapImageB64?: string,
  layers: { sets?: LayerVisibilitySet[]; stack?: ReturnType<typeof layerStackState> } = {},
) {
  const sets = layers.sets ?? [];
  const resolvedFiles = resolveExportFiles(items, {
    now: new Date(2026, 0, 2, 3, 4, 5),
    projectName: 'site',
    rootDir: '/out',
    availableRegions: regions.map((r) => ({ id: r.id, name: r.name })),
    availableVisibilitySets: sets,
    templates: templates.map((t) => ({ id: t.id, name: t.name, extension: t.extension })),
    defaultFormats: [{ id: '__default_yaml__', name: 'YAML', extension: 'yaml' }],
  });
  return buildExportPackageItems({
    enabledItems: items,
    resolvedFiles,
    templates,
    regions,
    visibilitySets: sets,
    layerStack: layers.stack ?? layerStackState(),
    waypoints: [{ index: 0 }],
    mapLayers: [],
    mapImageB64,
  });
}

describe('formatSessionTimestamp', () => {
  it('formats local time as YYYYMMDD_HHmmss', () => {
    expect(formatSessionTimestamp(new Date(2026, 0, 2, 3, 4, 5))).toBe('20260102_030405');
  });
});

describe('buildExportPackageItems', () => {
  it('writes waypoint files, with the template content for template items', () => {
    const { waypointItems } = build([
      item({ id: 'a' }),
      item({ id: 'b', type: 'waypoint_template', sourceId: 't1', relativePathPattern: 'wp.csv' }),
    ]);

    expect(waypointItems).toEqual([
      { path: '/out/wp.yaml', waypoints: [{ index: 0 }], template: undefined, image_data_b64: undefined },
      { path: '/out/wp.csv', waypoints: [{ index: 0 }], template: '{{#each}}', image_data_b64: undefined },
    ]);
  });

  it("carries the matched template's engine through to the waypoint item, and leaves it undefined for the default format", () => {
    const { waypointItems } = build([
      item({ id: 'a' }),
      item({ id: 'b', type: 'waypoint_template', sourceId: 't2', relativePathPattern: 'wp2.yaml' }),
    ]);

    expect(waypointItems[0].engine).toBeUndefined();
    expect(waypointItems[1].engine).toBe('jinja');
  });

  it('attaches the map screenshot only to items that ask for it', () => {
    const { waypointItems } = build(
      [item({ id: 'a', includeMapImage: true }), item({ id: 'b', relativePathPattern: 'b.yaml' })],
      'IMG',
    );
    expect(waypointItems.map((w) => w.image_data_b64)).toEqual(['IMG', undefined]);
  });

  it('exports one map per region for "all regions" items, without the image extension', () => {
    const { mapItems } = build([
      item({ id: 'm', type: 'map_all_regions', sourceId: 'all', relativePathPattern: 'Map/{{name}}.pgm' }),
    ]);

    expect(mapItems.map((m) => [m.save_path, m.region.name, m.format])).toEqual([
      ['/out/Map/north', 'north', 'ros_standard'],
      ['/out/Map/south', 'south', 'ros_standard'],
    ]);
  });

  it('exports a single region and skips unknown regions', () => {
    const { mapItems } = build([
      item({ id: 'm1', type: 'map_region', sourceId: 'r2', relativePathPattern: 'south.png', mapFormat: 'png_only' }),
      item({ id: 'm2', type: 'map_region', sourceId: 'missing', relativePathPattern: 'x.pgm' }),
    ]);

    expect(mapItems).toHaveLength(1);
    expect(mapItems[0]).toMatchObject({ save_path: '/out/south', format: 'png_only', region: { name: 'south' } });
  });

  describe('with layer visibility sets', () => {
    const stack = layerStackState(
      makeMap('map'),
      makeManualCustomLayer('keepout'),
      makeManualCustomLayer('draft', { visible: false }),
    );
    const localization: LayerVisibilitySet = {
      id: 'loc',
      name: 'Localization',
      visibility: { map: true, keepout: false, draft: false },
    };
    const navigation: LayerVisibilitySet = {
      id: 'nav',
      name: 'Navigation',
      visibility: { map: true, keepout: true, draft: false },
    };
    const mapItem = (overrides: Partial<ExportTargetItem>) =>
      item({ type: 'map_region', sourceId: 'r1', relativePathPattern: 'Map/{{name}}_{{set}}.pgm', ...overrides });

    it('exports the same region once per set, each drawing only that set’s layers', () => {
      const { mapItems } = build(
        [mapItem({ id: 'a', visibilitySetId: 'loc' }), mapItem({ id: 'b', visibilitySetId: 'nav' })],
        undefined,
        { sets: [localization, navigation], stack },
      );

      expect(mapItems.map((m) => [m.save_path, m.region.name, m.region.layerVisibility])).toEqual([
        ['/out/Map/north_Localization', 'north', { map: true, keepout: false, draft: false }],
        ['/out/Map/north_Navigation', 'north', { map: true, keepout: true, draft: false }],
      ]);
    });

    it('draws the layers shown now for an item that names no set', () => {
      const { mapItems } = build([mapItem({ id: 'a' })], undefined, { sets: [localization], stack });

      expect(mapItems[0].save_path).toBe('/out/Map/north_current');
      expect(mapItems[0].region.layerVisibility).toEqual({ map: true, keepout: true, draft: false });
    });

    it('draws a layer the set has no entry for as it is shown now', () => {
      const partial: LayerVisibilitySet = { id: 'p', name: 'Partial', visibility: { map: true } };

      const { mapItems } = build([mapItem({ id: 'a', visibilitySetId: 'p' })], undefined, { sets: [partial], stack });

      expect(mapItems[0].region.layerVisibility).toEqual({ map: true, keepout: true, draft: false });
    });
  });
});

describe('findMapVisibilityProblems', () => {
  const stack = layerStackState(makeMap('map'), makeManualCustomLayer('keepout'));
  const mapItem = (overrides: Partial<ExportTargetItem>) =>
    item({ type: 'map_region', sourceId: 'r1', relativePathPattern: 'north.pgm', ...overrides });
  const partial: LayerVisibilitySet = { id: 'p', name: 'Partial', visibility: { map: true } };

  it('finds nothing to report for items on the current display or on a set that covers every layer', () => {
    const full: LayerVisibilitySet = { id: 'f', name: 'Full', visibility: { map: true, keepout: false } };

    expect(
      findMapVisibilityProblems([mapItem({ id: 'a' }), mapItem({ id: 'b', visibilitySetId: 'f' })], [full], stack),
    ).toEqual({ missingSetPatterns: [], undecided: [] });
  });

  it('reports a deleted set by the path of the item that used it', () => {
    const problems = findMapVisibilityProblems(
      [mapItem({ id: 'a', visibilitySetId: 'gone', relativePathPattern: 'Map/a.pgm' })],
      [],
      stack,
    );

    expect(problems.missingSetPatterns).toEqual(['Map/a.pgm']);
  });

  it('reports the layers a set does not cover once per set, and not for reference layers', () => {
    const withReference = layerStackState(
      makeMap('map'),
      makeManualCustomLayer('keepout'),
      makeManualCustomLayer('guide', { is_reference: true }),
    );

    const problems = findMapVisibilityProblems(
      [mapItem({ id: 'a', visibilitySetId: 'p' }), mapItem({ id: 'b', visibilitySetId: 'p' })],
      [partial],
      withReference,
    );

    expect(problems.undecided).toEqual([{ setName: 'Partial', count: 1 }]);
  });

  it('does not look at waypoint items', () => {
    const problems = findMapVisibilityProblems([item({ id: 'w', visibilitySetId: 'gone' })], [], stack);

    expect(problems).toEqual({ missingSetPatterns: [], undecided: [] });
  });
});
