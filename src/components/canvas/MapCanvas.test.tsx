import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MapCanvas } from './MapCanvas';
import { useAppStore } from '../../stores/appStore';

// Mock PIXI and @pixi/react to prevent WebGL runtime errors in JSDOM
vi.mock('@pixi/react', () => ({
  Application: ({ children }: any) => <div data-testid="pixi-app">{children}</div>,
  Stage: ({ children }: any) => <div data-testid="pixi-stage">{children}</div>,
  Container: ({ children }: any) => <div data-testid="pixi-container">{children}</div>,
  Graphics: () => <div data-testid="pixi-graphics" />,
  Sprite: () => <div data-testid="pixi-sprite" />,
  useApp: () => ({ renderer: { events: { cursorStyles: {} } } }),
  extend: vi.fn(),
}));
vi.mock('pixi.js', () => ({
  Assets: { load: vi.fn(), unload: vi.fn() },
  Texture: { from: vi.fn().mockReturnValue({}) },
  EventSystem: vi.fn(),
  Container: vi.fn(),
  Sprite: vi.fn(),
  Graphics: vi.fn(),
  Text: vi.fn(),
  TextStyle: vi.fn(),
}));

describe('MapCanvas Component', () => {
  it('mounts the canvas and renders children layers when maps exist', () => {
    // Inject a dummy map layer
    const store = useAppStore.getState();
    store.mapLayers = [
      { id: '1', name: 'Map1', visible: true, opacity: 1, z_index: 0, image_base64: 'data...', width: 100, height: 100, info: { width: 100, height: 100, origin: [0, 0, 0], resolution: 0.05 } }
    ];

    const { getByTestId } = render(<MapCanvas />);

    // Container should exist
    expect(getByTestId('pixi-app').querySelector('pixicontainer')).toBeInTheDocument();
  });

  it('sets the image source exactly as provided without duplicate base64 prefix', () => {
    const store = useAppStore.getState();
    const mockBase64 = 'data:image/png;base64,mockImageData';
    store.mapLayers = [
      { id: '2', name: 'Map2', visible: true, opacity: 1, z_index: 0, image_base64: mockBase64, width: 100, height: 100, info: null }
    ];

    // Mock global Image to intercept the src setter
    let capturedSrc = '';
    const OriginalImage = globalThis.Image;
    globalThis.Image = class {
      onload: () => void = () => {};
      set src(value: string) {
        capturedSrc = value;
      }
    } as any;

    render(<MapCanvas />);

    expect(capturedSrc).toBe(mockBase64);
    expect(capturedSrc).not.toContain('data:image/png;base64,data:image/png;base64,');

    // Restore Image mock
    globalThis.Image = OriginalImage;
  });
});

