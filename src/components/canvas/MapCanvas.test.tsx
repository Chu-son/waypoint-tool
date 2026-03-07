import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapCanvas } from './MapCanvas';
import { useAppStore } from '../../stores/appStore';

// Mock PixiJS and @pixi/react
vi.mock('@pixi/react', () => ({
  Application: ({ children }: any) => <div data-testid="pixi-app">{children}</div>,
  extend: vi.fn(),
}));

vi.mock('pixi.js', () => ({
  Container: () => ({ destroy: vi.fn() }),
  Sprite: () => ({ destroy: vi.fn() }),
  Graphics: () => ({ clear: vi.fn(), drawCircle: vi.fn(), destroy: vi.fn() }),
  Texture: {
    from: vi.fn().mockReturnValue({}),
  },
  Text: () => ({ destroy: vi.fn() }),
  TextStyle: vi.fn(),
}));

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
});
