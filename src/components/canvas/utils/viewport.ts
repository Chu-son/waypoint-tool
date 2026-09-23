/**
 * Pure viewport math for MapCanvas.
 *
 * The world container is drawn at screen offset (position + VIEWPORT_ORIGIN_OFFSET) with a
 * Y-inverted scale, so:
 *   screenX = worldX * scale + position.x + 400
 *   screenY = -worldY * scale + position.y + 400
 */
import type { ProjectMapLayer } from '../../../types/store';

export const VIEWPORT_ORIGIN_OFFSET = 400;
export const MIN_SCALE = 0.01;
export const MAX_SCALE = 500;

export type Viewport = { scale: number; position: { x: number; y: number } };
export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

export const clampScale = (scale: number) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));

export function screenToWorld(screenX: number, screenY: number, { scale, position }: Viewport) {
  return {
    x: (screenX - (position.x + VIEWPORT_ORIGIN_OFFSET)) / scale,
    y: (position.y + VIEWPORT_ORIGIN_OFFSET - screenY) / scale,
  };
}

/** World-space bounding box of map layers (respecting their origin yaw) and extra points. */
export function contentBounds(mapLayers: ProjectMapLayer[], points: Array<{ x: number; y: number }>): Bounds | null {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  const include = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  for (const layer of mapLayers) {
    const width = layer.info?.width || layer.width;
    const height = layer.info?.height || layer.height;
    const resolution = layer.info?.resolution || 0.05;
    const [originX = 0, originY = 0, originYaw = 0] = layer.info?.origin || [];
    const w = (width || 1000) * resolution;
    const h = (height || 1000) * resolution;
    const cos = Math.cos(originYaw);
    const sin = Math.sin(originYaw);
    for (const [cx, cy] of [
      [0, 0],
      [w, 0],
      [w, h],
      [0, h],
    ]) {
      include(originX + cx * cos - cy * sin, originY + cx * sin + cy * cos);
    }
  }
  for (const p of points) include(p.x, p.y);

  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

/** Viewport that shows `bounds` (plus 10% / at least 1 m padding) centred in a screen of the given size. */
export function fitViewport(bounds: Bounds, screenW: number, screenH: number): Viewport | null {
  const paddingX = Math.max((bounds.maxX - bounds.minX) * 0.1, 1.0);
  const paddingY = Math.max((bounds.maxY - bounds.minY) * 0.1, 1.0);
  const minX = bounds.minX - paddingX;
  const maxX = bounds.maxX + paddingX;
  const minY = bounds.minY - paddingY;
  const maxY = bounds.maxY + paddingY;
  const worldW = maxX - minX;
  const worldH = maxY - minY;
  if (worldW <= 0 || worldH <= 0) return null;

  const scale = clampScale(Math.min((screenW * 0.9) / worldW, (screenH * 0.9) / worldH));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  return {
    scale,
    position: {
      x: screenW / 2 - centerX * scale - VIEWPORT_ORIGIN_OFFSET,
      y: screenH / 2 + centerY * scale - VIEWPORT_ORIGIN_OFFSET,
    },
  };
}

/** Zoom by `factor` keeping the world point under (screenX, screenY) fixed on screen. */
export function zoomAt(viewport: Viewport, screenX: number, screenY: number, factor: number): Viewport {
  const world = screenToWorld(screenX, screenY, viewport);
  const scale = clampScale(viewport.scale * factor);
  return {
    scale,
    position: {
      x: screenX - world.x * scale - VIEWPORT_ORIGIN_OFFSET,
      y: screenY + world.y * scale - VIEWPORT_ORIGIN_OFFSET,
    },
  };
}
