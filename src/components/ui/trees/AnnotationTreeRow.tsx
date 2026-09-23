import React, { useState, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  Trash2,
  GripVertical,
  CircleDot,
  Navigation,
  Minus,
  Square,
  Circle,
  Tag,
  ChevronRight,
  Folder,
  Wand2,
} from 'lucide-react';
import { Button } from '../common/Button';
import { cn } from '../../../utils/cn';
import { DEFAULT_ANNOTATION_COLOR } from '../../../utils/colorPresets';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AnnotationObject, AnnotationGroup, AnnotationType } from '../../../types/store';

function getAnnotationIcon(type: AnnotationType) {
  switch (type) {
    case 'point':
      return <CircleDot size={13} className="text-primary-base" />;
    case 'oriented_point':
      return <Navigation size={13} className="text-accent-generator" />;
    case 'line':
      return <Minus size={13} className="text-accent-anchor" />;
    case 'rect':
      return <Square size={13} className="text-accent-reference" />;
    case 'circle':
      return <Circle size={13} className="text-accent-reference" />;
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
  hasSelectedChild?: boolean;
  isFlashing?: boolean;
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

export function SortableAnnotationTreeNode({
  id,
  depth,
  isGroup,
  group,
  obj,
  isSelected,
  hasSelectedChild,
  isFlashing,
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

  const isVisible = isGroup ? (group?.visible ?? true) : (obj?.visible ?? true);
  const isGenerator = isGroup && group?.type === 'generator';
  const childCount = group?.children_ids?.length || 0;

  return (
    <li ref={setNodeRef} style={style} data-tree-item-id={id} className="space-y-1 select-none">
      <div
        onClick={onClick}
        onContextMenu={onContextMenu}
        style={{ paddingLeft: `${Math.min(depth * 10 + 6, 32)}px` }}
        className={cn(
          'group relative flex items-center justify-between gap-1 py-1 pr-1.5 rounded-md text-xs transition-colors cursor-pointer border overflow-hidden',
          isSelected
            ? 'bg-primary-base/15 border-primary-base/50 text-text-base font-medium'
            : hasSelectedChild
              ? 'bg-primary-base/10 border-primary-base/40 ring-1 ring-primary-base/25 text-text-base font-medium'
              : 'bg-surface-panel/40 hover:bg-surface-hover border-border-base/40 text-text-muted hover:text-text-base',
          isFlashing && 'ring-2 ring-primary-base ring-offset-1 shadow-lg bg-primary-base/25 animate-pulse',
          !isVisible && 'opacity-60 grayscale-[0.3]',
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
              isGenerator ? (
                <Wand2 size={13} className="text-primary-base" />
              ) : (
                <Folder size={13} className="text-accent-anchor" />
              )
            ) : obj ? (
              <>
                <span
                  className="w-2 h-2 rounded-full border border-border-base shadow-xs shrink-0"
                  style={{ backgroundColor: obj.color || DEFAULT_ANNOTATION_COLOR }}
                  title={`Color: ${obj.color || DEFAULT_ANNOTATION_COLOR}`}
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
            <span className="truncate font-medium flex-1 min-w-0 text-text-base" title={group?.name || obj?.name || ''}>
              {group?.name || obj?.name || ''}
            </span>
          )}

          {/* Child Selection Dot Indicator for Collapsed Container */}
          {isGroup && !isExpanded && hasSelectedChild && (
            <span
              className="w-2 h-2 rounded-full shrink-0 animate-pulse bg-primary-base ring-2 ring-surface-panel shadow-xs"
              title="選択中の子要素を含んでいます"
            />
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
                obj.labelVisible ? 'text-primary-base' : 'text-text-muted/40 hover:text-text-muted',
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
              isVisible ? 'text-text-base' : 'text-text-muted/40 hover:text-text-muted',
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
