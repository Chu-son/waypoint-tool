import React from 'react';
import { Button } from './Button';
import { cn } from '../../../utils/cn';

export interface FloatingBannerAction {
  label: string;
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  onClick: () => void;
  title?: string;
}

export interface FloatingActionBannerProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  valueDisplay?: string | number;
  statusText?: React.ReactNode;
  actions: FloatingBannerAction[];
  className?: string;
}

export const FloatingActionBanner = React.forwardRef<HTMLDivElement, FloatingActionBannerProps>(
  (
    {
      icon,
      title,
      subtitle,
      valueDisplay,
      statusText,
      actions,
      className = '',
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          "absolute top-4 left-16 max-w-[calc(100%-5rem)] z-20 flex items-center gap-2 sm:gap-3 bg-surface-panel/95 backdrop-blur-md border border-amber-500/50 shadow-2xl rounded-xl px-3 sm:px-4 py-2 text-xs text-text-base animate-in fade-in slide-in-from-top-2 duration-200 overflow-x-auto scrollbar-thin flex-nowrap",
          className
        )}
      >
        <div className="flex items-center gap-2 pr-2 border-r border-border-base/50 flex-shrink-0">
          {icon && <div className="text-amber-400 flex-shrink-0">{icon}</div>}
          <div className="min-w-0 max-w-[120px] sm:max-w-[180px]">
            <div className="font-semibold text-amber-300 truncate" title={title}>
              {title}
            </div>
            {subtitle && (
              <div className="font-normal text-text-muted text-[11px] truncate" title={subtitle}>
                ({subtitle})
              </div>
            )}
            {valueDisplay !== undefined && (
              <div className="font-mono text-text-base font-bold truncate">
                値: {typeof valueDisplay === 'number' ? valueDisplay.toFixed(4) : valueDisplay}
              </div>
            )}
          </div>
        </div>

        {statusText && (
          <div className="px-1 sm:px-2 text-text-muted flex-shrink-0">
            {statusText}
          </div>
        )}

        <div className="flex items-center gap-1.5 sm:gap-2 pl-2 border-l border-border-base/50 flex-shrink-0 ml-auto">
          {actions.map((act, idx) => (
            <Button
              key={idx}
              variant={act.variant || 'secondary'}
              size="sm"
              disabled={act.disabled}
              onClick={act.onClick}
              title={act.title}
              className={
                act.variant === 'primary'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white font-medium gap-1 shadow disabled:opacity-50 flex-shrink-0 h-7 text-xs px-2.5'
                  : 'hover:bg-rose-900/40 hover:text-rose-300 gap-1 flex-shrink-0 h-7 text-xs px-2.5'
              }
            >
              {act.icon}
              <span className="hidden xs:inline sm:inline">{act.label}</span>
            </Button>
          ))}
        </div>
      </div>
    );
  }
);
FloatingActionBanner.displayName = 'FloatingActionBanner';
