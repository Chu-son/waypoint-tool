import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnchorTransformGroup } from './AnchorTransformGroup';
import { WaypointNode } from '../../../types/store';

describe('AnchorTransformGroup', () => {
  const anchorNode: WaypointNode = {
    id: 'anchor-node',
    type: 'manual',
    transform: { x: 10, y: 10, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
  };

  const currentNode: WaypointNode = {
    id: 'current-node',
    type: 'manual',
    transform: { x: 15, y: 10, z: 2, qx: 0, qy: 0, qz: 0, qw: 1 },
  };

  const handleUpdate = vi.fn();
  const onContextMenuLabel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders anchor-relative transform headers and inputs', () => {
    render(
      <AnchorTransformGroup
        node={currentNode}
        anchorNode={anchorNode}
        handleUpdate={handleUpdate}
        onContextMenuLabel={onContextMenuLabel}
      />
    );

    expect(screen.getByText(/Transform \(From Anchor\)/)).toBeInTheDocument();
    expect(screen.getByText('Local X (m)')).toBeInTheDocument();
    expect(screen.getByText('Local Y (m)')).toBeInTheDocument();
    expect(screen.getByText('Delta Z (m)')).toBeInTheDocument();
  });

  it('triggers onContextMenuLabel when right clicking field labels', () => {
    render(
      <AnchorTransformGroup
        node={currentNode}
        anchorNode={anchorNode}
        handleUpdate={handleUpdate}
        onContextMenuLabel={onContextMenuLabel}
      />
    );

    const labelX = screen.getByText('Local X (m)');
    fireEvent.contextMenu(labelX);
    expect(onContextMenuLabel).toHaveBeenCalledWith('x', expect.anything());

    const labelYaw = screen.getByText('Delta Yaw (rad)');
    fireEvent.contextMenu(labelYaw);
    expect(onContextMenuLabel).toHaveBeenCalledWith('yaw', expect.anything());
  });
});
