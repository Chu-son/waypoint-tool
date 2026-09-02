import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppStore } from '../../stores/appStore';
import {
  ChevronRight,
  Layers,
  GripVertical,
  Anchor,
  Code2,
  Unlink,
  Trash2,
  Copy,
  Folder,
  FolderPlus,
  Edit2,
  ArrowDownToLine,
  X,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { WaypointNode } from '../../types/store';
import {
  getFlattenedWaypointIds,
  getVisibleTreeNodes,
  computeDragDropPosition,
  findNodeParentId,
  getNodesAfterInsertionTarget,
} from '../../utils/treeUtils';
import { useTreeItemSelection } from '../../hooks/useTreeItemSelection';

export const INSERTION_BAR_ID = '__insertion_bar__';

interface InsertionBarItemProps {
  depth?: number;
  isAtEnd?: boolean;
  onReset: () => void;
}

function InsertionBarItem({ depth = 0, isAtEnd = false, onReset }: InsertionBarItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: INSERTION_BAR_ID,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 60 : 20,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="list-none select-none my-1"
      onDoubleClick={(e) => {
        e.stopPropagation();
        onReset();
      }}
    >
      <div
        style={{ marginLeft: `${depth * 16}px` }}
        className="group relative flex items-center gap-1.5 py-1 px-1 rounded transition-all"
      >
        {/* Grip Handle for Dragging */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-primary-base hover:text-primary-base/80 p-0.5 rounded hover:bg-primary-base/10 shrink-0 touch-none transition-colors"
          title="ドラッグして挿入位置を移動"
        >
          <GripVertical size={13} />
        </div>

        {/* Accent Insertion Line Bar */}
        <div className="flex-1 flex items-center">
          <div className="h-1.5 w-full bg-primary-base rounded-full shadow-sm ring-1 ring-primary-base/40 group-hover:ring-primary-base transition-all" />
        </div>

        {/* Reset (✕) Button if not at end */}
        {!isAtEnd && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReset();
            }}
            className="shrink-0 p-0.5 rounded text-text-muted hover:text-text-base hover:bg-surface-hover transition-colors"
            title="末尾に戻す"
          >
            <X size={12} />
          </button>
        )}
      </div>
    </li>
  );
}

interface TreeItemRowProps {
  id: string;
  node: WaypointNode;
  depth: number;
  isSelected: boolean;
  isAnchor?: boolean;
  isExpanded?: boolean;
  isEditing?: boolean;
  isAfterInsertion?: boolean;
  globalIndex?: number;
  indexStartIndex: number;
  onToggleExpand?: () => void;
  onClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onRename: (newName: string) => void;
  onCancelRename: () => void;
}

function SortableTreeNodeItem({
  id,
  node,
  depth,
  isSelected,
  isAnchor,
  isExpanded,
  isEditing,
  isAfterInsertion,
  globalIndex,
  indexStartIndex,
  onToggleExpand,
  onClick,
  onContextMenu,
  onRename,
  onCancelRename,
}: TreeItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [nameValue, setNameValue] = useState(node.name || '');
  const plugins = useAppStore((state) => state.plugins);

  useEffect(() => {
    setNameValue(node.name || '');
  }, [node.name, isEditing]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 50 : 'auto',
    position: 'relative' as const,
  };

  const isGenerator = node.type === 'generator';
  const isGroup = node.type === 'manual_group' || node.type === 'group';
  const isContainer = isGenerator || isGroup;

  const pluginName = isGenerator && node.plugin_id && plugins[node.plugin_id]
    ? plugins[node.plugin_id].manifest.name
    : 'Generator';

  const defaultDisplayName = isGenerator
    ? pluginName
    : isGroup
    ? (node.name || 'Group')
    : (node.name ? `Waypoint (${node.name})` : 'Waypoint');

  const handleNameSubmit = () => {
    if (nameValue.trim() && nameValue !== node.name) {
      onRename(nameValue.trim());
    } else {
      onCancelRename();
    }
  };

  const childCount = node.children_ids?.length || 0;

  return (
    <li ref={setNodeRef} style={style} className="space-y-1 select-none">
      <div
        onClick={onClick}
        onContextMenu={onContextMenu}
        style={{ paddingLeft: `${Math.min(depth * 10 + 6, 32)}px` }}
        className={cn(
          'group relative flex items-center justify-between gap-1 py-1.5 pr-1.5 rounded-lg text-xs transition-all cursor-pointer border overflow-hidden',
          isSelected
            ? isGenerator
              ? 'bg-accent-generator/20 border-accent-generator text-text-base shadow-sm ring-1 ring-accent-generator/30'
              : 'bg-primary-base/20 border-primary-base text-text-base shadow-sm ring-1 ring-primary-base/30'
            : 'bg-surface-panel/60 hover:bg-surface-hover border-border-base/40 text-text-muted hover:text-text-base',
          isAnchor && 'border-accent-anchor/60 bg-accent-anchor/20',
          isAfterInsertion && 'opacity-40 grayscale-[35%] hover:opacity-75'
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
          {/* Grip Icon for DnD */}
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-text-muted/40 hover:text-text-muted shrink-0 touch-none"
          >
            <GripVertical size={13} />
          </div>

          {/* Expand/Collapse Chevron for Groups/Generators */}
          {isContainer ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand?.();
              }}
              className="p-0.5 hover:bg-surface-hover rounded text-text-muted hover:text-text-base transition-transform shrink-0"
            >
              <ChevronRight
                size={13}
                className={cn('transition-transform duration-150', isExpanded ? 'rotate-90' : '')}
              />
            </button>
          ) : (
            <span className="w-3 shrink-0" />
          )}

          {/* Node Icon */}
          <div className="shrink-0 flex items-center">
            {isGenerator ? (
              <Layers size={13} className="text-accent-generator" />
            ) : isGroup ? (
              <Folder size={13} className="text-accent-anchor" />
            ) : (
              <span className="text-xs">🎯</span>
            )}
          </div>

          {/* Node Name / Inline Editing */}
          {isEditing ? (
            <input
              type="text"
              value={nameValue}
              autoFocus
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameSubmit();
                if (e.key === 'Escape') {
                  setNameValue(node.name || '');
                  onCancelRename();
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 bg-surface-base border border-primary-base rounded px-1.5 py-0.5 text-xs text-text-base focus:outline-none"
            />
          ) : (
            <div className="flex items-center gap-1 min-w-0 flex-1 truncate">
              {!isContainer && globalIndex !== undefined && (
                <span className="opacity-60 font-mono text-[11px] shrink-0">
                  [{globalIndex + indexStartIndex}]
                </span>
              )}
              <span className="truncate font-medium text-text-base" title={defaultDisplayName}>
                {isContainer ? (node.name || defaultDisplayName) : defaultDisplayName}
              </span>
              {isAnchor && (
                <span className="text-accent-anchor text-xs font-bold shrink-0" title="Anchor Point">
                  ⚓
                </span>
              )}
            </div>
          )}

          {/* Item Count Badge for Groups/Generators */}
          {isContainer && (
            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-surface-hover text-text-muted border border-border-base/30 shrink-0 font-mono font-bold">
              {childCount}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

export function WaypointTree() {
  const rootNodeIds = useAppStore((state) => state.rootNodeIds);
  const nodes = useAppStore((state) => state.nodes);
  const selectedNodeIds = useAppStore((state) => state.selectedNodeIds);
  const selectNodes = useAppStore((state) => state.selectNodes);
  const duplicateNodes = useAppStore((state) => state.duplicateNodes);
  const moveNodesInTree = useAppStore((state) => state.moveNodesInTree);
  const indexStartIndex = useAppStore((state) => state.indexStartIndex);
  const groupNodes = useAppStore((state) => state.groupNodes);
  const ungroupNode = useAppStore((state) => state.ungroupNode);
  const renameNode = useAppStore((state) => state.renameNode);
  const removeNodes = useAppStore((state) => state.removeNodes);
  const setRightPanelActiveTab = useAppStore((state) => state.setRightPanelActiveTab);
  const setRightPanelOpen = useAppStore((state) => state.setRightPanelOpen);
  const openPluginDataModal = useAppStore((state) => state.openPluginDataModal);
  const anchorNodeId = useAppStore((state) => state.anchorNodeId);
  const setAnchorNode = useAppStore((state) => state.setAnchorNode);
  const elementCopyState = useAppStore((state) => state.elementCopyState);
  const setElementCopyState = useAppStore((state) => state.setElementCopyState);
  const insertionTarget = useAppStore((state) => state.insertionTarget);
  const setInsertionTarget = useAppStore((state) => state.setInsertionTarget);

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // マニュアルウェイポイントのインデックスマップ
  const waypointIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    const flatWpIds = getFlattenedWaypointIds(rootNodeIds, nodes);
    flatWpIds.forEach((id, idx) => map.set(id, idx));
    return map;
  }, [rootNodeIds, nodes]);

  // 画面上に展開されている全ノードを深さ優先順で取得
  const visibleNodes = useMemo(() => {
    return getVisibleTreeNodes(rootNodeIds, nodes, expandedNodes);
  }, [rootNodeIds, nodes, expandedNodes]);

  // insertionTarget より後方のノードIDを算出（グレーアウト判定用）
  const afterNodeIds = useMemo(() => {
    return getNodesAfterInsertionTarget(rootNodeIds, nodes, insertionTarget);
  }, [rootNodeIds, nodes, insertionTarget]);

  interface DisplayTreeItem {
    id: string;
    isInsertionBar?: boolean;
    depth: number;
    node?: WaypointNode;
    isAtEnd?: boolean;
  }

  // ドラッグ可能な挿入バーを含めた表示用リストを構築
  const displayItems = useMemo<DisplayTreeItem[]>(() => {
    if (rootNodeIds.length === 0) return [];

    const result: DisplayTreeItem[] = [];
    let barInserted = false;

    // 挿入位置がルート先頭 (null, 0) の場合
    if (insertionTarget && insertionTarget.parentId === null && insertionTarget.index === 0) {
      result.push({ id: INSERTION_BAR_ID, isInsertionBar: true, depth: 0, isAtEnd: false });
      barInserted = true;
    }

    for (let i = 0; i < visibleNodes.length; i++) {
      const item = visibleNodes[i];
      const node = nodes[item.id];
      result.push({ id: item.id, depth: item.depth, node });

      if (insertionTarget && !barInserted) {
        // ケースA: 空グループまたはグループ先頭 (index 0) に挿入
        if (insertionTarget.parentId === item.id && insertionTarget.index === 0) {
          result.push({ id: INSERTION_BAR_ID, isInsertionBar: true, depth: item.depth + 1, isAtEnd: false });
          barInserted = true;
          continue;
        }

        // ケースB: このアイテムの直後に挿入
        const itemParentId = findNodeParentId(item.id, rootNodeIds, nodes);
        if (itemParentId === insertionTarget.parentId) {
          const siblings = itemParentId ? (nodes[itemParentId]?.children_ids || []) : rootNodeIds;
          const idxInSiblings = siblings.indexOf(item.id);
          if (idxInSiblings === insertionTarget.index - 1) {
            // このアイテム自身が展開されたグループで子を持つ場合は、子ノード群の後に挿入バーを出す
            const hasExpandedChildren = (node?.type === 'manual_group' || node?.type === 'group' || node?.type === 'generator') &&
                                        expandedNodes.has(item.id) &&
                                        (node.children_ids?.length ?? 0) > 0;
            if (!hasExpandedChildren) {
              result.push({ id: INSERTION_BAR_ID, isInsertionBar: true, depth: item.depth, isAtEnd: false });
              barInserted = true;
            }
          }
        }
      }
    }

    // まだ挿入されていない場合（末尾または insertionTarget === null のデフォルト時）
    if (!barInserted) {
      result.push({ id: INSERTION_BAR_ID, isInsertionBar: true, depth: 0, isAtEnd: insertionTarget === null });
    }

    return result;
  }, [visibleNodes, insertionTarget, rootNodeIds, nodes, expandedNodes]);

  const visibleIds = useMemo(() => displayItems.map((n) => n.id), [displayItems]);

  const { handleItemClick, handleItemContextMenu } = useTreeItemSelection({
    selectedIds: selectedNodeIds,
    selectFn: selectNodes,
    visibleIds,
    onInspect: () => {
      setRightPanelActiveTab('inspector');
      setRightPanelOpen(true);
    },
    elementCopyState,
    onElementCopySelect: (id) => {
      selectNodes([id]);
      if (elementCopyState) {
        setElementCopyState({ ...elementCopyState, previewNodeId: id });
      }
    },
  });

  const handleContextMenu = (e: React.MouseEvent, nodeId: string) => {
    handleItemContextMenu(e, nodeId);
    setContextMenu({ nodeId, x: e.clientX, y: e.clientY });
  };

  const handleCreateGroup = () => {
    const targetIds = selectedNodeIds.length > 0
      ? selectedNodeIds
      : contextMenu ? [contextMenu.nodeId] : [];
    if (targetIds.length === 0) return;

    const newGroupId = groupNodes(targetIds);
    if (newGroupId) {
      setExpandedNodes((prev) => new Set([...prev, newGroupId]));
      setEditingNodeId(newGroupId);
    }
    setContextMenu(null);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // 挿入バーがドラッグされた場合
    if (activeId === INSERTION_BAR_ID) {
      const parentId = findNodeParentId(overId, rootNodeIds, nodes);
      const siblings = parentId ? (nodes[parentId]?.children_ids || []) : rootNodeIds;
      const idx = siblings.indexOf(overId);

      const position = computeDragDropPosition(activeId, overId, visibleIds);
      if (position === 'before') {
        setInsertionTarget({ parentId, index: Math.max(0, idx) });
      } else {
        // after
        const isRootLast = parentId === null && idx === rootNodeIds.length - 1;
        if (isRootLast) {
          setInsertionTarget(null); // 末尾復帰
        } else {
          setInsertionTarget({ parentId, index: idx + 1 });
        }
      }
      return;
    }

    // 通常のノードがドラッグされ、挿入バーの上にドロップされた場合
    if (overId === INSERTION_BAR_ID) {
      const movingIds = selectedNodeIds.includes(activeId) && selectedNodeIds.length > 1
        ? selectedNodeIds
        : [activeId];
      if (insertionTarget) {
        const { parentId, index } = insertionTarget;
        const siblings = parentId ? (nodes[parentId]?.children_ids || []) : rootNodeIds;
        const targetNodeId = siblings[index] || siblings[siblings.length - 1];
        if (targetNodeId && !movingIds.includes(targetNodeId)) {
          moveNodesInTree(movingIds, targetNodeId, index < siblings.length ? 'before' : 'after');
        }
      }
      return;
    }

    // 通常のノード同士のドラッグ移動
    const movingIds = selectedNodeIds.includes(activeId) && selectedNodeIds.length > 1
      ? selectedNodeIds
      : [activeId];

    if (movingIds.includes(overId)) return;

    const position = computeDragDropPosition(activeId, overId, visibleIds);
    moveNodesInTree(movingIds, overId, position);
  };

  const totalWaypointsCount = waypointIndexMap.size;
  const activeDragNode = activeDragId ? nodes[activeDragId] : null;

  return (
    <div className="w-full flex flex-col space-y-2 relative">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-text-base uppercase tracking-wider">Waypoints</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface-hover text-text-muted font-bold">
            {totalWaypointsCount}
          </span>
        </div>
      </div>

      {rootNodeIds.length === 0 ? (
        <div className="text-sm text-text-muted/60 italic p-4 text-center">
          No items yet. Drag to create points on the map.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="p-1">
            <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
              <ul className="space-y-1">
                {displayItems.map((item) => {
                  if (item.isInsertionBar) {
                    return (
                      <InsertionBarItem
                        key={INSERTION_BAR_ID}
                        depth={item.depth}
                        isAtEnd={item.isAtEnd}
                        onReset={() => setInsertionTarget(null)}
                      />
                    );
                  }

                  const node = item.node;
                  if (!node) return null;

                  const isSelected = selectedNodeIds.includes(item.id);
                  const isAnchor = anchorNodeId === item.id;
                  const isExpanded = expandedNodes.has(item.id);
                  const isEditing = editingNodeId === item.id;
                  const globalIdx = waypointIndexMap.get(item.id);
                  const isAfter = afterNodeIds.has(item.id);

                  return (
                    <SortableTreeNodeItem
                      key={item.id}
                      id={item.id}
                      node={node}
                      depth={item.depth}
                      isSelected={isSelected}
                      isAnchor={isAnchor}
                      isExpanded={isExpanded}
                      isEditing={isEditing}
                      isAfterInsertion={isAfter}
                      globalIndex={globalIdx}
                      indexStartIndex={indexStartIndex}
                      onToggleExpand={() => toggleExpand(item.id)}
                      onClick={(e) => handleItemClick(item.id, e)}
                      onContextMenu={(e) => handleContextMenu(e, item.id)}
                      onRename={(newName) => {
                        renameNode(item.id, newName);
                        setEditingNodeId(null);
                      }}
                      onCancelRename={() => setEditingNodeId(null)}
                    />
                  );
                })}
              </ul>
            </SortableContext>
          </div>

          <DragOverlay>
            {activeDragId === INSERTION_BAR_ID ? (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface-panel/95 border border-primary-base shadow-xl text-primary-base w-48">
                <GripVertical size={13} />
                <div className="h-1.5 w-full bg-primary-base rounded-full" />
              </div>
            ) : activeDragNode ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-panel/90 border border-primary-base shadow-xl text-xs text-text-base">
                <GripVertical size={13} className="text-primary-base" />
                <span className="font-semibold">{activeDragNode.name || 'Waypoint'}</span>
                {selectedNodeIds.length > 1 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-primary-base text-text-inverse font-bold text-[10px]">
                    +{selectedNodeIds.length}
                  </span>
                )}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-[9999] bg-surface-panel border border-border-base rounded-xl shadow-xl py-1 min-w-[190px] text-xs text-text-base select-none backdrop-blur-md flex flex-col gap-0.5"
        >
          {(() => {
            const targetNode = nodes[contextMenu.nodeId];
            const isContainer = targetNode?.type === 'generator' || targetNode?.type === 'manual_group' || targetNode?.type === 'group';
            const isMultiSelected = selectedNodeIds.length > 1 && selectedNodeIds.includes(contextMenu.nodeId);
            const targetIds = isMultiSelected ? selectedNodeIds : [contextMenu.nodeId];

            return (
              <>
                {/* グループ化 (Group) */}
                <button
                  onClick={handleCreateGroup}
                  className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-surface-hover text-left w-full transition-colors text-text-base font-medium"
                >
                  <FolderPlus size={13} className="text-accent-anchor" />
                  <span>
                    {targetIds.length > 1
                      ? `選択項目をグループ化 (${targetIds.length})`
                      : 'グループ化 (Group)'}
                  </span>
                </button>

                {/* 名前を変更 (Rename) */}
                <button
                  onClick={() => {
                    setEditingNodeId(contextMenu.nodeId);
                    setContextMenu(null);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-surface-hover text-left w-full transition-colors text-text-base"
                >
                  <Edit2 size={13} className="text-primary-base" />
                  <span>名前を変更 (Rename)</span>
                </button>

                {/* グループ解除 (Ungroup) */}
                {isContainer && (
                  <button
                    onClick={() => {
                      ungroupNode(contextMenu.nodeId);
                      setContextMenu(null);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-surface-hover text-left w-full transition-colors text-text-base"
                  >
                    <Unlink size={13} className="text-accent-anchor" />
                    <span>グループ解除 (Ungroup)</span>
                  </button>
                )}

                {/* 挿入位置に設定 */}
                <button
                  onClick={() => {
                    const parentId = findNodeParentId(contextMenu.nodeId, rootNodeIds, nodes);
                    const siblings = parentId ? (nodes[parentId]?.children_ids || []) : rootNodeIds;
                    const idx = siblings.indexOf(contextMenu.nodeId);
                    setInsertionTarget({ parentId, index: idx + 1 });
                    setContextMenu(null);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-surface-hover text-left w-full transition-colors text-text-base"
                >
                  <ArrowDownToLine size={13} className="text-primary-base" />
                  <span>この直後に挿入を設定</span>
                </button>
                {isContainer && (
                  <button
                    onClick={() => {
                      setInsertionTarget({ parentId: contextMenu.nodeId, index: 0 });
                      setExpandedNodes((prev) => new Set([...prev, contextMenu.nodeId]));
                      setContextMenu(null);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-surface-hover text-left w-full transition-colors text-text-base"
                  >
                    <ArrowDownToLine size={13} className="text-accent-anchor" />
                    <span>グループ内の先頭に挿入を設定</span>
                  </button>
                )}

                <div className="h-px bg-border-base/30 my-0.5" />

                {/* 複製 (Duplicate) */}
                <button
                  onClick={() => {
                    duplicateNodes(targetIds);
                    setContextMenu(null);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-surface-hover text-left w-full transition-colors text-text-base"
                >
                  <Copy size={13} className="text-accent-automation" />
                  <span>{isMultiSelected ? `選択項目を複製 (${targetIds.length})` : '複製 (Duplicate)'}</span>
                </button>

                {/* 内部プロパティ表示 (モーダル) */}
                <button
                  onClick={() => {
                    const titleName = targetNode?.name || (targetNode?.type === 'generator' ? 'Generator' : 'Waypoint');
                    openPluginDataModal(
                      `内部プロパティ: ${titleName}`,
                      targetNode?.plugin_data,
                      `ノードID: ${targetNode?.id} • 内部メタデータ (Read-only)`
                    );
                    setContextMenu(null);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-surface-hover text-left w-full transition-colors text-text-base"
                >
                  <Code2 size={13} className="text-accent-automation" />
                  <span>内部プロパティを表示</span>
                </button>

                {/* インスペクターを開く */}
                <button
                  onClick={() => {
                    selectNodes([contextMenu.nodeId]);
                    setRightPanelActiveTab('inspector');
                    setRightPanelOpen(true);
                    setContextMenu(null);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-surface-hover text-left w-full transition-colors text-text-base"
                >
                  <Layers size={13} className="text-text-muted" />
                  <span>インスペクターを開く</span>
                </button>

                {/* アンカー設定 (ウェイポイントの場合) */}
                {!isContainer && !isMultiSelected && (
                  <button
                    onClick={() => {
                      if (anchorNodeId === contextMenu.nodeId) {
                        setAnchorNode(null);
                      } else {
                        setAnchorNode(contextMenu.nodeId);
                      }
                      setContextMenu(null);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-surface-hover text-left w-full transition-colors text-text-base"
                  >
                    <Anchor size={13} className="text-accent-anchor" />
                    <span>{anchorNodeId === contextMenu.nodeId ? 'アンカー設定を解除' : 'アンカーに設定'}</span>
                  </button>
                )}

                <div className="h-px bg-border-base/30 my-0.5" />

                {/* 削除 */}
                <button
                  onClick={() => {
                    removeNodes(targetIds);
                    setContextMenu(null);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-danger-base/10 text-danger-base text-left w-full transition-colors"
                >
                  <Trash2 size={13} />
                  <span>{isMultiSelected ? `選択項目を削除 (${targetIds.length})` : '削除 (Delete)'}</span>
                </button>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
