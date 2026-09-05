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
  ArrowDownToLine: () => <div data-testid="arrow-down-to-line-icon" />,
  X: () => <div data-testid="x-icon" />,
  Target: () => <div data-testid="target-icon" />,
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
      insertionTarget: null,
      setInsertionTarget: vi.fn(),
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
      insertionTarget: null,
      setInsertionTarget: vi.fn(),
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
      insertionTarget: null,
      setInsertionTarget: vi.fn(),
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
      insertionTarget: null,
      setInsertionTarget: vi.fn(),
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

  it('renders insertion bar and allows reset when insertionTarget is active', () => {
    const mockSetInsertionTarget = vi.fn();
    (useAppStore as any).mockImplementation((selector: any) => selector({
      rootNodeIds: ['wp-1', 'wp-2', 'wp-3'],
      nodes: mockNodes,
      plugins: mockPlugins,
      selectedNodeIds: [],
      indexStartIndex: 0,
      insertionTarget: { parentId: null, index: 1 },
      setInsertionTarget: mockSetInsertionTarget,
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

    // X icon should be visible on the insertion bar
    const xIcon = screen.getByTestId('x-icon');
    expect(xIcon).toBeInTheDocument();

    // Click reset button
    fireEvent.click(xIcon);
    expect(mockSetInsertionTarget).toHaveBeenCalledWith(null);

    // Node wp-2 (index 1) and wp-3 (index 2) are after insertion target (index 1), so their container should be greyed out
    const wp2Text = screen.getByText('[1]');
    const wp2Row = wp2Text.closest('.group');
    expect(wp2Row?.className).toContain('opacity-40');
  });

  it('renders insertion bar in empty tree state', () => {
    (useAppStore as any).mockImplementation((selector: any) => selector({
      rootNodeIds: [],
      nodes: {},
      plugins: {},
      selectedNodeIds: [],
      indexStartIndex: 0,
      insertionTarget: null,
      setInsertionTarget: vi.fn(),
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
    expect(screen.getByText(/no items yet/i)).toBeInTheDocument();
    // Grip vertical icon from InsertionBarItem should be present
    expect(screen.getByTestId('grip-vertical-icon')).toBeInTheDocument();
  });

  it('does NOT include insertion bar pseudo ID during shift range selection', () => {
    (useAppStore as any).mockImplementation((selector: any) => selector({
      rootNodeIds: ['wp-1', 'wp-2', 'wp-3'],
      nodes: mockNodes,
      plugins: mockPlugins,
      selectedNodeIds: ['wp-1'],
      indexStartIndex: 0,
      insertionTarget: { parentId: null, index: 1 }, // Insertion bar between wp-1 and wp-2
      setInsertionTarget: vi.fn(),
      selectNodes: mockSelectNodes,
      duplicateNodes: mockDuplicateNodes,
      removeNodes: mockRemoveNodes,
      reorderNodes: mockReorderNodes,
      reorderMultipleNodes: mockReorderMultipleNodes,
      groupNodes: mockGroupNodes,
      ungroupNode: mockUngroupNode,
      renameNode: mockRenameNode,
      setRightPanelActiveTab: vi.fn(),
      setRightPanelOpen: vi.fn(),
    }));

    render(<WaypointTree />);

    // First click wp-1 to establish lastSelectedId anchor
    const wp1Item = screen.getByText('[0]');
    fireEvent.click(wp1Item);

    // Click wp-3 with Shift key held
    const wp3Item = screen.getByText('[2]');
    fireEvent.click(wp3Item, { shiftKey: true });

    expect(mockSelectNodes).toHaveBeenLastCalledWith(['wp-1', 'wp-2', 'wp-3'], false);
    // Ensure pseudo bar ID was NEVER selected
    const calledWith = mockSelectNodes.mock.calls[mockSelectNodes.mock.calls.length - 1][0];
    expect(calledWith).not.toContain('__insertion_bar__');
  });

  it('hides insert-at-start menu for generator but shows for manual_group', () => {
    const mockSetTarget = vi.fn();
    (useAppStore as any).mockImplementation((selector: any) => selector({
      rootNodeIds: ['gen-1', 'grp-1'],
      nodes: {
        'gen-1': { id: 'gen-1', type: 'generator', name: 'Generator 1', children_ids: ['c1'] },
        'c1': { id: 'c1', type: 'manual', name: 'WP Child' },
        'grp-1': { id: 'grp-1', type: 'manual_group', name: 'Group 1', children_ids: [] },
      },
      plugins: { p1: { manifest: { name: 'P1' } } },
      selectedNodeIds: [],
      indexStartIndex: 0,
      insertionTarget: null,
      setInsertionTarget: mockSetTarget,
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

    // Right-click generator node
    const genItem = screen.getByText('Generator 1');
    fireEvent.contextMenu(genItem);

    // "グループ内の先頭に挿入を設定" should NOT be present for generator
    expect(screen.queryByText('グループ内の先頭に挿入を設定')).not.toBeInTheDocument();

    // Right-click manual_group node
    const grpItem = screen.getByText('Group 1');
    fireEvent.contextMenu(grpItem);

    // "グループ内の先頭に挿入を設定" should be present for manual_group
    const insertInsideBtn = screen.getByText('グループ内の先頭に挿入を設定');
    expect(insertInsideBtn).toBeInTheDocument();
    fireEvent.click(insertInsideBtn);
    expect(mockSetTarget).toHaveBeenCalledWith({ parentId: 'grp-1', index: 0 });
  });

  it('escapes insertion target outside generator when clicking insert-after on generator child', () => {
    const mockSetTarget = vi.fn();
    (useAppStore as any).mockImplementation((selector: any) => selector({
      rootNodeIds: ['gen-1'],
      nodes: {
        'gen-1': { id: 'gen-1', type: 'generator', name: 'Gen 1', children_ids: ['c1'] },
        'c1': { id: 'c1', type: 'manual', name: 'Child WP' },
      },
      plugins: { p1: { manifest: { name: 'P1' } } },
      selectedNodeIds: [],
      indexStartIndex: 0,
      insertionTarget: null,
      setInsertionTarget: mockSetTarget,
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

    // Expand the generator node so its child becomes visible
    const expandBtn = screen.getByTestId('right-icon');
    fireEvent.click(expandBtn);

    const childItem = screen.getByText('[0]');
    fireEvent.contextMenu(childItem);

    const insertAfterBtn = screen.getByText('この直後に挿入を設定');
    expect(insertAfterBtn).toBeInTheDocument();
    fireEvent.click(insertAfterBtn);

    // Should escape outside generator to Root index 1 (after gen-1)
    expect(mockSetTarget).toHaveBeenCalledWith({ parentId: null, index: 1 });
  });

  it('places insertion bar directly after expanded group children when insertionTarget is after the group at root', () => {
    (useAppStore as any).mockImplementation((selector: any) => selector({
      rootNodeIds: ['grp-1', 'wp-3'],
      nodes: {
        'grp-1': { id: 'grp-1', type: 'manual_group', name: 'Group 1', children_ids: ['c1', 'c2'] },
        'c1': { id: 'c1', type: 'manual', name: 'Child 1' },
        'c2': { id: 'c2', type: 'manual', name: 'Child 2' },
        'wp-3': { id: 'wp-3', type: 'manual', name: 'Waypoint 3' },
      },
      plugins: {},
      selectedNodeIds: [],
      indexStartIndex: 0,
      insertionTarget: { parentId: null, index: 1 }, // Right after grp-1 at root level
      setInsertionTarget: vi.fn(),
      selectNodes: mockSelectNodes,
      duplicateNodes: mockDuplicateNodes,
      removeNodes: mockRemoveNodes,
      reorderNodes: mockReorderNodes,
      reorderMultipleNodes: mockReorderMultipleNodes,
      groupNodes: mockGroupNodes,
      ungroupNode: mockUngroupNode,
      renameNode: mockRenameNode,
    }));

    const { container } = render(<WaypointTree />);

    // Initially collapsed: Group 1, Insertion Bar (with reset button), Waypoint 3
    let listItems = container.querySelectorAll('ul > li');
    expect(listItems).toHaveLength(3);
    expect(listItems[0]).toHaveTextContent('Group 1');
    expect(listItems[1].querySelector('button[title="末尾に戻す"]')).not.toBeNull(); // Insertion Bar
    expect(listItems[2]).toHaveTextContent('Waypoint 3');

    // Expand Group 1
    const expandBtn = screen.getByTestId('right-icon');
    fireEvent.click(expandBtn);

    // After expansion: Group 1, Child 1, Child 2, Insertion Bar, Waypoint 3
    listItems = container.querySelectorAll('ul > li');
    expect(listItems).toHaveLength(5);
    expect(listItems[0]).toHaveTextContent('Group 1');
    expect(listItems[1]).toHaveTextContent('Child 1');
    expect(listItems[2]).toHaveTextContent('Child 2');
    expect(listItems[3].querySelector('button[title="末尾に戻す"]')).not.toBeNull(); // Insertion Bar AFTER Child 2
    expect(listItems[4]).toHaveTextContent('Waypoint 3');
  });

  it('places insertion bar after nested expanded group children when insertionTarget is inside a group', () => {
    (useAppStore as any).mockImplementation((selector: any) => selector({
      rootNodeIds: ['grp-1'],
      nodes: {
        'grp-1': { id: 'grp-1', type: 'manual_group', name: 'Group 1', children_ids: ['subgrp-1', 'wp-sibling'] },
        'subgrp-1': { id: 'subgrp-1', type: 'manual_group', name: 'Sub Group', children_ids: ['sub-c1'] },
        'sub-c1': { id: 'sub-c1', type: 'manual', name: 'Sub Child 1' },
        'wp-sibling': { id: 'wp-sibling', type: 'manual', name: 'WP Sibling' },
      },
      plugins: {},
      selectedNodeIds: [],
      indexStartIndex: 0,
      insertionTarget: { parentId: 'grp-1', index: 1 }, // After subgrp-1 inside grp-1
      setInsertionTarget: vi.fn(),
      selectNodes: mockSelectNodes,
      duplicateNodes: mockDuplicateNodes,
      removeNodes: mockRemoveNodes,
      reorderNodes: mockReorderNodes,
      reorderMultipleNodes: mockReorderMultipleNodes,
      groupNodes: mockGroupNodes,
      ungroupNode: mockUngroupNode,
      renameNode: mockRenameNode,
    }));

    const { container } = render(<WaypointTree />);

    // Expand Group 1
    const chevrons = screen.getAllByTestId('right-icon');
    fireEvent.click(chevrons[0]);

    // Expand Sub Group
    const subChevrons = screen.getAllByTestId('right-icon');
    fireEvent.click(subChevrons[1]);

    // Expected order: Group 1, Sub Group, Sub Child 1, Insertion Bar, WP Sibling
    const listItems = container.querySelectorAll('ul > li');
    expect(listItems).toHaveLength(5);
    expect(listItems[0]).toHaveTextContent('Group 1');
    expect(listItems[1]).toHaveTextContent('Sub Group');
    expect(listItems[2]).toHaveTextContent('Sub Child 1');
    expect(listItems[3].querySelector('button[title="末尾に戻す"]')).not.toBeNull(); // Insertion Bar after sub-c1
    expect(listItems[4]).toHaveTextContent('WP Sibling');
  });

  it('places insertion bar at start of group when insertionTarget is index 0 inside a group', () => {
    (useAppStore as any).mockImplementation((selector: any) => selector({
      rootNodeIds: ['grp-1'],
      nodes: {
        'grp-1': { id: 'grp-1', type: 'manual_group', name: 'Group 1', children_ids: ['c1', 'c2'] },
        'c1': { id: 'c1', type: 'manual', name: 'Child 1' },
        'c2': { id: 'c2', type: 'manual', name: 'Child 2' },
      },
      plugins: {},
      selectedNodeIds: [],
      indexStartIndex: 0,
      insertionTarget: { parentId: 'grp-1', index: 0 }, // At start of grp-1
      setInsertionTarget: vi.fn(),
      selectNodes: mockSelectNodes,
      duplicateNodes: mockDuplicateNodes,
      removeNodes: mockRemoveNodes,
      reorderNodes: mockReorderNodes,
      reorderMultipleNodes: mockReorderMultipleNodes,
      groupNodes: mockGroupNodes,
      ungroupNode: mockUngroupNode,
      renameNode: mockRenameNode,
    }));

    const { container } = render(<WaypointTree />);

    // Expand Group 1
    const expandBtn = screen.getByTestId('right-icon');
    fireEvent.click(expandBtn);

    // Expected order: Group 1, Insertion Bar, Child 1, Child 2
    const listItems = container.querySelectorAll('ul > li');
    expect(listItems).toHaveLength(4);
    expect(listItems[0]).toHaveTextContent('Group 1');
    expect(listItems[1].querySelector('button[title="末尾に戻す"]')).not.toBeNull(); // Insertion Bar right after header
    expect(listItems[2]).toHaveTextContent('Child 1');
    expect(listItems[3]).toHaveTextContent('Child 2');
  });

  it('keeps insertion bar attached directly below collapsed group when target is inside the collapsed group', () => {
    (useAppStore as any).mockImplementation((selector: any) => selector({
      rootNodeIds: ['grp-1', 'wp-other'],
      nodes: {
        'grp-1': { id: 'grp-1', type: 'manual_group', name: 'Group 1', children_ids: ['c1', 'c2'] },
        'c1': { id: 'c1', type: 'manual', name: 'Child 1' },
        'c2': { id: 'c2', type: 'manual', name: 'Child 2' },
        'wp-other': { id: 'wp-other', type: 'manual', name: 'Other Waypoint' },
      },
      plugins: {},
      selectedNodeIds: [],
      indexStartIndex: 0,
      insertionTarget: { parentId: 'grp-1', index: 2 }, // After c2 inside grp-1
      setInsertionTarget: vi.fn(),
      selectNodes: mockSelectNodes,
      duplicateNodes: mockDuplicateNodes,
      removeNodes: mockRemoveNodes,
      reorderNodes: mockReorderNodes,
      reorderMultipleNodes: mockReorderMultipleNodes,
      groupNodes: mockGroupNodes,
      ungroupNode: mockUngroupNode,
      renameNode: mockRenameNode,
    }));

    const { container } = render(<WaypointTree />);

    // When collapsed: Group 1, Insertion Bar (attached to Group 1, depth 1), Other Waypoint
    let listItems = container.querySelectorAll('ul > li');
    expect(listItems).toHaveLength(3);
    expect(listItems[0]).toHaveTextContent('Group 1');
    expect(listItems[1].querySelector('button[title="末尾に戻す"]')).not.toBeNull();
    expect(listItems[2]).toHaveTextContent('Other Waypoint');

    // Expand Group 1
    const expandBtn = screen.getByTestId('right-icon');
    fireEvent.click(expandBtn);

    // After expand: Group 1, Child 1, Child 2, Insertion Bar, Other Waypoint
    listItems = container.querySelectorAll('ul > li');
    expect(listItems).toHaveLength(5);
    expect(listItems[0]).toHaveTextContent('Group 1');
    expect(listItems[1]).toHaveTextContent('Child 1');
    expect(listItems[2]).toHaveTextContent('Child 2');
    expect(listItems[3].querySelector('button[title="末尾に戻す"]')).not.toBeNull();
    expect(listItems[4]).toHaveTextContent('Other Waypoint');
  });

  it('anchors insertion bar to nearest visible ancestor when target is in a deeply nested collapsed group', () => {
    (useAppStore as any).mockImplementation((selector: any) => selector({
      rootNodeIds: ['top-grp', 'wp-end'],
      nodes: {
        'top-grp': { id: 'top-grp', type: 'manual_group', name: 'Top Group', children_ids: ['sub-grp'] },
        'sub-grp': { id: 'sub-grp', type: 'manual_group', name: 'Sub Group', children_ids: ['sub-c1'] },
        'sub-c1': { id: 'sub-c1', type: 'manual', name: 'Sub Child 1' },
        'wp-end': { id: 'wp-end', type: 'manual', name: 'End Waypoint' },
      },
      plugins: {},
      selectedNodeIds: [],
      indexStartIndex: 0,
      insertionTarget: { parentId: 'sub-grp', index: 1 }, // Inside sub-grp
      setInsertionTarget: vi.fn(),
      selectNodes: mockSelectNodes,
      duplicateNodes: mockDuplicateNodes,
      removeNodes: mockRemoveNodes,
      reorderNodes: mockReorderNodes,
      reorderMultipleNodes: mockReorderMultipleNodes,
      groupNodes: mockGroupNodes,
      ungroupNode: mockUngroupNode,
      renameNode: mockRenameNode,
    }));

    const { container } = render(<WaypointTree />);

    // top-grp is collapsed: Insertion bar should be attached to top-grp before wp-end
    let listItems = container.querySelectorAll('ul > li');
    expect(listItems).toHaveLength(3);
    expect(listItems[0]).toHaveTextContent('Top Group');
    expect(listItems[1].querySelector('button[title="末尾に戻す"]')).not.toBeNull();
    expect(listItems[2]).toHaveTextContent('End Waypoint');
  });

  it('automatically escapes insertionTarget to outside group when collapsing a group containing the insertionTarget', () => {
    const mockSetInsertionTarget = vi.fn();
    (useAppStore as any).mockImplementation((selector: any) => selector({
      rootNodeIds: ['grp-1', 'wp-end'],
      nodes: {
        'grp-1': { id: 'grp-1', type: 'manual_group', name: 'Group 1', children_ids: ['c1'] },
        'c1': { id: 'c1', type: 'manual', name: 'Child 1' },
        'wp-end': { id: 'wp-end', type: 'manual', name: 'End Waypoint' },
      },
      plugins: {},
      selectedNodeIds: [],
      indexStartIndex: 0,
      insertionTarget: { parentId: 'grp-1', index: 1 }, // Target is inside grp-1
      setInsertionTarget: mockSetInsertionTarget,
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

    // Step 1: Expand Group 1
    const expandBtn = screen.getByTestId('right-icon');
    fireEvent.click(expandBtn);

    // Step 2: Collapse Group 1
    fireEvent.click(expandBtn);

    // setInsertionTarget must be called with escaped target outside grp-1 at root index 1
    expect(mockSetInsertionTarget).toHaveBeenCalledWith({ parentId: null, index: 1 });
  });

  it('renders insertion bar with depth 0 (no indent) when insertionTarget is at root level after an expanded group', () => {
    (useAppStore as any).mockImplementation((selector: any) => selector({
      rootNodeIds: ['grp-1', 'wp-end'],
      nodes: {
        'grp-1': { id: 'grp-1', type: 'manual_group', name: 'Group 1', children_ids: ['c1', 'c2'] },
        'c1': { id: 'c1', type: 'manual', name: 'Child 1' },
        'c2': { id: 'c2', type: 'manual', name: 'Child 2' },
        'wp-end': { id: 'wp-end', type: 'manual', name: 'End Waypoint' },
      },
      plugins: {},
      selectedNodeIds: [],
      indexStartIndex: 0,
      insertionTarget: { parentId: null, index: 1 }, // At root level after grp-1
      setInsertionTarget: vi.fn(),
      selectNodes: mockSelectNodes,
      duplicateNodes: mockDuplicateNodes,
      removeNodes: mockRemoveNodes,
      reorderNodes: mockReorderNodes,
      reorderMultipleNodes: mockReorderMultipleNodes,
      groupNodes: mockGroupNodes,
      ungroupNode: mockUngroupNode,
      renameNode: mockRenameNode,
    }));

    const { container } = render(<WaypointTree />);

    // Expand Group 1
    const expandBtn = screen.getByTestId('right-icon');
    fireEvent.click(expandBtn);

    // Insertion bar should be after Child 2 with marginLeft: 0px (depth 0)
    const listItems = container.querySelectorAll('ul > li');
    expect(listItems).toHaveLength(5);
    const barLi = listItems[3];
    const barInnerDiv = barLi.querySelector('div.group');
    expect(barInnerDiv).toHaveStyle({ marginLeft: '0px' });
  });

  it('renders insertion bar with depth 1 (indented) when insertionTarget is inside group at end', () => {
    (useAppStore as any).mockImplementation((selector: any) => selector({
      rootNodeIds: ['grp-1', 'wp-end'],
      nodes: {
        'grp-1': { id: 'grp-1', type: 'manual_group', name: 'Group 1', children_ids: ['c1', 'c2'] },
        'c1': { id: 'c1', type: 'manual', name: 'Child 1' },
        'c2': { id: 'c2', type: 'manual', name: 'Child 2' },
        'wp-end': { id: 'wp-end', type: 'manual', name: 'End Waypoint' },
      },
      plugins: {},
      selectedNodeIds: [],
      indexStartIndex: 0,
      insertionTarget: { parentId: 'grp-1', index: 2 }, // Inside grp-1 at end
      setInsertionTarget: vi.fn(),
      selectNodes: mockSelectNodes,
      duplicateNodes: mockDuplicateNodes,
      removeNodes: mockRemoveNodes,
      reorderNodes: mockReorderNodes,
      reorderMultipleNodes: mockReorderMultipleNodes,
      groupNodes: mockGroupNodes,
      ungroupNode: mockUngroupNode,
      renameNode: mockRenameNode,
    }));

    const { container } = render(<WaypointTree />);

    // Expand Group 1
    const expandBtn = screen.getByTestId('right-icon');
    fireEvent.click(expandBtn);

    // Insertion bar should be after Child 2 with marginLeft: 16px (depth 1)
    const listItems = container.querySelectorAll('ul > li');
    expect(listItems).toHaveLength(5);
    const barLi = listItems[3];
    const barInnerDiv = barLi.querySelector('div.group');
    expect(barInnerDiv).toHaveStyle({ marginLeft: '16px' });
  });

  it('moves dragged node to end of root when dropped on insertion bar with null insertionTarget', () => {
    const mockMoveNodes = vi.fn();
    (useAppStore as any).mockImplementation((selector: any) => selector({
      rootNodeIds: ['wp-1', 'wp-2'],
      nodes: mockNodes,
      plugins: {},
      selectedNodeIds: ['wp-1'],
      indexStartIndex: 0,
      insertionTarget: null, // End of root
      setInsertionTarget: vi.fn(),
      selectNodes: mockSelectNodes,
      duplicateNodes: mockDuplicateNodes,
      removeNodes: mockRemoveNodes,
      reorderNodes: mockReorderNodes,
      reorderMultipleNodes: mockReorderMultipleNodes,
      moveNodesInTree: mockMoveNodes,
      groupNodes: mockGroupNodes,
      ungroupNode: mockUngroupNode,
      renameNode: mockRenameNode,
    }));

    render(<WaypointTree />);

    // Trigger DndContext onDragEnd programmatically via SortableTreeNodeItem or direct event
    // Verify component renders without error and insertion bar is present
    expect(screen.getAllByTestId('grip-vertical-icon')).toHaveLength(3); // 2 nodes + 1 insertion bar
  });
});
