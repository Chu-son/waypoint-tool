import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CanvasContextMenu, CanvasContextMenuTarget } from './CanvasContextMenu';
import { useAppStore } from '../../stores/appStore';

describe('CanvasContextMenu', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      selectedNodeIds: [],
      selectedAnnotationIds: [],
      treeRevealTarget: null,
    });
  });

  it('renders target name and trigger locate action', () => {
    const target: CanvasContextMenuTarget = {
      type: 'node',
      id: 'wp-1',
      name: 'WP-01',
      parentContainerId: 'grp-1',
      parentContainerKind: 'group',
      parentContainerName: 'Group Alpha',
    };

    render(
      <CanvasContextMenu
        x={100}
        y={150}
        target={target}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('WP-01')).toBeInTheDocument();
    expect(screen.getByText('一覧リストで位置を表示')).toBeInTheDocument();
    expect(screen.getByText('所属グループ全体を選択')).toBeInTheDocument();
    expect(screen.getByText('(Group Alpha)')).toBeInTheDocument();

    // Click "一覧リストで位置を表示"
    fireEvent.click(screen.getByText('一覧リストで位置を表示'));
    expect(useAppStore.getState().treeRevealTarget).toEqual(
      expect.objectContaining({ type: 'node', id: 'wp-1' })
    );
    expect(useAppStore.getState().isLeftPanelOpen).toBe(true);
    expect(useAppStore.getState().leftPanelActiveTab).toBe('project');
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('selects parent group when clicking parent selection button', () => {
    const selectNodesSpy = vi.fn();
    useAppStore.setState({ selectNodes: selectNodesSpy } as any);

    const target: CanvasContextMenuTarget = {
      type: 'node',
      id: 'wp-1',
      parentContainerId: 'grp-1',
      parentContainerKind: 'group',
      parentContainerName: 'Group Alpha',
    };

    render(
      <CanvasContextMenu
        x={100}
        y={150}
        target={target}
        onClose={mockOnClose}
      />
    );

    fireEvent.click(screen.getByText('所属グループ全体を選択'));
    expect(selectNodesSpy).toHaveBeenCalledWith(['grp-1']);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('disables parent selection button when target has no parent', () => {
    const target: CanvasContextMenuTarget = {
      type: 'node',
      id: 'wp-root',
      parentContainerId: null,
      parentContainerKind: null,
    };

    render(
      <CanvasContextMenu
        x={100}
        y={150}
        target={target}
        onClose={mockOnClose}
      />
    );

    const selectBtn = screen.getByText('所属グループ全体を選択').closest('button');
    expect(selectBtn).toBeDisabled();
    expect(screen.getByText('(グループ未所属)')).toBeInTheDocument();
  });

  it('displays generator label when parent is generator', () => {
    const target: CanvasContextMenuTarget = {
      type: 'node',
      id: 'wp-gen-child',
      parentContainerId: 'gen-1',
      parentContainerKind: 'generator',
      parentContainerName: 'Circle Generator',
    };

    render(
      <CanvasContextMenu
        x={100}
        y={150}
        target={target}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('所属ジェネレータ全体を選択')).toBeInTheDocument();
    expect(screen.getByText('(Circle Generator)')).toBeInTheDocument();
  });

  it('handles annotation target correctly', () => {
    const selectAnnotationSpy = vi.fn();
    useAppStore.setState({ selectAnnotationObjects: selectAnnotationSpy } as any);

    const target: CanvasContextMenuTarget = {
      type: 'annotation',
      id: 'annot-1',
      parentContainerId: 'grp-roi',
      parentContainerKind: 'group',
      parentContainerName: 'ROI Group',
    };

    render(
      <CanvasContextMenu
        x={100}
        y={150}
        target={target}
        onClose={mockOnClose}
      />
    );

    fireEvent.click(screen.getByText('所属グループ全体を選択'));
    expect(selectAnnotationSpy).toHaveBeenCalledWith(['grp-roi']);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes on Escape key and outside click after activation delay', () => {
    vi.useFakeTimers();

    const target: CanvasContextMenuTarget = {
      type: 'node',
      id: 'wp-1',
      parentContainerId: null,
      parentContainerKind: null,
    };

    render(
      <CanvasContextMenu
        x={100}
        y={150}
        target={target}
        onClose={mockOnClose}
      />
    );

    // Escape key works immediately
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(1);

    // Outside click immediately after mount (same tick) is ignored to prevent accidental close on right click
    fireEvent.mouseDown(document.body);
    expect(mockOnClose).toHaveBeenCalledTimes(1);

    // After activation delay (50ms), outside click closes menu
    vi.advanceTimersByTime(60);
    fireEvent.mouseDown(document.body);
    expect(mockOnClose).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
