/**
 * 緯度経度 ⇔ ワールド座標（m, X 右 / Y 上）の変換。
 *
 * ワールド座標 = R(yaw) · (UTM − UTM原点) + (dx, dy)
 * UTM は原点と同じ帯に固定して計算するため、帯をまたいでも連続に扱える。
 * 回転行列は ROS マップ原点の剛体変換（ARCHITECTURE §5.3）と同じ向き（反時計回りが正）。
 */

import type { GeoAlignment, GeoOrigin, TileCoord, TilePlacement } from '../../types/geo';
import { latLonToUtm, utmToLatLon, type UtmCoord } from './utm';
import { chooseZoom, latLonToTileXY, tilesInRange, tileXYToLatLon, TILE_SIZE } from './webMercator';

const DEG = Math.PI / 180;

export const DEFAULT_GEO_ORIGIN: GeoOrigin = { kind: 'latlon', lat: 35.681236, lon: 139.767125 };
export const IDENTITY_ALIGNMENT: GeoAlignment = { dx: 0, dy: 0, yawDeg: 0 };

export function originToUtm(origin: GeoOrigin): UtmCoord {
  if (origin.kind === 'utm') {
    return {
      zone: origin.zone,
      hemisphere: origin.hemisphere,
      easting: origin.easting,
      northing: origin.northing,
    };
  }
  return latLonToUtm(origin.lat, origin.lon);
}

export function originToLatLon(origin: GeoOrigin): { lat: number; lon: number } {
  return origin.kind === 'latlon' ? { lat: origin.lat, lon: origin.lon } : utmToLatLon(originToUtm(origin));
}

/** 原点の指定方式を切り替える。指す地点は変えない。 */
export function convertOrigin(origin: GeoOrigin, kind: GeoOrigin['kind']): GeoOrigin {
  if (origin.kind === kind) return origin;
  if (kind === 'utm') return { kind: 'utm', ...originToUtm(origin) };
  return { kind: 'latlon', ...utmToLatLon(originToUtm(origin)) };
}

export function geoToWorld(
  lat: number,
  lon: number,
  origin: GeoOrigin,
  alignment: GeoAlignment,
): { x: number; y: number } {
  const o = originToUtm(origin);
  const p = latLonToUtm(lat, lon, o.zone, o.hemisphere);
  const dE = p.easting - o.easting;
  const dN = p.northing - o.northing;
  const yaw = alignment.yawDeg * DEG;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return {
    x: cos * dE - sin * dN + alignment.dx,
    y: sin * dE + cos * dN + alignment.dy,
  };
}

export function worldToGeo(
  x: number,
  y: number,
  origin: GeoOrigin,
  alignment: GeoAlignment,
): { lat: number; lon: number } {
  const o = originToUtm(origin);
  const yaw = alignment.yawDeg * DEG;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const rx = x - alignment.dx;
  const ry = y - alignment.dy;
  return utmToLatLon({
    zone: o.zone,
    hemisphere: o.hemisphere,
    easting: o.easting + cos * rx + sin * ry,
    northing: o.northing - sin * rx + cos * ry,
  });
}

/**
 * タイルの左上・右上・左下の 3 隅をワールド座標へ写し、Sprite の配置（位置・回転・スケール）を求める。
 * Web Mercator と UTM はどちらも等角なので、タイル 1 枚の範囲では相似変換として扱える。
 * Y 軸は Pixi 側（テクスチャは下向きが +v）に合わせて符号を反転して返す。
 */
export function tilePlacement(tile: TileCoord, origin: GeoOrigin, alignment: GeoAlignment): TilePlacement {
  const corner = (dx: number, dy: number) => {
    const { lat, lon } = tileXYToLatLon(tile.x + dx, tile.y + dy, tile.z);
    return geoToWorld(lat, lon, origin, alignment);
  };
  const tl = corner(0, 0);
  const tr = corner(1, 0);
  const bl = corner(0, 1);
  const ax = (tr.x - tl.x) / TILE_SIZE;
  const ay = (tr.y - tl.y) / TILE_SIZE;
  const bx = (bl.x - tl.x) / TILE_SIZE;
  const by = (bl.y - tl.y) / TILE_SIZE;
  return {
    x: tl.x,
    y: tl.y,
    rotation: Math.atan2(ay, ax),
    scaleX: Math.hypot(ax, ay),
    scaleY: -Math.hypot(bx, by),
  };
}

export interface WorldBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** 表示中のワールド範囲（の四隅）に掛かるタイルを、画面解像度に合ったズームで列挙する。 */
export function visibleTiles(
  bounds: WorldBounds,
  scale: number,
  origin: GeoOrigin,
  alignment: GeoAlignment,
  maxZoom: number,
  limit: number,
): TileCoord[] {
  const center = worldToGeo((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2, origin, alignment);
  const z = chooseZoom(scale, center.lat, maxZoom);

  const corners = [
    [bounds.minX, bounds.minY],
    [bounds.maxX, bounds.minY],
    [bounds.minX, bounds.maxY],
    [bounds.maxX, bounds.maxY],
  ].map(([x, y]) => {
    const g = worldToGeo(x, y, origin, alignment);
    return latLonToTileXY(g.lat, g.lon, z);
  });

  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  return tilesInRange(z, Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys), limit);
}
