import { describe, expect, it } from 'vitest';
import { rotateAlignmentAboutOrigin, translateAlignment } from './alignDrag';

describe('translateAlignment', () => {
  it('moves the map by the pointer movement and keeps its rotation', () => {
    const result = translateAlignment({ dx: 1, dy: 2, yawDeg: 30 }, { x: 10, y: 10 }, { x: 13, y: 6 });
    expect(result).toEqual({ dx: 4, dy: -2, yawDeg: 30 });
  });

  it('returns to the initial position when the pointer returns to where it started', () => {
    const initial = { dx: 5, dy: 5, yawDeg: 10 };
    expect(translateAlignment(initial, { x: 3, y: 3 }, { x: 3, y: 3 })).toEqual(initial);
  });
});

describe('rotateAlignmentAboutOrigin', () => {
  const initial = { dx: 10, dy: 20, yawDeg: 0 };

  it('turns the map counter-clockwise when the pointer circles the origin counter-clockwise', () => {
    // pointer goes from east of the origin to north of the origin: +90°
    const result = rotateAlignmentAboutOrigin(initial, { x: 15, y: 20 }, { x: 10, y: 25 });
    expect(result.yawDeg).toBeCloseTo(90, 9);
  });

  it('adds to the existing rotation', () => {
    const result = rotateAlignmentAboutOrigin({ ...initial, yawDeg: 30 }, { x: 15, y: 20 }, { x: 10, y: 25 });
    expect(result.yawDeg).toBeCloseTo(120, 9);
  });

  it('does not depend on how far from the origin the pointer is', () => {
    const near = rotateAlignmentAboutOrigin(initial, { x: 11, y: 20 }, { x: 10, y: 21 });
    const far = rotateAlignmentAboutOrigin(initial, { x: 110, y: 20 }, { x: 10, y: 120 });
    expect(near.yawDeg).toBeCloseTo(far.yawDeg, 9);
  });

  it('keeps the origin where it is', () => {
    const result = rotateAlignmentAboutOrigin(initial, { x: 15, y: 20 }, { x: 0, y: 30 });
    expect(result.dx).toBe(10);
    expect(result.dy).toBe(20);
  });

  it('keeps the yaw within -180..180 when rotating past a half turn', () => {
    const result = rotateAlignmentAboutOrigin({ ...initial, yawDeg: 170 }, { x: 15, y: 20 }, { x: 10, y: 25 });
    expect(result.yawDeg).toBeCloseTo(-100, 9);
  });

  it('gives no rotation when the pointer has not moved', () => {
    expect(rotateAlignmentAboutOrigin(initial, { x: 15, y: 20 }, { x: 15, y: 20 }).yawDeg).toBe(0);
  });
});
