import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LayerPanel } from './LayerPanel';
import { useAppStore } from '../../stores/appStore';
import { DialogAPI, BackendAPI } from '../../api';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Eye: () => <div data-testid="eye-icon" />,
  EyeOff: () => <div data-testid="eye-off-icon" />,
  Trash2: () => <div data-testid="trash-icon" />,
  FolderOpen: () => <div data-testid="folder-icon" />,
  ChevronUp: () => <div data-testid="up-icon" />,
  ChevronDown: () => <div data-testid="down-icon" />,
  Layers: () => <div data-testid="layers-icon" />,
  ScanEye: () => <div data-testid="scan-eye-icon" />,
  Sparkles: () => <div data-testid="sparkles-icon" />,
  Pencil: () => <div data-testid="pencil-icon" />,
  Crop: () => <div data-testid="crop-icon" />,
  Plus: () => <div data-testid="plus-icon" />,
  Settings2: () => <div data-testid="settings2-icon" />,
  X: () => <div data-testid="x-icon" />,
  Palette: () => <div data-testid="palette-icon" />,
  RotateCcw: () => <div data-testid="rotate-ccw-icon" />,
  RotateCw: () => <div data-testid="rotate-cw-icon" />,
  FlipHorizontal2: () => <div data-testid="flip-horizontal-icon" />,
  Move: () => <div data-testid="move-icon" />,
  SlidersHorizontal: () => <div data-testid="sliders-horizontal-icon" />,
  Bookmark: () => <div data-testid="bookmark-icon" />,
  Target: () => <div data-testid="target-icon" />,
}));

// Mock API
vi.mock('../../api', () => ({
  DialogAPI: {
    open: vi.fn(),
    ask: vi.fn().mockResolvedValue(true),
  },
  BackendAPI: {
    loadROSMap: vi.fn(),
  },
}));

// Mock Store
vi.mock('../../stores/appStore', () => ({
  useAppStore: vi.fn(),
}));

describe('LayerPanel', () => {
  const mockUpdateMapLayer = vi.fn();
  const mockRemoveMapLayer = vi.fn();
  const mockReorderMapLayers = vi.fn();
  const mockAddMapLayer = vi.fn();
  const mockSetLastDirectory = vi.fn();

  const mockLayers = [
    { id: 'l1', name: 'Map 1', visible: true, opacity: 1, info: {}, width: 10, height: 10 },
    { id: 'l2', name: 'Map 2', visible: false, opacity: 0.5, info: {}, width: 20, height: 20 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (useAppStore as any).mockImplementation((selector: any) => selector({
      mapLayers: [],
      customLayers: [],
      lastDirectory: '/test/dir',
      occupancySettings: { defaultOccupiedThresh: 0.65, defaultFreeThresh: 0.25, defaultNegate: 0 },
      showOccupancyHighlight: false,
      setShowOccupancyHighlight: vi.fn(),
      updateMapLayer: mockUpdateMapLayer,
      removeMapLayer: mockRemoveMapLayer,
      reorderMapLayers: mockReorderMapLayers,
      addMapLayer: mockAddMapLayer,
      updateCustomLayer: vi.fn(),
      removeCustomLayer: vi.fn(),
      reorderCustomLayers: vi.fn(),
      setLastDirectory: mockSetLastDirectory,
      plugins: {},
      selectNodes: vi.fn(),
      runWithLoading: async (_: any, fn: any) => await fn(),
    }));
  });

  it('renders empty state', () => {
    render(<LayerPanel />);
    expect(screen.getByText(/no maps or custom layers/i)).toBeInTheDocument();
  });

  it('shows layers and handles visibility toggle', () => {
    (useAppStore as any).mockImplementation((selector: any) => selector({
      mapLayers: mockLayers,
      customLayers: [],
      updateMapLayer: mockUpdateMapLayer,
      plugins: {},
      selectNodes: vi.fn(),
    }));

    render(<LayerPanel />);
    expect(screen.getByText('Map 1')).toBeInTheDocument();
    
    const toggleBtns = screen.getAllByTitle('Toggle Visibility');
    fireEvent.click(toggleBtns[0]);
    expect(mockUpdateMapLayer).toHaveBeenCalledWith('l1', { visible: false });
  });

  it('handles reordering with up/down buttons', () => {
    (useAppStore as any).mockImplementation((selector: any) => selector({
      mapLayers: mockLayers,
      customLayers: [],
      reorderMapLayers: mockReorderMapLayers,
      plugins: {},
      selectNodes: vi.fn(),
    }));

    render(<LayerPanel />);
    
    // First item's Down button (second button in up/down group for first item)
    const downBtns = screen.getAllByTitle('Move Down');
    fireEvent.click(downBtns[0]);
    expect(mockReorderMapLayers).toHaveBeenCalledWith(0, 1);
  });

  it('handles map loading flow', async () => {
    (DialogAPI.open as any).mockResolvedValue('/path/to/test_map.yaml');
    (BackendAPI.loadROSMap as any).mockResolvedValue({
      info: { resolution: 0.05 },
      image_data_b64: 'fake-base64',
      width: 100,
      height: 100,
    });

    render(<LayerPanel />);
    
    const loadBtn = screen.getByText('Load Map');
    fireEvent.click(loadBtn);

    await waitFor(() => {
      expect(DialogAPI.open).toHaveBeenCalled();
      expect(BackendAPI.loadROSMap).toHaveBeenCalledWith('/path/to/test_map.yaml');
      expect(mockAddMapLayer).toHaveBeenCalledWith(
        'test_map.yaml',
        { resolution: 0.05 },
        'fake-base64',
        100,
        100
      );
      expect(mockSetLastDirectory).toHaveBeenCalledWith('/path/to');
    });
  });

  it('removes layer after confirmation', async () => {
    (useAppStore as any).mockImplementation((selector: any) => selector({
      mapLayers: mockLayers,
      customLayers: [],
      removeMapLayer: mockRemoveMapLayer,
      plugins: {},
      selectNodes: vi.fn(),
    }));

    render(<LayerPanel />);
    
    const removeBtns = screen.getAllByTitle('Remove Map');
    fireEvent.click(removeBtns[0]);

    await waitFor(() => {
      expect(DialogAPI.ask).toHaveBeenCalled();
      expect(mockRemoveMapLayer).toHaveBeenCalledWith('l1');
    });
  });

  it('handles custom layer reference toggle and displays REF badge', () => {
    const mockUpdateCustomLayer = vi.fn();
    const mockCustomLayers = [
      {
        id: 'cl1',
        name: 'Ref Layer',
        type: 'manual',
        visible: true,
        opacity: 1.0,
        z_index: 0,
        blend_mode: 'overwrite',
        is_reference: true,
        editObjects: [],
      },
      {
        id: 'cl2',
        name: 'Normal Layer',
        type: 'manual',
        visible: true,
        opacity: 1.0,
        z_index: 1,
        blend_mode: 'overwrite',
        is_reference: false,
        editObjects: [],
      },
    ];

    (useAppStore as any).mockImplementation((selector: any) => selector({
      mapLayers: [],
      customLayers: mockCustomLayers,
      updateCustomLayer: mockUpdateCustomLayer,
      plugins: {},
      selectNodes: vi.fn(),
    }));

    render(<LayerPanel />);
    expect(screen.getByDisplayValue('Ref Layer')).toBeInTheDocument();
    expect(screen.getByText('REF')).toBeInTheDocument();

    // In collapsed state, settings notice is not shown
    expect(screen.queryByText(/※ 参照レイヤーのため合成されません/i)).not.toBeInTheDocument();

    // Open settings for Ref Layer (first custom layer card)
    const settingsBtns = screen.getAllByTitle('Edit Layer Settings (Opacity, Blend Mode)');
    fireEvent.click(settingsBtns[0]);
    expect(screen.getByText(/※ 参照レイヤーのため合成されません/i)).toBeInTheDocument();

    const refToggleBtns = screen.getAllByTitle(/Reference Layer:/i);
    expect(refToggleBtns).toHaveLength(2);

    // Toggle reference on normal layer
    fireEvent.click(refToggleBtns[1]);
    expect(mockUpdateCustomLayer).toHaveBeenCalledWith('cl2', { is_reference: true });

    // Toggle reference on reference layer
    fireEvent.click(refToggleBtns[0]);
    expect(mockUpdateCustomLayer).toHaveBeenCalledWith('cl1', { is_reference: false });
  });

  it('hides custom layer opacity and blend mode by default and expands settings on click', () => {
    const mockUpdateCustomLayer = vi.fn();
    const mockCustomLayers = [
      {
        id: 'cl1',
        name: 'Custom Layer 1',
        type: 'manual',
        visible: true,
        opacity: 0.7,
        z_index: 0,
        blend_mode: 'overwrite',
        is_reference: false,
        editObjects: [],
      },
    ];

    (useAppStore as any).mockImplementation((selector: any) => selector({
      mapLayers: [],
      customLayers: mockCustomLayers,
      updateCustomLayer: mockUpdateCustomLayer,
      plugins: {},
      selectNodes: vi.fn(),
    }));

    render(<LayerPanel />);

    // By default, Opacity and Blend Mode are hidden
    expect(screen.queryByText('Opacity')).not.toBeInTheDocument();
    expect(screen.queryByText('Blend Mode')).not.toBeInTheDocument();

    // Click settings button
    const settingsBtn = screen.getByTitle('Edit Layer Settings (Opacity, Blend Mode)');
    fireEvent.click(settingsBtn);

    // Now settings are visible
    expect(screen.getByText('Opacity')).toBeInTheDocument();
    expect(screen.getByText('Blend Mode')).toBeInTheDocument();
  });

  it('hides region bounds by default and expands settings on click', () => {
    const mockUpdateExportRegion = vi.fn();
    const mockRemoveExportRegion = vi.fn();
    const mockRegions = [
      {
        id: 'r1',
        name: 'Export Zone',
        rect: { x: 1.5, y: 2.5, width: 10, height: 20 },
        visible: true,
      },
    ];

    (useAppStore as any).mockImplementation((selector: any) => selector({
      mapLayers: [],
      customLayers: [],
      exportRegions: mockRegions,
      updateExportRegion: mockUpdateExportRegion,
      removeExportRegion: mockRemoveExportRegion,
      plugins: {},
      selectNodes: vi.fn(),
    }));

    render(<LayerPanel />);

    // Region name and badge are visible
    expect(screen.getByDisplayValue('Export Zone')).toBeInTheDocument();
    expect(screen.getByText('Region 1')).toBeInTheDocument();

    // Region bounds should NOT be visible by default
    expect(screen.queryByText('Region Bounds')).not.toBeInTheDocument();
    expect(screen.queryByText('Width (m)')).not.toBeInTheDocument();

    // Click settings button
    const settingsBtn = screen.getByTitle('Region Bounds Settings');
    fireEvent.click(settingsBtn);

    // Now region bounds should be visible
    expect(screen.getByText('Region Bounds')).toBeInTheDocument();
    expect(screen.getByText('X (m)')).toBeInTheDocument();
    expect(screen.getByText('Y (m)')).toBeInTheDocument();
    expect(screen.getByText('Width (m)')).toBeInTheDocument();
    expect(screen.getByText('Height (m)')).toBeInTheDocument();
  });

  it('hides opacity and blend mode by default and expands settings on click', () => {
    (useAppStore as any).mockImplementation((selector: any) => selector({
      mapLayers: [
        {
          id: 'l1',
          name: 'Map 1',
          visible: true,
          opacity: 0.8,
          blend_mode: 'overwrite',
          info: {
            resolution: 0.05,
            origin: [10.0, 20.0, 0.0],
            initial_origin: [10.0, 20.0, 0.0],
          },
          width: 100,
          height: 100,
        },
      ],
      customLayers: [],
      occupancySettings: { defaultOccupiedThresh: 0.65, defaultFreeThresh: 0.25, defaultNegate: 0 },
      updateMapLayer: mockUpdateMapLayer,
      plugins: {},
      selectNodes: vi.fn(),
    }));

    render(<LayerPanel />);

    // By default, Opacity and Blend Mode should NOT be visible
    expect(screen.queryByText('Layer Opacity')).not.toBeInTheDocument();
    expect(screen.queryByText('Blend Mode')).not.toBeInTheDocument();
    expect(screen.queryByText(/Relative Pose/i)).not.toBeInTheDocument();

    // Click the Edit / Settings button
    const settingsBtn = screen.getByTitle('Edit Map Layer (Pose, Opacity, Blend, Thresholds)');
    fireEvent.click(settingsBtn);

    // Now settings sections should be visible
    expect(screen.getByText('Layer Opacity')).toBeInTheDocument();
    expect(screen.getByText('Blend Mode')).toBeInTheDocument();
    expect(screen.getByText(/Relative Pose/i)).toBeInTheDocument();
    expect(screen.getByText('Occupancy Thresholds')).toBeInTheDocument();
    expect(screen.getByText(/YAML Origin:/i)).toBeInTheDocument();

    // Test quick rotate button (+90°)
    const rotatePlus90Btn = screen.getByTitle('Rotate +90° (Clockwise)');
    fireEvent.click(rotatePlus90Btn);

    expect(mockUpdateMapLayer).toHaveBeenCalledWith('l1', {
      info: expect.objectContaining({
        origin: [10.0, 20.0, Math.PI / 2],
        initial_origin: [10.0, 20.0, 0.0],
      }),
    });
  });

  it('allows resetting pose to YAML origin', () => {
    (useAppStore as any).mockImplementation((selector: any) => selector({
      mapLayers: [
        {
          id: 'l1',
          name: 'Map 1',
          visible: true,
          opacity: 0.8,
          blend_mode: 'overwrite',
          info: {
            resolution: 0.05,
            origin: [15.0, 25.0, Math.PI / 4],
            initial_origin: [10.0, 20.0, 0.0],
          },
          width: 100,
          height: 100,
        },
      ],
      customLayers: [],
      occupancySettings: { defaultOccupiedThresh: 0.65, defaultFreeThresh: 0.25, defaultNegate: 0 },
      updateMapLayer: mockUpdateMapLayer,
      plugins: {},
      selectNodes: vi.fn(),
    }));

    render(<LayerPanel />);

    // Open settings
    const settingsBtn = screen.getByTitle('Edit Map Layer (Pose, Opacity, Blend, Thresholds)');
    fireEvent.click(settingsBtn);

    // Click Reset pose button
    const resetPoseBtn = screen.getByTitle('Reset pose to YAML origin');
    fireEvent.click(resetPoseBtn);

    expect(mockUpdateMapLayer).toHaveBeenCalledWith('l1', {
      info: expect.objectContaining({
        origin: [10.0, 20.0, 0.0],
        initial_origin: [10.0, 20.0, 0.0],
      }),
    });
  });
});
