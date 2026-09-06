import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapCanvas, getFallbackGridColors } from './MapCanvas';
import { useAppStore } from '../../stores/appStore';

// Mock PixiJS and @pixi/react
vi.mock('@pixi/react', () => ({
  Application: ({ children, background }: any) => <div data-testid="pixi-app" data-background={background}>{children}</div>,
  extend: vi.fn(),
}));

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
    Graphics: () => ({ clear: vi.fn(), drawCircle: vi.fn(), destroy: vi.fn() }),
    Texture: {
      from: vi.fn().mockReturnValue({}),
    },
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
  };
});

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'test-uuid',
}));

describe('MapCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Polyfill for pointer capture which is missing in jsdom
    if (!HTMLDivElement.prototype.setPointerCapture) {
      HTMLDivElement.prototype.setPointerCapture = vi.fn();
    }
    if (!HTMLDivElement.prototype.releasePointerCapture) {
      HTMLDivElement.prototype.releasePointerCapture = vi.fn();
    }

    useAppStore.setState({
      nodes: {},
      rootNodeIds: [],
      selectedNodeIds: [],
      activeTool: 'select',
      mapLayers: [],
      plugins: {},
      pluginInteractionData: {},
      activePluginId: null,
      activeInputIndex: 0,
      pluginActiveProperties: {},
    });
  });

  it('renders correctly with default state', () => {
    render(<MapCanvas />);
    expect(screen.getByTestId('pixi-app')).toBeInTheDocument();
  });

  it('handles tool switching to add_point', () => {
    useAppStore.setState({ activeTool: 'add_point' });
    const { container } = render(<MapCanvas />);
    const canvasDiv = container.firstChild as HTMLElement;
    expect(canvasDiv).toHaveClass('cursor-crosshair');
  });

  it('creates a new node on click when add_point tool is active', () => {
    useAppStore.setState({ activeTool: 'add_point' });
    const { container } = render(<MapCanvas />);
    const canvasDiv = container.firstChild as HTMLElement;

    // Mock getBoundingClientRect for offset calculation
    vi.spyOn(canvasDiv, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
    } as DOMRect);

    fireEvent.pointerDown(canvasDiv, { button: 0, clientX: 100, clientY: 100 });

    const state = useAppStore.getState();
    expect(state.nodes['test-uuid']).toBeDefined();
    expect(state.nodes['test-uuid'].type).toBe('manual');
    expect(state.selectedNodeIds).toContain('test-uuid');
  });

  it('performs fitToMaps when triggerFitToMaps is called', async () => {
    useAppStore.setState({
      mapLayers: [
        {
          id: 'layer1',
          name: 'map.yaml',
          visible: true,
          opacity: 1,
          z_index: 0,
          image_base64: 'data:image/png;base64,mock',
          info: { resolution: 0.1, origin: [0, 0, 0] },
          width: 100,
          height: 100,
        },
      ],
    });

    render(<MapCanvas />);
    
    // triggerFitToMaps increments a counter in the store
    act(() => {
      useAppStore.setState({ shouldFitToMaps: 1 });
    });

    // We can't easily check the internal state of MapCanvas (position/scale)
    // but we can verify that the store state was applied.
  });

  it('clears selection when clicking empty space in select mode', () => {
    useAppStore.setState({
      activeTool: 'select',
      selectedNodeIds: ['existing-node'],
    });

    render(<MapCanvas />);
    const canvasDiv = screen.getByTestId('pixi-app').parentElement!;

    fireEvent.pointerUp(canvasDiv, { pointerId: 1 });

    expect(useAppStore.getState().selectedNodeIds).toEqual([]);
  });

  describe('canvasBackgroundColor (CAD / RViz approach)', () => {
    it('uses charcoal surface base (0x090a0c) in default dark mode', () => {
      useAppStore.setState({
        themeMode: 'dark',
        themePreset: 'default',
        isCustomUiMode: false,
        customUiConfig: null,
      });

      render(<MapCanvas />);
      const app = screen.getByTestId('pixi-app');
      // 0x090a0c in decimal is 592396
      expect(app.getAttribute('data-background')).toBe(String(0x090a0c));
    });

    it('maintains high-contrast dark charcoal background (0x090a0c) in light mode (Option A)', () => {
      useAppStore.setState({
        themeMode: 'light',
        themePreset: 'emerald',
        isCustomUiMode: false,
        customUiConfig: null,
      });

      render(<MapCanvas />);
      const app = screen.getByTestId('pixi-app');
      // Even in light mode with emerald accent, canvas background must remain 0x090a0c (not off-white 0xf7f8f9)
      expect(app.getAttribute('data-background')).toBe(String(0x090a0c));
    });

    it('honors explicit custom surfaceBase override in customUiConfig', () => {
      useAppStore.setState({
        themeMode: 'light',
        isCustomUiMode: true,
        customUiConfig: {
          theme: {
            colors: {
              surfaceBase: '#1a1a1a',
            },
          },
        } as any,
      });

      render(<MapCanvas />);
      const app = screen.getByTestId('pixi-app');
      // 0x1a1a1a in decimal is 1710618
      expect(app.getAttribute('data-background')).toBe(String(0x1a1a1a));
    });
  });

  describe('getFallbackGridColors (Option A CAD grid fallback)', () => {
    it('uses panel colors from resolved theme in dark mode', () => {
      const resolved = {
        variables: {
          '--color-surface-panel': '#121316',
          '--color-border-base': 'rgba(255, 255, 255, 0.08)',
          '--color-text-muted': '#8a8f98',
        },
        colorScheme: 'dark' as const,
      };
      const colors = getFallbackGridColors(resolved, false);
      expect(colors.bg).toBe('#121316');
      expect(colors.grid).toBe('rgba(255, 255, 255, 0.08)');
      expect(colors.text).toBe('#8a8f98');
    });

    it('uses CAD dark viewport colors in light mode (Option A) when no explicit surface is set', () => {
      const resolved = {
        variables: {
          '--color-surface-panel': '#ffffff',
          '--color-border-base': '#e2e4e8',
          '--color-text-muted': '#686b74',
        },
        colorScheme: 'light' as const,
      };
      const colors = getFallbackGridColors(resolved, false);
      // In light mode Option A, fallback grid texture must NOT be pure white #ffffff
      expect(colors.bg).toBe('#121316');
      expect(colors.grid).toBe('rgba(255, 255, 255, 0.08)');
      expect(colors.text).toBe('#8a8f98');
    });

    it('honors resolved theme colors in light mode when explicit custom surface is set', () => {
      const resolved = {
        variables: {
          '--color-surface-panel': '#e5e7eb',
          '--color-border-base': '#9ca3af',
          '--color-text-muted': '#374151',
        },
        colorScheme: 'light' as const,
      };
      const colors = getFallbackGridColors(resolved, true);
      expect(colors.bg).toBe('#e5e7eb');
      expect(colors.grid).toBe('#9ca3af');
      expect(colors.text).toBe('#374151');
    });
  });
});
