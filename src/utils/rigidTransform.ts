/**
 * Pure geometry of one rigid move in the plane: turn around a pivot, then shift. Shared by everything that
 * moves a set of things as one body (layer groups, waypoint and annotation groups).
 */

export type Pose = [number, number, number];

/** Turns by `dyaw` (radians, counter-clockwise) around `pivot`, then shifts by (`dx`, `dy`) meters. */
export interface RigidTransform {
  dx: number;
  dy: number;
  dyaw: number;
  pivot: { x: number; y: number };
}

export const isIdentityTransform = (t: RigidTransform): boolean => t.dx === 0 && t.dy === 0 && t.dyaw === 0;

export function transformPoint(p: { x: number; y: number }, t: RigidTransform): { x: number; y: number } {
  const cos = Math.cos(t.dyaw);
  const sin = Math.sin(t.dyaw);
  const rx = p.x - t.pivot.x;
  const ry = p.y - t.pivot.y;
  return { x: t.pivot.x + rx * cos - ry * sin + t.dx, y: t.pivot.y + rx * sin + ry * cos + t.dy };
}

/** A pose `[x, y, yaw]` after the transform: its position moves like a point and its yaw turns with it. */
export function transformPose(pose: Pose, t: RigidTransform): Pose {
  const { x, y } = transformPoint({ x: pose[0], y: pose[1] }, t);
  return [x, y, pose[2] + t.dyaw];
}

const EPSILON = 1e-9;

/** Wraps an angle to (-π, π]. */
export const wrapAngle = (yaw: number): number => {
  const wrapped = yaw - 2 * Math.PI * Math.floor((yaw + Math.PI) / (2 * Math.PI));
  return wrapped <= -Math.PI + EPSILON ? Math.PI : wrapped;
};
