import React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "../../../utils/cn";

interface AlertBoxProps {
  title: string;
  variant?: "primary" | "danger" | "warning" | "success" | "info";
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

const variantStyles = {
  primary: "bg-primary-base/10 border-primary-base/30 text-primary-base",
  info: "bg-primary-base/10 border-primary-base/30 text-primary-base",
  danger: "bg-danger-base/10 border-danger-base/30 text-danger-base",
  warning: "bg-amber-500/10 border-amber-500/30 text-amber-500",
  success: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
};

export function AlertBox({
  title,
  variant = "primary",
  icon,
  action,
  children,
  className,
}: AlertBoxProps) {
  return (
    <div
      className={cn(
        "p-3 border rounded-lg flex items-start gap-2.5",
        variantStyles[variant],
        className
      )}
    >
      <div className="shrink-0 mt-0.5">
        {icon || <AlertCircle size={14} className="current-color" />}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-bold leading-none mb-1">{title}</h4>
        {children && (
          <div className="text-[10px] opacity-90 leading-relaxed font-normal">
            {children}
          </div>
        )}
      </div>
      {action && <div className="shrink-0 ml-2">{action}</div>}
    </div>
  );
}
