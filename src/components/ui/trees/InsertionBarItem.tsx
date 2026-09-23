import { GripVertical, X } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export const INSERTION_BAR_ID = '__insertion_bar__';

interface InsertionBarItemProps {
  depth?: number;
  isAtEnd?: boolean;
  onReset: () => void;
}

export function InsertionBarItem({ depth = 0, isAtEnd = false, onReset }: InsertionBarItemProps) {
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
