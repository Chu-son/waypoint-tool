import React from 'react';
import { useAppStore } from '../../../stores/appStore';
import { ChevronRight, Layers, GripVertical, Anchor, Folder, Target } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { WaypointNode } from '../../../types/store';
import { InlineNameInput } from '../common/InlineNameInput';

interface TreeItemRowProps {
  id: string;
  node: WaypointNode;
  depth: number;
  isSelected: boolean;
  hasSelectedChild?: boolean;
  isFlashing?: boolean;
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

export function SortableTreeNodeItem({
  id,
  node,
  depth,
  isSelected,
  hasSelectedChild,
  isFlashing,
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
  const plugins = useAppStore((state) => state.plugins);

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

  const pluginName =
    isGenerator && node.plugin_id && plugins[node.plugin_id] ? plugins[node.plugin_id].manifest.name : 'Generator';

  const defaultDisplayName = isGenerator
    ? pluginName
    : isGroup
      ? node.name || 'Group'
      : node.name
        ? `Waypoint (${node.name})`
        : 'Waypoint';

  const childCount = node.children_ids?.length || 0;

  return (
    <li ref={setNodeRef} style={style} data-tree-item-id={id} className="space-y-1 select-none">
      <div
        onClick={onClick}
        onContextMenu={onContextMenu}
        style={{ paddingLeft: `${Math.min(depth * 10 + 6, 32)}px` }}
        className={cn(
          'group relative flex items-center justify-between gap-1 py-1 pr-1.5 rounded-md text-xs transition-colors cursor-pointer border overflow-hidden',
          isSelected
            ? isGenerator
              ? 'bg-accent-generator/15 border-accent-generator/50 text-text-base'
              : 'bg-primary-base/15 border-primary-base/50 text-text-base'
            : hasSelectedChild
              ? isGenerator
                ? 'bg-accent-generator/10 border-accent-generator/40 ring-1 ring-accent-generator/25 text-text-base'
                : 'bg-primary-base/10 border-primary-base/40 ring-1 ring-primary-base/25 text-text-base'
              : 'bg-surface-panel/40 hover:bg-surface-hover border-border-base/40 text-text-muted hover:text-text-base',
          isFlashing && 'ring-2 ring-primary-base ring-offset-1 shadow-lg bg-primary-base/25 animate-pulse',
          isAnchor && 'border-accent-anchor/60 bg-accent-anchor/20',
          isAfterInsertion && 'opacity-40 grayscale-[35%] hover:opacity-75',
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
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
              aria-expanded={!!isExpanded}
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
              <Target size={13} className="text-primary-base" />
            )}
          </div>

          {/* Node Name / Inline Editing */}
          {isEditing ? (
            <InlineNameInput name={node.name || ''} onRename={onRename} onCancel={onCancelRename} />
          ) : (
            <div className="flex items-center gap-1 min-w-0 flex-1 truncate">
              {!isContainer && globalIndex !== undefined && (
                <span className="opacity-60 font-mono text-[11px] shrink-0">[{globalIndex + indexStartIndex}]</span>
              )}
              <span className="truncate font-medium text-text-base" title={defaultDisplayName}>
                {isContainer ? node.name || defaultDisplayName : defaultDisplayName}
              </span>
              {isAnchor && (
                <span title="Anchor Point" className="shrink-0 flex items-center">
                  <Anchor size={12} className="text-accent-anchor" />
                </span>
              )}
            </div>
          )}

          {/* Child Selection Dot Indicator for Collapsed Container */}
          {isContainer && !isExpanded && hasSelectedChild && (
            <span
              className={cn(
                'w-2 h-2 rounded-full shrink-0 animate-pulse ring-2 ring-surface-panel shadow-xs',
                isGenerator ? 'bg-accent-generator' : 'bg-primary-base',
              )}
              title="選択中の子要素を含んでいます"
            />
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
