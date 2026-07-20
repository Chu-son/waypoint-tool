import React from 'react';
import { Button } from './Button';

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

export function FloatingActionBanner({
  icon,
  title,
  subtitle,
  valueDisplay,
  statusText,
  actions,
  className = '',
}: FloatingActionBannerProps) {
  return (
    <div className={`absolute top-4 left-16 z-20 flex items-center gap-3 bg-surface-panel/95 backdrop-blur-md border border-amber-500/50 shadow-2xl rounded-xl px-4 py-2.5 text-xs text-text-base animate-in fade-in slide-in-from-top-2 duration-200 ${className}`}>
      <div className="flex items-center gap-2 pr-2 border-r border-border-base/50">
        {icon && <div className="text-amber-400 flex-shrink-0">{icon}</div>}
        <div>
          <div className="font-semibold text-amber-300">
            {title}
            {subtitle && <span className="font-normal text-text-muted ml-1">({subtitle})</span>}
          </div>
          {valueDisplay !== undefined && (
            <div className="font-mono text-text-base font-bold">
              値: {typeof valueDisplay === 'number' ? valueDisplay.toFixed(4) : valueDisplay}
            </div>
          )}
        </div>
      </div>

      {statusText && (
        <div className="px-2 text-text-muted whitespace-nowrap">
          {statusText}
        </div>
      )}

      <div className="flex items-center gap-2 pl-2 border-l border-border-base/50">
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
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white font-medium gap-1 shadow disabled:opacity-50'
                : 'hover:bg-rose-900/40 hover:text-rose-300 gap-1'
            }
          >
            {act.icon}
            {act.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
