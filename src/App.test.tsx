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

    // Switch to Layers tab and click "Load ROS Map (YAML)"
    const layersTab = screen.getByText('Layers');
    act(() => {
      layersTab.click();
    });
    
    // The button should now be visible
    const loadMapBtn = screen.getByText('Load ROS Map (YAML)');
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

  // --- 要件2: Waypoint編集 ---

  it('switches to add_point tool mode', async () => {
    render(<App />);

    // Click the "Add Waypoint (P)" tool button
    const addPointBtn = screen.getByTitle('Add Waypoint (P)');
    act(() => {
      addPointBtn.click();
    });

    expect(useAppStore.getState().activeTool).toBe('add_point');
  });

  // --- 要件8: UIレイアウト ---

  it('renders the Project / Hierarchy panel', async () => {
    render(<App />);
    expect(screen.getByText('Project / Hierarchy')).toBeInTheDocument();
  });

  it('switches between Inspector and Layers tabs', async () => {
    render(<App />);

    // Default tab is Inspector
    expect(screen.getByText('Inspector')).toBeInTheDocument();

    // Click Layers tab
    const layersTab = screen.getByText('Layers');
    act(() => {
      layersTab.click();
    });

    // Layers panel content should be visible
    expect(screen.getByText('Load ROS Map (YAML)')).toBeInTheDocument();
  });

  // --- 要件2: Waypoint編集 ---

  it('removes selected nodes when Delete key is pressed', async () => {
    // Pre-add a node to the store
    useAppStore.setState({
      nodes: {
        'del-node': { id: 'del-node', type: 'manual', transform: { x: 1, y: 2, qx: 0, qy: 0, qz: 0, qw: 1 } },
      },
      rootNodeIds: ['del-node'],
      selectedNodeIds: ['del-node'],
    });

    render(<App />);

    // Simulate Delete key press
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
    });

    const state = useAppStore.getState();
    expect(state.nodes['del-node']).toBeUndefined();
    expect(state.rootNodeIds).not.toContain('del-node');
  });
});
