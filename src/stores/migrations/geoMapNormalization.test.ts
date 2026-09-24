import { describe, expect, it } from 'vitest';
import { DEFAULT_GEO_MAP, normalizeGeoMap } from './geoMapNormalization';
import { migrateAndNormalizeProjectData } from './projectMigration';

describe('normalizeGeoMap', () => {
  it.each([[undefined], [null], ['x'], [42], [[]]])('falls back to the defaults for %j', (raw) => {
    expect(normalizeGeoMap(raw)).toEqual(DEFAULT_GEO_MAP);
  });

  it('keeps a valid saved configuration as it is', () => {
    const saved = {
      enabled: true,
      basemapId: 'gsi_photo',
      customBasemap: { urlTemplate: 'https://t.example/{z}/{x}/{y}.png', maxZoom: 15, attribution: 'me' },
      opacity: 0.3,
      origin: { kind: 'utm', zone: 54, hemisphere: 'N', easting: 388000, northing: 3950000 },
      alignment: { dx: 1.5, dy: -2.5, yawDeg: 30 },
    };
    expect(normalizeGeoMap(saved)).toEqual(saved);
  });

  it('fills in the fields that are missing without touching the ones present', () => {
    const result = normalizeGeoMap({ enabled: true, alignment: { yawDeg: 15 } });
    expect(result.enabled).toBe(true);
    expect(result.alignment).toEqual({ dx: 0, dy: 0, yawDeg: 15 });
    expect(result.basemapId).toBe(DEFAULT_GEO_MAP.basemapId);
    expect(result.origin).toEqual(DEFAULT_GEO_MAP.origin);
  });

  it('keeps falsy-but-valid values instead of replacing them with defaults', () => {
    const result = normalizeGeoMap({ enabled: false, opacity: 0, alignment: { dx: 0, dy: 0, yawDeg: 0 } });
    expect(result.opacity).toBe(0);
    expect(result.enabled).toBe(false);
  });

  it('rejects an unknown basemap, out-of-range values and malformed origins', () => {
    expect(normalizeGeoMap({ basemapId: 'bing' }).basemapId).toBe('osm');
    expect(normalizeGeoMap({ opacity: 7 }).opacity).toBe(1);
    expect(normalizeGeoMap({ origin: { kind: 'latlon', lat: 120, lon: 0 } }).origin).toEqual(DEFAULT_GEO_MAP.origin);
    expect(normalizeGeoMap({ origin: { kind: 'utm', zone: 99, easting: 1, northing: 1 } }).origin).toEqual(
      DEFAULT_GEO_MAP.origin,
    );
    expect(normalizeGeoMap({ alignment: { dx: 'a', dy: NaN, yawDeg: Infinity } }).alignment).toEqual({
      dx: 0,
      dy: 0,
      yawDeg: 0,
    });
  });
});

describe('project files without a background map (older versions)', () => {
  it('load with the map disabled', () => {
    const migrated = migrateAndNormalizeProjectData({ version: 1, nodes: {}, root_node_ids: [] });
    expect(migrated.geo_map).toEqual(DEFAULT_GEO_MAP);
    expect(migrated.geo_map.enabled).toBe(false);
  });

  it('load a version 0 project with the map disabled', () => {
    const migrated = migrateAndNormalizeProjectData({ nodes: {}, root_node_ids: [] });
    expect(migrated.geo_map).toEqual(DEFAULT_GEO_MAP);
  });
});
