import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';
import { useAppStore } from '../../../../stores/appStore';
import { useTreeItemSelection } from '../../../../hooks/useTreeItemSelection';
import {
  computeDropTarget,
  treeAncestorIds,
  treeParentIndex,
  visibleTreeRows,
  type DropTarget,
  type TreeModel,
  type TreeRowInfo,
} from '../../../../utils/treeCore';
import { TREE_BASE_PADDING_PX, TREE_INDENT_PX, TreeRow, type TreeRowContent } from './TreeRow';

/** How long the pointer rests on a collapsed container while dragging before it opens (ms). */
const AUTO_EXPAND_DELAY_MS = 600;

const EMPTY: string[] = [];

export interface TreeViewProps {
  /** Key of this tree's expanded state in the store. */
  treeId: string;
  ariaLabel: string;
  model: TreeModel;
  selectedIds: readonly string[];
  /** Replaces the selection. */
  onSelectionChange: (ids: string[]) => void;
  renderRow: (row: TreeRowInfo) => TreeRowContent | null;
  onToggleVisible?: (id: string) => void;
  /** Enables renaming (double-click, F2). */
  onRename?: (id: string, name: string) => void;
  /** The item being renamed, when the parent starts it (e.g. from a context menu). */
  editingId: string | null;
  onEditingChange: (id: string | null) => void;
  canDrop: (movingIds: string[], target: DropTarget) => boolean;
  /** Moves the items; called only for drops `canDrop` accepted. */
  onDrop: (movingIds: string[], target: DropTarget) => void;
  onItemContextMenu?: (e: React.MouseEvent, id: string) => void;
  onBackgroundContextMenu?: (e: React.MouseEvent) => void;
  emptyState?: ReactNode;
  /** The row to highlight briefly (see `useTreeReveal`). */
  flashingId?: string | null;
}

/**
 * The shared tree list (docs/RULES.md "ツリー操作標準"): click / Ctrl / Shift selection, expand and collapse,
 * rename by double-click or F2, drag and drop before / after / inside (with the horizontal position choosing
 * the depth at the end of a group), Alt+↑/↓ to move the selection among its siblings, and the ancestors of
 * a newly selected item opened.
 */
export function TreeView({
  treeId,
  ariaLabel,
  model,
  selectedIds,
  onSelectionChange,
  renderRow,
  onToggleVisible,
  onRename,
  editingId,
  onEditingChange,
  canDrop,
  onDrop,
  onItemContextMenu,
  onBackgroundContextMenu,
  emptyState,
  flashingId,
}: TreeViewProps) {
  const expandedIds = useAppStore((state) => state.expandedTreeItems[treeId] ?? EMPTY);
  const setTreeItemExpanded = useAppStore((state) => state.setTreeItemExpanded);
  const expandTreeItems = useAppStore((state) => state.expandTreeItems);
  const expanded = useMemo(() => new Set(expandedIds), [expandedIds]);

  const rows = useMemo(() => visibleTreeRows(model, expanded), [model, expanded]);
  const visibleIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const parentIndex = useMemo(() => treeParentIndex(model), [model]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // Open the groups above a newly selected item, so that it is seen (e.g. a layer added inside a closed group).
  useEffect(() => {
    const ancestors = selectedIds.flatMap((id) => treeAncestorIds(parentIndex, id));
    if (ancestors.length > 0) expandTreeItems(treeId, ancestors);
    // Only a change of selection should open groups; closing one afterwards must stay possible.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);

  // Collapsed containers holding a selected item are marked.
  const holdingSelection = useMemo(() => {
    const holders = new Set<string>();
    selectedIds.forEach((id) => treeAncestorIds(parentIndex, id).forEach((a) => holders.add(a)));
    return holders;
  }, [selectedIds, parentIndex]);

  const selectFn = useCallback(
    (ids: string[], multi?: boolean) => {
      if (!multi) return onSelectionChange(ids);
      const [id] = ids;
      onSelectionChange(selectedSet.has(id) ? selectedIds.filter((s) => s !== id) : [...selectedIds, id]);
    },
    [onSelectionChange, selectedIds, selectedSet],
  );
  const { handleItemClick, handleItemContextMenu } = useTreeItemSelection({
    selectedIds: selectedIds as string[],
    selectFn,
    visibleIds,
  });

  // --- Drag and drop ---
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const expandTimer = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);

  const movingIdsFor = (id: string) => (selectedSet.has(id) && selectedIds.length > 1 ? [...selectedIds] : [id]);

  const clearExpandTimer = () => {
    if (expandTimer.current) clearTimeout(expandTimer.current.timer);
    expandTimer.current = null;
  };
  useEffect(() => clearExpandTimer, []);

  const targetFor = (event: DragMoveEvent | DragEndEvent): DropTarget | null => {
    const { over, active, activatorEvent, delta } = event;
    // Only a pointer drag has a position; a keyboard drag is left to Alt+↑/↓.
    if (!over || !activatorEvent || !('clientX' in activatorEvent)) return null;
    const pointer = activatorEvent as MouseEvent;
    const pointerX = pointer.clientX + delta.x;
    const pointerY = pointer.clientY + delta.y;
    const target = computeDropTarget(
      model,
      rows,
      String(over.id),
      {
        offsetY: pointerY - over.rect.top,
        height: over.rect.height,
        offsetX: pointerX - over.rect.left - TREE_BASE_PADDING_PX,
      },
      TREE_INDENT_PX,
    );
    return target && canDrop(movingIdsFor(String(active.id)), target) ? target : null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    onEditingChange(null);
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const target = targetFor(event);
    setDropTarget((prev) =>
      prev?.targetId === target?.targetId && prev?.position === target?.position ? prev : target,
    );
    const row = target && target.position === 'inside' ? rows.find((r) => r.id === target.targetId) : undefined;
    if (row && row.isContainer && !row.isExpanded) {
      if (expandTimer.current?.id !== row.id) {
        clearExpandTimer();
        expandTimer.current = {
          id: row.id,
          timer: setTimeout(() => setTreeItemExpanded(treeId, row.id, true), AUTO_EXPAND_DELAY_MS),
        };
      }
    } else {
      clearExpandTimer();
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const target = targetFor(event);
    const moving = movingIdsFor(String(event.active.id));
    setActiveId(null);
    setDropTarget(null);
    clearExpandTimer();
    if (target) onDrop(moving, target);
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setDropTarget(null);
    clearExpandTimer();
  };

  // --- Keyboard: F2 renames, Alt+↑/↓ moves the selection among its siblings ---
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    if (e.key === 'F2' && onRename && selectedIds.length === 1) {
      e.preventDefault();
      onEditingChange(selectedIds[0]);
      return;
    }
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && selectedIds.length > 0) {
      e.preventDefault();
      const ordered = visibleIds.filter((id) => selectedSet.has(id));
      const parents = new Set(ordered.map((id) => parentIndex.get(id) ?? null));
      if (ordered.length === 0 || parents.size !== 1) return;
      const [parent] = [...parents];
      const siblings = parent ? (model.childrenOf(parent) ?? []) : model.rootIds;
      const up = e.key === 'ArrowUp';
      const edge = siblings.indexOf(up ? ordered[0] : ordered[ordered.length - 1]);
      const neighbour = siblings[up ? edge - 1 : edge + 1];
      if (!neighbour) return;
      const target: DropTarget = { targetId: neighbour, position: up ? 'before' : 'after' };
      if (canDrop(ordered, target)) onDrop(ordered, target);
    }
  };

  const activeContent = activeId
    ? renderRow(
        rows.find((r) => r.id === activeId) ?? {
          id: activeId,
          depth: 0,
          parentId: null,
          isContainer: false,
          isExpanded: false,
        },
      )
    : null;

  if (model.rootIds.length === 0) return <>{emptyState}</>;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <ul
        role="tree"
        aria-label={ariaLabel}
        aria-multiselectable
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onContextMenu={(e) => {
          if (!onBackgroundContextMenu) return;
          e.preventDefault();
          onBackgroundContextMenu(e);
        }}
        className="space-y-1 p-1 outline-none focus-visible:ring-1 focus-visible:ring-primary-base/50 rounded-md"
      >
        {rows.map((row) => {
          const content = renderRow(row);
          if (!content) return null;
          return (
            <TreeRow
              key={row.id}
              id={row.id}
              depth={row.depth}
              isContainer={row.isContainer}
              isExpanded={row.isExpanded}
              isSelected={selectedSet.has(row.id)}
              holdsSelection={!row.isExpanded && holdingSelection.has(row.id)}
              isEditing={editingId === row.id}
              isFlashing={flashingId === row.id}
              dropIndicator={dropTarget?.targetId === row.id ? dropTarget.position : null}
              content={content}
              onClick={(e) => handleItemClick(row.id, e)}
              onDoubleClick={() => {
                if (onRename) onEditingChange(row.id);
              }}
              onContextMenu={(e) => {
                handleItemContextMenu(e, row.id);
                onItemContextMenu?.(e, row.id);
              }}
              onToggleExpand={() => setTreeItemExpanded(treeId, row.id, !row.isExpanded)}
              onToggleVisible={onToggleVisible ? () => onToggleVisible(row.id) : undefined}
              onRename={(name) => {
                onRename?.(row.id, name);
                onEditingChange(null);
              }}
              onCancelRename={() => onEditingChange(null)}
            />
          );
        })}
      </ul>

      <DragOverlay>
        {activeContent && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-surface-panel/90 border border-primary-base shadow-xl text-xs text-text-base">
            <GripVertical size={13} className="text-primary-base" />
            {activeContent.icon}
            <span className="font-semibold">{activeContent.name}</span>
            {activeId && selectedSet.has(activeId) && selectedIds.length > 1 && (
              <span className="px-1.5 rounded-full bg-primary-base text-surface-base font-bold text-[10px]">
                +{selectedIds.length - 1}
              </span>
            )}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
