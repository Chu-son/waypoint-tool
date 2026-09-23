/**
 * Normalisation of plugin output (docs/PLUGIN_GUIDE.md): waypoints, custom layers and annotations.
 */
import type { Transform, WaypointBaselineItem } from '../types/store';
import { yawToQuaternion } from './transformUtils';

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
  }));
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
 * - `{ waypoints: { columnar: true, x: [...], y: [...], ... } }` (column-oriented, for large outputs)
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
