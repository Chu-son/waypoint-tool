/**
 * Normalisation of the waypoint part of a plugin's output (docs/PLUGIN_GUIDE.md).
 */

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
