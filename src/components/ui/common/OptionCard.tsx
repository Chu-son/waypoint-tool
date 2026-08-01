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
        "flex items-start gap-4 p-4 rounded-xl cursor-pointer group",
        "bg-primary-base/5 border border-primary-base/10",
        "hover:border-primary-base/30 hover:bg-primary-base/[0.08] transition-all",
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
