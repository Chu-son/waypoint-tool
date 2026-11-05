/**
 * Pure geometry for moving a whole layer group: one rigid transform (turn around a pivot, then shift)
 * applied to map poses, plugin layer poses and the objects of hand-drawn layers.
 */
import type { CustomLayer, EditObject, GroupPoseOffset, ProjectMapLayer, ResolvedMapLayer } from '../types/layer';
import { descendantLayerIds, type LayerTree } from './layerTree';
import { mapWorldBounds, type WorldBounds } from './mapClip';
import {
  circleLikeBounds,
  composePose,
  lineLikeBounds,
  rectLikeBounds,
  transformBetweenPoses,
  transformCircleLike,
  transformLineLike,
  transformPoint,
  transformRectLike,
  unionBounds,
  type RigidTransform,
} from './rigidTransform';

export { isIdentityTransform, transformPoint, transformPose, type Pose, type RigidTransform } from './rigidTransform';

const NO_OFFSET: GroupPoseOffset = { x: 0, y: 0, yaw: 0 };
const ORIGIN = { x: 0, y: 0 };

/** True when the offset moves nothing. */
export const isZeroOffset = (offset: GroupPoseOffset | undefined): boolean =>
  !offset || (offset.x === 0 && offset.y === 0 && offset.yaw === 0);

/** The offset after applying `t` on top of `offset` (an absent offset is zero). Zero results come back as `undefined`. */
export function composeOffset(offset: GroupPoseOffset | undefined, t: RigidTransform): GroupPoseOffset | undefined {
  // The offset is where the origin pose of the contents has gone, so it moves like any pose.
  const next = composePose(offset ?? NO_OFFSET, t);
  return isZeroOffset(next) ? undefined : next;
}

/**
 * The transform around the origin that takes the group from `current` to `target`: applying it with
 * `composeOffset` gives `target` back. Used to turn a typed offset into a move.
 */
export function transformBetweenOffsets(current: GroupPoseOffset | undefined, target: GroupPoseOffset): RigidTransform {
  return transformBetweenPoses(current ?? NO_OFFSET, target, ORIGIN);
}

export function transformEditObject(object: EditObject, t: RigidTransform): EditObject {
  switch (object.type) {
    case 'rect':
      return transformRectLike(object, t);
    case 'circle':
      return transformCircleLike(object, t);
    case 'line':
      return transformLineLike(object, t);
    case 'freehand':
      return { ...object, points: object.points.map((p) => transformPoint(p, t)) };
  }
}

const editObjectBounds = (object: EditObject): WorldBounds => {
  switch (object.type) {
    case 'rect':
      return rectLikeBounds(object);
    case 'circle':
      return circleLikeBounds(object);
    case 'line':
      return lineLikeBounds(object, (object.lineWidth ?? 0) / 2);
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
  return unionBounds(boxes);
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
