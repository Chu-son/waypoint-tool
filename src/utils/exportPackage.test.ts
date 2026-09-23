import { describe, it, expect } from 'vitest';
import { buildExportPackageItems, formatSessionTimestamp } from './exportPackage';
import { resolveExportFiles } from './exportTemplateEngine';
import type { ExportRegion, ExportTargetItem, ExportTemplate } from '../types/store';

const regions: ExportRegion[] = [
  { id: 'r1', name: 'north', rect: { x: 0, y: 0, width: 10, height: 10 }, visible: true },
  { id: 'r2', name: 'south', rect: { x: 0, y: -10, width: 10, height: 10 }, visible: true },
];
const templates: ExportTemplate[] = [{ id: 't1', name: 'CSV', extension: 'csv', suffix: '', content: '{{#each}}' }];

const item = (overrides: Partial<ExportTargetItem>): ExportTargetItem => ({
  id: 'i',
  type: 'waypoint_default',
  sourceId: '__default_yaml__',
  relativePathPattern: 'wp.yaml',
  enabled: true,
  ...overrides,
});

function build(items: ExportTargetItem[], mapImageB64?: string) {
  const resolvedFiles = resolveExportFiles(items, {
    now: new Date(2026, 0, 2, 3, 4, 5),
    projectName: 'site',
    rootDir: '/out',
    availableRegions: regions.map((r) => ({ id: r.id, name: r.name })),
    templates: templates.map((t) => ({ id: t.id, name: t.name, extension: t.extension })),
    defaultFormats: [{ id: '__default_yaml__', name: 'YAML', extension: 'yaml' }],
  });
  return buildExportPackageItems({
    enabledItems: items,
    resolvedFiles,
    templates,
    regions,
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
});
