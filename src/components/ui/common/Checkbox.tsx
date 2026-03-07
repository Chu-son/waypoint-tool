import * as React from "react";
import { cn } from "../../../utils/cn";

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        type="checkbox"
        className={cn(
          "h-4 w-4 cursor-pointer rounded border-border-base bg-surface-panel text-primary-base focus:ring-2 focus:ring-primary-base/30",
          "disabled:cursor-not-allowed disabled:opacity-60",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Checkbox.displayName = "Checkbox";
