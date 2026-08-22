import { useAppStore } from '../../stores/appStore';
import { useWorkflowStepLifecycle } from '../../hooks/useWorkflowStepLifecycle';
import { SimplifiedControls } from './workflow/SimplifiedControls';
import { Button } from './common/Button';
import { EmptyState } from './common/EmptyState';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, ListOrdered } from 'lucide-react';
import { cn } from '../../utils/cn';

export function WorkflowPanel() {
  const customUiConfig = useAppStore((state) => state.customUiConfig);
  const isCustomUiMode = useAppStore((state) => state.isCustomUiMode);
  const currentStepIndex = useAppStore((state) => state.currentStepIndex);
  const goToStep = useAppStore((state) => state.goToStep);
  const nextStep = useAppStore((state) => state.nextStep);
  const prevStep = useAppStore((state) => state.prevStep);

  const workflow = isCustomUiMode ? customUiConfig?.workflow : undefined;
  const steps = workflow?.steps || [];
  const currentStep = steps[currentStepIndex];

  // Run lifecycle hooks on step changes
  useWorkflowStepLifecycle(currentStep);

  if (!workflow || steps.length === 0) {
    return (
      <div className="p-4 h-full flex flex-col justify-center">
        <EmptyState message="ワークフローが設定されていません。" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-surface-panel/30">
      {/* Header */}
      <div className="p-3 border-b border-border-base/50 bg-surface-panel/60">
        <div className="flex items-center gap-2">
          <ListOrdered size={16} className="text-primary-base" />
          <h2 className="text-sm font-bold text-text-base truncate">{workflow.title}</h2>
        </div>
        <div className="text-[11px] text-text-muted mt-0.5">
          ステップ {currentStepIndex + 1} / {steps.length}
        </div>
      </div>

      {/* Steps Progress List */}
      <div className="px-3 py-2 border-b border-border-base/40 max-h-48 overflow-y-auto space-y-1 bg-surface-base/30">
        {steps.map((step, idx) => {
          const isActive = idx === currentStepIndex;
          const isPassed = idx < currentStepIndex;

          return (
            <button
              key={step.id || idx}
              onClick={() => goToStep(idx)}
              className={cn(
                "w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-all cursor-pointer",
                isActive
                  ? "bg-primary-base text-white font-bold shadow-sm"
                  : isPassed
                  ? "text-text-base hover:bg-surface-hover/80"
                  : "text-text-muted hover:bg-surface-hover/50"
              )}
            >
              {isPassed ? (
                <CheckCircle2 size={14} className={isActive ? "text-white" : "text-primary-base shrink-0"} />
              ) : (
                <Circle size={14} className={isActive ? "text-white" : "text-text-muted/60 shrink-0"} />
              )}
              <span className="truncate flex-1">{step.title}</span>
            </button>
          );
        })}
      </div>

      {/* Active Step Content Card */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-between space-y-4">
        <div className="space-y-3">
          <div className="border-b border-border-base/40 pb-2">
            <h3 className="text-base font-bold text-text-base">{currentStep.title}</h3>
            {currentStep.description && (
              <p className="text-xs text-text-muted mt-1 leading-relaxed whitespace-pre-wrap">
                {currentStep.description}
              </p>
            )}
          </div>

          {/* Simplified Controls & Action Button */}
          <SimplifiedControls
            controls={currentStep.controls}
            simplifiedParams={currentStep.simplifiedParams}
            actionButton={currentStep.actionButton}
            pluginTarget={currentStep.pluginTarget}
          />
        </div>

        {/* Navigation Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-border-base/40 mt-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={prevStep}
            disabled={currentStepIndex === 0}
            className="gap-1"
          >
            <ChevronLeft size={14} /> 前へ
          </Button>

          <span className="text-[11px] font-mono text-text-muted">
            {currentStepIndex + 1} of {steps.length}
          </span>

          <Button
            variant="secondary"
            size="sm"
            onClick={nextStep}
            disabled={currentStepIndex === steps.length - 1}
            className="gap-1"
          >
            次へ <ChevronRight size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
