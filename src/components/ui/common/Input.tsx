import * as React from "react";
import { cn } from "../../../utils/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "w-full h-8 rounded-md border border-border-base bg-surface-base px-2.5 text-[13px] text-text-base outline-none transition-colors",
          "placeholder:text-text-muted/60",
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
