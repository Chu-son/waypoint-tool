import { describe, it, expect } from 'vitest';
import {
  extractAnnotationsFromRawResult,
  extractCustomLayerItems,
  extractWaypointsFromRawResult,
  pluginWaypointTransform,
  toBaselineWaypoints,
  captureSourceSnapshot,
  flattenSourceSnapshot,
} from './pluginResult';
import type { WaypointNode } from '../types/store';
import { quaternionToYaw } from './transformUtils';

describe('pluginWaypointTransform', () => {
  it('builds the orientation from yaw when no quaternion is given', () => {
    const t = pluginWaypointTransform({ x: 1, y: 2, yaw: Math.PI / 2 });
    expect(t).toMatchObject({ x: 1, y: 2, z: 0 });
    expect(quaternionToYaw(t)).toBeCloseTo(Math.PI / 2);
  });

  it('prefers an explicit quaternion over yaw', () => {
    expect(pluginWaypointTransform({ x: 0, y: 0, yaw: 1, qz: 0, qw: 1 })).toMatchObject({ qz: 0, qw: 1 });
  });

  it('copies an explicit transform', () => {
    const transform = { x: 3, y: 4, qx: 0, qy: 0, qz: 0, qw: 1 };
    const t = pluginWaypointTransform({ transform });
    expect(t).toEqual(transform);
    expect(t).not.toBe(transform);
  });
});

describe('extractCustomLayerItems', () => {
  it('reads a custom_layers list or a single bare layer', () => {
    expect(extractCustomLayerItems({ custom_layers: [{ name: 'a' }] })).toEqual([{ name: 'a' }]);
    const bare = { image_base64: 'x', info: {} };
    expect(extractCustomLayerItems(bare)).toEqual([bare]);
    expect(extractCustomLayerItems({ waypoints: [] })).toEqual([]);
  });
});

describe('extractAnnotationsFromRawResult', () => {
  it('reads an annotations list or the grouped form', () => {
    expect(extractAnnotationsFromRawResult({ annotations: [{ type: 'point' }] }).items).toEqual([{ type: 'point' }]);
    expect(
      extractAnnotationsFromRawResult({
        annotations: { name: 'Zones', items: [{ type: 'rect' }], plugin_data: { n: 1 } },
      }),
    ).toEqual({ items: [{ type: 'rect' }], groupName: 'Zones', pluginData: { n: 1 } });
    expect(extractAnnotationsFromRawResult(null).items).toEqual([]);
  });
});

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

  it('keeps stash_keys from the columnar format', () => {
    const { items } = extractWaypointsFromRawResult({
      waypoints: { columnar: true, count: 2, x: [0, 1], y: [0, 0], stash_keys: ['orig:0', 'orig:1'] },
    });
    expect(items.map((i) => i.stash_key)).toEqual(['orig:0', 'orig:1']);
  });
});

describe('toBaselineWaypoints', () => {
  it('records the stash_key of each generated waypoint', () => {
    const baseline = toBaselineWaypoints([
      { x: 0, y: 0, stash_key: 'orig:0' },
      { x: 1, y: 0 },
    ]);
    expect(baseline.map((b) => b.stash_key)).toEqual(['orig:0', undefined]);
  });
});

describe('captureSourceSnapshot / flattenSourceSnapshot', () => {
  const t = (x: number) => ({ x, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 });
  const makeNodes = (): Record<string, WaypointNode> => ({
    a: { id: 'a', type: 'manual', name: 'A', transform: t(0), options: { stop: true } },
    g: { id: 'g', type: 'group', name: 'G', children_ids: ['g1', 'inner'] },
    g1: { id: 'g1', type: 'manual', transform: t(1) },
    inner: { id: 'inner', type: 'generator', children_ids: ['i1'] },
    i1: { id: 'i1', type: 'manual', transform: t(2) },
    empty: { id: 'empty', type: 'group', children_ids: [] },
    b: { id: 'b', type: 'manual', transform: t(3) },
  });

  it('lists the waypoints in tree order with their name and options', () => {
    const nodes = makeNodes();
    const range = flattenSourceSnapshot(captureSourceSnapshot(['b', 'a'], nodes));

    expect(range).toEqual([
      { id: 'b', name: undefined, transform: t(3), options: undefined, group_path: [] },
      { id: 'a', name: 'A', transform: t(0), options: { stop: true }, group_path: [] },
    ]);
  });

  it('descends into groups and nested generators and tags each waypoint with its containers', () => {
    const range = flattenSourceSnapshot(captureSourceSnapshot(['a', 'g', 'empty', 'b'], makeNodes()));

    expect(range.map((w) => [w.id, w.group_path])).toEqual([
      ['a', []],
      ['g1', ['g']],
      ['i1', ['g', 'inner']],
      ['b', []],
    ]);
  });

  it('keeps the whole subtree, empty groups included, for restoring', () => {
    const snapshot = captureSourceSnapshot(['g', 'empty'], makeNodes());

    expect(snapshot.topLevelIds).toEqual(['g', 'empty']);
    expect(Object.keys(snapshot.nodes).sort()).toEqual(['empty', 'g', 'g1', 'i1', 'inner']);
  });

  it('is a copy, so later edits to the nodes do not change the snapshot', () => {
    const nodes = makeNodes();
    const snapshot = captureSourceSnapshot(['a'], nodes);
    nodes.a.transform!.x = 99;

    expect(flattenSourceSnapshot(snapshot)[0].transform.x).toBe(0);
  });

  it('rejects a range that contains a node which no longer exists', () => {
    expect(() => captureSourceSnapshot(['a', 'gone'], makeNodes())).toThrow(/no longer exists/);
  });
});
