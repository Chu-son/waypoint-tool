import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAppStore } from '../../stores/appStore';
import {
  Eye,
  EyeOff,
  Trash2,
  Plus,
  GripVertical,
  CircleDot,
  Navigation,
  Minus,
  Square,
  Circle,
  Tag,
  Copy,
  ChevronRight,
  Folder,
  FolderPlus,
  Wand2,
  Unlink,
  Code2,
  Edit2,
} from 'lucide-react';
import { Button } from './common/Button';
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
import { AnnotationObject, AnnotationGroup, AnnotationType } from '../../types/store';
import { getVisibleAnnotationNodes, computeDragDropPosition } from '../../utils/treeUtils';
import { useTreeItemSelection } from '../../hooks/useTreeItemSelection';

function getAnnotationIcon(type: AnnotationType) {
  switch (type) {
    case 'point':
      return <CircleDot size={13} className="text-blue-400" />;
    case 'oriented_point':
      return <Navigation size={13} className="text-emerald-400" />;
    case 'line':
      return <Minus size={13} className="text-amber-400" />;
    case 'rect':
      return <Square size={13} className="text-purple-400" />;
    case 'circle':
      return <Circle size={13} className="text-pink-400" />;
    default:
      return <CircleDot size={13} />;
  }
}

function getTypeLabel(type: AnnotationType) {
  switch (type) {
    case 'point':
      return 'Point';
    case 'oriented_point':
      return 'Oriented';
    case 'line':
      return 'Line';
    case 'rect':
      return 'Rect';
    case 'circle':
      return 'Circle';
    default:
      return type;
  }
}

interface TreeNodeItemProps {
  id: string;
  depth: number;
  isGroup: boolean;
  group?: AnnotationGroup;
  obj?: AnnotationObject;
  isSelected: boolean;
  isExpanded?: boolean;
  isEditing?: boolean;
  onToggleExpand?: () => void;
  onClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onRename: (newName: string) => void;
  onCancelRename: () => void;
  onToggleVisible: () => void;
  onToggleLabel?: () => void;
  onDelete: () => void;
}

function SortableAnnotationTreeNode({
  id,
  depth,
  isGroup,
  group,
  obj,
  isSelected,
  isExpanded,
  isEditing,
  onToggleExpand,
  onClick,
  onContextMenu,
  onRename,
  onCancelRename,
  onToggleVisible,
  onToggleLabel,
  onDelete,
}: TreeNodeItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [nameValue, setNameValue] = useState(group?.name || obj?.name || '');

  useEffect(() => {
    setNameValue(group?.name || obj?.name || '');
  }, [group?.name, obj?.name, isEditing]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 50 : 'auto',
    position: 'relative' as const,
  };

  const handleNameSubmit = () => {
    const currentName = group?.name || obj?.name || '';
    if (nameValue.trim() && nameValue !== currentName) {
      onRename(nameValue.trim());
    } else {
      onCancelRename();
    }
  };

  const isVisible = isGroup ? group?.visible ?? true : obj?.visible ?? true;
  const isGenerator = isGroup && group?.type === 'generator';
  const childCount = group?.children_ids?.length || 0;

  return (
    <li ref={setNodeRef} style={style} className="space-y-1 select-none">
      <div
        onClick={onClick}
        onContextMenu={onContextMenu}
        style={{ paddingLeft: `${Math.min(depth * 10 + 6, 32)}px` }}
        className={cn(
          'group relative flex items-center justify-between gap-1 py-1.5 pr-1.5 rounded-lg text-xs transition-all cursor-pointer border overflow-hidden',
          isSelected
            ? 'bg-primary-base/20 border-primary-base text-text-base shadow-sm ring-1 ring-primary-base/30 font-bold'
            : 'bg-surface-panel/60 hover:bg-surface-hover border-border-base/40 text-text-muted hover:text-text-base',
          !isVisible && 'opacity-60 grayscale-[0.3]'
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
          {/* Grip Icon */}
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-text-muted/40 hover:text-text-muted shrink-0 touch-none"
          >
            <GripVertical size={13} />
          </div>

          {/* Expand/Collapse Chevron for Groups */}
          {isGroup ? (
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

          {/* Group / Annotation Icon */}
          <div className="shrink-0 flex items-center gap-1">
            {isGroup ? (
              isGenerator ? <Wand2 size={13} className="text-primary-base" /> : <Folder size={13} className="text-amber-400" />
            ) : obj ? (
              <>
                <span
                  className="w-2 h-2 rounded-full border border-slate-600 shadow-xs shrink-0"
                  style={{ backgroundColor: obj.color || '#3B82F6' }}
                  title={`Color: ${obj.color || '#3B82F6'}`}
                />
                {getAnnotationIcon(obj.type)}
              </>
            ) : null}
          </div>

          {/* Name / Inline Editing */}
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
                  setNameValue(group?.name || obj?.name || '');
                  onCancelRename();
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 min-w-0 bg-surface-base border border-primary-base rounded px-1.5 py-0.5 text-xs text-text-base focus:outline-none"
            />
          ) : (
            <span
              className="truncate font-medium flex-1 min-w-0 text-text-base"
              title={group?.name || obj?.name || ''}
            >
              {group?.name || obj?.name || ''}
            </span>
          )}

          {/* Badge */}
          {isGroup ? (
            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-surface-hover text-text-muted border border-border-base/30 shrink-0 font-mono font-bold">
              {childCount}
            </span>
          ) : obj ? (
            <span className="text-[9px] px-1 py-0.2 rounded bg-surface-hover/80 text-text-muted border border-border-base/30 shrink-0 font-mono hidden xs:inline-block sm:inline-block">
              {getTypeLabel(obj.type)}
            </span>
          ) : null}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-0.5 shrink-0 ml-1 opacity-80 group-hover:opacity-100">
          {!isGroup && obj && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onToggleLabel?.();
              }}
              className={cn(
                'w-5 h-5 p-0 hover:bg-surface-hover',
                obj.labelVisible ? 'text-primary-base' : 'text-text-muted/40 hover:text-text-muted'
              )}
              title={obj.labelVisible ? 'ラベル: 表示中' : 'ラベル: 非表示中'}
            >
              <Tag size={11} />
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisible();
            }}
            className={cn(
              'w-5 h-5 p-0 hover:bg-surface-hover',
              isVisible ? 'text-text-base' : 'text-text-muted/40 hover:text-text-muted'
            )}
            title={isVisible ? '表示中' : '非表示中'}
          >
            {isVisible ? <Eye size={11} /> : <EyeOff size={11} />}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="w-5 h-5 p-0 hover:bg-danger-base/10 hover:text-danger-base text-text-muted/40 transition-colors"
            title="削除"
          >
            <Trash2 size={11} />
          </Button>
        </div>
      </div>
    </li>
  );
}

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

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
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
    handleItemContextMenu(e, id);
    setContextMenu({ id, x: e.clientX, y: e.clientY });
  };

  const handleCreateGroup = () => {
    const targetIds = selectedAnnotationIds.length > 0
      ? selectedAnnotationIds
      : contextMenu ? [contextMenu.id] : [];
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

    const movingIds = selectedAnnotationIds.includes(activeId) && selectedAnnotationIds.length > 1
      ? selectedAnnotationIds
      : [activeId];

    if (movingIds.includes(overId)) return;

    const position = computeDragDropPosition(activeId, overId, visibleIds);
    moveAnnotationsInTree(movingIds, overId, position);
  };

  const activeDragItem = activeDragId
    ? annotationObjects[activeDragId] || annotationGroups[activeDragId]
    : null;

  return (
    <div className="w-full flex flex-col space-y-2">
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
            className={cn('h-6 px-1.5 text-[11px] gap-1', showAnnotationLabels ? 'text-primary-base' : 'text-text-muted')}
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
        <div
          ref={menuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 bg-surface-panel border border-border-base/60 rounded-xl shadow-xl p-1 min-w-[190px] text-xs text-text-base flex flex-col gap-0.5 backdrop-blur-md"
        >
          {(() => {
            const isGroup = !!annotationGroups[contextMenu.id];
            const groupObj = isGroup ? annotationGroups[contextMenu.id] : undefined;
            const itemObj = !isGroup ? annotationObjects[contextMenu.id] : undefined;
            const isMultiSelected = selectedAnnotationIds.length > 1 && selectedAnnotationIds.includes(contextMenu.id);
            const targetIds = isMultiSelected ? selectedAnnotationIds : [contextMenu.id];

            return (
              <>
                {/* グループ化 (Group) */}
                <button
                  onClick={handleCreateGroup}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-hover text-left w-full transition-colors text-text-base font-medium"
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
                    setEditingId(contextMenu.id);
                    setContextMenu(null);
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-hover text-left w-full transition-colors text-text-base"
                >
                  <Edit2 size={13} className="text-blue-400" />
                  <span>名前を変更 (Rename)</span>
                </button>

                {/* グループ解除 (Ungroup) */}
                {isGroup && (
                  <button
                    onClick={() => {
                      ungroupAnnotation(contextMenu.id);
                      setContextMenu(null);
                    }}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-hover text-left w-full transition-colors text-text-base"
                  >
                    <Unlink size={13} className="text-amber-400" />
                    <span>グループ解除 (Ungroup)</span>
                  </button>
                )}

                <div className="h-px bg-border-base/30 my-0.5" />

                {/* 複製 (Duplicate) */}
                <button
                  onClick={() => {
                    duplicateAnnotations(targetIds);
                    setContextMenu(null);
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-hover text-left w-full transition-colors text-text-base"
                >
                  <Copy size={13} className="text-cyan-400" />
                  <span>{isMultiSelected ? `選択項目を複製 (${targetIds.length})` : '複製 (Duplicate)'}</span>
                </button>

                {/* 内部プロパティ表示 (モーダル) */}
                <button
                  onClick={() => {
                    if (isGroup) {
                      openPluginDataModal(
                        `アノテーショングループ: ${groupObj?.name || 'Group'}`,
                        groupObj?.plugin_data,
                        `プラグイン: ${groupObj?.plugin_id || 'Manual'} • 内部メタデータ (Read-only)`
                      );
                    } else {
                      openPluginDataModal(
                        `アノテーション: ${itemObj?.name || 'Annotation'}`,
                        itemObj?.plugin_data,
                        `タイプ: ${itemObj?.type} • 内部メタデータ (Read-only)`
                      );
                    }
                    setContextMenu(null);
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-hover text-left w-full transition-colors text-text-base"
                >
                  <Code2 size={13} className="text-cyan-400" />
                  <span>内部プロパティを表示</span>
                </button>

                {/* インスペクターを開く */}
                <button
                  onClick={() => {
                    selectAnnotationObjects([contextMenu.id]);
                    setRightPanelActiveTab('inspector');
                    setRightPanelOpen(true);
                    setContextMenu(null);
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-hover text-left w-full transition-colors text-text-base"
                >
                  <Folder size={13} className="text-text-muted" />
                  <span>インスペクターを開く</span>
                </button>

                <div className="h-px bg-border-base/30 my-0.5" />

                {/* 削除 */}
                <button
                  onClick={() => {
                    removeAnnotationObjects(targetIds);
                    setContextMenu(null);
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-danger-base/10 text-danger-base text-left w-full transition-colors"
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
