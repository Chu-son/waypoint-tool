/**
 * キャンバス上のドラッグによる背景地図の位置合わせ。
 * 位置合わせは「ワールド = R(yaw)·(UTM − 原点) + (dx, dy)」の (dx, dy, yaw) で、
 * (dx, dy) は地図の原点（緯度経度/UTM で指定した地点）がワールド上で置かれる位置。
 */

import type { GeoAlignment } from '../../types/geo';

type Point = { x: number; y: number };

/** ドラッグの移動量だけ地図を平行移動する。 */
export function translateAlignment(initial: GeoAlignment, start: Point, current: Point): GeoAlignment {
  return {
    ...initial,
    dx: initial.dx + (current.x - start.x),
    dy: initial.dy + (current.y - start.y),
  };
}

const normalizeDeg = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

/**
 * 地図の原点（(dx, dy)）を軸に、ポインタが軸のまわりを回った角度だけ地図を回転する。
 * 原点の位置は動かない。
 */
export function rotateAlignmentAboutOrigin(initial: GeoAlignment, start: Point, current: Point): GeoAlignment {
  const pivot = { x: initial.dx, y: initial.dy };
  const startAngle = Math.atan2(start.y - pivot.y, start.x - pivot.x);
  const currentAngle = Math.atan2(current.y - pivot.y, current.x - pivot.x);
  const deltaDeg = ((currentAngle - startAngle) * 180) / Math.PI;
  return { ...initial, yawDeg: normalizeDeg(initial.yawDeg + deltaDeg) };
}
