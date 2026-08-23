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
  SlidersHorizontal: () => <div data-testid="sliders-horizontal-icon" />,
  Bookmark: () => <div data-testid="bookmark-icon" />,
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
});
