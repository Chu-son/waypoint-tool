import type { RobotFootprint } from '../types/store';

const MIN_POLYGON_RADIUS = 0.25;

/**
 * Width (m) swept by the robot footprint, used when the path width follows the footprint.
 * Polygons use the diameter of the smallest origin-centred circle enclosing all vertices.
 */
export function getFootprintWidth(footprint: RobotFootprint): number {
  switch (footprint.type) {
    case 'circular':
      return (footprint.radius || 0.25) * 2;
    case 'rectangular':
      return footprint.width || 0.5;
    case 'polygon': {
      const radii = footprint.points.map(([x, y]) => Math.hypot(x, y)).filter(Number.isFinite);
      return Math.max(...radii, MIN_POLYGON_RADIUS) * 2;
    }
  }
}
