import * as React from "react";
import { cn } from "../../../utils/cn";

export interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  className?: string;
}

export function Kbd({ children, className, ...props }: KbdProps) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center px-1.5 py-0.5 text-[11px] font-mono font-medium rounded border border-border-base bg-surface-base/80 text-text-muted shadow-xs select-none tracking-tight leading-none",
        className
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}
