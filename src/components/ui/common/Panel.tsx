import * as React from "react";
import { cn } from "../../../utils/cn";

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "base" | "overlay";
}

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ className, variant = "base", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-surface-panel border border-border-base shadow-lg",
          variant === "overlay" && "bg-surface-base/95 backdrop-blur-md",
          className
        )}
        {...props}
      />
    );
  }
);
Panel.displayName = "Panel";
