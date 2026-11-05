/**
 * Pure geometry of one rigid move in the plane: turn around a pivot, then shift. Shared by everything that
 * moves a set of things as one body (layer groups, waypoint and annotation groups).
 */
import type { Pose2D } from '../types/geometry';
import type { WorldBounds } from './mapClip';

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

/** Rounds away floating-point noise, so repeated moves that cancel out land on exact values. */
const tidy = (v: number): number => (Math.abs(v) < EPSILON ? 0 : Math.round(v * 1e9) / 1e9);

/** The pose after the transform, with its yaw wrapped to (-π, π]. */
export function composePose(pose: Pose2D, t: RigidTransform): Pose2D {
  const { x, y } = transformPoint(pose, t);
  return { x: tidy(x), y: tidy(y), yaw: tidy(wrapAngle(pose.yaw + t.dyaw)) };
}

/** The transform turning around `pivot` that takes `current` to `target`: `composePose(current, it)` is `target`. */
export function transformBetweenPoses(
  current: Pose2D,
  target: Pose2D,
  pivot: { x: number; y: number },
): RigidTransform {
  const dyaw = wrapAngle(target.yaw - current.yaw);
  const turned = transformPoint(current, { dx: 0, dy: 0, dyaw, pivot });
  return { dx: target.x - turned.x, dy: target.y - turned.y, dyaw, pivot };
}

// --- Shapes shared by hand-drawn layer objects and annotations (same field names) ---

export function transformRectLike<T extends { cx: number; cy: number; angle: number }>(shape: T, t: RigidTransform): T {
  const c = transformPoint({ x: shape.cx, y: shape.cy }, t);
  return { ...shape, cx: c.x, cy: c.y, angle: shape.angle + t.dyaw };
}

export function transformCircleLike<T extends { cx: number; cy: number }>(shape: T, t: RigidTransform): T {
  const c = transformPoint({ x: shape.cx, y: shape.cy }, t);
  return { ...shape, cx: c.x, cy: c.y };
}

export function transformLineLike<T extends { x1: number; y1: number; x2: number; y2: number }>(
  shape: T,
  t: RigidTransform,
): T {
  const a = transformPoint({ x: shape.x1, y: shape.y1 }, t);
  const b = transformPoint({ x: shape.x2, y: shape.y2 }, t);
  return { ...shape, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
}

export function rectLikeBounds(shape: {
  cx: number;
  cy: number;
  width: number;
  height: number;
  angle: number;
}): WorldBounds {
  const cos = Math.abs(Math.cos(shape.angle));
  const sin = Math.abs(Math.sin(shape.angle));
  const halfW = (shape.width * cos + shape.height * sin) / 2;
  const halfH = (shape.width * sin + shape.height * cos) / 2;
  return { minX: shape.cx - halfW, minY: shape.cy - halfH, maxX: shape.cx + halfW, maxY: shape.cy + halfH };
}

export function circleLikeBounds(shape: { cx: number; cy: number; radius: number }): WorldBounds {
  return {
    minX: shape.cx - shape.radius,
    minY: shape.cy - shape.radius,
    maxX: shape.cx + shape.radius,
    maxY: shape.cy + shape.radius,
  };
}

/** Box around a segment, widened by `halfWidth` on every side. */
export function lineLikeBounds(shape: { x1: number; y1: number; x2: number; y2: number }, halfWidth = 0): WorldBounds {
  return {
    minX: Math.min(shape.x1, shape.x2) - halfWidth,
    minY: Math.min(shape.y1, shape.y2) - halfWidth,
    maxX: Math.max(shape.x1, shape.x2) + halfWidth,
    maxY: Math.max(shape.y1, shape.y2) + halfWidth,
  };
}

/** One box around all `boxes`, or null when there are none. */
export function unionBounds(boxes: WorldBounds[]): WorldBounds | null {
  if (boxes.length === 0) return null;
  return {
    minX: Math.min(...boxes.map((b) => b.minX)),
    minY: Math.min(...boxes.map((b) => b.minY)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    maxY: Math.max(...boxes.map((b) => b.maxY)),
  };
}
