import React, { useState, useRef, useEffect } from 'react';
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
  Wand2,
  Unlink,
  Code2,
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
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AnnotationObject, AnnotationGroup, AnnotationType } from '../../types/store';
import { v4 as uuidv4 } from 'uuid';

function getAnnotationIcon(type: AnnotationType) {
  switch (type) {
    case 'point':
      return <CircleDot size={14} className="text-blue-400" />;
    case 'oriented_point':
      return <Navigation size={14} className="text-emerald-400" />;
    case 'line':
      return <Minus size={14} className="text-amber-400" />;
    case 'rect':
      return <Square size={14} className="text-purple-400" />;
    case 'circle':
      return <Circle size={14} className="text-pink-400" />;
    default:
      return <CircleDot size={14} />;
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

interface SortableAnnotationCardProps {
  id: string;
  obj: AnnotationObject;
  isSelected: boolean;
  isNested?: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onToggleVisible: () => void;
  onToggleLabel: () => void;
  onDelete: () => void;
  onRename: (newName: string) => void;
}

function SortableAnnotationCard({
  id,
  obj,
  isSelected,
  isNested = false,
  onSelect,
  onContextMenu,
  onToggleVisible,
  onToggleLabel,
  onDelete,
  onRename,
}: SortableAnnotationCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(obj.name);

  useEffect(() => {
    setNameValue(obj.name);
  }, [obj.name]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
    position: 'relative' as const,
  };

  const handleNameSubmit = () => {
    if (nameValue.trim() && nameValue !== obj.name) {
      onRename(nameValue.trim());
    } else {
      setNameValue(obj.name);
    }
    setIsEditingName(false);
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      className={cn(
        'group relative flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs select-none transition-all cursor-pointer border',
        isSelected
          ? 'bg-primary-base/15 border-primary-base/60 text-text-base shadow-sm ring-1 ring-primary-base/30'
          : 'bg-surface-panel/40 hover:bg-surface-hover border-border-base/40 text-text-muted hover:text-text-base',
        !obj.visible && 'opacity-60 grayscale-[0.3]',
        isNested && 'ml-4'
      )}
    >
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-text-muted/40 hover:text-text-muted shrink-0 touch-none"
        >
          <GripVertical size={12} />
        </div>

        {/* Color Dot & Type Icon */}
        <div className="flex items-center gap-1 shrink-0">
          <span
            className="w-2 h-2 rounded-full border border-slate-600 shadow-xs shrink-0"
            style={{ backgroundColor: obj.color || '#3B82F6' }}
            title={`Color: ${obj.color || '#3B82F6'}`}
          />
          {getAnnotationIcon(obj.type)}
        </div>

        {/* Name / Editable Name */}
        {isEditingName ? (
          <input
            type="text"
            value={nameValue}
            autoFocus
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameSubmit();
              if (e.key === 'Escape') {
                setNameValue(obj.name);
                setIsEditingName(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-surface-base border border-primary-base/80 rounded px-1.5 py-0.5 text-xs text-text-base focus:outline-none"
          />
        ) : (
          <span
            onDoubleClick={(e) => {
              e.stopPropagation();
              setIsEditingName(true);
            }}
            className="truncate font-medium flex-1 text-text-base"
            title={`${obj.name} (ダブルクリックで名前変更)`}
          >
            {obj.name}
          </span>
        )}

        {/* Type Badge */}
        <span className="text-[9px] px-1 py-0.2 rounded bg-surface-hover/80 text-text-muted border border-border-base/30 shrink-0 font-mono">
          {getTypeLabel(obj.type)}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-0.5 shrink-0 opacity-80 group-hover:opacity-100">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onToggleLabel();
          }}
          className={cn(
            'w-5 h-5 p-0 hover:bg-surface-hover',
            obj.labelVisible ? 'text-primary-base' : 'text-text-muted/40 hover:text-text-muted'
          )}
          title={obj.labelVisible ? 'ラベル: 表示中' : 'ラベル: 非表示中'}
        >
          <Tag size={11} />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisible();
          }}
          className={cn(
            'w-5 h-5 p-0 hover:bg-surface-hover',
            obj.visible ? 'text-text-base' : 'text-text-muted/40 hover:text-text-muted'
          )}
          title={obj.visible ? '表示中' : '非表示中'}
        >
          {obj.visible ? <Eye size={11} /> : <EyeOff size={11} />}
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
    </li>
  );
}

interface SortableGroupCardProps {
  id: string;
  group: AnnotationGroup;
  childrenObjects: AnnotationObject[];
  isExpanded: boolean;
  isSelected: boolean;
  selectedIds: string[];
  onToggleExpand: () => void;
  onSelectGroup: (e: React.MouseEvent) => void;
  onContextMenuGroup: (e: React.MouseEvent) => void;
  onToggleGroupVisible: () => void;
  onDeleteGroup: () => void;
  onRenameGroup: (newName: string) => void;
  onSelectChild: (childId: string, e: React.MouseEvent) => void;
  onContextMenuChild: (childId: string, e: React.MouseEvent) => void;
  onToggleChildVisible: (childId: string) => void;
  onToggleChildLabel: (childId: string) => void;
  onDeleteChild: (childId: string) => void;
  onRenameChild: (childId: string, newName: string) => void;
}

function SortableGroupCard({
  id,
  group,
  childrenObjects,
  isExpanded,
  isSelected,
  selectedIds,
  onToggleExpand,
  onSelectGroup,
  onContextMenuGroup,
  onToggleGroupVisible,
  onDeleteGroup,
  onRenameGroup,
  onSelectChild,
  onContextMenuChild,
  onToggleChildVisible,
  onToggleChildLabel,
  onDeleteChild,
  onRenameChild,
}: SortableGroupCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(group.name);

  useEffect(() => {
    setNameValue(group.name);
  }, [group.name]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
    position: 'relative' as const,
  };

  const handleNameSubmit = () => {
    if (nameValue.trim() && nameValue !== group.name) {
      onRenameGroup(nameValue.trim());
    } else {
      setNameValue(group.name);
    }
    setIsEditingName(false);
  };

  const isGenerator = group.type === 'generator';

  return (
    <li ref={setNodeRef} style={style} className="space-y-1">
      <div
        onClick={onSelectGroup}
        onContextMenu={onContextMenuGroup}
        className={cn(
          'group relative flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs select-none transition-all cursor-pointer border',
          isSelected
            ? 'bg-primary-base/20 border-primary-base/80 text-text-base shadow-sm ring-1 ring-primary-base/40 font-bold'
            : 'bg-surface-panel/60 hover:bg-surface-hover border-border-base/50 text-text-muted hover:text-text-base',
          !group.visible && 'opacity-60 grayscale-[0.3]'
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-text-muted/40 hover:text-text-muted shrink-0 touch-none"
          >
            <GripVertical size={12} />
          </div>

          {/* Expand/Collapse Chevron */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="p-0.5 hover:bg-surface-hover rounded text-text-muted hover:text-text-base transition-transform"
          >
            <ChevronRight
              size={13}
              className={cn('transition-transform duration-150', isExpanded ? 'rotate-90' : '')}
            />
          </button>

          {/* Group Icon */}
          <div className="shrink-0 text-primary-base">
            {isGenerator ? <Wand2 size={13} /> : <Folder size={13} />}
          </div>

          {/* Group Name */}
          {isEditingName ? (
            <input
              type="text"
              value={nameValue}
              autoFocus
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameSubmit();
                if (e.key === 'Escape') {
                  setNameValue(group.name);
                  setIsEditingName(false);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 bg-surface-base border border-primary-base/80 rounded px-1.5 py-0.5 text-xs text-text-base focus:outline-none"
            />
          ) : (
            <span
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditingName(true);
              }}
              className="truncate font-semibold flex-1 text-text-base"
              title={`${group.name} (ダブルクリックで名前変更)`}
            >
              {group.name}
            </span>
          )}

          {/* Count Badge */}
          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-surface-hover text-text-muted border border-border-base/30 shrink-0 font-mono font-bold">
            {childrenObjects.length}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0 opacity-80 group-hover:opacity-100">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onToggleGroupVisible();
            }}
            className={cn(
              'w-5 h-5 p-0 hover:bg-surface-hover',
              group.visible ? 'text-text-base' : 'text-text-muted/40 hover:text-text-muted'
            )}
            title={group.visible ? 'グループ表示中' : 'グループ非表示中'}
          >
            {group.visible ? <Eye size={11} /> : <EyeOff size={11} />}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteGroup();
            }}
            className="w-5 h-5 p-0 hover:bg-danger-base/10 hover:text-danger-base text-text-muted/40 transition-colors"
            title="グループ削除"
          >
            <Trash2 size={11} />
          </Button>
        </div>
      </div>

      {/* Children list */}
      {isExpanded && (
        <SortableContext items={group.children_ids || []} strategy={verticalListSortingStrategy}>
          <ul className="space-y-1">
            {childrenObjects.map((child) => (
              <SortableAnnotationCard
                key={child.id}
                id={child.id}
                obj={child}
                isNested
                isSelected={selectedIds.includes(child.id)}
                onSelect={(e) => onSelectChild(child.id, e)}
                onContextMenu={(e) => onContextMenuChild(child.id, e)}
                onToggleVisible={() => onToggleChildVisible(child.id)}
                onToggleLabel={() => onToggleChildLabel(child.id)}
                onDelete={() => onDeleteChild(child.id)}
                onRename={(newName) => onRenameChild(child.id, newName)}
              />
            ))}
          </ul>
        </SortableContext>
      )}
    </li>
  );
}

export function AnnotationTree() {
  const annotationObjects = useAppStore((state) => state.annotationObjects) || {};
  const annotationGroups = useAppStore((state) => state.annotationGroups) || {};
  const rootAnnotationIds = useAppStore((state) => state.rootAnnotationIds) || [];
  const selectedAnnotationIds = useAppStore((state) => state.selectedAnnotationIds) || [];
  const selectAnnotationObjects = useAppStore((state) => state.selectAnnotationObjects);
  const reorderRootAnnotations = useAppStore((state) => state.reorderRootAnnotations);
  const reorderGroupChildren = useAppStore((state) => state.reorderGroupChildren);
  const updateAnnotationObject = useAppStore((state) => state.updateAnnotationObject);
  const updateAnnotationGroup = useAppStore((state) => state.updateAnnotationGroup);
  const removeAnnotationObjects = useAppStore((state) => state.removeAnnotationObjects);
  const explodeAnnotationGroup = useAppStore((state) => state.explodeAnnotationGroup);
  const toggleAnnotationVisibility = useAppStore((state) => state.toggleAnnotationVisibility);
  const toggleAnnotationGroupVisibility = useAppStore((state) => state.toggleAnnotationGroupVisibility);
  const toggleAnnotationLabelVisibility = useAppStore((state) => state.toggleAnnotationLabelVisibility);
  const setAnnotationEditMode = useAppStore((state) => state.setAnnotationEditMode);
  const isAnnotationEditMode = useAppStore((state) => state.isAnnotationEditMode);
  const showAnnotations = useAppStore((state) => state.showAnnotations);
  const setShowAnnotations = useAppStore((state) => state.setShowAnnotations);
  const showAnnotationLabels = useAppStore((state) => state.showAnnotationLabels);
  const setShowAnnotationLabels = useAppStore((state) => state.setShowAnnotationLabels);
  const addAnnotationObject = useAppStore((state) => state.addAnnotationObject);
  const setRightPanelActiveTab = useAppStore((state) => state.setRightPanelActiveTab);
  const setRightPanelOpen = useAppStore((state) => state.setRightPanelOpen);
  const openPluginDataModal = useAppStore((state) => state.openPluginDataModal);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ id: string; isGroup: boolean; x: number; y: number } | null>(null);
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
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dragging at root level
    const oldRootIdx = rootAnnotationIds.indexOf(activeId);
    const newRootIdx = rootAnnotationIds.indexOf(overId);
    if (oldRootIdx !== -1 && newRootIdx !== -1) {
      reorderRootAnnotations(oldRootIdx, newRootIdx);
      return;
    }

    // Check if dragging inside the same group
    for (const [gid, grp] of Object.entries(annotationGroups)) {
      const children = grp.children_ids || [];
      const oldIdx = children.indexOf(activeId);
      const newIdx = children.indexOf(overId);
      if (oldIdx !== -1 && newIdx !== -1) {
        reorderGroupChildren(gid, oldIdx, newIdx);
        return;
      }
    }
  };

  const handleStartAdd = () => {
    setAnnotationEditMode(true);
  };

  const handleDuplicate = (id: string) => {
    const obj = annotationObjects[id];
    if (!obj) return;
    const duplicated: AnnotationObject = {
      ...structuredClone(obj),
      id: uuidv4(),
      name: `${obj.name} (Copy)`,
    };
    if (duplicated.type === 'point' || duplicated.type === 'oriented_point') {
      duplicated.x += 0.5;
      duplicated.y += 0.5;
    } else if (duplicated.type === 'line') {
      duplicated.x1 += 0.5;
      duplicated.y1 += 0.5;
      duplicated.x2 += 0.5;
      duplicated.y2 += 0.5;
    } else if (duplicated.type === 'rect' || duplicated.type === 'circle') {
      duplicated.cx += 0.5;
      duplicated.cy += 0.5;
    }
    addAnnotationObject(duplicated, obj.group_id);
    selectAnnotationObjects([duplicated.id]);
    setContextMenu(null);
  };

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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={rootAnnotationIds} strategy={verticalListSortingStrategy}>
            <ul className="space-y-1.5">
              {rootAnnotationIds.map((id) => {
                const group = annotationGroups[id];
                if (group) {
                  const children = (group.children_ids || [])
                    .map((cid) => annotationObjects[cid])
                    .filter(Boolean);
                  const isExpanded = expandedGroups.has(id);
                  const isSelected = selectedAnnotationIds.includes(id);

                  return (
                    <SortableGroupCard
                      key={id}
                      id={id}
                      group={group}
                      childrenObjects={children}
                      isExpanded={isExpanded}
                      isSelected={isSelected}
                      selectedIds={selectedAnnotationIds}
                      onToggleExpand={() => toggleGroupExpand(id)}
                      onSelectGroup={(e) => {
                        e.stopPropagation();
                        selectAnnotationObjects([id], e.shiftKey || e.metaKey);
                        setRightPanelActiveTab('inspector');
                        setRightPanelOpen(true);
                      }}
                      onContextMenuGroup={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        selectAnnotationObjects([id]);
                        setContextMenu({ id, isGroup: true, x: e.clientX, y: e.clientY });
                      }}
                      onToggleGroupVisible={() => toggleAnnotationGroupVisibility(id)}
                      onDeleteGroup={() => removeAnnotationObjects([id])}
                      onRenameGroup={(newName) => updateAnnotationGroup(id, { name: newName })}
                      onSelectChild={(childId, e) => {
                        e.stopPropagation();
                        selectAnnotationObjects([childId], e.shiftKey || e.metaKey);
                        setRightPanelActiveTab('inspector');
                        setRightPanelOpen(true);
                      }}
                      onContextMenuChild={(childId, e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        selectAnnotationObjects([childId]);
                        setContextMenu({ id: childId, isGroup: false, x: e.clientX, y: e.clientY });
                      }}
                      onToggleChildVisible={(childId) => toggleAnnotationVisibility(childId)}
                      onToggleChildLabel={(childId) => toggleAnnotationLabelVisibility(childId)}
                      onDeleteChild={(childId) => removeAnnotationObjects([childId])}
                      onRenameChild={(childId, newName) => updateAnnotationObject(childId, { name: newName })}
                    />
                  );
                }

                const obj = annotationObjects[id];
                if (!obj) return null;
                const isSelected = selectedAnnotationIds.includes(id);
                return (
                  <SortableAnnotationCard
                    key={id}
                    id={id}
                    obj={obj}
                    isSelected={isSelected}
                    onSelect={(e) => {
                      e.stopPropagation();
                      selectAnnotationObjects([id], e.shiftKey || e.metaKey);
                      setRightPanelActiveTab('inspector');
                      setRightPanelOpen(true);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      selectAnnotationObjects([id]);
                      setContextMenu({ id, isGroup: false, x: e.clientX, y: e.clientY });
                    }}
                    onToggleVisible={() => toggleAnnotationVisibility(id)}
                    onToggleLabel={() => toggleAnnotationLabelVisibility(id)}
                    onDelete={() => removeAnnotationObjects([id])}
                    onRename={(newName) => updateAnnotationObject(id, { name: newName })}
                  />
                );
              })}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 bg-surface-panel border border-border-base/60 rounded-xl shadow-xl p-1 w-48 text-xs text-text-base flex flex-col gap-0.5 backdrop-blur-md"
        >
          {(() => {
            const isGroup = contextMenu.isGroup;
            const groupObj = isGroup ? annotationGroups[contextMenu.id] : undefined;
            const itemObj = !isGroup ? annotationObjects[contextMenu.id] : undefined;

            return (
              <>
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

                {isGroup ? (
                  <button
                    onClick={() => {
                      explodeAnnotationGroup(contextMenu.id);
                      setContextMenu(null);
                    }}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-hover text-left w-full transition-colors"
                  >
                    <Unlink size={13} className="text-amber-400" />
                    <span>グループ解除 (Explode)</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleDuplicate(contextMenu.id)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-hover text-left w-full transition-colors"
                  >
                    <Copy size={13} className="text-text-muted" />
                    <span>複製 (Duplicate)</span>
                  </button>
                )}

                <div className="h-px bg-border-base/30 my-0.5" />
                <button
                  onClick={() => {
                    removeAnnotationObjects([contextMenu.id]);
                    setContextMenu(null);
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-danger-base/10 text-danger-base text-left w-full transition-colors"
                >
                  <Trash2 size={13} />
                  <span>削除 (Delete)</span>
                </button>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
