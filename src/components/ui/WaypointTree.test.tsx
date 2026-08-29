import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WaypointTree } from './WaypointTree';
import { useAppStore } from '../../stores/appStore';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  ChevronRight: () => <div data-testid="right-icon" />,
  Layers: () => <div data-testid="layers-icon" />,
  GripVertical: () => <div data-testid="grip-vertical-icon" />,
  Anchor: () => <div data-testid="anchor-icon" />,
  Code2: () => <div data-testid="code-icon" />,
  Unlink: () => <div data-testid="unlink-icon" />,
  Trash2: () => <div data-testid="trash-icon" />,
  Copy: () => <div data-testid="copy-icon" />,
  Folder: () => <div data-testid="folder-icon" />,
  FolderPlus: () => <div data-testid="folder-plus-icon" />,
  Edit2: () => <div data-testid="edit-icon" />,
}));

// Mock Store
vi.mock('../../stores/appStore', () => ({
  useAppStore: vi.fn(),
}));

describe('WaypointTree', () => {
  const mockSelectNodes = vi.fn();
  const mockDuplicateNodes = vi.fn();
  const mockRemoveNodes = vi.fn();
  const mockReorderNodes = vi.fn();
  const mockReorderMultipleNodes = vi.fn();
  const mockGroupNodes = vi.fn().mockReturnValue('new-group-id');
  const mockUngroupNode = vi.fn();
  const mockRenameNode = vi.fn();

  const mockNodes: any = {
    'wp-1': { id: 'wp-1', type: 'manual' },
    'wp-2': { id: 'wp-2', type: 'manual' },
    'wp-3': { id: 'wp-3', type: 'manual' },
    'gen-1': { id: 'gen-1', type: 'generator', children_ids: ['c1', 'c2'], plugin_id: 'p1' },
    'c1': { id: 'c1', type: 'manual' },
    'c2': { id: 'c2', type: 'manual' },
  };

  const mockPlugins: any = {
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
      duplicateNodes: mockDuplicateNodes,
      removeNodes: mockRemoveNodes,
      reorderNodes: mockReorderNodes,
      reorderMultipleNodes: mockReorderMultipleNodes,
      groupNodes: mockGroupNodes,
      ungroupNode: mockUngroupNode,
      renameNode: mockRenameNode,
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
      duplicateNodes: mockDuplicateNodes,
      removeNodes: mockRemoveNodes,
      reorderNodes: mockReorderNodes,
      reorderMultipleNodes: mockReorderMultipleNodes,
      groupNodes: mockGroupNodes,
      ungroupNode: mockUngroupNode,
      renameNode: mockRenameNode,
    }));

    render(<WaypointTree />);

    // wp-1: [10]
    expect(screen.getByText('[10]')).toBeInTheDocument();
    
    // gen-1 item
    expect(screen.getByText('Test Plugin')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

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
      duplicateNodes: mockDuplicateNodes,
      removeNodes: mockRemoveNodes,
      reorderNodes: mockReorderNodes,
      reorderMultipleNodes: mockReorderMultipleNodes,
      groupNodes: mockGroupNodes,
      ungroupNode: mockUngroupNode,
      renameNode: mockRenameNode,
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

  it('handles grouping from context menu on multi-selected items', () => {
    (useAppStore as any).mockImplementation((selector: any) => selector({
      rootNodeIds: ['wp-1', 'wp-2', 'wp-3'],
      nodes: mockNodes,
      plugins: mockPlugins,
      selectedNodeIds: ['wp-1', 'wp-2'],
      indexStartIndex: 0,
      insertionIndex: -1,
      setInsertionIndex: vi.fn(),
      selectNodes: mockSelectNodes,
      duplicateNodes: mockDuplicateNodes,
      removeNodes: mockRemoveNodes,
      reorderNodes: mockReorderNodes,
      reorderMultipleNodes: mockReorderMultipleNodes,
      groupNodes: mockGroupNodes,
      ungroupNode: mockUngroupNode,
      renameNode: mockRenameNode,
    }));

    render(<WaypointTree />);

    // Right click wp-1
    const item1 = screen.getByText('[0]');
    fireEvent.contextMenu(item1);

    // Context menu should display Group option
    const groupOption = screen.getByText('選択項目をグループ化 (2)');
    expect(groupOption).toBeInTheDocument();

    fireEvent.click(groupOption);
    expect(mockGroupNodes).toHaveBeenCalledWith(['wp-1', 'wp-2']);
  });
});
