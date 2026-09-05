import * as React from "react";
import { cn } from "../../../utils/cn";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        className={cn(
          "w-full h-8 cursor-pointer appearance-none rounded-md border border-border-base bg-surface-base px-2.5 text-[13px] text-text-base leading-relaxed outline-none transition-colors",
          "focus:border-border-focus focus:ring-2 focus:ring-border-focus/20",
          "disabled:cursor-not-allowed disabled:opacity-60",
          /* Default appearance reset if needed, but keeping simple for now */
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = "Select";
