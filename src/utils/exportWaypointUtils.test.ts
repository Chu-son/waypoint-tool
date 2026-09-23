import { describe, it, expect } from 'vitest';
import { extractWaypointsForExport } from './exportWaypointUtils';
import { ObjectNode, OptionsSchema } from '../types/store';

describe('exportWaypointUtils', () => {
  it('extracts waypoints in DFS order with schema defaults and yaw computation', () => {
    const nodes: Record<string, ObjectNode> = {
      'node-1': {
        id: 'node-1',
        type: 'manual',
        name: 'WP 1',
        transform: {
          x: 1.0,
          y: 2.0,
          z: 0.0,
          qx: 0,
          qy: 0,
          qz: 0,
          qw: 1, // yaw = 0
        },
        options: { custom_val: 42 },
        children_ids: [],
      },
      'node-2': {
        id: 'node-2',
        type: 'manual',
        name: 'WP 2',
        transform: {
          x: 3.0,
          y: 4.0,
          z: 0.0,
          qx: 0,
          qy: 0,
          qz: Math.sin(Math.PI / 4),
          qw: Math.cos(Math.PI / 4), // yaw = PI / 2 (90 deg)
        },
        options: {},
        children_ids: [],
      },
    };

    const schema: OptionsSchema = {
      options: [{ name: 'speed', label: 'Speed', type: 'number', default: 1.5 }],
    };

    const result = extractWaypointsForExport(['node-1', 'node-2'], nodes, schema, 1);

    expect(result.length).toBe(2);

    expect(result[0].index).toBe(1);
    expect(result[0].id).toBe('node-1');
    expect(result[0].x).toBe(1.0);
    expect(result[0].y).toBe(2.0);
    expect(result[0].yaw).toBeCloseTo(0);
    expect(result[0].options.speed).toBe(1.5); // schema default applied
    expect(result[0].options.custom_val).toBe(42);

    expect(result[1].index).toBe(2);
    expect(result[1].id).toBe('node-2');
    expect(result[1].x).toBe(3.0);
    expect(result[1].y).toBe(4.0);
    expect(result[1].yaw).toBeCloseTo(Math.PI / 2);
    expect(result[1].options.speed).toBe(1.5);
  });
});
