import { Eye, EyeOff, Trash2, ChevronUp, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { Button } from '../common/Button';
import { cn } from '../../../utils/cn';

export function CardFrame({
  visible = true,
  children,
  className,
  isActive = false,
  onClick,
  onContextMenu,
}: {
  visible?: boolean;
  children: React.ReactNode;
  className?: string;
  isActive?: boolean;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={cn(
        'bg-surface-panel/40 backdrop-blur-sm border rounded-lg p-3 shadow-subtle hover:border-border-base/60 transition-all group overflow-hidden relative cursor-pointer',
        isActive ? 'border-primary-base/80 bg-primary-base/5 ring-1 ring-primary-base/30' : 'border-border-base/30',
        className,
      )}
    >
      {!visible && (
        <div className="absolute inset-0 bg-surface-base/40 z-1 pointer-events-none backdrop-grayscale-[0.5]" />
      )}
      {children}
    </div>
  );
}

interface LayerCardShellProps {
  visible: boolean;
  isActive?: boolean;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  icon?: React.ReactNode;
  title: React.ReactNode;
  subBadges?: React.ReactNode;
  headerActions?: React.ReactNode;
  showSettings: boolean;
  onToggleSettings: () => void;
  settingsTooltip?: string;
  onToggleVisible: () => void;
  onRemove: () => void;
  removeTooltip?: string;
  children?: React.ReactNode;
}

export function LayerCardShell({
  visible,
  isActive = false,
  onClick,
  onContextMenu,
  onMoveUp,
  onMoveDown,
  isFirst = false,
  isLast = false,
  icon,
  title,
  subBadges,
  headerActions,
  showSettings,
  onToggleSettings,
  settingsTooltip = 'Settings',
  onToggleVisible,
  onRemove,
  removeTooltip = 'Remove',
  children,
}: LayerCardShellProps) {
  const hasReorder = !!onMoveUp && !!onMoveDown;

  return (
    <CardFrame visible={visible} isActive={isActive} onClick={onClick} onContextMenu={onContextMenu}>
      <div className={cn('flex items-center justify-between relative z-10', showSettings ? 'mb-2.5' : 'mb-0')}>
        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-1.5">
          {hasReorder && (
            <div className="flex flex-col gap-0.5 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-text-muted hover:text-text-base hover:bg-surface-hover/50 disabled:opacity-30 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveUp?.();
                }}
                disabled={isFirst}
                title="Move Up"
              >
                <ChevronUp size={13} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-text-muted hover:text-text-base hover:bg-surface-hover/50 disabled:opacity-30 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveDown?.();
                }}
                disabled={isLast}
                title="Move Down"
              >
                <ChevronDown size={13} />
              </Button>
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              {icon}
              {title}
            </div>
            {subBadges && <div className="flex items-center gap-1.5 mt-0.5">{subBadges}</div>}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {headerActions}

          <Button
            variant={showSettings ? 'secondary' : 'ghost'}
            size="icon"
            className={cn(
              'h-7 w-7 text-text-muted hover:text-text-base transition-all',
              showSettings && 'text-accent-reference bg-accent-reference/10 border border-accent-reference/20',
            )}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSettings();
            }}
            title={settingsTooltip}
            aria-expanded={showSettings}
          >
            <SlidersHorizontal size={14} />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-text-muted hover:text-primary-base hover:bg-primary-base/10"
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisible();
            }}
            title="Toggle Visibility"
          >
            {visible ? <Eye size={15} /> : <EyeOff size={15} />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-text-muted hover:text-danger-base hover:bg-danger-base/10"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            title={removeTooltip}
          >
            <Trash2 size={15} />
          </Button>
        </div>
      </div>

      {showSettings && children && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 mt-2.5 pt-2.5 border-t border-border-base/40 space-y-3 bg-surface-base/40 p-2.5 rounded-xl animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {children}
        </div>
      )}
    </CardFrame>
  );
}
