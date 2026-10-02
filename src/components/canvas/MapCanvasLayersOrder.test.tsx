import { act, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapCanvas } from './MapCanvas';
import { useAppStore } from '../../stores/appStore';
import { DEFAULT_GEO_MAP } from '../../stores/migrations/geoMapNormalization';
import { layerStackState, makeManualCustomLayer, makeMap } from '../../test/fixtures';

// Mock PixiJS and @pixi/react
vi.mock('@pixi/react', () => import('../../test/mocks/pixi').then((m) => m.pixiReactMock));

vi.mock('pixi.js', () => {
  return {
    Container: () => ({ destroy: vi.fn() }),
    Sprite: () => ({ destroy: vi.fn() }),
    Graphics: () => ({ clear: vi.fn(), drawCircle: vi.fn(), destroy: vi.fn() }),
    Texture: {
      from: vi.fn().mockReturnValue({ source: {} }),
    },
    Text: () => ({ destroy: vi.fn() }),
    TextStyle: vi.fn(),
    Filter: vi.fn(),
    GlProgram: {
      from: vi.fn().mockReturnValue({}),
    },
    UniformGroup: vi.fn(),
  };
});

describe('MapCanvas Layer Grouping and Hierarchy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      nodes: {},
      rootNodeIds: [],
      selectedNodeIds: [],
      activeTool: 'select',
      mapLayers: [],
      customLayers: [],
      plugins: {},
      activePluginId: null,
      activeInputIndex: 0,
      pluginActiveProperties: {},
      geoMap: DEFAULT_GEO_MAP,
    });
  });

  it('draws maps and custom layers together in one layer stack', () => {
    useAppStore.setState(
      layerStackState(
        makeMap('map-1', { image_base64: 'data:image/png;base64,map1' }),
        makeManualCustomLayer('custom-1', { blend_mode: 'overwrite', is_reference: false }),
        makeMap('map-2', { image_base64: 'data:image/png;base64,map2' }),
      ),
    );

    const { container } = render(<MapCanvas />);

    expect(screen.getByTestId('pixi-app')).toBeInTheDocument();
    expect(container.querySelectorAll('[label="layer-stack-group"]')).toHaveLength(1);
  });

  it('draws the geographic base map behind the layer stack', () => {
    useAppStore.setState({
      ...layerStackState(makeMap('map-1', { image_base64: 'data:image/png;base64,map1' })),
      geoMap: { ...useAppStore.getState().geoMap, enabled: true },
    });

    const { container } = render(<MapCanvas />);

    const geo = container.querySelector('[label="geo-tile-layer"]');
    const stack = container.querySelector('[label="layer-stack-group"]');
    expect(geo).not.toBeNull();
    expect(stack).not.toBeNull();
    expect(geo!.compareDocumentPosition(stack!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows the base map attribution only while the base map is on', () => {
    const { rerender } = render(<MapCanvas />);
    expect(screen.queryByText(/OpenStreetMap contributors/)).toBeNull();

    act(() => useAppStore.setState({ geoMap: { ...useAppStore.getState().geoMap, enabled: true } }));
    rerender(<MapCanvas />);

    expect(screen.getByText(/OpenStreetMap contributors/)).toBeInTheDocument();
  });
});
