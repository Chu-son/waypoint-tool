import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';
import { BackendAPI } from './api/backend';
import { useAppStore } from './stores/appStore';

// Mock Tauri specific modules
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onCloseRequested: vi.fn().mockResolvedValue(vi.fn()),
    destroy: vi.fn(),
  }),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  ask: vi.fn().mockResolvedValue(true),
}));

// Mock the backend API
vi.mock('./api/backend', () => ({
  BackendAPI: {
    fetchInstalledPlugins: vi.fn().mockResolvedValue([]),
    loadROSMap: vi.fn(),
    saveProject: vi.fn(),
    loadProject: vi.fn(),
    loadOptionsSchema: vi.fn(),
    exportWaypoints: vi.fn(),
  },
}));

// Mock the canvas element because PixiJS uses WebGL, which jsdom doesn't support well
vi.mock('./components/canvas/MapCanvas', () => ({
  MapCanvas: () => <div data-testid="mock-map-canvas">Mocked Canvas Volume</div>,
}));

describe('App Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      nodes: {},
      rootNodeIds: [],
      selectedNodeIds: [],
      activeTool: 'select',
      mapLayers: [],
      plugins: {},
      isDirty: false,
    });
  });

  it('renders the main application layout', async () => {
    render(<App />);

    // Validate main structural elements are mounted
    expect(screen.getByText('Project / Hierarchy')).toBeInTheDocument();
    expect(screen.getByText('Tools')).toBeInTheDocument();
    expect(screen.getByTestId('mock-map-canvas')).toBeInTheDocument();
    
    // The default right panel tab is 'Inspector'
    expect(screen.getByText('Inspector')).toBeInTheDocument();
    expect(screen.getByText('Layers')).toBeInTheDocument();

    // Verify backend is called to fetch plugins on init
    await waitFor(() => {
      expect(BackendAPI.fetchInstalledPlugins).toHaveBeenCalledTimes(1);
    });
  });

  it('handles loading a map file', async () => {
    // Mock open dialog specifically for this test
    const { open } = await import('@tauri-apps/plugin-dialog');
    (open as any).mockResolvedValue('map.yaml');

    // Make the backend mock map load
    const mockedMapData = {
      info: { image: 'map.png', resolution: 0.05, origin: [0, 0, 0], negate: 0, occupied_thresh: 0.65, free_thresh: 0.196 },
      image_data_b64: 'mockbase64',
      width: 100,
      height: 100
    };
    (BackendAPI.loadROSMap as any).mockResolvedValue(mockedMapData);

    render(<App />);

    // Click the "Load Map (YAML)" button inside ToolPanel
    const loadMapBtn = screen.getByTitle('Load Map (YAML)');
    act(() => {
      loadMapBtn.click();
    });

    await waitFor(() => {
      // It should call the plugin dialog to select a file
      expect(open).toHaveBeenCalled();
    });

    await waitFor(() => {
      // It should call the backend with the selected path
      expect(BackendAPI.loadROSMap).toHaveBeenCalledWith('map.yaml');
    });

    // Check if the store was updated
    await waitFor(() => {
      const state = useAppStore.getState();
      expect(state.mapLayers.length).toBe(1);
      expect(state.mapLayers[0].name).toBe('map.yaml');
      expect(state.mapLayers[0].image_base64).toBe('mockbase64');
    });
  });
});
