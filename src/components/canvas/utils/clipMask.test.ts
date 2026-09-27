import { describe, it, expect } from 'vitest';
import type { Graphics } from 'pixi.js';
import { drawClipMask } from './clipMask';
import { createGraphicsRecorder } from '../../../test/mocks/pixi';

const paint = (clip: Parameters<typeof drawClipMask>[1]) => {
  const g = createGraphicsRecorder();
  drawClipMask(g as unknown as Graphics, clip);
  return g.calls;
};

describe('drawClipMask', () => {
  it('fills exactly the clip rectangles in world coordinates', () => {
    const calls = paint({
      rects: [
        { x: 0, y: 0, width: 2, height: 4 },
        { x: 2, y: 0, width: 2, height: 2 },
      ],
    });

    expect(calls.filter((c) => c.method === 'rect').map((c) => c.args)).toEqual([
      [0, 0, 2, 4],
      [2, 0, 2, 2],
    ]);
    expect(calls.filter((c) => c.method === 'fill')).toHaveLength(2);
  });

  it('paints nothing when there is no clip', () => {
    expect(paint(null).filter((c) => c.method === 'rect')).toHaveLength(0);
  });
});
