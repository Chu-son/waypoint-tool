import { describe, expect, it } from 'vitest';
import type { GeoAlignment, GeoOrigin } from '../../types/geo';
import {
  convertOrigin,
  geoToWorld,
  IDENTITY_ALIGNMENT,
  originToLatLon,
  tilePlacement,
  visibleTiles,
  worldToGeo,
} from './geoTransform';
import { latLonToTileXY, tileXYToLatLon } from './webMercator';

const ORIGIN: GeoOrigin = { kind: 'latlon', lat: 35.681236, lon: 139.767125 };

describe('geo ⇔ world transform', () => {
  it('maps the origin itself to the world origin when unaligned', () => {
    const p = geoToWorld(ORIGIN.kind === 'latlon' ? ORIGIN.lat : 0, 139.767125, ORIGIN, IDENTITY_ALIGNMENT);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo(0, 6);
  });

  it('places points east and north of the origin on +X and +Y', () => {
    const east = geoToWorld(35.681236, 139.767125 + 0.001, ORIGIN, IDENTITY_ALIGNMENT);
    const north = geoToWorld(35.681236 + 0.001, 139.767125, ORIGIN, IDENTITY_ALIGNMENT);
    expect(east.x).toBeGreaterThan(80);
    expect(Math.abs(east.y)).toBeLessThan(2); // 格子収束角ぶんのずれ
    expect(north.y).toBeGreaterThan(100);
    expect(Math.abs(north.x)).toBeLessThan(2);
  });

  it('applies the alignment offset to the map', () => {
    const alignment: GeoAlignment = { dx: 12, dy: -7, yawDeg: 0 };
    const p = geoToWorld(35.681236, 139.767125, ORIGIN, alignment);
    expect(p.x).toBeCloseTo(12, 6);
    expect(p.y).toBeCloseTo(-7, 6);
  });

  it('rotates the map counter-clockwise by the alignment yaw', () => {
    const eastOfOrigin = worldToGeo(100, 0, ORIGIN, IDENTITY_ALIGNMENT);
    const p = geoToWorld(eastOfOrigin.lat, eastOfOrigin.lon, ORIGIN, { dx: 0, dy: 0, yawDeg: 90 });
    expect(p.x).toBeCloseTo(0, 5);
    expect(p.y).toBeCloseTo(100, 5);
  });

  it.each<[string, GeoAlignment]>([
    ['identity', IDENTITY_ALIGNMENT],
    ['offset only', { dx: 30, dy: -45, yawDeg: 0 }],
    ['rotated and offset', { dx: -5, dy: 8, yawDeg: 37.5 }],
  ])('round-trips world → geo → world (%s)', (_name, alignment) => {
    const geo = worldToGeo(123.4, -56.7, ORIGIN, alignment);
    const back = geoToWorld(geo.lat, geo.lon, ORIGIN, alignment);
    expect(back.x).toBeCloseTo(123.4, 4);
    expect(back.y).toBeCloseTo(-56.7, 4);
  });

  it('gives the same world position whether the origin is written as lat/lon or UTM', () => {
    const utmOrigin = convertOrigin(ORIGIN, 'utm');
    expect(utmOrigin.kind).toBe('utm');
    const a = geoToWorld(35.6825, 139.7689, ORIGIN, IDENTITY_ALIGNMENT);
    const b = geoToWorld(35.6825, 139.7689, utmOrigin, IDENTITY_ALIGNMENT);
    expect(b.x).toBeCloseTo(a.x, 4);
    expect(b.y).toBeCloseTo(a.y, 4);
  });

  it('converting the origin type preserves the location', () => {
    const roundTrip = originToLatLon(convertOrigin(convertOrigin(ORIGIN, 'utm'), 'latlon'));
    expect(roundTrip.lat).toBeCloseTo(35.681236, 8);
    expect(roundTrip.lon).toBeCloseTo(139.767125, 8);
  });

  it('keeps working continuously across a UTM zone boundary', () => {
    // Zone 54/55 boundary is at 144°E
    const origin: GeoOrigin = { kind: 'latlon', lat: 35, lon: 143.9995 };
    const p = geoToWorld(35, 144.0005, origin, IDENTITY_ALIGNMENT);
    expect(p.x).toBeGreaterThan(80);
    expect(p.x).toBeLessThan(100);
  });
});

describe('tilePlacement', () => {
  const tileCenterGeo = (z: number, x: number, y: number) => tileXYToLatLon(x + 0.5, y + 0.5, z);

  function spritePointToWorld(
    placement: ReturnType<typeof tilePlacement>,
    u: number,
    v: number,
  ): { x: number; y: number } {
    const cos = Math.cos(placement.rotation);
    const sin = Math.sin(placement.rotation);
    const lx = placement.scaleX * u;
    const ly = placement.scaleY * v;
    return { x: placement.x + cos * lx - sin * ly, y: placement.y + sin * lx + cos * ly };
  }

  it.each<[string, GeoAlignment]>([
    ['unaligned', IDENTITY_ALIGNMENT],
    ['aligned', { dx: 20, dy: -10, yawDeg: 25 }],
  ])('puts the tile image where its geographic centre lies (%s)', (_name, alignment) => {
    const { x: tx, y: ty } = latLonToTileXY(35.682, 139.768, 17);
    const tile = { z: 17, x: Math.floor(tx), y: Math.floor(ty) };
    const placement = tilePlacement(tile, ORIGIN, alignment);

    const center = tileCenterGeo(tile.z, tile.x, tile.y);
    const expected = geoToWorld(center.lat, center.lon, ORIGIN, alignment);
    const actual = spritePointToWorld(placement, 128, 128);

    expect(actual.x).toBeCloseTo(expected.x, 1);
    expect(actual.y).toBeCloseTo(expected.y, 1);
  });

  it('draws the tile upright (north is up) when unaligned and rotated by the alignment yaw otherwise', () => {
    const tile = { z: 17, x: 116420, y: 51614 };
    const upright = tilePlacement(tile, ORIGIN, IDENTITY_ALIGNMENT);
    expect(upright.scaleY).toBeLessThan(0);
    expect(Math.abs(upright.rotation)).toBeLessThan(0.02); // 格子収束角（東京で約 0.7°）の範囲

    const rotated = tilePlacement(tile, ORIGIN, { dx: 0, dy: 0, yawDeg: 30 });
    expect((rotated.rotation * 180) / Math.PI - (upright.rotation * 180) / Math.PI).toBeCloseTo(30, 3);
  });
});

describe('visibleTiles', () => {
  const bounds = { minX: -100, maxX: 100, minY: -100, maxY: 100 };

  it('covers the tile that contains the world origin', () => {
    const tiles = visibleTiles(bounds, 2, ORIGIN, IDENTITY_ALIGNMENT, 19, 256);
    const z = tiles[0].z;
    const o = latLonToTileXY(35.681236, 139.767125, z);
    expect(tiles).toContainEqual({ z, x: Math.floor(o.x), y: Math.floor(o.y) });
  });

  it('uses finer tiles when zoomed in', () => {
    const coarse = visibleTiles(bounds, 0.5, ORIGIN, IDENTITY_ALIGNMENT, 19, 256);
    const fine = visibleTiles(bounds, 8, ORIGIN, IDENTITY_ALIGNMENT, 19, 256);
    expect(fine[0].z).toBeGreaterThan(coarse[0].z);
  });

  it('never requests more tiles than the limit', () => {
    const wide = { minX: -50000, maxX: 50000, minY: -50000, maxY: 50000 };
    expect(visibleTiles(wide, 2, ORIGIN, IDENTITY_ALIGNMENT, 19, 64).length).toBeLessThanOrEqual(64);
  });
});
