import * as React from "react";
import { cn } from "../../../utils/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "w-full rounded border border-border-base bg-surface-base px-3 py-2 text-sm text-text-base outline-none transition-colors",
          "placeholder:text-text-muted",
          "focus:border-border-focus focus:ring-2 focus:ring-border-focus/20",
          "disabled:cursor-not-allowed disabled:opacity-60",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
