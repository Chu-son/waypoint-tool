import { useEffect, useRef } from 'react';
import { useAppStore } from '../../stores/appStore';
import { ListTree, Folder, Layers } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface CanvasContextMenuTarget {
  type: 'node' | 'annotation';
  id: string;
  name?: string;
  parentContainerId: string | null;
  parentContainerKind: 'generator' | 'group' | null;
  parentContainerName?: string | null;
}

export interface CanvasContextMenuProps {
  x: number;
  y: number;
  target: CanvasContextMenuTarget;
  onClose: () => void;
}

export function CanvasContextMenu({ x, y, target, onClose }: CanvasContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const revealInTree = useAppStore((state) => state.revealInTree);
  const selectNodes = useAppStore((state) => state.selectNodes);
  const selectAnnotationObjects = useAppStore((state) => state.selectAnnotationObjects);

  useEffect(() => {
    let isActive = false;
    const timer = setTimeout(() => {
      isActive = true;
    }, 50);

    const handleClickOutside = (e: MouseEvent | PointerEvent) => {
      if (!isActive) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('pointerdown', handleClickOutside);
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', handleClickOutside);
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // ウィンドウ外へのはみ出し防止位置調整
  const menuWidth = 230;
  const menuHeight = 110;
  const adjustedX = typeof window !== 'undefined'
    ? Math.max(8, Math.min(x, window.innerWidth - menuWidth - 8))
    : x;
  const adjustedY = typeof window !== 'undefined'
    ? Math.max(8, Math.min(y, window.innerHeight - menuHeight - 8))
    : y;

  const handleReveal = () => {
    revealInTree(target.type, target.id);
    onClose();
  };

  const handleSelectParent = () => {
    if (!target.parentContainerId) return;
    if (target.type === 'node') {
      selectNodes([target.parentContainerId]);
    } else {
      selectAnnotationObjects([target.parentContainerId]);
    }
    onClose();
  };

  const isGenerator = target.parentContainerKind === 'generator';
  const parentLabel = isGenerator ? 'ジェネレータ' : 'グループ';
  const hasParent = Boolean(target.parentContainerId);

  return (
    <div
      ref={menuRef}
      style={{ top: adjustedY, left: adjustedX }}
      className="fixed z-[9999] bg-surface-panel/95 border border-border-base rounded-xl shadow-2xl py-1 min-w-[210px] text-xs text-text-base select-none backdrop-blur-md flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Header Info */}
      <div className="px-3 py-1 text-[11px] font-semibold text-text-muted border-b border-border-base/30 flex items-center justify-between">
        <span className="truncate max-w-[170px]">{target.name || (target.type === 'node' ? 'Waypoint' : 'Annotation')}</span>
        <span className="text-[10px] uppercase tracking-wider px-1 py-0.2 bg-surface-hover rounded text-text-muted">
          {target.type === 'node' ? 'WP' : 'ROI'}
        </span>
      </div>

      {/* 一覧リストで表示 */}
      <button
        type="button"
        onClick={handleReveal}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-surface-hover text-left w-full transition-colors text-text-base font-medium"
      >
        <ListTree size={14} className="text-primary-base" />
        <span>一覧リストで位置を表示</span>
      </button>

      {/* 所属グループ / ジェネレータ全体を選択 */}
      <button
        type="button"
        disabled={!hasParent}
        onClick={handleSelectParent}
        className={cn(
          'flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-left w-full transition-colors font-medium',
          hasParent
            ? 'hover:bg-surface-hover text-text-base cursor-pointer'
            : 'text-text-muted/40 cursor-not-allowed'
        )}
      >
        {isGenerator ? (
          <Layers size={14} className={hasParent ? 'text-accent-generator' : 'text-text-muted/40'} />
        ) : (
          <Folder size={14} className={hasParent ? 'text-accent-anchor' : 'text-text-muted/40'} />
        )}
        <div className="flex flex-col min-w-0">
          <span>所属{parentLabel}全体を選択</span>
          {hasParent && target.parentContainerName && (
            <span className="text-[10px] text-text-muted truncate max-w-[150px]">
              ({target.parentContainerName})
            </span>
          )}
          {!hasParent && (
            <span className="text-[10px] text-text-muted/50">
              (グループ未所属)
            </span>
          )}
        </div>
      </button>
    </div>
  );
}
