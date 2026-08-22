import { useEffect, useRef } from 'react';
import { useAppStore } from '../stores/appStore';
import { StepLifecycle, WorkflowStep } from '../types/customUi';
import { executeWorkflowAction } from '../utils/workflowActions';

async function applyStepLifecycle(lifecycle: StepLifecycle | undefined) {
  if (!lifecycle) return;

  // 1. Direct state updates
  if (lifecycle.state && Object.keys(lifecycle.state).length > 0) {
    useAppStore.setState(lifecycle.state);
  }

  // 2. Action invocations
  if (lifecycle.actions && Array.isArray(lifecycle.actions)) {
    for (const action of lifecycle.actions) {
      const actionName = typeof action === 'string' ? action : action.name;
      const actionArgs = typeof action === 'string' ? undefined : action.args;
      await executeWorkflowAction(actionName, actionArgs);
    }
  }
}

export function useWorkflowStepLifecycle(step: WorkflowStep | undefined) {
  const prevStepRef = useRef<WorkflowStep | undefined>(undefined);

  useEffect(() => {
    const prevStep = prevStepRef.current;

    // Apply onLeave of previous step
    if (prevStep && prevStep.id !== step?.id && prevStep.onLeave) {
      applyStepLifecycle(prevStep.onLeave);
    }

    // Apply onEnter of current step
    if (step) {
      // Auto-set target plugin if specified
      if (step.pluginTarget) {
        const store = useAppStore.getState();
        if (store.activePluginId !== step.pluginTarget) {
          store.setActivePlugin(step.pluginTarget);
        }
      }

      if (step.onEnter) {
        applyStepLifecycle(step.onEnter);
      }
    }

    prevStepRef.current = step;

    return () => {
      // Clean up current step on unmount
      if (step?.onLeave) {
        applyStepLifecycle(step.onLeave);
      }
    };
  }, [step?.id]);
}
