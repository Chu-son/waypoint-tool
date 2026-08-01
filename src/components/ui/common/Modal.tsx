import * as React from "react";
import { X } from "lucide-react";
import { cn } from "../../../utils/cn";
import { Panel } from "./Panel";

export interface ModalProps extends React.HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
  onClose: () => void;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
}

const sizeVariants = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl w-[90vw]",
  "2xl": "max-w-4xl w-[90vw]",
  full: "max-w-[95vw] w-full",
};

export function Modal({ 
  isOpen, 
  onClose, 
  size = "md",
  children, 
  className, 
  ...props 
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-surface-base/80 backdrop-blur-sm animate-in fade-in duration-200" 
        onClick={onClose}
      />
      
      {/* Content */}
      <Panel
        className={cn(
          "relative w-full flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 shadow-2xl",
          sizeVariants[size],
          className
        )}
        variant="overlay"
        {...props}
      >
        {children}
      </Panel>
    </div>
  );
}

export interface ModalHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  onClose?: () => void;
  icon?: React.ReactNode;
  title?: string;
}

export function ModalHeader({ className, onClose, icon, title, children, ...props }: ModalHeaderProps) {
  return (
    <div
      className={cn("px-6 py-4 border-b border-border-base flex items-center justify-between bg-surface-base/30", className)}
      {...props}
    >
      <div className="text-lg font-bold text-text-base flex items-center gap-2">
        {icon && <span className="flex items-center shrink-0">{icon}</span>}
        {title ? <span>{title}</span> : children}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-text-muted hover:text-text-base hover:bg-surface-hover p-1.5 rounded-lg transition-all"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      )}
    </div>
  );
}

export function ModalContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("px-6 py-4 overflow-y-auto flex-1", className)}
      {...props}
    />
  );
}

export function ModalFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("px-6 py-4 border-t border-border-base flex justify-end gap-3 bg-surface-base/20", className)}
      {...props}
    />
  );
}
