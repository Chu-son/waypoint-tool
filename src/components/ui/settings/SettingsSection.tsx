import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../../utils/cn';

interface SettingsSectionProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function SettingsSection({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <div
      className={cn(
        'bg-surface-panel/40 border border-border-base/50 rounded-xl p-4 sm:p-5 shadow-xs space-y-4',
        className,
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-base/30 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && <Icon className="w-4 h-4 text-primary-base shrink-0" />}
          <div>
            <h4 className="text-sm font-semibold text-text-base tracking-tight">{title}</h4>
            {description && <p className="text-[12px] text-text-muted mt-0.5 leading-normal">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">{actions}</div>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
