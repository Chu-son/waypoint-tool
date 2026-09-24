/** Web Mercator (EPSG:3857) の XYZ タイル座標と緯度経度の変換。 */

import type { TileCoord } from '../../types/geo';

export const TILE_SIZE = 256;
const EARTH_CIRCUMFERENCE = 40075016.68557849;
/** Web Mercator が扱える緯度の上限。 */
export const MAX_MERCATOR_LAT = 85.0511287798;

const DEG = Math.PI / 180;

export function clampLat(lat: number): number {
  return Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat));
}

/** 緯度経度 → ズーム z における小数タイル座標。 */
export function latLonToTileXY(lat: number, lon: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const phi = clampLat(lat) * DEG;
  return {
    x: ((lon + 180) / 360) * n,
    y: ((1 - Math.asinh(Math.tan(phi)) / Math.PI) / 2) * n,
  };
}

/** 小数タイル座標 → 緯度経度。 */
export function tileXYToLatLon(x: number, y: number, z: number): { lat: number; lon: number } {
  const n = 2 ** z;
  return {
    lat: Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) / DEG,
    lon: (x / n) * 360 - 180,
  };
}

/** ズーム z・緯度 lat でタイル 1px が表す実距離 [m]。 */
export function metersPerTilePixel(lat: number, z: number): number {
  return (EARTH_CIRCUMFERENCE * Math.cos(clampLat(lat) * DEG)) / (TILE_SIZE * 2 ** z);
}

/**
 * 画面 1px が表す実距離 (1/scale [m]) にタイルの解像度が最も近くなるズームを選ぶ。
 * `scale` は画面 px / m。
 */
export function chooseZoom(scale: number, lat: number, maxZoom: number): number {
  if (!(scale > 0)) return 0;
  const cosLat = Math.max(Math.cos(clampLat(lat) * DEG), 1e-6);
  const z = Math.round(Math.log2((EARTH_CIRCUMFERENCE * cosLat * scale) / TILE_SIZE));
  return Math.max(0, Math.min(maxZoom, z));
}

/** 小数タイル座標の範囲に掛かるタイルを列挙する。経度方向は折り返さず範囲内に収める。 */
export function tilesInRange(
  z: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  limit: number,
): TileCoord[] {
  const n = 2 ** z;
  const x0 = Math.max(0, Math.floor(minX));
  const x1 = Math.min(n - 1, Math.floor(maxX));
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(n - 1, Math.floor(maxY));
  const tiles: TileCoord[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (tiles.length >= limit) return tiles;
      tiles.push({ z, x, y });
    }
  }
  return tiles;
}
