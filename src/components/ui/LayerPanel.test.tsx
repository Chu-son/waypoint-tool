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
}));

// Mock API
vi.mock('../../api', () => ({
  DialogAPI: {
    open: vi.fn(),
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
      lastDirectory: '/test/dir',
      updateMapLayer: mockUpdateMapLayer,
      removeMapLayer: mockRemoveMapLayer,
      reorderMapLayers: mockReorderMapLayers,
      addMapLayer: mockAddMapLayer,
      setLastDirectory: mockSetLastDirectory,
    }));
  });

  it('renders empty state', () => {
    render(<LayerPanel />);
    expect(screen.getByText(/no maps loaded/i)).toBeInTheDocument();
  });

  it('shows layers and handles visibility toggle', () => {
    (useAppStore as any).mockImplementation((selector: any) => selector({
      mapLayers: mockLayers,
      updateMapLayer: mockUpdateMapLayer,
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
      reorderMapLayers: mockReorderMapLayers,
    }));

    render(<LayerPanel />);
    const downBtn = screen.getAllByText('▼')[0]; // For first layer
    fireEvent.click(downBtn);
    expect(mockReorderMapLayers).toHaveBeenCalledWith(0, 1);
  });

  it('handles map loading flow', async () => {
    (useAppStore as any).mockImplementation((selector: any) => selector({
      mapLayers: [],
      lastDirectory: '/test/dir',
      addMapLayer: mockAddMapLayer,
      setLastDirectory: mockSetLastDirectory,
    }));

    (DialogAPI.open as any).mockResolvedValue('/new/map.yaml');
    (BackendAPI.loadROSMap as any).mockResolvedValue({
        info: { res: 0.1 },
        image_data_b64: 'b64',
        width: 100,
        height: 100
    });

    render(<LayerPanel />);
    const loadBtn = screen.getByText(/load ros map/i);
    fireEvent.click(loadBtn);

    await waitFor(() => {
      expect(DialogAPI.open).toHaveBeenCalled();
      expect(BackendAPI.loadROSMap).toHaveBeenCalledWith('/new/map.yaml');
      expect(mockAddMapLayer).toHaveBeenCalledWith('map.yaml', { res: 0.1 }, 'b64', 100, 100);
      expect(mockSetLastDirectory).toHaveBeenCalledWith('/new');
    });
  });

  it('removes layer after confirmation', () => {
    (useAppStore as any).mockImplementation((selector: any) => selector({
      mapLayers: [mockLayers[0]],
      removeMapLayer: mockRemoveMapLayer,
    }));

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    
    render(<LayerPanel />);
    const deleteBtn = screen.getByTitle('Remove Map');
    fireEvent.click(deleteBtn);

    expect(confirmSpy).toHaveBeenCalled();
    expect(mockRemoveMapLayer).toHaveBeenCalledWith('l1');
  });
});
