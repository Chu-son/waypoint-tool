import React from "react";
import { cn } from "../../../utils/cn";

export interface InlineFieldRowProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export function InlineFieldRow({ label, children, className }: InlineFieldRowProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-tight shrink-0 select-none">
        {label}
      </span>
      {children}
    </div>
  );
}
