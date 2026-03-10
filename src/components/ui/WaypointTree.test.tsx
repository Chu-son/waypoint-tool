import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WaypointTree } from './WaypointTree';
import { useAppStore } from '../../stores/appStore';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  ChevronRight: () => <div data-testid="right-icon" />,
  Layers: () => <div data-testid="layers-icon" />,
  GripVertical: () => <div data-testid="grip-vertical-icon" />,
}));

// Mock Store
vi.mock('../../stores/appStore', () => ({
  useAppStore: vi.fn(),
}));

describe('WaypointTree', () => {
  const mockSelectNodes = vi.fn();
  const mockReorderNodes = vi.fn();

  const mockNodes = {
    'wp-1': { id: 'wp-1', type: 'manual' },
    'gen-1': { id: 'gen-1', type: 'generator', children_ids: ['c1', 'c2'], plugin_id: 'p1' },
    'c1': { id: 'c1', type: 'manual' },
    'c2': { id: 'c2', type: 'manual' },
    'wp-2': { id: 'wp-2', type: 'manual' },
  };

  const mockPlugins = {
    'p1': { manifest: { name: 'Test Plugin' } }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useAppStore as any).mockImplementation((selector: any) => selector({
      rootNodeIds: [],
      nodes: {},
      plugins: {},
      selectedNodeIds: [],
      indexStartIndex: 0,
      insertionIndex: -1,
      setInsertionIndex: vi.fn(),
      selectNodes: mockSelectNodes,
      reorderNodes: mockReorderNodes,
    }));
  });

  it('renders empty state', () => {
    render(<WaypointTree />);
    expect(screen.getByText(/no items yet/i)).toBeInTheDocument();
  });

  it('displays mixed node types and correct indexing', () => {
    (useAppStore as any).mockImplementation((selector: any) => selector({
      rootNodeIds: ['wp-1', 'gen-1', 'wp-2'],
      nodes: mockNodes,
      plugins: mockPlugins,
      selectedNodeIds: [],
      indexStartIndex: 10, // Offset
      insertionIndex: -1,
      setInsertionIndex: vi.fn(),
      selectNodes: mockSelectNodes,
    }));

    render(<WaypointTree />);

    // wp-1: [10]
    expect(screen.getByText('[10]')).toBeInTheDocument();
    
    // gen-1 item
    expect(screen.getByText('Test Plugin')).toBeInTheDocument();
    expect(screen.getByText('(2 pts)')).toBeInTheDocument();

    // wp-2: should skip 2 children of gen-1 -> 10 + 1 (wp-1) + 2 (gen children) = 13
    expect(screen.getByText('[13]')).toBeInTheDocument();
  });

  it('handles expansion and showing children with correct indices', () => {
    (useAppStore as any).mockImplementation((selector: any) => selector({
      rootNodeIds: ['gen-1'],
      nodes: mockNodes,
      plugins: mockPlugins,
      selectedNodeIds: [],
      indexStartIndex: 0,
      insertionIndex: -1,
      setInsertionIndex: vi.fn(),
      selectNodes: mockSelectNodes,
    }));

    render(<WaypointTree />);
    
    // Initially children are hidden
    expect(screen.queryByText(/\[0\]/)).not.toBeInTheDocument();

    // Click chevron to expand
    const chevron = screen.getByTestId('right-icon');
    fireEvent.click(chevron);

    // c1: [0], c2: [1]
    expect(screen.getByText('[0]')).toBeInTheDocument();
    expect(screen.getByText('[1]')).toBeInTheDocument();
  });

  it('handles selection on click (single and multi)', () => {
    (useAppStore as any).mockImplementation((selector: any) => selector({
      rootNodeIds: ['wp-1', 'wp-2'],
      nodes: mockNodes,
      plugins: mockPlugins,
      selectedNodeIds: [],
      indexStartIndex: 0,
      insertionIndex: -1,
      setInsertionIndex: vi.fn(),
      selectNodes: mockSelectNodes,
    }));

    render(<WaypointTree />);

    const item1Text = screen.getByText('[0]');
    fireEvent.click(item1Text);
    expect(mockSelectNodes).toHaveBeenCalledWith(['wp-1'], false);

    const item2Text = screen.getByText('[1]');
    fireEvent.click(item2Text, { shiftKey: true });
    expect(mockSelectNodes).toHaveBeenCalledWith(['wp-2'], true);
  });

  // (Removed handle reordering buttons test because buttons were replaced by DnD GripVertical)
});
