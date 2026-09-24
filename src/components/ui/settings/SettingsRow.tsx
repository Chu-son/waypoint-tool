import React from 'react';
import { cn } from '../../../utils/cn';

interface SettingsRowProps {
  label: string;
  labelRight?: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  vertical?: boolean;
  className?: string;
}

export function SettingsRow({
  label,
  labelRight,
  description,
  children,
  vertical = false,
  className,
}: SettingsRowProps) {
  if (vertical) {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center justify-between">
          <label className="text-[13px] font-medium text-text-base">{label}</label>
          {labelRight && <span className="text-xs text-text-muted font-mono">{labelRight}</span>}
        </div>
        {description && <p className="text-[11px] text-text-muted leading-relaxed">{description}</p>}
        <div className="pt-1">{children}</div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1.5', className)}>
      <div className="space-y-0.5 max-w-md pr-2">
        <div className="flex items-center gap-2">
          <label className="text-[13px] font-medium text-text-base">{label}</label>
          {labelRight && <span className="text-xs text-text-muted font-mono">{labelRight}</span>}
        </div>
        {description && <p className="text-[11px] text-text-muted leading-relaxed">{description}</p>}
      </div>
      <div className="shrink-0 sm:self-center">{children}</div>
    </div>
  );
}
