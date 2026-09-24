/**
 * Shared PixiJS stand-ins for jsdom, where WebGL is unavailable.
 *
 * Usage (vi.mock factories are hoisted, so import lazily):
 *   vi.mock('@pixi/react', () => import('../../test/mocks/pixi').then((m) => m.pixiReactMock));
 *   vi.mock('pixi.js', () => import('../../test/mocks/pixi').then((m) => m.pixiJsMock));
 *
 * `<pixiContainer>` and friends render as inert custom DOM elements under jsdom, so layer
 * components can still be mounted. To assert what a `draw` callback paints, pass a
 * `createGraphicsRecorder()` to it and inspect `calls`.
 */
import { vi } from 'vitest';
import type { ReactNode } from 'react';

export const pixiReactMock = {
  Application: ({ children, background }: { children?: ReactNode; background?: unknown }) => (
    <div data-testid="pixi-app" data-background={background as string | undefined}>
      {children}
    </div>
  ),
  extend: vi.fn(),
  useApplication: () => ({ app: { renderer: { resolution: 1 }, canvas: document.createElement('canvas') } }),
  useTick: vi.fn(),
};

class MockFilter {
  destroy = vi.fn();
  resources: Record<string, unknown>;
  constructor(options?: { resources?: Record<string, unknown> }) {
    this.resources = options?.resources ?? {};
  }
}

class MockUniformGroup {
  uniforms: Record<string, unknown>;
  constructor(uniforms?: Record<string, unknown>) {
    this.uniforms = uniforms ?? {};
  }
}

export const pixiJsMock = {
  Container: vi.fn(() => ({ destroy: vi.fn() })),
  Sprite: vi.fn(() => ({ destroy: vi.fn() })),
  Graphics: vi.fn(() => createGraphicsRecorder()),
  Text: vi.fn(() => ({ destroy: vi.fn() })),
  TextStyle: vi.fn(),
  Texture: { from: vi.fn(() => ({ destroy: vi.fn() })), EMPTY: {}, WHITE: {} },
  Rectangle: vi.fn((x = 0, y = 0, width = 0, height = 0) => ({ x, y, width, height })),
  Filter: MockFilter,
  GlProgram: { from: vi.fn(() => ({})) },
  UniformGroup: MockUniformGroup,
  CanvasTextMetrics: {
    measureText: (text: string) => {
      const lines = text.split('\n');
      return {
        width: Math.max(...lines.map((l) => l.length)) * 6,
        height: lines.length * 12,
        lines,
      };
    },
  },
};

export type GraphicsCall = { method: string; args: unknown[] };

/**
 * A chainable fake of `PIXI.Graphics` that records every drawing call, so tests can assert
 * what was painted (shapes, colors) without depending on how the layer builds it.
 */
export function createGraphicsRecorder() {
  const calls: GraphicsCall[] = [];
  const target = { calls } as Record<string | symbol, unknown> & { calls: GraphicsCall[] };
  const proxy: Record<string | symbol, unknown> & { calls: GraphicsCall[] } = new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop];
      return (...args: unknown[]) => {
        calls.push({ method: String(prop), args });
        return proxy;
      };
    },
  });
  return proxy;
}
