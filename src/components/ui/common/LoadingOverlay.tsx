import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../../stores/appStore';
import { Loader2 } from 'lucide-react';
import { cn } from '../../../utils/cn';

interface LoadingOverlayProps {
  className?: string;
}

/** Elapsed time is only shown once a task has been running this long, so quick tasks do not flicker. */
const ELAPSED_VISIBLE_AFTER_SECONDS = 3;

const ElapsedTime: React.FC<{ since: number }> = ({ since }) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const seconds = Math.floor((now - since) / 1000);
  if (seconds < ELAPSED_VISIBLE_AFTER_SECONDS) return null;
  return <div className="text-[11px] text-text-muted tabular-nums">{seconds} 秒経過</div>;
};

/**
 * Full-screen overlay for the most recent blocking loading task. It is rendered into `document.body`
 * above the modals (which are portaled there too), so work started from inside a modal is visible.
 */
export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ className }) => {
  const activeLoadingTasks = useAppStore((state) => state.activeLoadingTasks);

  const blockingTasks = Object.values(activeLoadingTasks).filter((t) => t.blocking !== false);

  if (blockingTasks.length === 0) {
    return null;
  }

  // Get the most recent blocking task
  const currentTask = blockingTasks.sort((a, b) => b.createdAt - a.createdAt)[0];

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      aria-label={currentTask.message}
      className={cn(
        'fixed inset-0 bg-surface-base/60 backdrop-blur-sm z-[60] flex items-center justify-center select-none pointer-events-auto animate-in fade-in duration-150',
        className,
      )}
    >
      <div className="bg-surface-panel/95 border border-border-base/80 rounded-xl p-6 shadow-2xl flex flex-col items-center gap-3 min-w-[280px] max-w-sm text-center">
        <Loader2 size={32} className="animate-spin text-primary-base" />
        <div className="space-y-1">
          <div className="text-sm font-semibold text-text-base">{currentTask.message}</div>
          {currentTask.detail && (
            <div className="text-xs text-text-muted whitespace-pre-line">{currentTask.detail}</div>
          )}
          <ElapsedTime key={currentTask.id} since={currentTask.createdAt} />
        </div>
      </div>
    </div>,
    document.body,
  );
};
