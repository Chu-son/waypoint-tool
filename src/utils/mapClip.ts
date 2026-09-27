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

export function rectContains(rect: ClipRect, x: number, y: number): boolean {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
}

/** Whether a world point is inside the clip. No clip means the whole map. */
export function clipContains(clip: MapLayerClip | null, x: number, y: number): boolean {
  if (!clip) return true;
  return clip.rects.some((rect) => rectContains(rect, x, y));
}
