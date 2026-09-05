import { cn } from "../../../utils/cn";

interface EmptyStateProps {
  message: string;
  className?: string;
}

export function EmptyState({ message, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "text-center py-8 px-4 text-text-muted text-xs bg-surface-panel/20 rounded-lg border border-border-base",
        className
      )}
    >
      {message}
    </div>
  );
}
