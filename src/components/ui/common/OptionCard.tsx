import React from "react";
import { cn } from "../../../utils/cn";
import { Checkbox } from "./Checkbox";

interface OptionCardProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function OptionCard({
  checked,
  onChange,
  title,
  description,
  children,
  className,
}: OptionCardProps) {
  return (
    <label
      className={cn(
        "flex items-start gap-3.5 p-3.5 rounded-lg cursor-pointer group",
        "bg-surface-panel/40 border border-border-base",
        "hover:border-primary-base/40 hover:bg-surface-hover/60 transition-colors",
        className
      )}
    >
      <div className="pt-1">
        <Checkbox
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
      </div>
      <div className="space-y-1 w-full">
        <p className="text-sm font-bold text-text-base group-hover:text-primary-base transition-colors">
          {title}
        </p>
        {description && (
          <p className="text-[11px] text-text-muted/80 leading-relaxed">
            {description}
          </p>
        )}
        {children}
      </div>
    </label>
  );
}
