import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LayerPanel } from './LayerPanel';
import { useAppStore } from '../../stores/appStore';

// Mock Tauri modules
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

vi.mock('../../api/backend', () => ({
  BackendAPI: {
    loadROSMap: vi.fn(),
  },
}));

describe('LayerPanel UI', () => {
  beforeEach(() => {
    useAppStore.setState({
      mapLayers: [],
      lastDirectory: null,
    });
  });

  // --- 要件1: マップ表示 ---

  it('renders the Load ROS Map button', () => {
    render(<LayerPanel />);
    expect(screen.getByText('Load ROS Map (YAML)')).toBeInTheDocument();
  });

  it('displays map layers in the list', () => {
    useAppStore.setState({
      mapLayers: [
        { id: 'l1', name: 'floor_map.yaml', info: null, image_base64: 'b64', visible: true, opacity: 1, z_index: 0, width: 100, height: 100 },
        { id: 'l2', name: 'office_map.yaml', info: null, image_base64: 'b64', visible: true, opacity: 0.5, z_index: 1, width: 200, height: 200 },
      ],
    });

    render(<LayerPanel />);

    expect(screen.getByText('floor_map.yaml')).toBeInTheDocument();
    expect(screen.getByText('office_map.yaml')).toBeInTheDocument();
  });

  it('toggles layer visibility and updates the store', () => {
    useAppStore.setState({
      mapLayers: [
        { id: 'l1', name: 'Map1', info: null, image_base64: 'b64', visible: true, opacity: 1, z_index: 0, width: 100, height: 100 },
      ],
    });

    render(<LayerPanel />);

    const toggleBtn = screen.getByTitle('Toggle Visibility');
    act(() => {
      toggleBtn.click();
    });

    expect(useAppStore.getState().mapLayers[0].visible).toBe(false);
  });

  it('updates layer opacity via the slider', () => {
    useAppStore.setState({
      mapLayers: [
        { id: 'l1', name: 'Map1', info: null, image_base64: 'b64', visible: true, opacity: 1, z_index: 0, width: 100, height: 100 },
      ],
    });

    render(<LayerPanel />);

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '0.5' } });

    expect(useAppStore.getState().mapLayers[0].opacity).toBe(0.5);
  });

  it('shows empty state when no layers exist', () => {
    render(<LayerPanel />);
    expect(screen.getByText('No maps loaded.')).toBeInTheDocument();
  });
});
