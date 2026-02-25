import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { WaypointTree } from './WaypointTree';
import { useAppStore } from '../../stores/appStore';

describe('WaypointTree UI', () => {
  beforeEach(() => {
    useAppStore.setState({
      nodes: {},
      rootNodeIds: [],
      selectedNodeIds: [],
      plugins: {},
      indexStartIndex: 0,
    });
  });

  // --- 要件2: Waypoint編集 ---

  it('displays waypoint nodes in the tree', () => {
    useAppStore.setState({
      rootNodeIds: ['wp1', 'wp2'],
      nodes: {
        'wp1': { id: 'wp1', type: 'manual', transform: { x: 0, y: 0, qx: 0, qy: 0, qz: 0, qw: 1 } },
        'wp2': { id: 'wp2', type: 'manual', transform: { x: 5, y: 5, qx: 0, qy: 0, qz: 0, qw: 1 } },
      },
    });

    render(<WaypointTree />);

    // Should show index labels [0] and [1]
    expect(screen.getByText('[0]')).toBeInTheDocument();
    expect(screen.getByText('[1]')).toBeInTheDocument();
  });

  it('selects a node when clicked', () => {
    useAppStore.setState({
      rootNodeIds: ['wp1'],
      nodes: {
        'wp1': { id: 'wp1', type: 'manual' },
      },
    });

    render(<WaypointTree />);

    const item = screen.getByText('[0]').closest('li')!;
    fireEvent.click(item);

    expect(useAppStore.getState().selectedNodeIds).toEqual(['wp1']);
  });

  // --- 要件4: 自動生成 ---

  it('displays generator nodes with nested children', () => {
    useAppStore.setState({
      rootNodeIds: ['gen1'],
      nodes: {
        'gen1': { id: 'gen1', type: 'generator', children_ids: ['c1', 'c2'], plugin_id: 'sweep' },
        'c1': { id: 'c1', type: 'manual' },
        'c2': { id: 'c2', type: 'manual' },
      },
      plugins: {
        'sweep': { id: 'sweep', manifest: { name: 'Sweep Generator', type: 'python', executable: 'main.py', inputs: [], properties: [] }, folder_path: '/p', is_builtin: true },
      },
    });

    render(<WaypointTree />);

    // Generator node label should show the plugin name
    expect(screen.getByText('Sweep Generator')).toBeInTheDocument();
    // Should show child count
    expect(screen.getByText('(2 pts)')).toBeInTheDocument();
  });

  it('shows empty state message when no nodes exist', () => {
    render(<WaypointTree />);
    expect(screen.getByText(/No items yet/)).toBeInTheDocument();
  });
});
