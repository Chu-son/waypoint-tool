/**
 * Boundary checks for stored poses (`base_pose` of waypoint and annotation groups, `pose_offset` of layer
 * groups) read from project files and the clipboard: a malformed value is dropped, never repaired.
 */
import type { Pose2D } from '../types/geometry';

/** The pose when `raw` has finite `x`, `y` and `yaw`, otherwise undefined. */
export function normalizePose2D(raw: unknown): Pose2D | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const { x, y, yaw } = raw as Record<string, unknown>;
  const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  return finite(x) && finite(y) && finite(yaw) ? { x, y, yaw } : undefined;
}

/** `item` with a valid `base_pose` kept and a malformed one removed (the same object when nothing changes). */
function withValidBasePose<T extends object>(item: T): T {
  if (!('base_pose' in item)) return item;
  const pose = normalizePose2D((item as { base_pose?: unknown }).base_pose);
  const next = { ...item } as T & { base_pose?: Pose2D };
  if (pose) next.base_pose = pose;
  else delete next.base_pose;
  return next;
}

type WithSnapshot = { source_snapshot?: { nodes?: unknown } };

/**
 * Waypoint nodes (or annotation groups) with every `base_pose` checked, including the nodes kept in a
 * generator's `source_snapshot` at any depth.
 */
export function normalizeBasePoses<T extends object>(items: Record<string, T>): Record<string, T> {
  const result: Record<string, T> = {};
  for (const [id, item] of Object.entries(items)) {
    if (!item || typeof item !== 'object') {
      result[id] = item;
      continue;
    }
    let next = withValidBasePose(item);
    const snapshot = (next as WithSnapshot).source_snapshot;
    if (snapshot?.nodes && typeof snapshot.nodes === 'object' && !Array.isArray(snapshot.nodes)) {
      next = {
        ...next,
        source_snapshot: { ...snapshot, nodes: normalizeBasePoses(snapshot.nodes as Record<string, object>) },
      };
    }
    result[id] = next;
  }
  return result;
}
