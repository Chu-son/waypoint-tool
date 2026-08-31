import React from "react";
import { Label } from "../common/Label";
import { NumericInput } from "../NumericInput";
import { cn } from "../../../utils/cn";

interface TransformFieldProps {
  label: string;
  fieldId: string;
  value: number;
  precision: number;
  placeholder?: string;
  step?: string;
  variant?: "world" | "anchor";
  isCopying?: boolean;
  onContextMenu?: (e: React.MouseEvent) => void;
  onChange: (value: number) => void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  className?: string;
}

export function TransformField({
  label,
  fieldId: _fieldId,
  value,
  precision,
  placeholder,
  step,
  variant = "world",
  isCopying = false,
  onContextMenu,
  onChange,
  onEditStart,
  onEditEnd,
  className,
}: TransformFieldProps) {
  const isAnchor = variant === "anchor";

  return (
    <div className={className}>
      <Label
        className={cn(
          "block text-xs mb-1 cursor-context-menu select-none",
          isCopying
            ? isAnchor
              ? "text-accent-anchor font-bold"
              : "text-primary-base font-bold"
            : "text-text-muted hover:text-text-base"
        )}
        onContextMenu={(e) => {
          if (onContextMenu) {
            e.preventDefault();
            onContextMenu(e);
          }
        }}
      >
        {label}
      </Label>
      <NumericInput
        value={value}
        precision={precision}
        placeholder={placeholder}
        step={step}
        className={cn(
          isCopying &&
            (isAnchor ? "border-accent-anchor bg-accent-anchor/20" : "border-primary-base bg-primary-base/10")
        )}
        onEditStart={onEditStart}
        onEditEnd={onEditEnd}
        onChange={onChange}
      />
    </div>
  );
}
