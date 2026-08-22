import { StateCreator } from 'zustand';
import { AppState } from '../appStore';

export type WorkflowSlice = {
  currentStepIndex: number;
  goToStep: (index: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  resetWorkflow: () => void;
};

export const createWorkflowSlice: StateCreator<AppState, [], [], WorkflowSlice> = (set, get) => ({
  currentStepIndex: 0,

  goToStep: (index: number) => {
    const { customUiConfig, isCustomUiMode } = get();
    const steps = isCustomUiMode && customUiConfig?.workflow?.steps ? customUiConfig.workflow.steps : [];
    if (steps.length > 0) {
      const clamped = Math.max(0, Math.min(index, steps.length - 1));
      set({ currentStepIndex: clamped });
    } else {
      set({ currentStepIndex: Math.max(0, index) });
    }
  },

  nextStep: () => {
    const { currentStepIndex, customUiConfig, isCustomUiMode } = get();
    const steps = isCustomUiMode && customUiConfig?.workflow?.steps ? customUiConfig.workflow.steps : [];
    if (currentStepIndex < steps.length - 1) {
      set({ currentStepIndex: currentStepIndex + 1 });
    }
  },

  prevStep: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex > 0) {
      set({ currentStepIndex: currentStepIndex - 1 });
    }
  },

  resetWorkflow: () => set({ currentStepIndex: 0 }),
});
