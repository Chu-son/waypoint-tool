import React from "react";
import { cn } from "../../../utils/cn";

interface TabSectionHeaderProps {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  className?: string;
}

export function TabSectionHeader({
  title,
  subtitle,
  actions,
  className,
}: TabSectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex justify-between items-center bg-surface-panel p-4 rounded-xl border border-border-base/50 shadow-sm",
        className
      )}
    >
      <div>
        <h3 className="text-lg font-bold text-text-base tracking-tight">
          {title}
        </h3>
        <p className="text-xs text-text-muted mt-0.5 font-medium">{subtitle}</p>
      </div>
      {actions && <div className="flex gap-2.5">{actions}</div>}
    </div>
  );
}
