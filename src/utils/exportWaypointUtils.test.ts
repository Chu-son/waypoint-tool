import { describe, it, expect } from 'vitest';
import {
  collectIntegerOptionKeys,
  extractGeoForExport,
  extractGlobalsForExport,
  extractWaypointsForExport,
  countWaypointsWithInvalidOptions,
} from './exportWaypointUtils';
import type { WaypointNode, OptionsSchema } from '../types/store';
import { normalizeOptionsSchema } from './optionSchema';

describe('extractGeoForExport', () => {
  it('describes the aligned map origin in lat/lon, UTM and heading', () => {
    const geo = extractGeoForExport({
      origin: { kind: 'utm', zone: 54, hemisphere: 'N', easting: 500000, northing: 3950000 },
      alignment: { dx: 0, dy: 0, yawDeg: 90 },
    });

    expect(geo.utm).toEqual({ zone: 54, hemisphere: 'N', easting: 500000, northing: 3950000 });
    expect(geo.lon).toBeCloseTo(141, 6); // ゾーン 54 の中央子午線
    expect(geo.heading_deg).toBeCloseTo(-90, 9);
    expect(geo.heading).toBeCloseTo(-Math.PI / 2, 9);
  });
});

describe('extractGlobalsForExport', () => {
  it('maps each global field name to its value and leaves out fields without a value', () => {
    const schema: OptionsSchema = {
      options: [],
      globals: [
        { name: 'default_speed', label: 'Default Speed', type: 'float', value: 0.5 },
        { name: 'frame_id', label: 'Frame', type: 'string', value: 'map' },
        { name: 'tags', label: 'Tags', type: 'list', item: { type: 'string' }, value: ['a', 'b'] },
        { name: 'unset', label: 'Unset', type: 'string' },
      ],
    };

    expect(extractGlobalsForExport(schema)).toEqual({ default_speed: 0.5, frame_id: 'map', tags: ['a', 'b'] });
  });

  it('returns no globals when the project has no option schema', () => {
    expect(extractGlobalsForExport(null)).toEqual({});
  });
});

describe('collectIntegerOptionKeys', () => {
  it('collects integer fields, including nested, list, map and union ones, but not float fields', () => {
    const schema: OptionsSchema = {
      options: [
        { name: 'countdown_ms', label: 'Countdown', type: 'integer' },
        { name: 'speed', label: 'Speed', type: 'float' },
        { name: 'ids', label: 'Ids', type: 'list', item: { type: 'integer' } },
        { name: 'names', label: 'Names', type: 'list', item: { type: 'string' } },
        { name: 'counts', label: 'Counts', type: 'map', value_type: { type: 'integer' } },
        {
          name: 'actions',
          label: 'Actions',
          type: 'list',
          item: {
            type: 'union',
            variants: [{ value: 'wait', fields: [{ name: 'retries', label: 'Retries', type: 'integer' }] }],
          },
        },
        {
          name: 'limits',
          label: 'Limits',
          type: 'object',
          fields: [{ name: 'max_count', label: 'Max', type: 'integer' }],
        },
      ],
      globals: [{ name: 'default_retries', label: 'Retries', type: 'integer', value: 3 }],
    };

    expect(collectIntegerOptionKeys(schema)).toEqual([
      'countdown_ms',
      'counts',
      'default_retries',
      'ids',
      'max_count',
      'retries',
    ]);
  });

  it('returns nothing when the project has no option schema', () => {
    expect(collectIntegerOptionKeys(null)).toEqual([]);
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
      options: [{ name: 'speed', label: 'Speed', type: 'float', default: 1.5 }],
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
    // raw_options には未入力の speed を補完しない。
    expect(result[0].raw_options).toEqual({ custom_val: 42 });

    expect(result[1].index).toBe(2);
    expect(result[1].id).toBe('node-2');
    expect(result[1].x).toBe(3.0);
    expect(result[1].y).toBe(4.0);
    expect(result[1].yaw).toBeCloseTo(Math.PI / 2);
    expect(result[1].options.speed).toBe(1.5);
    expect(result[1].raw_options).toEqual({});
  });

  it('resolves defaults inside nested union fields for options, while raw_options keeps only explicit input', () => {
    const nodes: Record<string, WaypointNode> = {
      'node-1': {
        id: 'node-1',
        type: 'manual',
        transform: { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
        options: { on_reached_actions: [{ type: 'wait' }] },
        children_ids: [],
      },
    };
    const schema: OptionsSchema = {
      options: [
        {
          name: 'on_reached_actions',
          label: 'Actions',
          type: 'list',
          item: {
            type: 'union',
            discriminator: 'type',
            variants: [
              {
                value: 'wait',
                fields: [{ name: 'countdown_ms', label: 'Countdown', type: 'integer', default: 3000 }],
              },
            ],
          },
        },
      ],
      globals: [],
    };

    const [result] = extractWaypointsForExport(['node-1'], nodes, schema);

    expect(result.options.on_reached_actions).toEqual([{ type: 'wait', countdown_ms: 3000 }]);
    expect(result.raw_options.on_reached_actions).toEqual([{ type: 'wait' }]);
  });
});

describe('countWaypointsWithInvalidOptions', () => {
  const nodesTree = (options: Record<string, any>[]): Record<string, WaypointNode> =>
    Object.fromEntries(
      options.map((opt, i) => [
        `node-${i}`,
        {
          id: `node-${i}`,
          type: 'manual' as const,
          transform: { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
          options: opt,
          children_ids: [],
        },
      ]),
    );

  it('returns 0 when there is no schema, or none of its options are required', () => {
    const nodes = nodesTree([{}]);
    expect(countWaypointsWithInvalidOptions(['node-0'], nodes, null)).toBe(0);

    const schema: OptionsSchema = { options: [{ name: 'speed', label: 'Speed', type: 'float' }], globals: [] };
    expect(countWaypointsWithInvalidOptions(['node-0'], nodes, schema)).toBe(0);
  });

  it('counts a waypoint missing a required top-level field with no default', () => {
    const schema: OptionsSchema = {
      options: [{ name: 'service', label: 'Service', type: 'string', required: true }],
      globals: [],
    };
    const nodes = nodesTree([{}, { service: '/foo' }]);
    expect(countWaypointsWithInvalidOptions(['node-0', 'node-1'], nodes, schema)).toBe(1);
  });

  it('does not count a required field that has a default', () => {
    const schema: OptionsSchema = {
      options: [{ name: 'mode', label: 'Mode', type: 'string', required: true, default: 'normal' }],
      globals: [],
    };
    const nodes = nodesTree([{}]);
    expect(countWaypointsWithInvalidOptions(['node-0'], nodes, schema)).toBe(0);
  });

  it('counts a waypoint missing a required field nested inside a union variant', () => {
    const schema: OptionsSchema = {
      options: [
        {
          name: 'on_reached_actions',
          label: 'Actions',
          type: 'list',
          item: {
            type: 'union',
            discriminator: 'type',
            variants: [
              { value: 'service', fields: [{ name: 'service', label: 'Service', type: 'string', required: true }] },
            ],
          },
        },
      ],
      globals: [],
    };
    const nodes = nodesTree([
      { on_reached_actions: [{ type: 'service' }] },
      { on_reached_actions: [{ type: 'service', service: '/foo' }] },
    ]);
    expect(countWaypointsWithInvalidOptions(['node-0', 'node-1'], nodes, schema)).toBe(1);
  });

  it('counts a waypoint whose value does not match the declared choices', () => {
    const schema: OptionsSchema = {
      options: [{ name: 'mode', label: 'Mode', type: 'string', enum_values: ['normal', 'queue_wait'] }],
      globals: [],
    };
    const nodes = nodesTree([{ mode: 'bogus' }, { mode: 'normal' }]);
    expect(countWaypointsWithInvalidOptions(['node-0', 'node-1'], nodes, schema)).toBe(1);
  });

  it('counts a waypoint referencing an undefined preset', () => {
    const schema: OptionsSchema = {
      options: [{ name: 'tolerance', label: 'Tolerance', type: 'float', presets: [{ name: 'small', value: 0.1 }] }],
      globals: [],
    };
    const nodes = nodesTree([{ tolerance: { $preset: 'unknown' } }, { tolerance: { $preset: 'small' } }]);
    expect(countWaypointsWithInvalidOptions(['node-0', 'node-1'], nodes, schema)).toBe(1);
  });
});

describe('presets in export output', () => {
  const nodesTree = (options: Record<string, any>[]): Record<string, WaypointNode> =>
    Object.fromEntries(
      options.map((opt, i) => [
        `node-${i}`,
        {
          id: `node-${i}`,
          type: 'manual' as const,
          transform: { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
          options: opt,
          children_ids: [],
        },
      ]),
    );

  it('resolves a preset reference in both options and raw_options, without applying the schema default in raw_options', () => {
    const schema: OptionsSchema = {
      options: [
        {
          name: 'tolerance',
          label: 'Tolerance',
          type: 'float',
          default: 0.2,
          presets: [{ name: 'small', value: 0.1 }],
        },
        { name: 'unset', label: 'Unset', type: 'float', default: 9 },
      ],
      globals: [],
    };
    const nodes = nodesTree([{ tolerance: { $preset: 'small' } }]);
    const [wp] = extractWaypointsForExport(['node-0'], nodes, schema);
    expect(wp.raw_options).toEqual({ tolerance: 0.1 });
    expect(wp.options).toEqual({ tolerance: 0.1, unset: 9 });
  });

  it('resolves a preset reference used as a global value', () => {
    const schema: OptionsSchema = {
      options: [],
      globals: [
        {
          name: 'default_tolerance',
          label: 'Default Tolerance',
          type: 'float',
          value: { $preset: 'small' } as any,
          presets: [{ name: 'small', value: 0.1 }],
        },
      ],
    };
    expect(extractGlobalsForExport(schema)).toEqual({ default_tolerance: 0.1 });
  });
});

describe('export of a field whose default is linked to a global', () => {
  it('exports the linked global value in options for an omitted field, and keeps it out of raw_options', () => {
    const nodes: Record<string, WaypointNode> = {
      'node-1': {
        id: 'node-1',
        type: 'manual',
        transform: { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
        options: {},
        children_ids: [],
      },
    };
    const schema = normalizeOptionsSchema({
      options: [{ name: 'through', label: 'Through', type: 'boolean', default: true, default_global: 'g_through' }],
      globals: [{ name: 'g_through', label: 'G', type: 'boolean', value: false }],
    });

    const [wp] = extractWaypointsForExport(['node-1'], nodes, schema, 0);

    expect(wp.options.through).toBe(false);
    expect(wp.raw_options).toEqual({});
  });
});
