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
  sm: "max-w-sm w-full",
  md: "max-w-md w-full",
  lg: "max-w-lg w-full",
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
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-surface-base/80 backdrop-blur-sm animate-in fade-in duration-200" 
        onClick={onClose}
      />
      
      {/* Content */}
      <Panel
        className={cn(
          "relative w-full flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 shadow-2xl rounded-xl border border-border-base",
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
      className={cn("px-4 sm:px-6 py-3 sm:py-4 border-b border-border-base flex items-center justify-between bg-surface-base/30 shrink-0", className)}
      {...props}
    >
      <div className="text-base sm:text-lg font-bold text-text-base flex items-center gap-2 min-w-0">
        {icon && <span className="flex items-center shrink-0">{icon}</span>}
        {title ? <span className="truncate">{title}</span> : children}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-text-muted hover:text-text-base hover:bg-surface-hover p-1.5 rounded-lg transition-all shrink-0 ml-2"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}

export function ModalContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("px-4 sm:px-6 py-3 sm:py-4 overflow-y-auto flex-1", className)}
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
