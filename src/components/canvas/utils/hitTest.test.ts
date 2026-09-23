import { describe, it, expect } from 'vitest';
import { findNearestObjectCenter, hitTestRectHandles } from './hitTest';
import { makePointAnnotation, makeTransform, makeWaypoint } from '../../../test/fixtures';

describe('hitTestRectHandles', () => {
  const data = {
    area: { center: { x: 0, y: 0 }, width: 10, height: 4, yaw: 0 },
    start: { x: 1, y: 1 }, // not a rectangle
  };

  // At zoom 100 px/m the 14 px grab radius is 0.14 m and the rotation handle sits 0.2 m above the top edge.
  const zoom = 100;

  it('finds the rotation handle above the top edge', () => {
    expect(hitTestRectHandles(data, { x: 0, y: 2.2 }, zoom)).toEqual({ key: 'area', handle: 'rotation' });
  });

  it.each([
    [{ x: -5, y: 2 }, 'min'],
    [{ x: 5, y: -2 }, 'max'],
    [{ x: 5, y: 2 }, 'topRight'],
    [{ x: -5, y: -2 }, 'bottomLeft'],
  ])('finds the corner at %j', (world, corner) => {
    expect(hitTestRectHandles(data, world, zoom)).toEqual({ key: 'area', handle: 'corner', corner });
  });

  it('follows the rectangle rotation', () => {
    const rotated = { area: { center: { x: 0, y: 0 }, width: 10, height: 4, yaw: Math.PI / 2 } };
    // With +90°, the local top-right corner (5, 2) sits at world (-2, 5).
    expect(hitTestRectHandles(rotated, { x: -2, y: 5 }, zoom)).toMatchObject({ corner: 'topRight' });
  });

  it('uses a grab radius that is constant on screen', () => {
    expect(hitTestRectHandles(data, { x: -5 + 0.1, y: 2 }, 100)).toMatchObject({ corner: 'min' });
    expect(hitTestRectHandles(data, { x: -5 + 0.2, y: 2 }, 100)).toBeNull();
  });

  it('returns null away from any handle', () => {
    expect(hitTestRectHandles(data, { x: 0, y: 0 }, zoom)).toBeNull();
  });
});

describe('findNearestObjectCenter', () => {
  const nodes = { a: makeWaypoint('a', { name: 'A', transform: makeTransform(0, 0) }) };
  const annotations = { p: makePointAnnotation('p', { name: 'P', x: 10, y: 0 }) };

  it('snaps to the closest waypoint or annotation within the screen radius', () => {
    expect(findNearestObjectCenter(9, 0, nodes, annotations, 10)).toMatchObject({ objectId: 'p', x: 10 });
    expect(findNearestObjectCenter(1, 0, nodes, annotations, 10)).toMatchObject({ objectId: 'a', objectType: 'node' });
  });

  it('returns null when nothing is close enough on screen', () => {
    expect(findNearestObjectCenter(5, 0, nodes, annotations, 10)).toBeNull();
  });
});
