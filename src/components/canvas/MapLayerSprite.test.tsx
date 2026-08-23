import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MapLayerSprite } from './MapCanvas';
import { TextStyle, Texture } from 'pixi.js';

// Mock @pixi/react
vi.mock('@pixi/react', () => ({
  Application: ({ children }: any) => <div>{children}</div>,
  extend: vi.fn(),
}));

// Mock pixi.js
vi.mock('pixi.js', () => {
  class MockFilter {
    destroy = vi.fn();
    resources: any;
    constructor(options?: any) {
      this.resources = options?.resources || {};
    }
  }
  return {
    Container: () => ({ destroy: vi.fn() }),
    Sprite: () => ({ destroy: vi.fn() }),
    Graphics: () => ({ destroy: vi.fn() }),
    Text: () => ({ destroy: vi.fn() }),
    TextStyle: vi.fn(),
    Filter: MockFilter,
    GlProgram: {
      from: vi.fn().mockReturnValue({}),
    },
    UniformGroup: class MockUniformGroup {
      uniforms: any;
      constructor(uniforms?: any) {
        this.uniforms = uniforms || {};
      }
    },
    Texture: {
      from: vi.fn((img: any) => ({
        width: img?.width || 100,
        height: img?.height || 100,
        destroyed: false,
        source: {
          alphaMode: 'premultiply-alpha-on-upload',
          destroyed: false,
          style: { addressModeU: 'clamp-to-edge' },
        },
        destroy: vi.fn(function (this: any, destroySource: boolean = false) {
          this.destroyed = true;
          if (destroySource) {
            this.source = null;
          }
        }),
      })),
    },
  };
});

describe('MapLayerSprite Texture Lifecycle & Regression Test', () => {
  let createdImages: HTMLImageElement[] = [];
  const originalImage = window.Image;

  beforeEach(() => {
    vi.clearAllMocks();
    createdImages = [];

    // Controlled Image constructor to intercept onload
    window.Image = class MockImage {
      onload: ((ev: Event) => void) | null = null;
      onerror: ((ev: Event | string) => void) | null = null;
      width: number = 200;
      height: number = 200;
      private _src: string = '';

      get src() {
        return this._src;
      }
      set src(value: string) {
        this._src = value;
        createdImages.push(this as any);
      }
    } as any;
  });

  afterEach(() => {
    window.Image = originalImage;
  });

  it('keeps active texture alive during asynchronous reload and safely cleans up on load & unmount', async () => {
    const mockTextStyle = new TextStyle();
    const initialLayer = {
      id: 'custom-layer-1',
      name: 'Drivable Area Layer',
      type: 'plugin',
      image_base64: 'data:image/png;base64,INITIAL_IMAGE',
      info: { resolution: 0.05, origin: [0, 0, 0], width: 200, height: 200 },
      visible: true,
      opacity: 0.8,
      z_index: 0,
      blend_mode: 'overwrite',
    };

    const { rerender, unmount } = render(
      <MapLayerSprite
        layer={initialLayer}
        scale={1.0}
        textStyle={mockTextStyle}
      />
    );

    // 1. Initial render triggered Image 1 instantiation
    expect(createdImages).toHaveLength(1);
    const img1 = createdImages[0];
    expect(img1.src).toBe('data:image/png;base64,INITIAL_IMAGE');

    // Trigger Image 1 onload -> Texture 1 is created
    let texture1: any;
    act(() => {
      img1.onload?.(new Event('load'));
    });

    expect(Texture.from).toHaveBeenCalledTimes(1);
    texture1 = (Texture.from as any).mock.results[0].value;
    expect(texture1.destroyed).toBe(false);

    // 2. Re-generate / update layer with new image data
    const updatedLayer = {
      ...initialLayer,
      image_base64: 'REGENERATED_RAW_BASE64_WITHOUT_PREFIX',
    };

    rerender(
      <MapLayerSprite
        layer={updatedLayer}
        scale={1.0}
        textStyle={mockTextStyle}
      />
    );

    // New Image 2 is instantiated with normalized data: prefix, but onload has NOT fired yet
    expect(createdImages).toHaveLength(2);
    const img2 = createdImages[1];
    expect(img2.src).toBe('data:image/png;base64,REGENERATED_RAW_BASE64_WITHOUT_PREFIX');

    // =========================================================================
    // REGRESSION TEST ASSERTION:
    // With the old bug, texture1 would have been destroyed immediately here,
    // causing texture1.destroyed === true and texture1.source === null (alphaMode crash).
    // With the fix, texture1 MUST remain alive until texture2 is loaded!
    // =========================================================================
    expect(texture1.destroyed).toBe(false);
    expect(texture1.destroy).not.toHaveBeenCalled();

    // 3. Image 2 finishes loading
    let texture2: any;
    act(() => {
      img2.onload?.(new Event('load'));
    });

    expect(Texture.from).toHaveBeenCalledTimes(2);
    texture2 = (Texture.from as any).mock.results[1].value;

    // Now texture1 should be cleanly destroyed with false (preserving source style)
    expect(texture1.destroy).toHaveBeenCalledWith(false);
    expect(texture1.destroyed).toBe(true);
    expect(texture2.destroyed).toBe(false);

    // 4. Unmount component
    unmount();

    // Final active texture (texture2) should now be destroyed with false
    expect(texture2.destroy).toHaveBeenCalledWith(false);
    expect(texture2.destroyed).toBe(true);
  });
});
