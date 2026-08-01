import React from "react";
import { cn } from "../../../utils/cn";

export interface FieldLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode;
  className?: string;
}

export function FieldLabel({ children, className, ...props }: FieldLabelProps) {
  return (
    <label
      className={cn(
        "block text-[10px] font-bold text-text-muted uppercase tracking-wider select-none",
        className
      )}
      {...props}
    >
      {children}
    </label>
  );
}
