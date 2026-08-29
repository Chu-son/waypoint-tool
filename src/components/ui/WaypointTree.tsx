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
import { getFlattenedWaypointIds, getFlattenedNodeIds, getVisibleTreeNodes } from '../../utils/treeUtils';

interface TreeItemRowProps {
  id: string;
  node: WaypointNode;
  depth: number;
  isSelected: boolean;
  isAnchor?: boolean;
  isExpanded?: boolean;
  isEditing?: boolean;
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
        style={{ paddingLeft: `${Math.max(8, depth * 16 + 8)}px` }}
        className={cn(
          'group relative flex items-center justify-between gap-1.5 py-1.5 pr-2 rounded-lg text-xs transition-all cursor-pointer border',
          isSelected
            ? isGenerator
              ? 'bg-emerald-500/20 border-emerald-500 text-text-base shadow-sm ring-1 ring-emerald-500/30'
              : 'bg-primary-base/20 border-primary-base text-text-base shadow-sm ring-1 ring-primary-base/30'
            : 'bg-surface-panel/60 hover:bg-surface-hover border-border-base/40 text-text-muted hover:text-text-base',
          isAnchor && 'border-amber-400/60 bg-amber-950/20'
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
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
            <span className="w-4 shrink-0" />
          )}

          {/* Node Icon */}
          <div className="shrink-0 flex items-center">
            {isGenerator ? (
              <Layers size={13} className="text-emerald-400" />
            ) : isGroup ? (
              <Folder size={13} className="text-amber-400" />
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
                <span className="text-amber-400 text-xs font-bold shrink-0" title="Anchor Point">
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

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [lastSelectedNodeId, setLastSelectedNodeId] = useState<string | null>(null);
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

  // 全ノードの深さ優先フラット順
  const allFlatNodeIds = useMemo(() => {
    return getFlattenedNodeIds(rootNodeIds, nodes);
  }, [rootNodeIds, nodes]);

  // マニュアルウェイポイントのインデックスマップ
  const waypointIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    const flatWpIds = getFlattenedWaypointIds(rootNodeIds, nodes);
    flatWpIds.forEach((id, idx) => map.set(id, idx));
    return map;
  }, [rootNodeIds, nodes]);

  const handleNodeClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (elementCopyState) {
      selectNodes([id]);
      setElementCopyState({ ...elementCopyState, previewNodeId: id });
      setLastSelectedNodeId(id);
      return;
    }

    if (e.shiftKey && lastSelectedNodeId && allFlatNodeIds.includes(lastSelectedNodeId)) {
      const fromIdx = allFlatNodeIds.indexOf(lastSelectedNodeId);
      const toIdx = allFlatNodeIds.indexOf(id);
      if (fromIdx !== -1 && toIdx !== -1) {
        const start = Math.min(fromIdx, toIdx);
        const end = Math.max(fromIdx, toIdx);
        const rangeIds = allFlatNodeIds.slice(start, end + 1);
        if (e.ctrlKey || e.metaKey) {
          const merged = Array.from(new Set([...selectedNodeIds, ...rangeIds]));
          selectNodes(merged, false);
        } else {
          selectNodes(rangeIds, false);
        }
        return;
      }
    }

    setLastSelectedNodeId(id);
    selectNodes([id], e.shiftKey || e.ctrlKey || e.metaKey);
  };

  const handleContextMenu = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedNodeIds.includes(nodeId)) {
      selectNodes([nodeId]);
      setLastSelectedNodeId(nodeId);
    }
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

  // 画面上に展開されている全ノードを深さ優先順で取得
  const visibleNodes = useMemo(() => {
    return getVisibleTreeNodes(rootNodeIds, nodes, expandedNodes);
  }, [rootNodeIds, nodes, expandedNodes]);

  const visibleIds = useMemo(() => visibleNodes.map((n) => n.id), [visibleNodes]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const movingIds = selectedNodeIds.includes(activeId) && selectedNodeIds.length > 1
      ? selectedNodeIds
      : [activeId];

    if (movingIds.includes(overId)) return;

    const activeIdx = visibleIds.indexOf(activeId);
    const overIdx = visibleIds.indexOf(overId);
    const position: 'before' | 'after' = activeIdx < overIdx ? 'after' : 'before';

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
        <div className="text-sm text-slate-500 italic p-4 text-center">
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
                {visibleNodes.map(({ id, depth }) => {
                  const node = nodes[id];
                  if (!node) return null;

                  const isSelected = selectedNodeIds.includes(id);
                  const isAnchor = anchorNodeId === id;
                  const isExpanded = expandedNodes.has(id);
                  const isEditing = editingNodeId === id;
                  const globalIdx = waypointIndexMap.get(id);

                  return (
                    <SortableTreeNodeItem
                      key={id}
                      id={id}
                      node={node}
                      depth={depth}
                      isSelected={isSelected}
                      isAnchor={isAnchor}
                      isExpanded={isExpanded}
                      isEditing={isEditing}
                      globalIndex={globalIdx}
                      indexStartIndex={indexStartIndex}
                      onToggleExpand={() => toggleExpand(id)}
                      onClick={(e) => handleNodeClick(id, e)}
                      onContextMenu={(e) => handleContextMenu(e, id)}
                      onRename={(newName) => {
                        renameNode(id, newName);
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
            {activeDragNode && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-panel/90 border border-primary-base shadow-xl text-xs text-text-base">
                <GripVertical size={13} className="text-primary-base" />
                <span className="font-semibold">{activeDragNode.name || 'Waypoint'}</span>
                {selectedNodeIds.length > 1 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-primary-base text-surface-base font-bold text-[10px]">
                    +{selectedNodeIds.length}
                  </span>
                )}
              </div>
            )}
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
                  <FolderPlus size={13} className="text-amber-400" />
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
                  <Edit2 size={13} className="text-blue-400" />
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
                    <Unlink size={13} className="text-amber-400" />
                    <span>グループ解除 (Ungroup)</span>
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
                  <Copy size={13} className="text-cyan-400" />
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
                  <Code2 size={13} className="text-cyan-400" />
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
                    <Anchor size={13} className="text-amber-400" />
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
