import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ElementCopyOverlay } from './ElementCopyOverlay';
import { useAppStore } from '../../stores/appStore';

// Mock useAppStore
vi.mock('../../stores/appStore', () => ({
  useAppStore: vi.fn(),
}));

describe('ElementCopyOverlay', () => {
  const mockSetElementCopyState = vi.fn();
  const mockClearElementCopyState = vi.fn();
  const mockUpdateNode = vi.fn();

  const targetNode = {
    id: 'node-2',
    type: 'manual' as const,
    transform: { x: 10, y: 20, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useAppStore as any).mockImplementation((selector: any) => {
      const state = {
        elementCopyState: { field: 'yaw', value: 1.57, coordSystem: 'world', previewNodeId: 'node-2' },
        setElementCopyState: mockSetElementCopyState,
        clearElementCopyState: mockClearElementCopyState,
        selectedNodeIds: ['node-2'],
        nodes: { 'node-2': targetNode },
        rootNodeIds: ['node-1', 'node-2'],
        anchorNodeId: null,
        updateNode: mockUpdateNode,
        indexStartIndex: 0,
      };
      return selector(state);
    });
  });

  it('renders copy overlay info and active target', () => {
    render(<ElementCopyOverlay />);

    expect(screen.getByText(/YAW コピー中/)).toBeInTheDocument();
    expect(screen.getByText(/Waypoint \[1\] に適用中/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ペースト確定/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /完了/ })).toBeInTheDocument();
  });

  it('triggers paste confirmation when confirm button is clicked', () => {
    render(<ElementCopyOverlay />);

    const confirmBtn = screen.getByRole('button', { name: /ペースト確定/ });
    fireEvent.click(confirmBtn);

    expect(mockUpdateNode).toHaveBeenCalledWith('node-2', expect.anything());
    expect(mockSetElementCopyState).toHaveBeenCalledWith(
      expect.objectContaining({ previewNodeId: null })
    );
  });

  it('triggers clearElementCopyState when cancel button is clicked', () => {
    render(<ElementCopyOverlay />);

    const cancelBtn = screen.getByRole('button', { name: /完了/ });
    fireEvent.click(cancelBtn);

    expect(mockClearElementCopyState).toHaveBeenCalled();
  });
});
