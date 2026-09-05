import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../../utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 disabled:opacity-50 disabled:pointer-events-none select-none",
  {
    variants: {
      variant: {
        primary: "bg-primary-base text-text-inverse hover:bg-primary-hover shadow-xs border border-primary-hover/30 focus:ring-primary-base/40",
        secondary: "bg-surface-panel border border-border-base text-text-base hover:bg-surface-hover hover:border-border-base/80 focus:ring-border-focus/40",
        outline: "border border-border-base bg-transparent text-text-base hover:bg-surface-hover hover:border-border-base/80 focus:ring-border-focus/40",
        ghost: "bg-transparent text-text-muted hover:bg-surface-hover hover:text-text-base",
        danger: "bg-danger-base text-text-inverse hover:bg-danger-hover border border-danger-hover/30 shadow-xs focus:ring-danger-base/40",
        icon: "bg-surface-panel text-text-muted border border-border-base hover:bg-surface-hover hover:text-text-base hover:border-border-base/80",
      },
      size: {
        default: "h-8 px-3 text-[13px] rounded-md",
        sm: "h-7 px-2.5 text-xs rounded-md",
        xs: "h-6 px-2 text-[11px] rounded",
        lg: "h-9 px-4 text-sm rounded-md",
        icon: "h-8 w-8 rounded-md shrink-0",
        "icon-sm": "h-7 w-7 rounded-md shrink-0",
        "icon-xs": "h-6 w-6 rounded shrink-0",
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
