import { describe, it, expect } from 'vitest';
import { clipContains, halfOfBounds, mapWorldBounds } from './mapClip';
import { makeResolvedMapLayer } from '../test/fixtures';

describe('mapWorldBounds', () => {
  it('covers the map from its origin by width and height × resolution', () => {
    const map = makeResolvedMapLayer('m', { width: 200, height: 100, info: { resolution: 0.1, origin: [-5, 2, 0] } });
    expect(mapWorldBounds(map)).toEqual({ minX: -5, minY: 2, maxX: 15, maxY: 12 });
  });

  it('follows a rotated map', () => {
    const map = makeResolvedMapLayer('m', {
      width: 10,
      height: 10,
      info: { resolution: 1, origin: [0, 0, Math.PI / 2] },
    });
    const b = mapWorldBounds(map);
    expect(b.minX).toBeCloseTo(-10);
    expect(b.maxX).toBeCloseTo(0);
    expect(b.maxY).toBeCloseTo(10);
  });
});

describe('halfOfBounds', () => {
  const bounds = { minX: 0, minY: 0, maxX: 10, maxY: 4 };

  it.each([
    ['left', { x: 0, y: 0, width: 5, height: 4 }],
    ['right', { x: 5, y: 0, width: 5, height: 4 }],
    ['bottom', { x: 0, y: 0, width: 10, height: 2 }],
    ['top', { x: 0, y: 2, width: 10, height: 2 }],
  ] as const)('%s half', (side, rect) => {
    expect(halfOfBounds(bounds, side)).toEqual(rect);
  });

  it('gives the left and right halves no overlap and no gap along their shared edge', () => {
    const left = { rects: [halfOfBounds(bounds, 'left')] };
    const right = { rects: [halfOfBounds(bounds, 'right')] };
    for (const x of [0, 4.99, 5, 9.99]) {
      expect([clipContains(left, x, 1), clipContains(right, x, 1)].filter(Boolean)).toHaveLength(1);
    }
  });
});

describe('clipContains', () => {
  it('uses the whole map when there is no clip', () => {
    expect(clipContains(null, 1e9, -1e9)).toBe(true);
  });

  it('is the union of its rectangles', () => {
    const l = {
      rects: [
        { x: 0, y: 0, width: 2, height: 4 },
        { x: 2, y: 0, width: 2, height: 2 },
      ],
    };
    expect(clipContains(l, 1, 3)).toBe(true);
    expect(clipContains(l, 3, 1)).toBe(true);
    expect(clipContains(l, 3, 3)).toBe(false);
  });
});
