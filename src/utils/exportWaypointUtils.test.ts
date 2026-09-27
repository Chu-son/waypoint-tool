import { describe, it, expect } from 'vitest';
import { extractGlobalsForExport, extractWaypointsForExport } from './exportWaypointUtils';
import type { WaypointNode, OptionsSchema } from '../types/store';

describe('extractGlobalsForExport', () => {
  it('maps each global field name to its value and leaves out fields without a value', () => {
    const schema: OptionsSchema = {
      options: [],
      globals: [
        { name: 'default_speed', label: 'Default Speed', type: 'float', value: 0.5 },
        { name: 'frame_id', label: 'Frame', type: 'string', value: 'map' },
        { name: 'tags', label: 'Tags', type: 'list', item_type: 'string', value: ['a', 'b'] },
        { name: 'unset', label: 'Unset', type: 'string' },
      ],
    };

    expect(extractGlobalsForExport(schema)).toEqual({ default_speed: 0.5, frame_id: 'map', tags: ['a', 'b'] });
  });

  it('returns no globals when the project has no option schema', () => {
    expect(extractGlobalsForExport(null)).toEqual({});
  });
});

describe('exportWaypointUtils', () => {
  it('extracts waypoints in DFS order with schema defaults and yaw computation', () => {
    const nodes: Record<string, WaypointNode> = {
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
      globals: [],
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
