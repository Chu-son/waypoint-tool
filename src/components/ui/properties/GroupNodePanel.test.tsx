import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GroupNodePanel } from './GroupNodePanel';
import { useAppStore } from '../../../stores/appStore';
import { WaypointNode } from '../../../types/store';

vi.mock('../../../stores/appStore', () => ({
  useAppStore: vi.fn(),
}));

describe('GroupNodePanel', () => {
  const mockRenameNode = vi.fn();
  const mockSelectNodes = vi.fn();
  const mockUngroupNode = vi.fn();

  const groupNode: WaypointNode = {
    id: 'grp-1',
    name: 'Test Group',
    type: 'manual_group',
    children_ids: ['c1', 'c2'],
  };

  const mockNodes: Record<string, WaypointNode> = {
    'grp-1': groupNode,
    c1: { id: 'c1', type: 'manual', name: 'WP 1' },
    c2: { id: 'c2', type: 'manual', name: 'WP 2' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useAppStore as any).mockImplementation((selector: any) =>
      selector({
        renameNode: mockRenameNode,
        selectNodes: mockSelectNodes,
        ungroupNode: mockUngroupNode,
        nodes: mockNodes,
      })
    );
  });

  it('renders group information correctly', () => {
    render(<GroupNodePanel node={groupNode} />);
    expect(screen.getByText('Test Group')).toBeInTheDocument();
    expect(screen.getByText('grp-1')).toBeInTheDocument();
    expect(screen.getByText('合計')).toBeInTheDocument();
  });

  it('calls selectNodes with children IDs when clicking select all children', () => {
    render(<GroupNodePanel node={groupNode} />);
    const selectAllBtn = screen.getByText('子要素をすべて選択');
    fireEvent.click(selectAllBtn);
    expect(mockSelectNodes).toHaveBeenCalledWith(['c1', 'c2']);
  });

  it('calls ungroupNode when clicking ungroup button', () => {
    render(<GroupNodePanel node={groupNode} />);
    const ungroupBtn = screen.getByText('グループ解除 (Ungroup)');
    fireEvent.click(ungroupBtn);
    expect(mockUngroupNode).toHaveBeenCalledWith('grp-1');
  });

  it('renames node when editing group name', () => {
    render(<GroupNodePanel node={groupNode} />);
    const nameDisplay = screen.getByText('Test Group');
    fireEvent.click(nameDisplay);
    const input = screen.getByDisplayValue('Test Group');
    fireEvent.change(input, { target: { value: 'Renamed Group' } });
    fireEvent.blur(input);
    expect(mockRenameNode).toHaveBeenCalledWith('grp-1', 'Renamed Group');
  });
});
