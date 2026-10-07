/**
 * Normalisation of plugin output (docs/PLUGIN_GUIDE.md): waypoints, custom layers and annotations.
 */
import type { SourceSnapshot, Transform, WaypointBaselineItem, WaypointNode, WaypointOptions } from '../types/store';
import { yawToQuaternion } from './transformUtils';
import { collectDescendantIds } from './treeUtils';

/**
 * Pose of a plugin-emitted waypoint. Accepts an explicit `transform`, a quaternion, or a `yaw`
 * (used only when no quaternion `qw` is given). Missing coordinates default to 0.
 */
export function pluginWaypointTransform(wp: any): Transform {
  if (wp.transform) return { ...wp.transform };
  const { qz, qw } =
    typeof wp.yaw === 'number' && typeof wp.qw !== 'number'
      ? yawToQuaternion(wp.yaw)
      : { qz: wp.qz ?? 0, qw: wp.qw ?? 1 };
  return { x: wp.x ?? 0, y: wp.y ?? 0, z: wp.z ?? 0, qx: wp.qx ?? 0, qy: wp.qy ?? 0, qz, qw };
}

/** Snapshot of generated waypoints, kept to detect later manual edits (see generatorStashUtils). */
export function toBaselineWaypoints(items: any[]): WaypointBaselineItem[] {
  return items.map((wp) => ({
    transform: pluginWaypointTransform(wp),
    options: wp.options ? { ...wp.options } : undefined,
    name: wp.name,
    stash_key: typeof wp.stash_key === 'string' ? wp.stash_key : undefined,
  }));
}

/** A waypoint frozen into `context.waypoint_range` (the `needs: ["waypoint_range"]` payload). */
export interface WaypointRangeItem {
  id: string;
  name?: string;
  transform: Transform;
  options?: WaypointOptions;
  /** Ids of the groups / generators (outermost first) this waypoint sits in within the range. Empty if directly in the range. */
  group_path: string[];
}

/**
 * Deep copy of the subtrees a generator consumes (groups and nested generators included), so the
 * original hierarchy can be restored later (`restoreGeneratorSource`).
 */
export function captureSourceSnapshot(ids: string[], nodes: Record<string, WaypointNode>): SourceSnapshot {
  const captured: Record<string, WaypointNode> = {};
  ids.forEach((id) => {
    if (!nodes[id]) throw new Error(`The selected range contains a node that no longer exists (${id}).`);
    [id, ...collectDescendantIds(id, nodes)].forEach((nid) => {
      if (nodes[nid]) captured[nid] = JSON.parse(JSON.stringify(nodes[nid]));
    });
  });
  return { topLevelIds: [...ids], nodes: captured };
}

/**
 * Flattens a snapshot into the `waypoint_range` payload: every waypoint in tree order, descending
 * into groups and generators, each tagged with the containers it sits in.
 */
export function flattenSourceSnapshot(snapshot: SourceSnapshot): WaypointRangeItem[] {
  const items: WaypointRangeItem[] = [];
  const visit = (id: string, path: string[]) => {
    const node = snapshot.nodes[id];
    if (!node) return;
    if (node.type === 'manual') {
      if (!node.transform) return;
      items.push({
        id: node.id,
        name: node.name,
        transform: { ...node.transform },
        options: node.options ? { ...node.options } : undefined,
        group_path: path,
      });
      return;
    }
    (node.children_ids || []).forEach((childId) => visit(childId, [...path, id]));
  };
  snapshot.topLevelIds.forEach((id) => visit(id, []));
  return items;
}

/** Custom layers from `{ custom_layers: [...] }` or a single bare layer `{ image_base64, info }`. */
export function extractCustomLayerItems(rawResult: any): any[] {
  if (Array.isArray(rawResult?.custom_layers)) return rawResult.custom_layers;
  if (rawResult?.image_base64 && rawResult?.info) return [rawResult];
  return [];
}

export interface ParsedAnnotationsResult {
  items: any[];
  pluginData?: Record<string, any>;
  groupName?: string;
}

/** Annotations from `{ annotations: [...] }` or `{ annotations: { name, items, plugin_data } }`. */
export function extractAnnotationsFromRawResult(rawResult: any): ParsedAnnotationsResult {
  const annotations = rawResult?.annotations;
  if (Array.isArray(annotations)) return { items: annotations };
  if (Array.isArray(annotations?.items)) {
    return { items: annotations.items, pluginData: annotations.plugin_data, groupName: annotations.name };
  }
  return { items: [] };
}

export interface ParsedWaypointsResult {
  items: any[];
  pluginData?: Record<string, any>;
  groupName?: string;
}

/**
 * Accepts every waypoint output shape a plugin may return and yields a flat item list:
 * - `{ waypoints: { columnar: true, x: [...], y: [...], ... } }` (column-oriented, for large outputs;
 *   optional `names` / `options` / `stash_keys` columns)
 * - `{ waypoints: { name, items: [...], plugin_data } }`
 * - `{ waypoints: [...] }`
 * - a bare array of waypoints (legacy)
 */
export function extractWaypointsFromRawResult(rawResult: any): ParsedWaypointsResult {
  let items: any[] = [];
  let pluginData: Record<string, any> | undefined = undefined;
  let groupName: string | undefined = undefined;

  if (rawResult && rawResult.waypoints) {
    const wp = rawResult.waypoints;
    if (wp.columnar) {
      const count = wp.count ?? (Array.isArray(wp.x) ? wp.x.length : 0);
      items = new Array(count);
      for (let i = 0; i < count; i++) {
        items[i] = {
          x: wp.x?.[i] ?? 0,
          y: wp.y?.[i] ?? 0,
          z: wp.z?.[i] ?? 0,
          yaw: wp.yaw?.[i] ?? 0,
          name: wp.names?.[i],
          options: wp.options?.[i],
          stash_key: wp.stash_keys?.[i],
        };
      }
      pluginData = wp.plugin_data;
      groupName = wp.name;
    } else if (Array.isArray(wp)) {
      items = wp;
    } else if (wp.items && Array.isArray(wp.items)) {
      items = wp.items;
      pluginData = wp.plugin_data;
      groupName = wp.name;
    }
  } else if (
    Array.isArray(rawResult) &&
    rawResult.length > 0 &&
    (rawResult[0].transform || rawResult[0].x !== undefined)
  ) {
    items = rawResult;
  }

  return { items, pluginData, groupName };
}
