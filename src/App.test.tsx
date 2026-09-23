import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';
import { BackendAPI, DialogAPI } from './api';
import { useAppStore } from './stores/appStore';
import { resetAppStore, PAST_WELCOME } from './test/store';

// PixiJS needs WebGL, which jsdom lacks.
vi.mock('@pixi/react', () => import('./test/mocks/pixi').then((m) => m.pixiReactMock));
vi.mock('pixi.js', () => import('./test/mocks/pixi').then((m) => m.pixiJsMock));

describe('App Integration', () => {
  beforeEach(() => {
    resetAppStore(PAST_WELCOME);
    vi.spyOn(BackendAPI, 'fetchInstalledPlugins').mockResolvedValue([]);
  });

  it('renders the main application layout', async () => {
    render(<App />);

    // Validate main structural elements are mounted
    expect(screen.getAllByText('Waypoints')[0]).toBeInTheDocument();
    expect(screen.getByText('Annotations')).toBeInTheDocument();
    expect(screen.getByText('Tools')).toBeInTheDocument();
    expect(screen.getByTestId('pixi-app')).toBeInTheDocument();

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
    vi.spyOn(DialogAPI, 'open').mockResolvedValueOnce('map.yaml');

    // Make the backend mock map load
    const mockedMapData = {
      info: {
        image: 'map.png',
        resolution: 0.05,
        origin: [0, 0, 0],
        negate: 0,
        occupied_thresh: 0.65,
        free_thresh: 0.196,
      },
      image_data_b64: 'mockbase64',
      width: 100,
      height: 100,
    };
    vi.spyOn(BackendAPI, 'loadROSMap').mockResolvedValue(mockedMapData as any);

    render(<App />);

    // Switch to Layers tab and click "Load ROS Map (YAML)"
    const layersTab = screen.getByText('Layers');
    act(() => {
      layersTab.click();
    });

    // The button should now be visible
    const loadMapBtn = screen.getByText('Load Map');
    act(() => {
      loadMapBtn.click();
    });

    await waitFor(() => {
      expect(DialogAPI.open).toHaveBeenCalled();
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

  it('renders the Waypoints and Annotations panels', async () => {
    render(<App />);
    expect(screen.getAllByText('Waypoints')[0]).toBeInTheDocument();
    expect(screen.getByText('Annotations')).toBeInTheDocument();
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
    expect(screen.getByText('Load Map')).toBeInTheDocument();
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

  it('updates window title with project name and dirty state', async () => {
    render(<App />);

    await waitFor(() => expect(document.title).toBe('Untitled - Waypoint Tool'));

    act(() => {
      useAppStore.setState({ currentProjectPath: '/path/to/test_mission.wptroj' });
    });
    await waitFor(() => expect(document.title).toBe('test_mission - Waypoint Tool'));

    act(() => {
      useAppStore.setState({ isDirty: true });
    });
    await waitFor(() => expect(document.title).toBe('test_mission * - Waypoint Tool'));
  });

  it('opens ExportModal when clicking Export Waypoints button in ToolPanel', async () => {
    render(<App />);

    const exportButton = screen.getByTitle('Export Waypoints');
    expect(exportButton).toBeInTheDocument();

    act(() => {
      exportButton.click();
    });

    expect(screen.getByText(/統合エクスポート/)).toBeInTheDocument();
  });
});
