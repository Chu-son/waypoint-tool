import React from 'react';
import { useAppStore } from '../../../stores/appStore';
import { Loader2 } from 'lucide-react';
import { cn } from '../../../utils/cn';

interface BackgroundLoadingBadgeProps {
  className?: string;
}

export const BackgroundLoadingBadge: React.FC<BackgroundLoadingBadgeProps> = ({ className }) => {
  const activeLoadingTasks = useAppStore((state) => state.activeLoadingTasks);

  const allTasks = Object.values(activeLoadingTasks);
  const hasBlocking = allTasks.some((t) => t.blocking !== false);
  const backgroundTasks = allTasks.filter((t) => t.blocking === false);

  // If a blocking task is running, the full-screen overlay is already visible
  if (hasBlocking || backgroundTasks.length === 0) {
    return null;
  }

  // Get the most recent background task
  const currentTask = backgroundTasks.sort((a, b) => b.createdAt - a.createdAt)[0];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={currentTask.message}
      className={cn(
        'absolute top-4 right-4 z-20 pointer-events-none select-none flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-panel/90 backdrop-blur-md border border-border-base text-text-base text-xs shadow-lg animate-in fade-in slide-in-from-top-2 duration-200',
        className
      )}
    >
      <Loader2 size={13} className="animate-spin text-primary-base flex-shrink-0" />
      <span className="font-medium truncate max-w-[200px]">
        {currentTask.message}
      </span>
    </div>
  );
};
