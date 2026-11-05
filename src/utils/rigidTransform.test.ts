import { describe, it, expect } from 'vitest';
import {
  composePose,
  transformBetweenPoses,
  transformRectLike,
  unionBounds,
  type RigidTransform,
} from './rigidTransform';

const turn = (dyaw: number, pivot = { x: 0, y: 0 }): RigidTransform => ({ dx: 0, dy: 0, dyaw, pivot });

describe('composePose', () => {
  it('moves the position like a point and turns the heading', () => {
    const pose = composePose({ x: 2, y: 0, yaw: 0.25 }, turn(Math.PI / 2, { x: 1, y: 0 }));

    expect(pose.x).toBeCloseTo(1);
    expect(pose.y).toBeCloseTo(1);
    expect(pose.yaw).toBeCloseTo(0.25 + Math.PI / 2);
  });

  it('keeps the heading within (-π, π]', () => {
    expect(composePose({ x: 0, y: 0, yaw: 3 }, turn(1)).yaw).toBeCloseTo(4 - 2 * Math.PI);
  });

  it('keeps a pose at the origin as a pose (not as "nothing")', () => {
    expect(composePose({ x: 1, y: 0, yaw: 0 }, { dx: -1, dy: 0, dyaw: 0, pivot: { x: 0, y: 0 } })).toEqual({
      x: 0,
      y: 0,
      yaw: 0,
    });
  });
});

describe('transformBetweenPoses', () => {
  it.each([
    ['a shift', { x: 1, y: 2, yaw: 0 }, { x: 4, y: -1, yaw: 0 }],
    ['a turn on the spot', { x: 1, y: 2, yaw: 0.5 }, { x: 1, y: 2, yaw: -1 }],
    ['a turn and a shift', { x: -3, y: 0, yaw: 1 }, { x: 5, y: 5, yaw: 2.5 }],
  ])('takes the current pose to the target with %s', (_, current, target) => {
    const t = transformBetweenPoses(current, target, current);

    const reached = composePose(current, t);
    expect(reached.x).toBeCloseTo(target.x);
    expect(reached.y).toBeCloseTo(target.y);
    expect(reached.yaw).toBeCloseTo(target.yaw);
  });

  it('turns around the given pivot', () => {
    const t = transformBetweenPoses({ x: 1, y: 0, yaw: 0 }, { x: 1, y: 0, yaw: Math.PI / 2 }, { x: 1, y: 0 });

    expect(t.pivot).toEqual({ x: 1, y: 0 });
    expect(t.dx).toBeCloseTo(0);
    expect(t.dy).toBeCloseTo(0);
  });
});

describe('shapes', () => {
  it('turns a rect-like shape around the pivot and keeps its other fields', () => {
    const moved = transformRectLike({ id: 'r', cx: 2, cy: 0, angle: 0.1, width: 3 }, turn(Math.PI / 2));

    expect(moved.cx).toBeCloseTo(0);
    expect(moved.cy).toBeCloseTo(2);
    expect(moved.angle).toBeCloseTo(0.1 + Math.PI / 2);
    expect(moved).toMatchObject({ id: 'r', width: 3 });
  });

  it('joins boxes, and has nothing to join when there are none', () => {
    expect(
      unionBounds([
        { minX: 0, minY: 0, maxX: 1, maxY: 1 },
        { minX: -2, minY: 0.5, maxX: 0.5, maxY: 3 },
      ]),
    ).toEqual({ minX: -2, minY: 0, maxX: 1, maxY: 3 });
    expect(unionBounds([])).toBeNull();
  });
});
