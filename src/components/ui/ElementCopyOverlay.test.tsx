import { fireEvent, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ElementCopyOverlay } from './ElementCopyOverlay';
import { renderWithStore } from '../../test/render';
import { getAppState } from '../../test/store';
import { makeTransform, makeWaypoint, waypointTree } from '../../test/fixtures';
import { quaternionToYaw } from '../../utils/transformUtils';

const renderOverlay = () =>
  renderWithStore(<ElementCopyOverlay />, {
    ...waypointTree([makeWaypoint('node-1'), makeWaypoint('node-2', { transform: makeTransform(10, 20, 0) })]),
    selectedNodeIds: ['node-2'],
    elementCopyState: { field: 'yaw', value: 1.57, coordSystem: 'world', previewNodeId: 'node-2' },
  });

describe('ElementCopyOverlay', () => {
  it('shows which field is being copied and the waypoint it applies to', () => {
    renderOverlay();

    expect(screen.getByText(/YAW コピー中/)).toBeInTheDocument();
    expect(screen.getByText(/Waypoint \[1\] に適用中/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ペースト確定/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /完了/ })).toBeInTheDocument();
  });

  it('applies the copied value to the previewed waypoint on confirm', () => {
    renderOverlay();

    fireEvent.click(screen.getByRole('button', { name: /ペースト確定/ }));

    const pasted = getAppState().nodes['node-2'].transform!;
    expect(quaternionToYaw(pasted)).toBeCloseTo(1.57, 5);
    expect(pasted).toMatchObject({ x: 10, y: 20 });
    expect(getAppState().elementCopyState?.previewNodeId).toBeNull();
  });

  it('ends copy mode without changing the waypoint', () => {
    renderOverlay();

    fireEvent.click(screen.getByRole('button', { name: /完了/ }));

    expect(getAppState().elementCopyState).toBeNull();
    expect(quaternionToYaw(getAppState().nodes['node-2'].transform!)).toBe(0);
  });
});
