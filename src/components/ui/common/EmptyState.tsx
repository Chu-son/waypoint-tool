import { cn } from "../../../utils/cn";

interface EmptyStateProps {
  message: string;
  className?: string;
}

export function EmptyState({ message, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "text-center py-12 text-text-muted/60 text-sm bg-surface-panel/30 rounded-2xl border-2 border-dashed border-border-base/40 animate-pulse",
        className
      )}
    >
      {message}
    </div>
  );
}
