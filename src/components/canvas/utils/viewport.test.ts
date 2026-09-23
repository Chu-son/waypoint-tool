import { describe, it, expect } from 'vitest';
import { contentBounds, fitViewport, screenToWorld, zoomAt, type Viewport } from './viewport';
import { makeMapLayer } from '../../../test/fixtures';

const identity: Viewport = { scale: 1, position: { x: 0, y: 0 } };
const worldToScreen = (x: number, y: number, { scale, position }: Viewport) => ({
  x: x * scale + position.x + 400,
  y: -y * scale + position.y + 400,
});

describe('screenToWorld', () => {
  it('maps the default viewport origin to screen (400, 400) with +Y up', () => {
    expect(screenToWorld(500, 300, identity)).toEqual({ x: 100, y: 100 });
  });
});

describe('contentBounds', () => {
  it('covers a map layer from its origin by width/height × resolution', () => {
    const layer = makeMapLayer('m', {
      width: 200,
      height: 100,
      info: { resolution: 0.1, origin: [-5, 2, 0] },
    });
    expect(contentBounds([layer], [])).toEqual({ minX: -5, minY: 2, maxX: 15, maxY: 12 });
  });

  it('accounts for a rotated map origin', () => {
    const layer = makeMapLayer('m', { width: 10, height: 10, info: { resolution: 1, origin: [0, 0, Math.PI / 2] } });
    const b = contentBounds([layer], [])!;
    expect(b.minX).toBeCloseTo(-10);
    expect(b.maxX).toBeCloseTo(0);
    expect(b.maxY).toBeCloseTo(10);
  });

  it('includes extra points and is null when there is nothing', () => {
    expect(contentBounds([], [{ x: 3, y: -1 }])).toEqual({ minX: 3, minY: -1, maxX: 3, maxY: -1 });
    expect(contentBounds([], [])).toBeNull();
  });
});

describe('fitViewport', () => {
  it('centres the content and keeps it within the screen', () => {
    const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 50 };
    const vp = fitViewport(bounds, 800, 600)!;

    const center = worldToScreen(50, 25, vp);
    expect(center.x).toBeCloseTo(400);
    expect(center.y).toBeCloseTo(300);
    const topLeft = worldToScreen(0, 50, vp);
    const bottomRight = worldToScreen(100, 0, vp);
    expect(topLeft.x).toBeGreaterThanOrEqual(0);
    expect(bottomRight.x).toBeLessThanOrEqual(800);
    expect(topLeft.y).toBeGreaterThanOrEqual(0);
    expect(bottomRight.y).toBeLessThanOrEqual(600);
  });
});

describe('zoomAt', () => {
  it('keeps the world point under the cursor fixed', () => {
    const before = screenToWorld(620, 180, identity);
    const zoomed = zoomAt(identity, 620, 180, 2);

    expect(zoomed.scale).toBe(2);
    const after = screenToWorld(620, 180, zoomed);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('clamps the zoom level', () => {
    expect(zoomAt(identity, 0, 0, 1e6).scale).toBe(500);
    expect(zoomAt(identity, 0, 0, 1e-6).scale).toBe(0.01);
  });
});
