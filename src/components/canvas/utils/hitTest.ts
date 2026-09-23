import type { AnnotationObject, WaypointNode } from '../../../types/store';
import { getAnnotationCenter } from '../../../stores/slices/measureSlice';

export type SnapTarget = {
  x: number;
  y: number;
  objectId: string;
  objectName: string;
  objectType: 'node' | 'annotation';
};

/** Screen-space snap radius (px) for measure-tool object snapping. */
const SNAP_RADIUS_PX = 30;

/**
 * The waypoint or visible annotation whose center is closest to (worldX, worldY), within
 * SNAP_RADIUS_PX on screen at the given zoom `scale`. Used by the measure tool's Alt-snap.
 */
export function findNearestObjectCenter(
  worldX: number,
  worldY: number,
  nodes: Record<string, WaypointNode>,
  annotations: Record<string, AnnotationObject>,
  scale: number,
): SnapTarget | null {
  let closestDist = SNAP_RADIUS_PX / Math.max(scale, 0.001);
  let result: SnapTarget | null = null;

  for (const node of Object.values(nodes)) {
    if (!node?.transform) continue;
    const dist = Math.hypot(node.transform.x - worldX, node.transform.y - worldY);
    if (dist < closestDist) {
      closestDist = dist;
      result = {
        x: node.transform.x,
        y: node.transform.y,
        objectId: node.id,
        objectName: node.name || node.id,
        objectType: 'node',
      };
    }
  }

  for (const annot of Object.values(annotations)) {
    if (!annot || annot.visible === false) continue;
    const center = getAnnotationCenter(annot);
    const dist = Math.hypot(center.x - worldX, center.y - worldY);
    if (dist < closestDist) {
      closestDist = dist;
      result = {
        x: center.x,
        y: center.y,
        objectId: annot.id,
        objectName: annot.name || annot.id,
        objectType: 'annotation',
      };
    }
  }

  return result;
}
