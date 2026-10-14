/**
 * Pure geometry for moving a whole layer group: one rigid transform (turn around a pivot, then shift)
 * applied to map poses, plugin layer poses and the objects of hand-drawn layers.
 */
import type { CustomLayer, EditObject, ProjectMapLayer, ResolvedMapLayer } from '../types/layer';
import { descendantLayerIds, type LayerTree } from './layerTree';
import { mapWorldBounds, type WorldBounds } from './mapClip';

export type Pose = [number, number, number];

/** Turns by `dyaw` (radians, counter-clockwise) around `pivot`, then shifts by (`dx`, `dy`) meters. */
export interface RigidTransform {
  dx: number;
  dy: number;
  dyaw: number;
  pivot: { x: number; y: number };
}

export const isIdentityTransform = (t: RigidTransform): boolean => t.dx === 0 && t.dy === 0 && t.dyaw === 0;

export function transformPoint(p: { x: number; y: number }, t: RigidTransform): { x: number; y: number } {
  const cos = Math.cos(t.dyaw);
  const sin = Math.sin(t.dyaw);
  const rx = p.x - t.pivot.x;
  const ry = p.y - t.pivot.y;
  return { x: t.pivot.x + rx * cos - ry * sin + t.dx, y: t.pivot.y + rx * sin + ry * cos + t.dy };
}

/** A pose `[x, y, yaw]` after the transform: its position moves like a point and its yaw turns with it. */
export function transformPose(pose: Pose, t: RigidTransform): Pose {
  const { x, y } = transformPoint({ x: pose[0], y: pose[1] }, t);
  return [x, y, pose[2] + t.dyaw];
}

export function transformEditObject(object: EditObject, t: RigidTransform): EditObject {
  switch (object.type) {
    case 'rect': {
      const c = transformPoint({ x: object.cx, y: object.cy }, t);
      return { ...object, cx: c.x, cy: c.y, angle: object.angle + t.dyaw };
    }
    case 'circle': {
      const c = transformPoint({ x: object.cx, y: object.cy }, t);
      return { ...object, cx: c.x, cy: c.y };
    }
    case 'line': {
      const a = transformPoint({ x: object.x1, y: object.y1 }, t);
      const b = transformPoint({ x: object.x2, y: object.y2 }, t);
      return { ...object, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
    }
    case 'freehand':
      return { ...object, points: object.points.map((p) => transformPoint(p, t)) };
  }
}

const editObjectBounds = (object: EditObject): WorldBounds => {
  switch (object.type) {
    case 'rect': {
      const cos = Math.abs(Math.cos(object.angle));
      const sin = Math.abs(Math.sin(object.angle));
      const halfW = (object.width * cos + object.height * sin) / 2;
      const halfH = (object.width * sin + object.height * cos) / 2;
      return { minX: object.cx - halfW, minY: object.cy - halfH, maxX: object.cx + halfW, maxY: object.cy + halfH };
    }
    case 'circle':
      return {
        minX: object.cx - object.radius,
        minY: object.cy - object.radius,
        maxX: object.cx + object.radius,
        maxY: object.cy + object.radius,
      };
    case 'line': {
      const half = (object.lineWidth ?? 0) / 2;
      return {
        minX: Math.min(object.x1, object.x2) - half,
        minY: Math.min(object.y1, object.y2) - half,
        maxX: Math.max(object.x1, object.x2) + half,
        maxY: Math.max(object.y1, object.y2) + half,
      };
    }
    case 'freehand': {
      const xs = object.points.map((p) => p.x);
      const ys = object.points.map((p) => p.y);
      return {
        minX: Math.min(...xs) - object.brushRadius,
        minY: Math.min(...ys) - object.brushRadius,
        maxX: Math.max(...xs) + object.brushRadius,
        maxY: Math.max(...ys) + object.brushRadius,
      };
    }
  }
};

/**
 * World-space box around the given maps and custom layers (a hand-drawn layer counts by its objects), or
 * null when there is nothing to measure. Its centre is the default pivot of a group's rotation.
 */
export function groupWorldBounds(
  maps: Array<Pick<ResolvedMapLayer, 'info' | 'width' | 'height'>>,
  customLayers: CustomLayer[],
): WorldBounds | null {
  const boxes: WorldBounds[] = maps.map(mapWorldBounds);
  for (const layer of customLayers) {
    if (layer.type === 'plugin')
      boxes.push(mapWorldBounds({ info: layer.info, width: layer.info.width, height: layer.info.height }));
    else boxes.push(...layer.editObjects.filter(hasExtent).map(editObjectBounds));
  }
  if (boxes.length === 0) return null;
  return {
    minX: Math.min(...boxes.map((b) => b.minX)),
    minY: Math.min(...boxes.map((b) => b.minY)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    maxY: Math.max(...boxes.map((b) => b.maxY)),
  };
}

/**
 * Map instances outside the group whose pose is shared (linked) with a linked instance inside it. Moving
 * the group moves them too, unless the group's instances are unlinked first.
 */
export function mapsSharingPoseWithOutside(
  stack: LayerTree & { mapLayers: ProjectMapLayer[] },
  groupId: string,
): ProjectMapLayer[] {
  const inside = new Set(descendantLayerIds(stack, groupId));
  const insideSources = new Set(
    stack.mapLayers.filter((l) => inside.has(l.id) && !l.origin_override).map((l) => l.sourceId),
  );
  return stack.mapLayers.filter((l) => !inside.has(l.id) && !l.origin_override && insideSources.has(l.sourceId));
}

const hasExtent = (object: EditObject): boolean => object.type !== 'freehand' || object.points.length > 0;
