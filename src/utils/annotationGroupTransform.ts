/**
 * Moving annotation groups (hand-made and plugin-generated) as one body: pure functions over the annotation
 * maps, rebuilding every object on the way to a change (see `waypointGroupTransform.ts`).
 */
import type { AnnotationGroup, AnnotationObject } from '../types/annotation';
import type { Pose2D } from '../types/geometry';
import type { WorldBounds } from './mapClip';
import { followingOf, moveGeneratorParams, type MoveContext } from './pluginInputTransform';
import {
  circleLikeBounds,
  composePose,
  lineLikeBounds,
  rectLikeBounds,
  transformCircleLike,
  transformLineLike,
  transformPoint,
  transformRectLike,
  unionBounds,
  type RigidTransform,
} from './rigidTransform';
import { collectDescendantIds } from './treeUtils';

export function moveAnnotationObject(object: AnnotationObject, t: RigidTransform): AnnotationObject {
  switch (object.type) {
    case 'point':
      return { ...object, ...transformPoint(object, t) };
    case 'oriented_point':
      return { ...object, ...transformPoint(object, t), yaw: object.yaw + t.dyaw };
    case 'line':
      return transformLineLike(object, t);
    case 'rect':
      return transformRectLike(object, t);
    case 'circle':
      return transformCircleLike(object, t);
  }
}

export function annotationBounds(object: AnnotationObject): WorldBounds {
  switch (object.type) {
    case 'point':
    case 'oriented_point':
      return { minX: object.x, minY: object.y, maxX: object.x, maxY: object.y };
    case 'line':
      return lineLikeBounds(object);
    case 'rect':
      return rectLikeBounds(object);
    case 'circle':
      return circleLikeBounds(object);
  }
}

function moveGroup(group: AnnotationGroup, t: RigidTransform, ctx: MoveContext): AnnotationGroup {
  const next: AnnotationGroup = { ...group };
  if (group.base_pose) next.base_pose = composePose(group.base_pose, t);
  if (group.type === 'generator' && group.generator_params && followingOf(group, ctx.plugins) !== 'none') {
    const inputs = ctx.plugins[group.plugin_id!].manifest.inputs ?? [];
    next.generator_params = moveGeneratorParams(group.generator_params, inputs, t, ctx.moved);
  }
  return next;
}

/** The groups `rootIds` and the groups and objects inside them, each once. */
export function annotationSubtreeIds(
  groups: Record<string, AnnotationGroup>,
  objects: Record<string, AnnotationObject>,
  rootIds: string[],
): { groupIds: string[]; objectIds: string[] } {
  const ids = new Set<string>();
  for (const id of rootIds) {
    if (!groups[id]) continue;
    ids.add(id);
    collectDescendantIds(id, groups).forEach((d) => ids.add(d));
  }
  return { groupIds: [...ids].filter((id) => groups[id]), objectIds: [...ids].filter((id) => objects[id]) };
}

/** Moved copies of the given groups and objects, keyed by id. */
export function moveAnnotations(
  groups: Record<string, AnnotationGroup>,
  objects: Record<string, AnnotationObject>,
  ids: { groupIds: string[]; objectIds: string[] },
  t: RigidTransform,
  ctx: MoveContext,
): { groups: Record<string, AnnotationGroup>; objects: Record<string, AnnotationObject> } {
  return {
    groups: Object.fromEntries(ids.groupIds.map((id) => [id, moveGroup(groups[id], t, ctx)])),
    objects: Object.fromEntries(ids.objectIds.map((id) => [id, moveAnnotationObject(objects[id], t)])),
  };
}

/**
 * The reference pose of an annotation group: the stored one, or else the centre of its objects with heading
 * 0. Null when it holds no object.
 */
export function effectiveAnnotationBasePose(
  groups: Record<string, AnnotationGroup>,
  objects: Record<string, AnnotationObject>,
  id: string,
): Pose2D | null {
  const group = groups[id];
  if (!group) return null;
  const { objectIds } = annotationSubtreeIds(groups, objects, [id]);
  const box = unionBounds(objectIds.map((objectId) => annotationBounds(objects[objectId])));
  if (!box) return null;
  if (group.base_pose) return group.base_pose;
  return { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2, yaw: 0 };
}
