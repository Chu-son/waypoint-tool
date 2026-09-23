import { describe, it, expect } from 'vitest';
import { extractWaypointsFromRawResult } from './pluginResult';

describe('extractWaypointsFromRawResult', () => {
  it('expands column-oriented output into one item per waypoint', () => {
    const result = extractWaypointsFromRawResult({
      waypoints: {
        columnar: true,
        name: 'Sweep',
        x: [1, 2],
        y: [3, 4],
        yaw: [0, 1.5],
        names: ['a', 'b'],
        plugin_data: { lines: 2 },
      },
    });

    expect(result.items).toEqual([
      { x: 1, y: 3, z: 0, yaw: 0, name: 'a', options: undefined },
      { x: 2, y: 4, z: 0, yaw: 1.5, name: 'b', options: undefined },
    ]);
    expect(result.groupName).toBe('Sweep');
    expect(result.pluginData).toEqual({ lines: 2 });
  });

  it('reads the { name, items, plugin_data } form', () => {
    const result = extractWaypointsFromRawResult({
      waypoints: { name: 'Route', items: [{ x: 1, y: 2 }], plugin_data: { k: 1 } },
    });
    expect(result).toEqual({ items: [{ x: 1, y: 2 }], groupName: 'Route', pluginData: { k: 1 } });
  });

  it('reads a waypoints array', () => {
    expect(extractWaypointsFromRawResult({ waypoints: [{ x: 1, y: 2 }] }).items).toEqual([{ x: 1, y: 2 }]);
  });

  it('accepts the legacy bare array of waypoints', () => {
    expect(extractWaypointsFromRawResult([{ x: 5, y: 6 }]).items).toEqual([{ x: 5, y: 6 }]);
  });

  it.each([[null], [undefined], [[]], [{ custom_layers: [] }], [[{ foo: 1 }]]])(
    'yields no items for output without waypoints (%j)',
    (raw) => {
      expect(extractWaypointsFromRawResult(raw).items).toEqual([]);
    },
  );
});
