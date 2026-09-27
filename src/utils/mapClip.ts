/**
 * Pure geometry for the per-instance map clip (the part of a map that takes part in blending).
 * Rectangles are in world meters and half-open, so two clips that share an edge neither overlap nor
 * leave a gap.
 */
import type { ClipRect, MapLayerClip, ResolvedMapLayer } from '../types/layer';

export type ClipSide = 'left' | 'right' | 'top' | 'bottom';

export type WorldBounds = { minX: number; minY: number; maxX: number; maxY: number };

/** World-space bounding box of a map, respecting its origin yaw. */
export function mapWorldBounds(layer: Pick<ResolvedMapLayer, 'info' | 'width' | 'height'>): WorldBounds {
  const resolution = layer.info?.resolution || 0.05;
  const [originX = 0, originY = 0, yaw = 0] = layer.info?.origin || [];
  const w = (layer.info?.width || layer.width) * resolution;
  const h = (layer.info?.height || layer.height) * resolution;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [cx, cy] of [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ]) {
    xs.push(originX + cx * cos - cy * sin);
    ys.push(originY + cx * sin + cy * cos);
  }
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

export function boundsToRect(bounds: WorldBounds): ClipRect {
  return {
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
  };
}

/** The given half of `bounds` as a rectangle (e.g. `'right'` is the right half in world X). */
export function halfOfBounds(bounds: WorldBounds, side: ClipSide): ClipRect {
  const full = boundsToRect(bounds);
  const halfW = full.width / 2;
  const halfH = full.height / 2;
  switch (side) {
    case 'left':
      return { ...full, width: halfW };
    case 'right':
      return { ...full, x: full.x + halfW, width: halfW };
    case 'bottom':
      return { ...full, height: halfH };
    case 'top':
      return { ...full, y: full.y + halfH, height: halfH };
  }
}

/**
 * Which edges a resize handle moves: `-1` the minimum edge of that axis, `+1` the maximum edge, `0`
 * leaves the axis alone. Corners move one edge on each axis. World Y points up, so `hy: +1` is the top.
 */
export type ClipHandle = { hx: -1 | 0 | 1; hy: -1 | 0 | 1 };

/** The eight resize handles of a rectangle. */
export const CLIP_HANDLES: readonly ClipHandle[] = [
  { hx: -1, hy: 1 },
  { hx: 0, hy: 1 },
  { hx: 1, hy: 1 },
  { hx: 1, hy: 0 },
  { hx: 1, hy: -1 },
  { hx: 0, hy: -1 },
  { hx: -1, hy: -1 },
  { hx: -1, hy: 0 },
];

/** The rectangle spanned by two opposite corners, whichever direction the drag went. */
export function rectFromCorners(a: { x: number; y: number }, b: { x: number; y: number }): ClipRect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

/** Position of a handle on its rectangle. */
export function handlePosition(rect: ClipRect, handle: ClipHandle): { x: number; y: number } {
  return {
    x: rect.x + ((handle.hx + 1) / 2) * rect.width,
    y: rect.y + ((handle.hy + 1) / 2) * rect.height,
  };
}

/**
 * The rectangle after dragging `handle` to `point`. Edges the handle does not touch stay put, and
 * dragging past the opposite edge flips the rectangle instead of producing a negative size.
 */
export function resizeRect(rect: ClipRect, handle: ClipHandle, point: { x: number; y: number }): ClipRect {
  const minX = rect.x;
  const maxX = rect.x + rect.width;
  const minY = rect.y;
  const maxY = rect.y + rect.height;
  const [x0, x1] = handle.hx === 0 ? [minX, maxX] : handle.hx < 0 ? [point.x, maxX] : [minX, point.x];
  const [y0, y1] = handle.hy === 0 ? [minY, maxY] : handle.hy < 0 ? [point.y, maxY] : [minY, point.y];
  return rectFromCorners({ x: x0, y: y0 }, { x: x1, y: y1 });
}

export function sameClip(a: MapLayerClip | null, b: MapLayerClip | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.rects.length === b.rects.length &&
    a.rects.every((r, i) => {
      const o = b.rects[i];
      return r.x === o.x && r.y === o.y && r.width === o.width && r.height === o.height;
    })
  );
}

export function rectContains(rect: ClipRect, x: number, y: number): boolean {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
}

/** Whether a world point is inside the clip. No clip means the whole map. */
export function clipContains(clip: MapLayerClip | null, x: number, y: number): boolean {
  if (!clip) return true;
  return clip.rects.some((rect) => rectContains(rect, x, y));
}
