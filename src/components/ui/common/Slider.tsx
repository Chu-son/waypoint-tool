import React from "react";
import { cn } from "../../../utils/cn";

interface SliderProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  valueDisplay?: string;
}

export const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, label, valueDisplay, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        {(label || valueDisplay) && (
          <div className="flex justify-between items-center px-1">
            {label && (
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                {label}
              </label>
            )}
            {valueDisplay && (
              <span className="text-[11px] font-mono font-bold text-primary-base bg-primary-base/5 px-1.5 py-0.5 rounded border border-primary-base/10">
                {valueDisplay}
              </span>
            )}
          </div>
        )}
        <div className="relative flex items-center group">
          <input
            type="range"
            className={cn(
              "h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-base/50 border border-border-base/30 outline-none transition-all",
              "focus-visible:ring-2 focus-visible:ring-primary-base/30 focus-visible:border-primary-base/50",
              "accent-primary-base",
              "[&::-webkit-slider-runnable-track]:rounded-full",
              "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-text-inverse [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary-base [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:active:scale-95 [&::-webkit-slider-thumb]:-mt-[5px]",
              "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-text-inverse [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary-base [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:transition-all [&::-moz-range-thumb]:hover:scale-110",
              className
            )}
            ref={ref}
            {...props}
          />
        </div>
      </div>
    );
  }
);

Slider.displayName = "Slider";
