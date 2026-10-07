import { describe, it, expect } from 'vitest';
import {
  detectGeneratorModifications,
  computeGeneratorStash,
  applyGeneratorStash,
  resolveGeneratorStash,
  normalizeAngle,
  areOptionsEqual,
} from './generatorStashUtils';
import { WaypointNode, Transform, WaypointOptions } from '../types/store';
import { yawToQuaternion } from './transformUtils';

describe('generatorStashUtils', () => {
  const makeTransform = (x: number, y: number, yaw: number): Transform => {
    const q = yawToQuaternion(yaw);
    return { x, y, z: 0, ...q };
  };

  describe('normalizeAngle', () => {
    it('normalizes angles within [-PI, PI]', () => {
      expect(normalizeAngle(0)).toBe(0);
      expect(normalizeAngle(Math.PI * 3)).toBeCloseTo(Math.PI);
      expect(normalizeAngle(-Math.PI * 3)).toBeCloseTo(-Math.PI);
      expect(normalizeAngle(Math.PI / 2)).toBeCloseTo(Math.PI / 2);
    });
  });

  describe('areOptionsEqual', () => {
    it('correctly compares options', () => {
      expect(areOptionsEqual(undefined, undefined)).toBe(true);
      expect(areOptionsEqual({}, undefined)).toBe(true);
      expect(areOptionsEqual({ a: 1 }, { a: 1 })).toBe(true);
      expect(areOptionsEqual({ a: 1 }, { a: 2 })).toBe(false);
      expect(areOptionsEqual({ a: [1, 2] }, { a: [1, 2] })).toBe(true);
      expect(areOptionsEqual({ a: [1, 2] }, { a: [1, 3] })).toBe(false);
    });

    it('deeply compares nested object_list/union values (e.g. on_reached_actions)', () => {
      const a: WaypointOptions = { on_reached_actions: [{ type: 'wait', countdown_ms: 3000 }, { type: 'amcl_reset' }] };
      const b: WaypointOptions = { on_reached_actions: [{ type: 'wait', countdown_ms: 3000 }, { type: 'amcl_reset' }] };
      const c: WaypointOptions = { on_reached_actions: [{ type: 'wait', countdown_ms: 4000 }, { type: 'amcl_reset' }] };

      expect(areOptionsEqual(a, b)).toBe(true);
      expect(areOptionsEqual(a, c)).toBe(false);
    });
  });

  describe('detectGeneratorModifications & computeGeneratorStash', () => {
    it('returns no modifications when baseline is missing or identical to children', () => {
      const parentNode: WaypointNode = {
        id: 'gen-1',
        type: 'generator',
        children_ids: ['child-0', 'child-1'],
        baseline_waypoints: [
          { transform: makeTransform(0, 0, 0), options: { speed: 1.0 }, name: 'WP0' },
          { transform: makeTransform(1, 0, 0), options: { speed: 1.0 }, name: 'WP1' },
        ],
      };

      const nodes: Record<string, WaypointNode> = {
        'child-0': {
          id: 'child-0',
          type: 'manual',
          transform: makeTransform(0, 0, 0),
          options: { speed: 1.0 },
          name: 'WP0',
        },
        'child-1': {
          id: 'child-1',
          type: 'manual',
          transform: makeTransform(1, 0, 0),
          options: { speed: 1.0 },
          name: 'WP1',
        },
      };

      const summary = detectGeneratorModifications(parentNode, nodes);
      expect(summary.hasModifications).toBe(false);
      expect(summary.modifiedCount).toBe(0);
      expect(summary.diffs).toHaveLength(0);

      const stash = computeGeneratorStash(parentNode, nodes);
      expect(Object.keys(stash)).toHaveLength(0);
    });

    it('detects position, yaw, options, and name modifications', () => {
      const parentNode: WaypointNode = {
        id: 'gen-1',
        type: 'generator',
        children_ids: ['child-0', 'child-1'],
        baseline_waypoints: [
          { transform: makeTransform(0, 0, 0), options: { speed: 1.0 }, name: 'WP0' },
          { transform: makeTransform(1, 0, 0), options: { speed: 1.0 }, name: 'WP1' },
        ],
      };

      const nodes: Record<string, WaypointNode> = {
        'child-0': {
          id: 'child-0',
          type: 'manual',
          // Position and yaw changed: x: 0.5, y: 0.2, yaw: PI/4
          transform: makeTransform(0.5, 0.2, Math.PI / 4),
          options: { speed: 1.0 },
          name: 'WP0',
        },
        'child-1': {
          id: 'child-1',
          type: 'manual',
          transform: makeTransform(1, 0, 0),
          options: { speed: 2.5 }, // Option changed
          name: 'CustomWP1', // Name changed
        },
      };

      const summary = detectGeneratorModifications(parentNode, nodes);
      expect(summary.hasModifications).toBe(true);
      expect(summary.modifiedCount).toBe(2);

      const diff0 = summary.diffs.find((d) => d.index === 0);
      expect(diff0?.hasTransformDiff).toBe(true);
      expect(diff0?.deltaX).toBeCloseTo(0.5);
      expect(diff0?.deltaY).toBeCloseTo(0.2);
      expect(diff0?.deltaYaw).toBeCloseTo(Math.PI / 4);

      const diff1 = summary.diffs.find((d) => d.index === 1);
      expect(diff1?.hasTransformDiff).toBe(false);
      expect(diff1?.modifiedOptions?.speed).toBe(2.5);
      expect(diff1?.customName).toBe('CustomWP1');

      const stash = computeGeneratorStash(parentNode, nodes);
      expect(stash[0]).toBeDefined();
      expect(stash[1]).toBeDefined();
    });

    it('handles count changes (deleted or added child nodes)', () => {
      const parentNode: WaypointNode = {
        id: 'gen-1',
        type: 'generator',
        children_ids: ['child-0'], // 1 node left, baseline had 2
        baseline_waypoints: [{ transform: makeTransform(0, 0, 0) }, { transform: makeTransform(1, 0, 0) }],
      };

      const nodes: Record<string, WaypointNode> = {
        'child-0': {
          id: 'child-0',
          type: 'manual',
          transform: makeTransform(0, 0, 0),
        },
      };

      const summary = detectGeneratorModifications(parentNode, nodes);
      expect(summary.hasModifications).toBe(true);
      expect(summary.hasCountChanged).toBe(true);
    });
  });

  describe('applyGeneratorStash', () => {
    it('applies position, yaw, options, and name to regenerated waypoints', () => {
      const newGeneratedWaypoints = [
        { x: 10, y: 10, yaw: 0, options: { speed: 0.5 }, name: 'Gen0' },
        { x: 20, y: 10, yaw: 0, options: { speed: 0.5 }, name: 'Gen1' },
      ];

      const stash = {
        0: {
          index: 0,
          hasTransformDiff: true,
          deltaX: 0.5,
          deltaY: -0.2,
          deltaZ: 0,
          deltaYaw: Math.PI / 2,
          modifiedOptions: { speed: 1.5, stop: true },
          customName: 'Custom0',
        },
      };

      const applied = applyGeneratorStash(newGeneratedWaypoints, stash);

      // Index 0 has modifications applied
      expect(applied[0].x).toBeCloseTo(10.5);
      expect(applied[0].y).toBeCloseTo(9.8);
      expect(applied[0].yaw).toBeCloseTo(Math.PI / 2);
      expect(applied[0].options.speed).toBe(1.5);
      expect(applied[0].options.stop).toBe(true);
      expect(applied[0].name).toBe('Custom0');

      // Index 1 remains untouched
      expect(applied[1].x).toBe(20);
      expect(applied[1].y).toBe(10);
      expect(applied[1].name).toBe('Gen1');
    });

    it('safely handles index mismatch when regenerated point count decreases', () => {
      // Regenerated points decreased to 1 point
      const newGeneratedWaypoints = [{ x: 5, y: 5, yaw: 0 }];

      // Stash had modifications on index 0 and index 2
      const stash = {
        0: {
          index: 0,
          hasTransformDiff: true,
          deltaX: 1,
          deltaY: 0,
          deltaZ: 0,
          deltaYaw: 0,
        },
        2: {
          index: 2,
          hasTransformDiff: true,
          deltaX: 2,
          deltaY: 0,
          deltaZ: 0,
          deltaYaw: 0,
        },
      };

      const applied = applyGeneratorStash(newGeneratedWaypoints, stash);
      expect(applied).toHaveLength(1);
      expect(applied[0].x).toBe(6);
      // Index 2 is ignored cleanly without errors
    });

    it('safely handles index mismatch when regenerated point count increases', () => {
      // Regenerated points increased to 3 points
      const newGeneratedWaypoints = [
        { x: 0, y: 0, yaw: 0 },
        { x: 1, y: 0, yaw: 0 },
        { x: 2, y: 0, yaw: 0 },
      ];

      const stash = {
        0: {
          index: 0,
          hasTransformDiff: true,
          deltaX: 0.5,
          deltaY: 0,
          deltaZ: 0,
          deltaYaw: 0,
        },
      };

      const applied = applyGeneratorStash(newGeneratedWaypoints, stash);
      expect(applied).toHaveLength(3);
      expect(applied[0].x).toBe(0.5);
      expect(applied[1].x).toBe(1);
      expect(applied[2].x).toBe(2);
    });
  });
});

describe('generatorStashUtils - stash_key matching', () => {
  const tf = (x: number): Transform => ({ x, y: 0, z: 0, ...yawToQuaternion(0) });

  // baseline: orig:0, one interpolated point, orig:1
  const keyedBaseline = [
    { transform: tf(0), stash_key: 'orig:0' },
    { transform: tf(1), stash_key: 'seg:0:1/2' },
    { transform: tf(2), stash_key: 'orig:1' },
  ];
  const generator = (baseline: WaypointNode['baseline_waypoints']): WaypointNode => ({
    id: 'gen',
    type: 'generator',
    children_ids: ['c0', 'c1', 'c2'],
    baseline_waypoints: baseline,
  });
  const children = (overrides: Record<string, Partial<WaypointNode>> = {}): Record<string, WaypointNode> => ({
    c0: { id: 'c0', type: 'manual', transform: tf(0), ...overrides.c0 },
    c1: { id: 'c1', type: 'manual', transform: tf(1), ...overrides.c1 },
    c2: { id: 'c2', type: 'manual', transform: tf(2), ...overrides.c2 },
  });

  it('keeps an edit on the same point after the point count changes', () => {
    const stash = computeGeneratorStash(generator(keyedBaseline), children({ c2: { options: { stop: true } } }));

    // regenerated without the interpolated point (e.g. subdivision disabled)
    const regenerated = [
      { x: 0, y: 0, yaw: 0, stash_key: 'orig:0' },
      { x: 2, y: 0, yaw: 0, stash_key: 'orig:1' },
    ];
    const { waypoints, unmatched } = resolveGeneratorStash(regenerated, stash);

    expect(waypoints[1].options).toEqual({ stop: true });
    expect(waypoints[0].options).toBeUndefined();
    expect(unmatched).toBe(0);
  });

  it('reports an edit whose point no longer exists instead of applying it elsewhere', () => {
    const stash = computeGeneratorStash(generator(keyedBaseline), children({ c1: { transform: tf(1.2) } }));

    const regenerated = [
      { x: 0, y: 0, yaw: 0, stash_key: 'orig:0' },
      { x: 2, y: 0, yaw: 0, stash_key: 'orig:1' },
    ];
    const { waypoints, unmatched } = resolveGeneratorStash(regenerated, stash);

    expect(waypoints.map((w) => w.x)).toEqual([0, 2]);
    expect(unmatched).toBe(1);
  });

  it('does not apply keyed edits to output points that have no key', () => {
    const stash = computeGeneratorStash(generator(keyedBaseline), children({ c0: { transform: tf(0.5) } }));

    const { waypoints, unmatched } = resolveGeneratorStash([{ x: 0, y: 0, yaw: 0 }], stash);

    expect(waypoints[0].x).toBe(0);
    expect(unmatched).toBe(1);
  });

  it('reports a point the user appended after generation as unmatched', () => {
    const generatorWithExtra = { ...generator(keyedBaseline), children_ids: ['c0', 'c1', 'c2', 'c3'] };
    const nodes = { ...children(), c3: { id: 'c3', type: 'manual', transform: tf(9) } as WaypointNode };

    const stash = computeGeneratorStash(generatorWithExtra, nodes);
    const { unmatched } = resolveGeneratorStash(
      keyedBaseline.map((b) => ({ x: b.transform.x, y: 0, yaw: 0, stash_key: b.stash_key })),
      stash,
    );

    expect(unmatched).toBe(1);
  });

  it('falls back to index matching when only some baseline points have a key', () => {
    const partial = [keyedBaseline[0], { transform: tf(1) }, keyedBaseline[2]];
    const stash = computeGeneratorStash(generator(partial), children({ c1: { transform: tf(1.5) } }));

    const { waypoints, unmatched } = resolveGeneratorStash(
      [
        { x: 0, y: 0, yaw: 0 },
        { x: 1, y: 0, yaw: 0 },
      ],
      stash,
    );

    expect(waypoints[1].x).toBeCloseTo(1.5);
    expect(unmatched).toBe(0);
  });

  it('falls back to index matching when keys are duplicated', () => {
    const dup = [keyedBaseline[0], { transform: tf(1), stash_key: 'orig:0' }, keyedBaseline[2]];
    const stash = computeGeneratorStash(generator(dup), children({ c1: { transform: tf(1.5) } }));

    const { waypoints } = resolveGeneratorStash(
      [
        { x: 0, y: 0, yaw: 0, stash_key: 'orig:0' },
        { x: 1, y: 0, yaw: 0, stash_key: 'orig:0' },
      ],
      stash,
    );

    // applied by position, never by the duplicated key
    expect(waypoints[1].x).toBeCloseTo(1.5);
  });
});
