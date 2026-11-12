import { useEffect, useRef } from 'react';
import { useAppStore } from '../stores/appStore';
import { HISTORY_FIELDS } from '../stores/history/historyModel';
import { StepLifecycle, WorkflowStep } from '../types/customUi';
import { executeWorkflowAction } from '../services/workflowActions';

/**
 * A step's direct state updates may set view state and settings only. Project data has to change through
 * `actions`, which record undo steps; written directly it would silently disappear on the next undo.
 */
function withoutUndoableValues(state: Record<string, unknown>): Record<string, unknown> {
  const allowed = Object.entries(state).filter(([key]) => !(key in HISTORY_FIELDS));
  if (allowed.length < Object.keys(state).length) {
    console.warn('Workflow lifecycle "state" cannot set undoable project data; use "actions". Ignored those keys.');
  }
  return Object.fromEntries(allowed);
}

async function applyStepLifecycle(lifecycle: StepLifecycle | undefined) {
  if (!lifecycle) return;

  // 1. Direct state updates
  if (lifecycle.state && Object.keys(lifecycle.state).length > 0) {
    useAppStore.setState(withoutUndoableValues(lifecycle.state));
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
      const store = useAppStore.getState();
      // Auto-exit annotation edit mode when moving between steps
      store.setAnnotationEditMode(false);

      // Auto-set target plugin and add_generator tool if specified
      if (step.pluginTarget || step.showPluginInputs) {
        if (step.pluginTarget && store.activePluginId !== step.pluginTarget) {
          store.setActivePlugin(step.pluginTarget);
        }
        store.setActiveTool('add_generator');
        store.setActiveInputIndex(0);
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
