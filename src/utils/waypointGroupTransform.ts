/**
 * Moving waypoint groups and generators as one body: pure functions over the node map. Every object on the
 * way to a change is rebuilt; nothing stored is modified in place (undo snapshots share the node objects).
 */
import type { Pose2D, Transform } from '../types/geometry';
import type { WaypointNode } from '../types/waypoint';
import { computePointsBoundingBox } from './geometry';
import { followingOf, moveGeneratorParams, type MoveContext } from './pluginInputTransform';
import { composePose, transformPoint, type RigidTransform } from './rigidTransform';
import { rotateQuaternionAboutZ } from './transformUtils';
import { collectDescendantIds, excludeDescendantsOfOthers } from './treeUtils';

/** A waypoint pose after the move: the position turns and shifts, the heading turns, the height stays. */
export function moveWaypointTransform(tf: Transform, t: RigidTransform): Transform {
  return { ...tf, ...transformPoint(tf, t), ...rotateQuaternionAboutZ(tf, t.dyaw) };
}

function moveNode(node: WaypointNode, t: RigidTransform, ctx: MoveContext): WaypointNode {
  const next: WaypointNode = { ...node };
  if (node.transform) next.transform = moveWaypointTransform(node.transform, t);
  if (node.base_pose) next.base_pose = composePose(node.base_pose, t);
  // A generator whose inputs move regenerates at the moved place, so its baseline moves too (the move is
  // not a hand edit). Otherwise the baseline stays and the move is reapplied as a hand edit after a rerun.
  if (node.type === 'generator' && followingOf(node, ctx.plugins) !== 'none') {
    const inputs = ctx.plugins[node.plugin_id!].manifest.inputs ?? [];
    if (node.baseline_waypoints) {
      next.baseline_waypoints = node.baseline_waypoints.map((item) => ({
        ...item,
        transform: moveWaypointTransform(item.transform, t),
      }));
    }
    if (node.generator_params) next.generator_params = moveGeneratorParams(node.generator_params, inputs, t, ctx.moved);
  }
  // The replaced points come back on "restore" and feed a waypoint-range rerun: they move as well.
  if (node.source_snapshot) {
    next.source_snapshot = {
      ...node.source_snapshot,
      nodes: Object.fromEntries(Object.entries(node.source_snapshot.nodes).map(([id, n]) => [id, moveNode(n, t, ctx)])),
    };
  }
  return next;
}

/** The ids `rootIds` and everything inside them, each once. */
export function nodeSubtreeIds(nodes: Record<string, WaypointNode>, rootIds: string[]): string[] {
  const ids = new Set<string>();
  for (const id of rootIds) {
    if (!nodes[id]) continue;
    ids.add(id);
    collectDescendantIds(id, nodes).forEach((d) => ids.add(d));
  }
  return [...ids].filter((id) => nodes[id]);
}

/** The moved copies of the nodes `ids` (an id list from `nodeSubtreeIds`), keyed by id. */
export function moveNodes(
  nodes: Record<string, WaypointNode>,
  ids: string[],
  t: RigidTransform,
  ctx: MoveContext,
): Record<string, WaypointNode> {
  return Object.fromEntries(ids.map((id) => [id, moveNode(nodes[id], t, ctx)]));
}

/**
 * The group or generator whose whole contents are exactly `ids` (it and everything inside it), so dragging
 * that selection moves the group as one body. Null for any other selection.
 */
export function wholeGroupSelected(nodes: Record<string, WaypointNode>, ids: string[]): string | null {
  const roots = excludeDescendantsOfOthers(ids, nodes);
  if (roots.length !== 1) return null;
  const root = nodes[roots[0]];
  if (!root || root.type === 'manual') return null;
  const contents = nodeSubtreeIds(nodes, [root.id]);
  const selected = new Set(ids);
  return contents.length === selected.size && contents.every((id) => selected.has(id)) ? root.id : null;
}

const pointsInside = (nodes: Record<string, WaypointNode>, id: string) =>
  collectDescendantIds(id, nodes)
    .map((d) => nodes[d])
    .filter((n): n is WaypointNode & { transform: Transform } => n?.type === 'manual' && !!n.transform)
    .map((n) => n.transform);

/**
 * The reference pose of a group or generator: the stored one, or else the centre of its waypoints with
 * heading 0. Null when it holds no waypoint (there is nothing to move).
 */
export function effectiveNodeBasePose(nodes: Record<string, WaypointNode>, id: string): Pose2D | null {
  const node = nodes[id];
  if (!node) return null;
  const points = pointsInside(nodes, id);
  if (points.length === 0) return null;
  if (node.base_pose) return node.base_pose;
  const box = computePointsBoundingBox(points);
  return { x: box.cx, y: box.cy, yaw: 0 };
}
