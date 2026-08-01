import React from "react";
import { cn } from "../../../utils/cn";
import { Label } from "./Label";

interface FormFieldProps {
  label: string;
  labelRight?: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  label,
  labelRight,
  description,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <Label
        className={cn(
          "text-sm font-semibold text-text-base",
          labelRight && "flex justify-between items-center"
        )}
      >
        <span>{label}</span>
        {labelRight && (
          <span className="text-primary-base font-mono">{labelRight}</span>
        )}
      </Label>
      {children}
      {description && (
        <p className="text-[11px] text-text-muted opacity-80 leading-relaxed px-1">
          {description}
        </p>
      )}
    </div>
  );
}
