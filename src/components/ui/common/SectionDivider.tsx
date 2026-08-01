import React from "react";
import { cn } from "../../../utils/cn";

export interface SectionDividerProps {
  title: string;
  action?: React.ReactNode;
  className?: string;
}

export function SectionDivider({ title, action, className }: SectionDividerProps) {
  return (
    <h4
      className={cn(
        "text-xs font-bold text-text-muted uppercase tracking-wider ml-1 px-1 flex items-center gap-2 select-none",
        className
      )}
    >
      <span>{title}</span>
      <div className="h-px flex-1 bg-border-base/30" />
      {action && <div>{action}</div>}
    </h4>
  );
}
