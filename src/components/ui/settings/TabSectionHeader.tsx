import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../../utils/cn';

interface TabSectionHeaderProps {
  title: string;
  subtitle: string;
  icon?: LucideIcon;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function TabSectionHeader({ title, subtitle, icon: Icon, badge, actions, className }: TabSectionHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-panel/80 p-4 rounded-xl border border-border-base/50 shadow-xs',
        className,
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className="w-9 h-9 rounded-lg bg-primary-base/10 border border-primary-base/20 flex items-center justify-center text-primary-base shrink-0">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold text-text-base tracking-tight truncate">{title}</h3>
            {badge}
          </div>
          <p className="text-xs text-text-muted mt-0.5 font-medium leading-relaxed">{subtitle}</p>
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">{actions}</div>}
    </div>
  );
}
