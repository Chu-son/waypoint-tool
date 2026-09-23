import React, { useState, useMemo } from 'react';
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from '../common/ContextMenu';
import { useAppStore } from '../../../stores/appStore';
import {
  Eye,
  EyeOff,
  Trash2,
  Plus,
  GripVertical,
  Tag,
  Copy,
  Folder,
  FolderPlus,
  Unlink,
  Code2,
  Edit2,
  Scissors,
  ClipboardPaste,
} from 'lucide-react';
import { Button } from '../common/Button';
import { cn } from '../../../utils/cn';
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
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
  getVisibleAnnotationNodes,
  computeDragDropPosition,
  getAncestorIds,
  getHighlightedContainerIds,
  getAnnotationParentId,
} from '../../../utils/treeUtils';
import { useTreeItemSelection } from '../../../hooks/useTreeItemSelection';
import { useTreeReveal } from '../../../hooks/useTreeReveal';
import { SortableAnnotationTreeNode } from './AnnotationTreeRow';

export function AnnotationTree() {
  const annotationObjects = useAppStore((state) => state.annotationObjects) || {};
  const annotationGroups = useAppStore((state) => state.annotationGroups) || {};
  const rootAnnotationIds = useAppStore((state) => state.rootAnnotationIds) || [];
  const selectedAnnotationIds = useAppStore((state) => state.selectedAnnotationIds) || [];
  const selectAnnotationObjects = useAppStore((state) => state.selectAnnotationObjects);
  const duplicateAnnotations = useAppStore((state) => state.duplicateAnnotations);
  const renameAnnotation = useAppStore((state) => state.renameAnnotation);
  const groupAnnotations = useAppStore((state) => state.groupAnnotations);
  const ungroupAnnotation = useAppStore((state) => state.ungroupAnnotation);
  const moveAnnotationsInTree = useAppStore((state) => state.moveAnnotationsInTree);
  const removeAnnotationObjects = useAppStore((state) => state.removeAnnotationObjects);
  const toggleAnnotationVisibility = useAppStore((state) => state.toggleAnnotationVisibility);
  const toggleAnnotationGroupVisibility = useAppStore((state) => state.toggleAnnotationGroupVisibility);
  const toggleAnnotationLabelVisibility = useAppStore((state) => state.toggleAnnotationLabelVisibility);
  const setAnnotationEditMode = useAppStore((state) => state.setAnnotationEditMode);
  const isAnnotationEditMode = useAppStore((state) => state.isAnnotationEditMode);
  const showAnnotations = useAppStore((state) => state.showAnnotations);
  const setShowAnnotations = useAppStore((state) => state.setShowAnnotations);
  const showAnnotationLabels = useAppStore((state) => state.showAnnotationLabels);
  const setShowAnnotationLabels = useAppStore((state) => state.setShowAnnotationLabels);
  const setRightPanelActiveTab = useAppStore((state) => state.setRightPanelActiveTab);
  const setRightPanelOpen = useAppStore((state) => state.setRightPanelOpen);
  const openPluginDataModal = useAppStore((state) => state.openPluginDataModal);
  const copySelectedMapElements = useAppStore((state) => state.copySelectedMapElements);
  const cutSelectedMapElements = useAppStore((state) => state.cutSelectedMapElements);
  const pasteMapElements = useAppStore((state) => state.pasteMapElements);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ id: string | null; x: number; y: number } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const handleStartAdd = () => {
    setAnnotationEditMode(true);
  };

  // 画面上に展開されている全ノードを深さ優先順で取得
  const visibleNodes = useMemo(() => {
    return getVisibleAnnotationNodes(rootAnnotationIds, annotationGroups, annotationObjects, expandedGroups);
  }, [rootAnnotationIds, annotationGroups, annotationObjects, expandedGroups]);

  const getAnnotParentId = React.useCallback(
    (id: string) => getAnnotationParentId(id, rootAnnotationIds, annotationGroups, annotationObjects),
    [rootAnnotationIds, annotationGroups, annotationObjects],
  );

  const highlightedContainerIds = useMemo(
    () => getHighlightedContainerIds(selectedAnnotationIds, getAnnotParentId),
    [selectedAnnotationIds, getAnnotParentId],
  );

  const { flashingId } = useTreeReveal({
    treeType: 'annotation',
    getAncestorIds: React.useCallback((id: string) => getAncestorIds(id, getAnnotParentId), [getAnnotParentId]),
    setExpanded: setExpandedGroups,
  });

  const visibleIds = useMemo(() => visibleNodes.map((n) => n.id), [visibleNodes]);

  const { handleItemClick, handleItemContextMenu } = useTreeItemSelection({
    selectedIds: selectedAnnotationIds,
    selectFn: selectAnnotationObjects,
    visibleIds,
    onInspect: () => {
      setRightPanelActiveTab('inspector');
      setRightPanelOpen(true);
    },
  });

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    handleItemContextMenu(e, id);
    setContextMenu({ id, x: e.clientX, y: e.clientY });
  };

  const handleCreateGroup = () => {
    const targetIds =
      selectedAnnotationIds.length > 0 ? selectedAnnotationIds : contextMenu?.id ? [contextMenu.id] : [];
    if (targetIds.length === 0) return;

    const newGroupId = groupAnnotations(targetIds);
    if (newGroupId) {
      setExpandedGroups((prev) => new Set([...prev, newGroupId]));
      setEditingId(newGroupId);
    }
    setContextMenu(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const movingIds =
      selectedAnnotationIds.includes(activeId) && selectedAnnotationIds.length > 1 ? selectedAnnotationIds : [activeId];

    if (movingIds.includes(overId)) return;

    const position = computeDragDropPosition(activeId, overId, visibleIds);
    moveAnnotationsInTree(movingIds, overId, position);
  };

  const activeDragItem = activeDragId ? annotationObjects[activeDragId] || annotationGroups[activeDragId] : null;

  return (
    <div
      className="w-full flex flex-col space-y-2 relative min-h-[120px]"
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({ id: null, x: e.clientX, y: e.clientY });
      }}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-text-base uppercase tracking-wider">Annotations</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface-hover text-text-muted font-bold">
            {Object.keys(annotationObjects).length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Toggle All Labels */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAnnotationLabels(!showAnnotationLabels)}
            className={cn(
              'h-6 px-1.5 text-[11px] gap-1',
              showAnnotationLabels ? 'text-primary-base' : 'text-text-muted',
            )}
            title={showAnnotationLabels ? '全ラベル非表示' : '全ラベル表示'}
          >
            <Tag size={12} />
          </Button>

          {/* Toggle All Annotations */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAnnotations(!showAnnotations)}
            className={cn('h-6 px-1.5 text-[11px] gap-1', showAnnotations ? 'text-text-base' : 'text-text-muted')}
            title={showAnnotations ? '全アノテーション非表示' : '全アノテーション表示'}
          >
            {showAnnotations ? <Eye size={12} /> : <EyeOff size={12} />}
          </Button>

          {/* Add Annotation Button */}
          <Button
            variant={isAnnotationEditMode ? 'primary' : 'secondary'}
            size="sm"
            onClick={handleStartAdd}
            className="h-6 px-2 text-[11px] font-bold gap-1 shadow-xs"
            title="アノテーション配置モードを開始"
          >
            <Plus size={12} />
            <span>Add</span>
          </Button>
        </div>
      </div>

      {/* List */}
      {rootAnnotationIds.length === 0 ? (
        <div className="text-center py-4 text-xs text-text-muted/60 italic bg-surface-panel/20 rounded-xl border border-border-base/20">
          アノテーションがありません。「+ Add」ボタンから配置できます。
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
                  const group = annotationGroups[id];
                  const obj = annotationObjects[id];
                  if (!group && !obj) return null;

                  const isGroup = !!group;
                  const isSelected = selectedAnnotationIds.includes(id);
                  const hasSelectedChild = !isSelected && highlightedContainerIds.has(id);
                  const isFlashing = flashingId === id;
                  const isExpanded = expandedGroups.has(id);
                  const isEditing = editingId === id;

                  return (
                    <SortableAnnotationTreeNode
                      key={id}
                      id={id}
                      depth={depth}
                      isGroup={isGroup}
                      group={group}
                      obj={obj}
                      isSelected={isSelected}
                      hasSelectedChild={hasSelectedChild}
                      isFlashing={isFlashing}
                      isExpanded={isExpanded}
                      isEditing={isEditing}
                      onToggleExpand={() => toggleGroupExpand(id)}
                      onClick={(e) => handleItemClick(id, e)}
                      onContextMenu={(e) => handleContextMenu(e, id)}
                      onRename={(newName) => {
                        renameAnnotation(id, newName);
                        setEditingId(null);
                      }}
                      onCancelRename={() => setEditingId(null)}
                      onToggleVisible={() => {
                        if (isGroup) toggleAnnotationGroupVisibility(id);
                        else toggleAnnotationVisibility(id);
                      }}
                      onToggleLabel={() => {
                        if (!isGroup) toggleAnnotationLabelVisibility(id);
                      }}
                      onDelete={() => removeAnnotationObjects([id])}
                    />
                  );
                })}
              </ul>
            </SortableContext>
          </div>

          <DragOverlay>
            {activeDragItem && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-panel/90 border border-primary-base shadow-xl text-xs text-text-base">
                <GripVertical size={13} className="text-primary-base" />
                <span className="font-semibold">{activeDragItem.name || 'Annotation'}</span>
                {selectedAnnotationIds.length > 1 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-primary-base text-surface-base font-bold text-[10px]">
                    +{selectedAnnotationIds.length}
                  </span>
                )}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)}>
          {contextMenu.id === null ? (
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
              const contextId = contextMenu.id;
              if (!contextId) return null;

              const isGroup = !!annotationGroups[contextId];
              const groupObj = isGroup ? annotationGroups[contextId] : undefined;
              const itemObj = !isGroup ? annotationObjects[contextId] : undefined;
              const isMultiSelected = selectedAnnotationIds.length > 1 && selectedAnnotationIds.includes(contextId);
              const targetIds = isMultiSelected ? selectedAnnotationIds : [contextId];

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
                    onSelect={() => setEditingId(contextId)}
                  >
                    名前を変更 (Rename)
                  </ContextMenuItem>
                  {isGroup && (
                    <ContextMenuItem
                      icon={<Unlink size={13} className="text-accent-anchor" />}
                      onSelect={() => ungroupAnnotation(contextId)}
                    >
                      グループ解除 (Ungroup)
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
                    onSelect={() => duplicateAnnotations(targetIds)}
                  >
                    {isMultiSelected ? `選択項目を複製 (${targetIds.length})` : '複製 (Duplicate)'}
                  </ContextMenuItem>
                  <ContextMenuItem
                    icon={<Code2 size={13} className="text-accent-automation" />}
                    onSelect={() => {
                      if (isGroup) {
                        openPluginDataModal(
                          `グループ: ${groupObj?.name || 'Group'}`,
                          groupObj?.plugin_data,
                          `プラグイン: ${groupObj?.plugin_id || 'Manual'} • 内部メタデータ (Read-only)`,
                        );
                      } else {
                        openPluginDataModal(
                          `アノテーション: ${itemObj?.name || 'Annotation'}`,
                          itemObj?.plugin_data,
                          `タイプ: ${itemObj?.type} • 内部メタデータ (Read-only)`,
                        );
                      }
                    }}
                  >
                    内部プロパティを表示
                  </ContextMenuItem>
                  <ContextMenuItem
                    icon={<Folder size={13} className="text-text-muted" />}
                    onSelect={() => {
                      selectAnnotationObjects([contextId]);
                      setRightPanelActiveTab('inspector');
                      setRightPanelOpen(true);
                    }}
                  >
                    インスペクターを開く
                  </ContextMenuItem>

                  <ContextMenuSeparator />

                  <ContextMenuItem
                    tone="danger"
                    icon={<Trash2 size={13} />}
                    onSelect={() => removeAnnotationObjects(targetIds)}
                  >
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
