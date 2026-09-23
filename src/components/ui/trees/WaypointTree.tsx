import React, { useMemo } from 'react';
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from '../common/ContextMenu';
import { useAppStore } from '../../../stores/appStore';
import {
  Layers,
  GripVertical,
  Anchor,
  Code2,
  Unlink,
  Trash2,
  Copy,
  FolderPlus,
  Edit2,
  ArrowDownToLine,
  Scissors,
  ClipboardPaste,
} from 'lucide-react';
import { DndContext, closestCenter, DragEndEvent, DragStartEvent, DragOverlay } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { WaypointNode } from '../../../types/store';
import {
  getFlattenedWaypointIds,
  getVisibleTreeNodes,
  computeDragDropPosition,
  findNodeParentId,
  getNodeDepth,
  getNodesAfterInsertionTarget,
  isInsertableContainer,
  escapeCollapsedInsertionTarget,
  determineMultiDepthDropTarget,
  getAncestorIds,
  getHighlightedContainerIds,
} from '../../../utils/treeUtils';
import { useTreeItemSelection } from '../../../hooks/useTreeItemSelection';
import { useTreeInteractionState } from '../../../hooks/useTreeInteractionState';
import { useTreeReveal } from '../../../hooks/useTreeReveal';
import { INSERTION_BAR_ID, InsertionBarItem } from './InsertionBarItem';
import { SortableTreeNodeItem } from './WaypointTreeRow';

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
  const copySelectedMapElements = useAppStore((state) => state.copySelectedMapElements);
  const cutSelectedMapElements = useAppStore((state) => state.cutSelectedMapElements);
  const pasteMapElements = useAppStore((state) => state.pasteMapElements);

  const {
    expanded: expandedNodes,
    setExpanded: setExpandedNodes,
    editingId: editingNodeId,
    setEditingId: setEditingNodeId,
    activeDragId,
    setActiveDragId,
    contextMenu: menuState,
    setContextMenu: setMenuState,
    sensors,
  } = useTreeInteractionState();
  const contextMenu = menuState && { nodeId: menuState.id, x: menuState.x, y: menuState.y };
  const setContextMenu = (m: { nodeId: string | null; x: number; y: number } | null) =>
    setMenuState(m && { id: m.nodeId, x: m.x, y: m.y });

  const toggleExpand = (id: string) => {
    const isCurrentlyExpanded = expandedNodes.has(id);
    const next = new Set(expandedNodes);
    if (isCurrentlyExpanded) {
      next.delete(id);
      if (insertionTarget) {
        const escaped = escapeCollapsedInsertionTarget(insertionTarget, next, rootNodeIds, nodes);
        if (escaped && (escaped.parentId !== insertionTarget.parentId || escaped.index !== insertionTarget.index)) {
          setInsertionTarget(escaped);
        }
      }
    } else {
      next.add(id);
    }
    setExpandedNodes(next);
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

  const getWaypointParentId = React.useCallback(
    (id: string) => findNodeParentId(id, rootNodeIds, nodes),
    [rootNodeIds, nodes],
  );

  const highlightedContainerIds = useMemo(
    () => getHighlightedContainerIds(selectedNodeIds, getWaypointParentId),
    [selectedNodeIds, getWaypointParentId],
  );

  const { flashingId } = useTreeReveal({
    treeType: 'node',
    getAncestorIds: React.useCallback((id: string) => getAncestorIds(id, getWaypointParentId), [getWaypointParentId]),
    setExpanded: setExpandedNodes,
  });

  interface DisplayTreeItem {
    id: string;
    isInsertionBar?: boolean;
    depth: number;
    node?: WaypointNode;
    isAtEnd?: boolean;
  }

  // ドラッグ可能な挿入バーを含めた表示用リストを構築
  const displayItems = useMemo<DisplayTreeItem[]>(() => {
    if (rootNodeIds.length === 0) {
      return [{ id: INSERTION_BAR_ID, isInsertionBar: true, depth: 0, isAtEnd: true }];
    }

    // insertionTarget が null の場合: ツリーの末尾に挿入バーを配置
    if (!insertionTarget) {
      const result: DisplayTreeItem[] = visibleNodes.map((item) => ({
        id: item.id,
        depth: item.depth,
        node: nodes[item.id],
      }));
      result.push({ id: INSERTION_BAR_ID, isInsertionBar: true, depth: 0, isAtEnd: true });
      return result;
    }

    // insertionTarget が存在する場合の挿入バー配置位置を特定
    let insertBarAfterVisibleIndex: number | null = null; // -1 は先頭（第0要素の前）
    let insertBarDepth = 0;

    if (insertionTarget.parentId === null) {
      insertBarDepth = 0;
      if (insertionTarget.index === 0) {
        insertBarAfterVisibleIndex = -1;
      } else {
        const refIndex = Math.min(insertionTarget.index - 1, rootNodeIds.length - 1);
        const refChildId = rootNodeIds[refIndex];
        const visibleIdx = visibleNodes.findIndex((v) => v.id === refChildId);
        if (visibleIdx !== -1) {
          // refChildId の全可視子孫ノードを走査し、最後の子孫の直後を挿入位置とする
          const refDepth = visibleNodes[visibleIdx].depth;
          let lastDescendantIdx = visibleIdx;
          for (let j = visibleIdx + 1; j < visibleNodes.length; j++) {
            if (visibleNodes[j].depth > refDepth) {
              lastDescendantIdx = j;
            } else {
              break;
            }
          }
          insertBarAfterVisibleIndex = lastDescendantIdx;
        }
      }
    } else {
      // 親グループが存在する場合
      const parentNode = nodes[insertionTarget.parentId];
      const children = parentNode?.children_ids || [];
      const parentVisibleIdx = visibleNodes.findIndex((v) => v.id === insertionTarget.parentId);
      const parentDepth =
        parentVisibleIdx !== -1
          ? visibleNodes[parentVisibleIdx].depth
          : getNodeDepth(insertionTarget.parentId, rootNodeIds, nodes);
      insertBarDepth = parentDepth + 1;

      let found = false;

      if (insertionTarget.index > 0 && children.length > 0) {
        const refIndex = Math.min(insertionTarget.index - 1, children.length - 1);
        const refChildId = children[refIndex];
        const visibleIdx = visibleNodes.findIndex((v) => v.id === refChildId);
        if (visibleIdx !== -1) {
          const refDepth = visibleNodes[visibleIdx].depth;
          let lastDescendantIdx = visibleIdx;
          for (let j = visibleIdx + 1; j < visibleNodes.length; j++) {
            if (visibleNodes[j].depth > refDepth) {
              lastDescendantIdx = j;
            } else {
              break;
            }
          }
          insertBarAfterVisibleIndex = lastDescendantIdx;
          found = true;
        }
      }

      if (!found) {
        // index === 0 または 子ノードが非表示（親や先祖が折りたたまれている）場合
        // insertionTarget.parentId から遡って最も近い可視の先祖ノードを探索
        let ancestorId: string | null = insertionTarget.parentId;
        while (ancestorId) {
          const ancestorVisibleIdx = visibleNodes.findIndex((v) => v.id === ancestorId);
          if (ancestorVisibleIdx !== -1) {
            insertBarAfterVisibleIndex = ancestorVisibleIdx;
            insertBarDepth = visibleNodes[ancestorVisibleIdx].depth + 1;
            found = true;
            break;
          }
          ancestorId = findNodeParentId(ancestorId, rootNodeIds, nodes);
        }
      }
    }

    const result: DisplayTreeItem[] = [];

    if (insertBarAfterVisibleIndex === -1) {
      result.push({ id: INSERTION_BAR_ID, isInsertionBar: true, depth: insertBarDepth, isAtEnd: false });
    }

    for (let i = 0; i < visibleNodes.length; i++) {
      const item = visibleNodes[i];
      result.push({ id: item.id, depth: item.depth, node: nodes[item.id] });

      if (insertBarAfterVisibleIndex === i) {
        result.push({ id: INSERTION_BAR_ID, isInsertionBar: true, depth: insertBarDepth, isAtEnd: false });
      }
    }

    // もし親が非表示などで可視ツリー内に挿入バーが配置できなかった場合の安全なフォールバック
    const hasBar = result.some((item) => item.isInsertionBar);
    if (!hasBar) {
      result.push({ id: INSERTION_BAR_ID, isInsertionBar: true, depth: 0, isAtEnd: false });
    }

    return result;
  }, [visibleNodes, insertionTarget, rootNodeIds, nodes]);

  const visibleIds = useMemo(() => displayItems.map((n) => n.id), [displayItems]);
  const selectableIds = useMemo(() => displayItems.filter((n) => !n.isInsertionBar).map((n) => n.id), [displayItems]);

  const { handleItemClick, handleItemContextMenu } = useTreeItemSelection({
    selectedIds: selectedNodeIds,
    selectFn: selectNodes,
    visibleIds: selectableIds,
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
    e.stopPropagation();
    handleItemContextMenu(e, nodeId);
    setContextMenu({ nodeId, x: e.clientX, y: e.clientY });
  };

  const handleCreateGroup = () => {
    const targetIds = selectedNodeIds.length > 0 ? selectedNodeIds : contextMenu?.nodeId ? [contextMenu.nodeId] : [];
    if (targetIds.length === 0) return;

    const newGroupId = groupNodes(targetIds);
    if (newGroupId) {
      setExpandedNodes((prev) => new Set([...prev, newGroupId]));
      setEditingNodeId(newGroupId);
    }
    setContextMenu(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over || active.id === over.id || rootNodeIds.length === 0) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // 挿入バーがドラッグされた場合
    if (activeId === INSERTION_BAR_ID) {
      let relativeX = 0;
      if (event.activatorEvent && 'clientX' in event.activatorEvent && over.rect) {
        const currentPointerX = (event.activatorEvent as MouseEvent).clientX + event.delta.x;
        relativeX = currentPointerX - over.rect.left;
      } else {
        relativeX = event.delta.x;
      }

      const position = computeDragDropPosition(activeId, overId, visibleIds);
      const target = determineMultiDepthDropTarget({
        activeId,
        overId,
        relativeX,
        position,
        rootNodeIds,
        nodes,
        expandedNodes,
      });

      setInsertionTarget(target);
      return;
    }

    // 通常のノードがドラッグされ、挿入バーの上にドロップされた場合
    if (overId === INSERTION_BAR_ID) {
      const movingIds = selectedNodeIds.includes(activeId) && selectedNodeIds.length > 1 ? selectedNodeIds : [activeId];
      if (insertionTarget) {
        const { parentId, index } = insertionTarget;
        const siblings = parentId ? nodes[parentId]?.children_ids || [] : rootNodeIds;
        if (siblings.length === 0 && parentId) {
          moveNodesInTree(movingIds, parentId, 'inside');
        } else {
          const targetNodeId = siblings[index] || siblings[siblings.length - 1];
          if (targetNodeId && !movingIds.includes(targetNodeId)) {
            moveNodesInTree(movingIds, targetNodeId, index < siblings.length ? 'before' : 'after');
          }
        }
      } else {
        // insertionTarget === null (ツリー末尾)
        const lastRootId = rootNodeIds[rootNodeIds.length - 1];
        if (lastRootId && !movingIds.includes(lastRootId)) {
          moveNodesInTree(movingIds, lastRootId, 'after');
        }
      }
      return;
    }

    // 通常のノード同士のドラッグ移動
    const movingIds = selectedNodeIds.includes(activeId) && selectedNodeIds.length > 1 ? selectedNodeIds : [activeId];

    if (movingIds.includes(overId)) return;

    const position = computeDragDropPosition(activeId, overId, visibleIds);
    moveNodesInTree(movingIds, overId, position);
  };

  const totalWaypointsCount = waypointIndexMap.size;
  const activeDragNode = activeDragId ? nodes[activeDragId] : null;

  return (
    <div
      className="w-full flex flex-col space-y-2 relative min-h-[120px]"
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({ nodeId: null, x: e.clientX, y: e.clientY });
      }}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-text-base uppercase tracking-wider">Waypoints</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface-hover text-text-muted font-bold">
            {totalWaypointsCount}
          </span>
        </div>
      </div>

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
                const hasSelectedChild = !isSelected && highlightedContainerIds.has(item.id);
                const isFlashing = flashingId === item.id;
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
                    hasSelectedChild={hasSelectedChild}
                    isFlashing={isFlashing}
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
          {rootNodeIds.length === 0 && (
            <div className="text-sm text-text-muted/60 italic p-4 text-center">
              No items yet. Drag to create points on the map.
            </div>
          )}
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

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)}>
          {contextMenu.nodeId === null ? (
            <>
              <ContextMenuItem
                icon={<ClipboardPaste size={13} className="text-primary-base" />}
                onSelect={() => pasteMapElements({ asGroup: false })}
              >
                貼り付け (Paste)
              </ContextMenuItem>
              <ContextMenuItem
                icon={<FolderPlus size={13} className="text-primary-base" />}
                onSelect={() => pasteMapElements({ asGroup: true })}
              >
                グループで貼り付け
              </ContextMenuItem>
            </>
          ) : (
            (() => {
              const contextNodeId = contextMenu.nodeId;
              if (!contextNodeId) return null;

              const targetNode = nodes[contextNodeId];
              const isContainer =
                targetNode?.type === 'generator' || targetNode?.type === 'manual_group' || targetNode?.type === 'group';
              const isInsertable = isInsertableContainer(targetNode);
              const isMultiSelected = selectedNodeIds.length > 1 && selectedNodeIds.includes(contextNodeId);
              const targetIds = isMultiSelected ? selectedNodeIds : [contextNodeId];

              return (
                <>
                  <ContextMenuItem
                    emphasis="strong"
                    icon={<FolderPlus size={13} className="text-accent-anchor" />}
                    onSelect={handleCreateGroup}
                  >
                    {targetIds.length > 1 ? `選択項目をグループ化 (${targetIds.length})` : 'グループ化 (Group)'}
                  </ContextMenuItem>
                  <ContextMenuItem
                    icon={<Edit2 size={13} className="text-primary-base" />}
                    onSelect={() => setEditingNodeId(contextNodeId)}
                  >
                    名前を変更 (Rename)
                  </ContextMenuItem>
                  {isContainer && (
                    <ContextMenuItem
                      icon={<Unlink size={13} className="text-accent-anchor" />}
                      onSelect={() => ungroupNode(contextNodeId)}
                    >
                      グループ解除 (Ungroup)
                    </ContextMenuItem>
                  )}
                  <ContextMenuItem
                    icon={<ArrowDownToLine size={13} className="text-primary-base" />}
                    onSelect={() => {
                      let targetParentId = findNodeParentId(contextNodeId, rootNodeIds, nodes);
                      let refNodeId = contextNodeId;
                      while (targetParentId && !isInsertableContainer(nodes[targetParentId])) {
                        refNodeId = targetParentId;
                        targetParentId = findNodeParentId(targetParentId, rootNodeIds, nodes);
                      }
                      const siblings = targetParentId ? nodes[targetParentId]?.children_ids || [] : rootNodeIds;
                      const idx = siblings.indexOf(refNodeId);
                      setInsertionTarget({ parentId: targetParentId, index: idx + 1 });
                    }}
                  >
                    この直後に挿入を設定
                  </ContextMenuItem>
                  {isInsertable && (
                    <ContextMenuItem
                      icon={<ArrowDownToLine size={13} className="text-accent-anchor" />}
                      onSelect={() => {
                        setInsertionTarget({ parentId: contextNodeId, index: 0 });
                        setExpandedNodes((prev) => new Set([...prev, contextNodeId]));
                      }}
                    >
                      グループ内の先頭に挿入を設定
                    </ContextMenuItem>
                  )}

                  <ContextMenuSeparator />

                  <ContextMenuItem
                    icon={<Scissors size={13} className="text-accent-automation" />}
                    onSelect={() => cutSelectedMapElements()}
                  >
                    {isMultiSelected ? `選択項目を切り取り (${targetIds.length})` : '切り取り (Cut)'}
                  </ContextMenuItem>
                  <ContextMenuItem
                    icon={<Copy size={13} className="text-accent-automation" />}
                    onSelect={() => copySelectedMapElements()}
                  >
                    {isMultiSelected ? `選択項目をコピー (${targetIds.length})` : 'コピー (Copy)'}
                  </ContextMenuItem>
                  <ContextMenuItem
                    icon={<ClipboardPaste size={13} className="text-primary-base" />}
                    onSelect={() => pasteMapElements({ asGroup: false })}
                  >
                    貼り付け (Paste)
                  </ContextMenuItem>
                  <ContextMenuItem
                    icon={<FolderPlus size={13} className="text-primary-base" />}
                    onSelect={() => pasteMapElements({ asGroup: true })}
                  >
                    グループで貼り付け
                  </ContextMenuItem>
                  <ContextMenuItem
                    icon={<Copy size={13} className="text-accent-automation" />}
                    onSelect={() => duplicateNodes(targetIds)}
                  >
                    {isMultiSelected ? `選択項目を複製 (${targetIds.length})` : '複製 (Duplicate)'}
                  </ContextMenuItem>
                  <ContextMenuItem
                    icon={<Code2 size={13} className="text-accent-automation" />}
                    onSelect={() => {
                      const titleName =
                        targetNode?.name || (targetNode?.type === 'generator' ? 'Generator' : 'Waypoint');
                      openPluginDataModal(
                        `内部プロパティ: ${titleName}`,
                        targetNode?.plugin_data,
                        `ノードID: ${targetNode?.id} • 内部メタデータ (Read-only)`,
                      );
                    }}
                  >
                    内部プロパティを表示
                  </ContextMenuItem>
                  <ContextMenuItem
                    icon={<Layers size={13} className="text-text-muted" />}
                    onSelect={() => {
                      selectNodes([contextNodeId]);
                      setRightPanelActiveTab('inspector');
                      setRightPanelOpen(true);
                    }}
                  >
                    インスペクターを開く
                  </ContextMenuItem>
                  {!isContainer && !isMultiSelected && (
                    <ContextMenuItem
                      icon={<Anchor size={13} className="text-accent-anchor" />}
                      onSelect={() => setAnchorNode(anchorNodeId === contextNodeId ? null : contextNodeId)}
                    >
                      {anchorNodeId === contextNodeId ? 'アンカー設定を解除' : 'アンカーに設定'}
                    </ContextMenuItem>
                  )}

                  <ContextMenuSeparator />

                  <ContextMenuItem tone="danger" icon={<Trash2 size={13} />} onSelect={() => removeNodes(targetIds)}>
                    {isMultiSelected ? `選択項目を削除 (${targetIds.length})` : '削除 (Delete)'}
                  </ContextMenuItem>
                </>
              );
            })()
          )}
        </ContextMenu>
      )}
    </div>
  );
}
