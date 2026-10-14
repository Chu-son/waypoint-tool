import type { ReactNode } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { ChevronRight, Eye, EyeOff, GripVertical } from 'lucide-react';
import { Button } from '../../common/Button';
import { InlineNameInput } from '../../common/InlineNameInput';
import { cn } from '../../../../utils/cn';
import type { DropPosition } from '../../../../utils/treeOps';

/** Indentation per level and before level 0 (px). Deep rows stop indenting so the name keeps room. */
export const TREE_INDENT_PX = 10;
export const TREE_BASE_PADDING_PX = 6;
const MAX_PADDING_PX = TREE_BASE_PADDING_PX + TREE_INDENT_PX * 5;
export const treeRowPadding = (depth: number) =>
  Math.min(depth * TREE_INDENT_PX + TREE_BASE_PADDING_PX, MAX_PADDING_PX);

/** What a tree shows in one row (the row frame, selection and drag are the tree's). */
export interface TreeRowContent {
  name: string;
  icon: ReactNode;
  /** Small labels after the name (kind, state). */
  badges?: ReactNode;
  /** Buttons before the eye, e.g. the item's main action. */
  actions?: ReactNode;
  /** The item's own visible flag; leave out for items without one. */
  visible?: boolean;
  /** Hidden by a container above it: drawn dimmed, its own flag kept. */
  hiddenByAncestor?: boolean;
  /** Tooltip of the name. */
  title?: string;
}

interface TreeRowProps {
  id: string;
  depth: number;
  isContainer: boolean;
  isExpanded: boolean;
  isSelected: boolean;
  /** A collapsed container that holds selected items. */
  holdsSelection: boolean;
  isEditing: boolean;
  /** Briefly highlighted after "reveal in tree". */
  isFlashing?: boolean;
  dropIndicator: DropPosition | null;
  content: TreeRowContent;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onToggleExpand: () => void;
  onToggleVisible?: () => void;
  onRename: (name: string) => void;
  onCancelRename: () => void;
}

/** One row of `TreeView`: drag handle, expander, icon, name, badges, actions and eye. */
export function TreeRow({
  id,
  depth,
  isContainer,
  isExpanded,
  isSelected,
  holdsSelection,
  isEditing,
  isFlashing,
  dropIndicator,
  content,
  onClick,
  onDoubleClick,
  onContextMenu,
  onToggleExpand,
  onToggleVisible,
  onRename,
  onCancelRename,
}: TreeRowProps) {
  const drag = useDraggable({ id });
  const drop = useDroppable({ id });
  const setRefs = (el: HTMLElement | null) => {
    drag.setNodeRef(el);
    drop.setNodeRef(el);
  };
  const { name, icon, badges, actions, visible, hiddenByAncestor, title } = content;
  const shownDimmed = visible === false || hiddenByAncestor;

  return (
    <li
      ref={setRefs}
      role="treeitem"
      aria-level={depth + 1}
      aria-selected={isSelected}
      aria-expanded={isContainer ? isExpanded : undefined}
      aria-label={name}
      data-tree-item-id={id}
      className={cn('relative select-none', drag.isDragging && 'opacity-40')}
    >
      {dropIndicator === 'before' && (
        <div className="absolute left-0 right-0 -top-px h-0.5 bg-primary-base rounded-full z-10 pointer-events-none" />
      )}
      {dropIndicator === 'after' && (
        <div className="absolute left-0 right-0 -bottom-px h-0.5 bg-primary-base rounded-full z-10 pointer-events-none" />
      )}
      <div
        onClick={onClick}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onDoubleClick();
        }}
        onContextMenu={onContextMenu}
        style={{ paddingLeft: `${treeRowPadding(depth)}px` }}
        className={cn(
          'group relative flex items-center justify-between gap-1 py-1 pr-1.5 rounded-md text-xs transition-colors cursor-pointer border overflow-hidden',
          isSelected
            ? 'bg-primary-base/15 border-primary-base/50 text-text-base font-medium'
            : holdsSelection
              ? 'bg-primary-base/10 border-primary-base/40 text-text-base'
              : 'bg-surface-panel/40 hover:bg-surface-hover border-border-base/40 text-text-muted hover:text-text-base',
          dropIndicator === 'inside' && 'ring-2 ring-primary-base bg-primary-base/10',
          isFlashing && 'ring-2 ring-primary-base ring-offset-1 shadow-lg bg-primary-base/25 animate-pulse',
          shownDimmed && 'opacity-60',
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
          <div
            {...drag.attributes}
            {...drag.listeners}
            aria-label={`${name} をドラッグして移動`}
            className="cursor-grab active:cursor-grabbing text-text-muted/40 hover:text-text-muted shrink-0 touch-none"
          >
            <GripVertical size={13} />
          </div>

          {isContainer ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
              }}
              aria-label={isExpanded ? `${name} を折りたたむ` : `${name} を展開`}
              className="p-0.5 hover:bg-surface-hover rounded text-text-muted hover:text-text-base shrink-0"
            >
              <ChevronRight size={13} className={cn('transition-transform duration-150', isExpanded && 'rotate-90')} />
            </button>
          ) : (
            <span className="w-3 shrink-0" />
          )}

          <span className="shrink-0 flex items-center">{icon}</span>

          {isEditing ? (
            <InlineNameInput name={name} onRename={onRename} onCancel={onCancelRename} />
          ) : (
            <span className="truncate min-w-0 flex-1 font-medium text-text-base" title={title ?? name}>
              {name}
            </span>
          )}

          {holdsSelection && (
            <span
              className="w-2 h-2 rounded-full shrink-0 bg-primary-base ring-2 ring-surface-panel"
              title="選択中の項目を含んでいます"
            />
          )}
          {badges}
        </div>

        <div className="flex items-center gap-0.5 shrink-0 ml-1">
          {actions}
          {visible !== undefined && onToggleVisible && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onToggleVisible();
              }}
              aria-label={visible ? `${name} を非表示にする` : `${name} を表示する`}
              aria-pressed={visible}
              title={
                hiddenByAncestor ? '上のグループが非表示のため表示されていません' : visible ? '表示中' : '非表示中'
              }
              className={cn(
                'w-5 h-5 p-0 hover:bg-surface-hover',
                visible && !hiddenByAncestor ? 'text-text-base' : 'text-text-muted/50 hover:text-text-muted',
              )}
            >
              {visible ? <Eye size={11} /> : <EyeOff size={11} />}
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
