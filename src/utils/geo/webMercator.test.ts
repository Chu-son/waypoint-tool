import { describe, expect, it } from 'vitest';
import { chooseZoom, latLonToTileXY, metersPerTilePixel, tilesInRange, tileXYToLatLon } from './webMercator';

describe('web mercator tiles', () => {
  it('maps (0, 0) to the centre of the world tile grid', () => {
    expect(latLonToTileXY(0, 0, 1)).toEqual({ x: 1, y: 1 });
  });

  it('gives the well-known tile for central Tokyo at zoom 15', () => {
    const { x, y } = latLonToTileXY(35.681236, 139.767125, 15);
    expect([Math.floor(x), Math.floor(y)]).toEqual([29105, 12903]);
  });

  it('round-trips lat/lon through fractional tile coordinates', () => {
    const { x, y } = latLonToTileXY(48.8584, 2.2945, 17);
    const back = tileXYToLatLon(x, y, 17);
    expect(back.lat).toBeCloseTo(48.8584, 9);
    expect(back.lon).toBeCloseTo(2.2945, 9);
  });

  it('reports ~156543 m per pixel at zoom 0 on the equator and shrinks with latitude', () => {
    expect(metersPerTilePixel(0, 0)).toBeCloseTo(156543.034, 2);
    expect(metersPerTilePixel(60, 0)).toBeCloseTo(78271.517, 2);
  });

  describe('chooseZoom', () => {
    it('selects a tile resolution close to the screen resolution', () => {
      // 1 screen px = 1 m near the equator → about zoom 17 (1.19 m/px)
      const z = chooseZoom(1, 0, 19);
      expect(z).toBe(17);
      expect(metersPerTilePixel(0, z)).toBeCloseTo(1, 0);
    });

    it('zooms in as the view zooms in and never exceeds the source maximum', () => {
      expect(chooseZoom(10, 35, 19)).toBeGreaterThan(chooseZoom(1, 35, 19));
      expect(chooseZoom(10000, 35, 18)).toBe(18);
    });

    it('never goes below zoom 0', () => {
      expect(chooseZoom(1e-9, 35, 19)).toBe(0);
    });
  });

  describe('tilesInRange', () => {
    it('lists every tile touched by the range', () => {
      const tiles = tilesInRange(3, 2.2, 3.7, 4.1, 5.5, 100);
      expect(tiles).toHaveLength(4);
      expect(tiles).toContainEqual({ z: 3, x: 2, y: 4 });
      expect(tiles).toContainEqual({ z: 3, x: 3, y: 5 });
    });

    it('stays within the world grid', () => {
      const tiles = tilesInRange(1, -5, 5, -5, 5, 100);
      expect(tiles).toHaveLength(4);
    });

    it('caps the number of tiles', () => {
      expect(tilesInRange(10, 0, 500, 0, 500, 256)).toHaveLength(256);
    });
  });
});
