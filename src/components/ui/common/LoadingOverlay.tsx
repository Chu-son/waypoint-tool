import React from 'react';
import { useAppStore } from '../../../stores/appStore';
import { Loader2 } from 'lucide-react';
import { cn } from '../../../utils/cn';

interface LoadingOverlayProps {
  className?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ className }) => {
  const activeLoadingTasks = useAppStore((state) => state.activeLoadingTasks);

  const blockingTasks = Object.values(activeLoadingTasks).filter(
    (t) => t.blocking !== false
  );

  if (blockingTasks.length === 0) {
    return null;
  }

  // Get the most recent blocking task
  const currentTask = blockingTasks.sort((a, b) => b.createdAt - a.createdAt)[0];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={currentTask.message}
      className={cn(
        'fixed inset-0 bg-surface-base/60 backdrop-blur-sm z-50 flex items-center justify-center select-none pointer-events-auto animate-in fade-in duration-150',
        className
      )}
    >
      <div className="bg-surface-panel/95 border border-border-base/80 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-3 min-w-[280px] max-w-sm text-center">
        <Loader2 size={32} className="animate-spin text-primary-base" />
        <div className="space-y-1">
          <div className="text-sm font-semibold text-text-base">
            {currentTask.message}
          </div>
          {currentTask.detail && (
            <div className="text-xs text-text-muted">
              {currentTask.detail}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
