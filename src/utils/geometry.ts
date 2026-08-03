export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
}

/**
 * Calculates the bounding box for an array of 2D points with optional margin.
 */
export function computePointsBoundingBox(
  points: { x: number; y: number }[],
  margin = 0
): BoundingBox {
  if (!points.length) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0, cx: 0, cy: 0 };
  }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  minX -= margin;
  maxX += margin;
  minY -= margin;
  maxY += margin;

  const width = Math.max(0, maxX - minX);
  const height = Math.max(0, maxY - minY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  return { minX, maxX, minY, maxY, width, height, cx, cy };
}

/**
 * Rotates a 2D vector (dx, dy) by the given angle (radians).
 */
export function rotateVector(dx: number, dy: number, angle: number): { x: number; y: number } {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: dx * cos - dy * sin,
    y: dx * sin + dy * cos,
  };
}
