import type { Graphics } from 'pixi.js';
import type { MapLayerClip } from '../../../types/store';
import { CANVAS_MASK_FILL } from '../canvasConstants';

/**
 * Paints the area of a map instance that stays visible as a mask, in world coordinates. Each
 * rectangle is filled separately so overlapping rectangles form a plain union.
 */
export function drawClipMask(g: Graphics, clip: MapLayerClip | null): void {
  g.clear();
  for (const rect of clip?.rects ?? []) {
    g.rect(rect.x, rect.y, rect.width, rect.height).fill(CANVAS_MASK_FILL);
  }
}
