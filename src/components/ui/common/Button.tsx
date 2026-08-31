import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../../utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary: "bg-primary-base text-text-inverse hover:bg-primary-hover focus:ring-primary-base/50",
        secondary: "bg-surface-hover text-text-base hover:bg-surface-hover/80 focus:ring-border-focus/50",
        outline: "border border-border-base bg-transparent text-text-base hover:bg-surface-hover focus:ring-border-focus/50",
        ghost: "bg-transparent text-text-muted hover:bg-surface-hover hover:text-text-base",
        danger: "bg-danger-base text-text-inverse hover:bg-danger-hover",
        icon: "bg-surface-panel text-text-muted border border-border-base hover:bg-surface-hover hover:text-text-base",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
