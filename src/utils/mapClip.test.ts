import { describe, it, expect } from 'vitest';
import {
  CLIP_HANDLES,
  clipContains,
  halfOfBounds,
  handlePosition,
  mapWorldBounds,
  moveClipWithPose,
  rectFromCorners,
  resizeRect,
  sameClip,
} from './mapClip';
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

describe('rectFromCorners', () => {
  it.each([
    ['down-right', { x: 1, y: 2 }, { x: 4, y: 7 }],
    ['up-left', { x: 4, y: 7 }, { x: 1, y: 2 }],
    ['down-left', { x: 4, y: 2 }, { x: 1, y: 7 }],
  ])('spans the same rectangle whichever direction the drag went (%s)', (_, a, b) => {
    expect(rectFromCorners(a, b)).toEqual({ x: 1, y: 2, width: 3, height: 5 });
  });
});

describe('resizeRect', () => {
  const rect = { x: 0, y: 0, width: 4, height: 2 };

  it('moves only the edge the handle is on', () => {
    expect(resizeRect(rect, { hx: 1, hy: 0 }, { x: 10, y: 99 })).toEqual({ x: 0, y: 0, width: 10, height: 2 });
    expect(resizeRect(rect, { hx: 0, hy: 1 }, { x: 99, y: 5 })).toEqual({ x: 0, y: 0, width: 4, height: 5 });
    expect(resizeRect(rect, { hx: -1, hy: 0 }, { x: -3, y: 99 })).toEqual({ x: -3, y: 0, width: 7, height: 2 });
  });

  it('moves both edges of a corner handle and keeps the opposite corner fixed', () => {
    expect(resizeRect(rect, { hx: -1, hy: -1 }, { x: 1, y: -1 })).toEqual({ x: 1, y: -1, width: 3, height: 3 });
  });

  it('flips instead of going negative when dragged past the opposite edge', () => {
    expect(resizeRect(rect, { hx: 1, hy: 0 }, { x: -2, y: 0 })).toEqual({ x: -2, y: 0, width: 2, height: 2 });
  });

  it('is grabbed where the handle is drawn', () => {
    for (const handle of CLIP_HANDLES) {
      const at = handlePosition(rect, handle);
      // dragging a handle onto where it already is changes nothing
      expect(resizeRect(rect, handle, at)).toEqual(rect);
    }
    expect(CLIP_HANDLES).toHaveLength(8);
  });
});

describe('moveClipWithPose', () => {
  const clip = { rects: [{ x: 2, y: 0, width: 2, height: 1 }] };

  it('has nothing to move without a clip', () => {
    expect(moveClipWithPose(null, [0, 0, 0], [5, 5, 0])).toBeNull();
  });

  it('shifts the clip by the translation of the map', () => {
    expect(moveClipWithPose(clip, [0, 0, 0], [1, -3, 0])).toEqual({ rects: [{ x: 3, y: -3, width: 2, height: 1 }] });
  });

  it('keeps the clip on the same part of the map across a quarter turn, swapping width and height', () => {
    // The clip centre is at (3, 0.5) in the world, i.e. 3 m along the map's x axis from its origin.
    const [rect] = moveClipWithPose(clip, [0, 0, 0], [0, 0, Math.PI / 2])!.rects;

    expect(rect.width).toBeCloseTo(1);
    expect(rect.height).toBeCloseTo(2);
    expect([rect.x + rect.width / 2, rect.y + rect.height / 2]).toEqual([expect.closeTo(-0.5), expect.closeTo(3)]);
  });

  it('keeps the size under a turn that is not a quarter turn', () => {
    const [rect] = moveClipWithPose(clip, [0, 0, 0], [0, 0, Math.PI / 6])!.rects;
    expect([rect.width, rect.height]).toEqual([2, 1]);
  });

  it('moves back to where it started when the pose is restored', () => {
    const away = moveClipWithPose(clip, [1, 1, 0.3], [4, -2, 1.9]);
    const [back] = moveClipWithPose(away, [4, -2, 1.9], [1, 1, 0.3])!.rects;
    expect([back.x, back.y]).toEqual([expect.closeTo(2), expect.closeTo(0)]);
  });
});

describe('sameClip', () => {
  const a = { rects: [{ x: 0, y: 0, width: 1, height: 1 }] };

  it('compares by area, not identity', () => {
    expect(sameClip(a, { rects: [{ x: 0, y: 0, width: 1, height: 1 }] })).toBe(true);
    expect(sameClip(a, { rects: [{ x: 0, y: 0, width: 2, height: 1 }] })).toBe(false);
    expect(sameClip(a, { rects: [...a.rects, ...a.rects] })).toBe(false);
  });

  it('treats no clip as different from any clip', () => {
    expect(sameClip(null, null)).toBe(true);
    expect(sameClip(null, a)).toBe(false);
    expect(sameClip(a, null)).toBe(false);
  });
});
