import { describe, it, expect } from 'vitest';
import { getFootprintWidth } from './footprint';

describe('getFootprintWidth', () => {
  it.each([
    ['circular', { type: 'circular', radius: 0.4 } as const, 0.8],
    ['rectangular', { type: 'rectangular', length: 1, width: 0.6 } as const, 0.6],
    [
      'polygon (farthest vertex)',
      {
        type: 'polygon',
        points: [
          [0.3, 0.4],
          [-0.1, 0.1],
          [0, -0.2],
        ],
      } as const,
      1.0,
    ],
    ['polygon smaller than the minimum', { type: 'polygon', points: [[0.1, 0]] } as const, 0.5],
  ])('%s', (_name, footprint, expected) => {
    expect(getFootprintWidth(footprint as any)).toBeCloseTo(expected);
  });
});
