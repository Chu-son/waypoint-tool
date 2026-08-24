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
import { AnnotationObject, AnnotationType } from '../../types/store';
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
        'group relative flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs select-none transition-all cursor-pointer border',
        isSelected
          ? 'bg-primary-base/15 border-primary-base/60 text-text-base shadow-sm ring-1 ring-primary-base/30'
          : 'bg-surface-panel/40 hover:bg-surface-hover border-border-base/40 text-text-muted hover:text-text-base',
        !obj.visible && 'opacity-60 grayscale-[0.3]'
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-text-muted/40 hover:text-text-muted shrink-0 touch-none"
        >
          <GripVertical size={13} />
        </div>

        {/* Color Dot & Type Icon */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className="w-2.5 h-2.5 rounded-full border border-slate-600 shadow-xs shrink-0"
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
        <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface-hover/80 text-text-muted border border-border-base/30 shrink-0 font-mono">
          {getTypeLabel(obj.type)}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100">
        {/* Label Visibility Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onToggleLabel();
          }}
          className={cn(
            'w-6 h-6 p-0 hover:bg-surface-hover',
            obj.labelVisible ? 'text-primary-base' : 'text-text-muted/40 hover:text-text-muted'
          )}
          title={obj.labelVisible ? 'ラベル: 表示中 (クリックで非表示)' : 'ラベル: 非表示中 (クリックで表示)'}
        >
          <Tag size={12} />
        </Button>

        {/* Visibility Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisible();
          }}
          className={cn(
            'w-6 h-6 p-0 hover:bg-surface-hover',
            obj.visible ? 'text-text-base' : 'text-text-muted/40 hover:text-text-muted'
          )}
          title={obj.visible ? '表示中 (クリックで非表示)' : '非表示中 (クリックで表示)'}
        >
          {obj.visible ? <Eye size={13} /> : <EyeOff size={13} />}
        </Button>

        {/* Delete */}
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="w-6 h-6 p-0 hover:bg-danger-base/10 hover:text-danger-base text-text-muted/40 transition-colors"
          title="削除"
        >
          <Trash2 size={12} />
        </Button>
      </div>
    </li>
  );
}

export function AnnotationTree() {
  const annotationObjects = useAppStore((state) => state.annotationObjects) || {};
  const annotationOrder = useAppStore((state) => state.annotationOrder) || [];
  const selectedAnnotationIds = useAppStore((state) => state.selectedAnnotationIds) || [];
  const selectAnnotationObjects = useAppStore((state) => state.selectAnnotationObjects);
  const reorderAnnotationObjects = useAppStore((state) => state.reorderAnnotationObjects);
  const updateAnnotationObject = useAppStore((state) => state.updateAnnotationObject);
  const removeAnnotationObjects = useAppStore((state) => state.removeAnnotationObjects);
  const toggleAnnotationVisibility = useAppStore((state) => state.toggleAnnotationVisibility);
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
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = annotationOrder.indexOf(active.id as string);
      const newIndex = annotationOrder.indexOf(over.id as string);
      if (oldIndex !== -1 && newIndex !== -1) {
        reorderAnnotationObjects(oldIndex, newIndex);
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
    addAnnotationObject(duplicated);
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
            {annotationOrder.length}
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
      {annotationOrder.length === 0 ? (
        <div className="text-center py-4 text-xs text-text-muted/60 italic bg-surface-panel/20 rounded-xl border border-border-base/20">
          アノテーションがありません。「+ Add」ボタンから配置できます。
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={annotationOrder} strategy={verticalListSortingStrategy}>
            <ul className="space-y-1.5">
              {annotationOrder.map((id) => {
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
                      setContextMenu({ id, x: e.clientX, y: e.clientY });
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
          className="fixed z-50 bg-surface-panel border border-border-base/60 rounded-xl shadow-xl p-1 w-36 text-xs text-text-base flex flex-col gap-0.5 backdrop-blur-md"
        >
          <button
            onClick={() => handleDuplicate(contextMenu.id)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-hover text-left w-full transition-colors"
          >
            <Copy size={12} className="text-text-muted" />
            <span>複製 (Duplicate)</span>
          </button>
          <div className="h-px bg-border-base/30 my-0.5" />
          <button
            onClick={() => {
              removeAnnotationObjects([contextMenu.id]);
              setContextMenu(null);
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-danger-base/10 text-danger-base text-left w-full transition-colors"
          >
            <Trash2 size={12} />
            <span>削除 (Delete)</span>
          </button>
        </div>
      )}
    </div>
  );
}
