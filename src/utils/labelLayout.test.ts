import { describe, it, expect, vi } from 'vitest';

vi.mock('pixi.js', () => ({
  CanvasTextMetrics: {
    measureText: (text: string) => {
      const lines = text.split('\n');
      const width = Math.max(...lines.map(line => line.length)) * 7;
      const height = lines.length * 16;
      return { width, height };
    },
  },
  TextStyle: class {},
}));

import { TextStyle } from 'pixi.js';
import { computeLabelOffsets, measureLabelLines, LabelCandidate, LabelLayout } from './labelLayout';

const style = new TextStyle();
const scale = 1;

function getRect(candidate: LabelCandidate, layout: LabelLayout) {
  const safeScale = Math.max(scale, 0.001);
  const sx = candidate.worldX * safeScale;
  const sy = -candidate.worldY * safeScale;
  const left = sx + layout.x * safeScale;
  const top = sy + layout.y * safeScale - layout.height;
  return { left, top, width: layout.width, height: layout.height };
}

function intersects(a: { left: number; top: number; width: number; height: number }, b: { left: number; top: number; width: number; height: number }) {
  return a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;
}

describe('measureLabelLines', () => {
  it('複数行のテキストの幅・高さを実測する', () => {
    const { width, height } = measureLabelLines(['abc', 'de'], style);
    expect(width).toBe(3 * 7);
    expect(height).toBe(2 * 16);
  });
});

describe('computeLabelOffsets', () => {
  it('単独のWaypointはデフォルトオフセット(15px相当)のまま配置される', () => {
    const candidates: LabelCandidate[] = [
      { id: 'a', worldX: 0, worldY: 0, lines: ['Index: [0]'] },
    ];
    const result = computeLabelOffsets(candidates, scale, style);
    const layout = result.get('a')!;
    expect(layout.x).toBeCloseTo(15);
    expect(layout.y).toBeCloseTo(-15);
  });

  it('近接した2つのWaypointのラベルは重ならないよう縦にずらされる', () => {
    const candidates: LabelCandidate[] = [
      { id: 'a', worldX: 0, worldY: 0, lines: ['Index: [0]', 'Transform:', '  x: 0.000, y: 0.000'] },
      { id: 'b', worldX: 0.01, worldY: 0, lines: ['Index: [1]', 'Transform:', '  x: 0.010, y: 0.000'] },
    ];
    const result = computeLabelOffsets(candidates, scale, style);
    const rectA = getRect(candidates[0], result.get('a')!);
    const rectB = getRect(candidates[1], result.get('b')!);
    expect(intersects(rectA, rectB)).toBe(false);
  });

  it('同一座標に多数のWaypointが密集してもクラッシュせず値を返し、試行回数上限に達したら重なりを許容する', () => {
    const candidates: LabelCandidate[] = Array.from({ length: 10 }, (_, i) => ({
      id: `node-${i}`,
      worldX: 0,
      worldY: 0,
      lines: [`Index: [${i}]`],
    }));
    const result = computeLabelOffsets(candidates, scale, style, { maxAttempts: 3 });
    expect(result.size).toBe(10);
    candidates.forEach(candidate => {
      const layout = result.get(candidate.id)!;
      expect(Number.isFinite(layout.x)).toBe(true);
      expect(Number.isFinite(layout.y)).toBe(true);
    });

    const rects = candidates.map(candidate => getRect(candidate, result.get(candidate.id)!));
    const overlappingPairs = rects.slice(1).some((rect, i) => intersects(rect, rects[i]));
    expect(overlappingPairs).toBe(true);
  });

  it('戻り値のwidth/heightはmeasureLabelLinesの結果と一致する', () => {
    const lines = ['Index: [0]', 'Transform:'];
    const candidates: LabelCandidate[] = [{ id: 'a', worldX: 5, worldY: 5, lines }];
    const result = computeLabelOffsets(candidates, scale, style);
    const layout = result.get('a')!;
    const expected = measureLabelLines(lines, style);
    expect(layout.width).toBe(expected.width);
    expect(layout.height).toBe(expected.height);
  });
});
