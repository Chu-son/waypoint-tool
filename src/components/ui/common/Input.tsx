import * as React from 'react';
import { cn } from '../../../utils/cn';
import { useEditSession, type EditBoundary } from './useEditSession';

/** A text input. With `onEditStart` / `onEditEnd`, focusing to blurring is one edit (one undo step). */
export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & EditBoundary;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', onEditStart, onEditEnd, onFocus, onBlur, ...props }, ref) => {
    const edit = useEditSession({ onEditStart, onEditEnd });
    return (
      <input
        type={type}
        className={cn(
          'w-full h-8 rounded-md border border-border-base bg-surface-base px-2.5 text-[13px] text-text-base outline-none transition-colors',
          'placeholder:text-text-muted/60',
          'focus:border-border-focus focus:ring-2 focus:ring-border-focus/20',
          'disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
        ref={ref}
        onFocus={(e) => {
          onFocus?.(e);
          edit.start();
        }}
        onBlur={(e) => {
          onBlur?.(e);
          edit.end();
        }}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';
