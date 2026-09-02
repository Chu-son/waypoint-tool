import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransformGroup } from './TransformGroup';
import { useAppStore } from '../../../stores/appStore';
import { WaypointNode } from '../../../types/store';
import { quaternionToYaw } from '../../../utils/transformUtils';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Eye: () => <div data-testid="eye-icon" />,
  EyeOff: () => <div data-testid="eye-off-icon" />,
  RotateCcw: () => <div data-testid="rotate-ccw-icon" />,
  FlipHorizontal2: () => <div data-testid="flip-horizontal-2-icon" />,
  RotateCw: () => <div data-testid="rotate-cw-icon" />,
}));

// Mock Store
vi.mock('../../../stores/appStore', () => ({
  useAppStore: vi.fn(),
}));

describe('TransformGroup - Quick Rotate', () => {
  const mockHandleUpdate = vi.fn();
  const mockRunInHistoryTransaction = vi.fn((fn: () => void) => fn());

  const sampleNode: WaypointNode = {
    id: 'wp-1',
    type: 'manual',
    transform: { x: 10, y: 20, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 }, // yaw = 0
  };

  beforeEach(() => {
    vi.clearAllMocks();

    (useAppStore as any).mockImplementation((selector: any) =>
      selector({
        visibleAttributes: ['transform'],
        toggleAttributeVisibility: vi.fn(),
        decimalPrecision: 2,
        selectedNodeIds: ['wp-1'],
        nodes: { 'wp-1': sampleNode },
      })
    );

    (useAppStore.getState as any) = vi.fn().mockReturnValue({
      runInHistoryTransaction: mockRunInHistoryTransaction,
      beginHistoryTransaction: vi.fn(),
      endHistoryTransaction: vi.fn(),
      nodes: { 'wp-1': sampleNode },
      selectedNodeIds: ['wp-1'],
    });
  });

  it('renders quick rotate buttons with appropriate aria labels and titles', () => {
    render(
      <TransformGroup
        isMultiSelection={false}
        node={sampleNode}
        handleUpdate={mockHandleUpdate}
      />
    );

    const leftBtn = screen.getByRole('button', { name: 'Rotate 90° Left' });
    const flipBtn = screen.getByRole('button', { name: 'Rotate 180°' });
    const rightBtn = screen.getByRole('button', { name: 'Rotate 90° Right' });

    expect(leftBtn).toBeInTheDocument();
    expect(leftBtn).toHaveAttribute('title', 'Rotate 90° Left (+90°)');
    expect(flipBtn).toBeInTheDocument();
    expect(flipBtn).toHaveAttribute('title', 'Rotate 180° (Mirror Reverse)');
    expect(rightBtn).toBeInTheDocument();
    expect(rightBtn).toHaveAttribute('title', 'Rotate 90° Right (-90°)');
  });

  it('rotates 90 degrees left (CCW) on left button click', () => {
    render(
      <TransformGroup
        isMultiSelection={false}
        node={sampleNode}
        handleUpdate={mockHandleUpdate}
      />
    );

    const leftBtn = screen.getByRole('button', { name: 'Rotate 90° Left' });
    fireEvent.click(leftBtn);

    expect(mockRunInHistoryTransaction).toHaveBeenCalledTimes(1);
    expect(mockHandleUpdate).toHaveBeenCalledTimes(1);

    const [calledId, update] = mockHandleUpdate.mock.calls[0];
    expect(calledId).toBe('wp-1');

    // Expected: yaw is +90 deg (pi / 2)
    const resultingYaw = quaternionToYaw(update.transform);
    expect(resultingYaw).toBeCloseTo(Math.PI / 2, 4);
  });

  it('rotates 180 degrees (mirror reverse) on 180 button click', () => {
    render(
      <TransformGroup
        isMultiSelection={false}
        node={sampleNode}
        handleUpdate={mockHandleUpdate}
      />
    );

    const flipBtn = screen.getByRole('button', { name: 'Rotate 180°' });
    fireEvent.click(flipBtn);

    expect(mockRunInHistoryTransaction).toHaveBeenCalledTimes(1);
    expect(mockHandleUpdate).toHaveBeenCalledTimes(1);

    const [calledId, update] = mockHandleUpdate.mock.calls[0];
    expect(calledId).toBe('wp-1');

    // Expected: yaw is 180 deg (pi or -pi)
    const resultingYaw = Math.abs(quaternionToYaw(update.transform));
    expect(resultingYaw).toBeCloseTo(Math.PI, 4);
  });

  it('rotates 90 degrees right (CW) on right button click', () => {
    render(
      <TransformGroup
        isMultiSelection={false}
        node={sampleNode}
        handleUpdate={mockHandleUpdate}
      />
    );

    const rightBtn = screen.getByRole('button', { name: 'Rotate 90° Right' });
    fireEvent.click(rightBtn);

    expect(mockRunInHistoryTransaction).toHaveBeenCalledTimes(1);
    expect(mockHandleUpdate).toHaveBeenCalledTimes(1);

    const [calledId, update] = mockHandleUpdate.mock.calls[0];
    expect(calledId).toBe('wp-1');

    // Expected: yaw is -90 deg (-pi / 2)
    const resultingYaw = quaternionToYaw(update.transform);
    expect(resultingYaw).toBeCloseTo(-Math.PI / 2, 4);
  });

  it('rotates all selected nodes when isMultiSelection is true', () => {
    const node2: WaypointNode = {
      id: 'wp-2',
      type: 'manual',
      // Starts at 90 degrees (pi / 2)
      transform: {
        x: 5,
        y: 5,
        z: 0,
        qx: 0,
        qy: 0,
        qz: Math.sin(Math.PI / 4),
        qw: Math.cos(Math.PI / 4),
      },
    };

    (useAppStore as any).mockImplementation((selector: any) =>
      selector({
        visibleAttributes: ['transform'],
        toggleAttributeVisibility: vi.fn(),
        decimalPrecision: 2,
        selectedNodeIds: ['wp-1', 'wp-2'],
        nodes: { 'wp-1': sampleNode, 'wp-2': node2 },
      })
    );

    (useAppStore.getState as any) = vi.fn().mockReturnValue({
      runInHistoryTransaction: mockRunInHistoryTransaction,
      beginHistoryTransaction: vi.fn(),
      endHistoryTransaction: vi.fn(),
      nodes: { 'wp-1': sampleNode, 'wp-2': node2 },
      selectedNodeIds: ['wp-1', 'wp-2'],
    });

    render(
      <TransformGroup
        isMultiSelection={true}
        node={null}
        handleUpdate={mockHandleUpdate}
      />
    );

    const leftBtn = screen.getByRole('button', { name: 'Rotate 90° Left' });
    fireEvent.click(leftBtn);

    expect(mockRunInHistoryTransaction).toHaveBeenCalledTimes(1);
    expect(mockHandleUpdate).toHaveBeenCalledTimes(2);

    // wp-1: 0 + 90 deg -> 90 deg (pi / 2)
    const wp1Call = mockHandleUpdate.mock.calls.find((c) => c[0] === 'wp-1');
    expect(wp1Call).toBeDefined();
    expect(quaternionToYaw(wp1Call![1].transform)).toBeCloseTo(Math.PI / 2, 4);

    // wp-2: 90 deg + 90 deg -> 180 deg (pi)
    const wp2Call = mockHandleUpdate.mock.calls.find((c) => c[0] === 'wp-2');
    expect(wp2Call).toBeDefined();
    expect(Math.abs(quaternionToYaw(wp2Call![1].transform))).toBeCloseTo(Math.PI, 4);
  });
});
