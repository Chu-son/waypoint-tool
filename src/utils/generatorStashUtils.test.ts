import { describe, it, expect } from 'vitest';
import {
  detectGeneratorModifications,
  computeGeneratorStash,
  applyGeneratorStash,
  normalizeAngle,
  areOptionsEqual,
} from './generatorStashUtils';
import { WaypointNode, Transform } from '../types/store';
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
        baseline_waypoints: [
          { transform: makeTransform(0, 0, 0) },
          { transform: makeTransform(1, 0, 0) },
        ],
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
      const newGeneratedWaypoints = [
        { x: 5, y: 5, yaw: 0 },
      ];

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
