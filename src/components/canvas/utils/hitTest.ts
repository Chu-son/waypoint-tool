import type { AnnotationObject, WaypointNode } from '../../../types/store';
import { getAnnotationCenter } from '../../../stores/slices/measureSlice';

export type SnapTarget = {
  x: number;
  y: number;
  objectId: string;
  objectName: string;
  objectType: 'node' | 'annotation';
};

export type RectCorner = 'min' | 'max' | 'topRight' | 'bottomLeft';
export type RectHandleHit = { key: string; handle: 'rotation' } | { key: string; handle: 'corner'; corner: RectCorner };

type RectInput = { center: { x: number; y: number }; width: number; height: number; yaw?: number };

const isRectInput = (value: unknown): value is RectInput =>
  !!value &&
  typeof value === 'object' &&
  !!(value as RectInput).center &&
  typeof (value as RectInput).width === 'number' &&
  typeof (value as RectInput).height === 'number';

/** Screen-space grab radius (px) for rectangle-input handles. */
const RECT_HANDLE_RADIUS_PX = 14;
/** Screen-space distance (px) of the rotation handle above the rectangle's top edge. */
const RECT_ROTATION_HANDLE_OFFSET_PX = 20;

/**
 * Finds the rotation handle or corner handle of a rectangle plugin input under the pointer.
 * Rectangles are the entries of `interactionData` shaped like `{ center, width, height, yaw }`.
 * Corners are named by their on-screen position: `min` = top-left, `max` = bottom-right.
 */
export function hitTestRectHandles(
  interactionData: Record<string, unknown>,
  world: { x: number; y: number },
  scale: number,
): RectHandleHit | null {
  const hitRadius = RECT_HANDLE_RADIUS_PX / scale;

  for (const [key, rect] of Object.entries(interactionData)) {
    if (!isRectInput(rect)) continue;
    const { center, width, height, yaw = 0 } = rect;
    const halfW = width / 2;
    const halfH = height / 2;

    // Pointer in the rectangle's local frame (+Y = screen top).
    const dx = world.x - center.x;
    const dy = world.y - center.y;
    const localX = dx * Math.cos(-yaw) - dy * Math.sin(-yaw);
    const localY = dx * Math.sin(-yaw) + dy * Math.cos(-yaw);

    if (Math.hypot(localX, localY - (halfH + RECT_ROTATION_HANDLE_OFFSET_PX / scale)) < hitRadius) {
      return { key, handle: 'rotation' };
    }

    const corners: Array<{ x: number; y: number; corner: RectCorner }> = [
      { x: -halfW, y: halfH, corner: 'min' },
      { x: halfW, y: -halfH, corner: 'max' },
      { x: halfW, y: halfH, corner: 'topRight' },
      { x: -halfW, y: -halfH, corner: 'bottomLeft' },
    ];
    for (const c of corners) {
      if (Math.hypot(localX - c.x, localY - c.y) < hitRadius) {
        return { key, handle: 'corner', corner: c.corner };
      }
    }
  }
  return null;
}

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
