import { describe, expect, it } from 'vitest';
import { buildWaypointsFromImport, DEFAULT_IMPORT_MAPPING, resolvePath } from './importUtils';
import { ImportFieldMapping, OptionsSchema } from '../types/store';

describe('resolvePath', () => {
  it('returns the object itself when path is empty', () => {
    const obj = { a: 1 };
    expect(resolvePath(obj, '')).toBe(obj);
    expect(resolvePath(obj, undefined)).toBe(obj);
  });

  it('resolves a nested dot path', () => {
    const obj = { position: { x: 1.5, y: 2.5 } };
    expect(resolvePath(obj, 'position.x')).toBe(1.5);
    expect(resolvePath(obj, 'position.y')).toBe(2.5);
  });

  it('returns undefined for a missing path', () => {
    const obj = { a: { b: 1 } };
    expect(resolvePath(obj, 'a.c.d')).toBeUndefined();
  });
});

describe('buildWaypointsFromImport', () => {
  it('parses the default root-array format', () => {
    const raw = [
      { id: 'wp1', x: 1, y: 2, z: 0, yaw: 0, options: {} },
      { id: 'wp2', x: 3, y: 4, yaw: Math.PI / 2, options: {} },
    ];

    const { nodes, errors } = buildWaypointsFromImport(raw, DEFAULT_IMPORT_MAPPING, null);

    expect(errors).toHaveLength(0);
    expect(nodes).toHaveLength(2);
    expect(nodes[0].transform?.x).toBe(1);
    expect(nodes[0].transform?.y).toBe(2);
    expect(nodes[1].transform?.qz).toBeCloseTo(Math.sin(Math.PI / 4));
    expect(nodes[1].transform?.qw).toBeCloseTo(Math.cos(Math.PI / 4));
  });

  it('resolves nested itemsPath and renamed fields', () => {
    const raw = {
      poses: [
        {
          label: 'wp_0',
          position: { x: 10, y: 20, z: 0 },
          orientation: { scalar: 1, x: 0, y: 0, z: 0 },
        },
      ],
    };

    const mapping: ImportFieldMapping = {
      itemsPath: 'poses',
      x: 'position.x',
      y: 'position.y',
      z: 'position.z',
      qw: 'orientation.scalar',
      qx: 'orientation.x',
      qy: 'orientation.y',
      qz: 'orientation.z',
    };

    const { nodes, errors } = buildWaypointsFromImport(raw, mapping, null);

    expect(errors).toHaveLength(0);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].transform).toEqual({ x: 10, y: 20, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 });
  });

  it('records an error and returns no nodes when itemsPath is not an array', () => {
    const { nodes, errors } = buildWaypointsFromImport({ foo: 'bar' }, { ...DEFAULT_IMPORT_MAPPING, itemsPath: 'foo' }, null);
    expect(nodes).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });

  it('skips an item missing x/y and continues with the rest', () => {
    const raw = [
      { id: 'wp1', x: 1, y: 2 },
      { id: 'wp2' },
      { id: 'wp3', x: 5, y: 6 },
    ];

    const { nodes, errors } = buildWaypointsFromImport(raw, DEFAULT_IMPORT_MAPPING, null);

    expect(nodes).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('#1');
  });

  it('coerces options according to the schema and fills in defaults', () => {
    const schema: OptionsSchema = {
      options: [
        { name: 'speed', label: 'Speed', type: 'float', default: 1.0 },
        { name: 'wait', label: 'Wait', type: 'integer', default: 0 },
        { name: 'dock', label: 'Dock', type: 'boolean', default: false },
      ],
    };

    const raw = [
      { id: 'wp1', x: 1, y: 2, options: { speed: '2.5', wait: '10', dock: 'true' } },
      { id: 'wp2', x: 3, y: 4, options: {} },
    ];

    const { nodes, errors } = buildWaypointsFromImport(raw, DEFAULT_IMPORT_MAPPING, schema);

    expect(errors).toHaveLength(0);
    expect(nodes[0].options).toEqual({ speed: 2.5, wait: 10, dock: true });
    expect(nodes[1].options).toEqual({ speed: 1.0, wait: 0, dock: false });
  });
});
