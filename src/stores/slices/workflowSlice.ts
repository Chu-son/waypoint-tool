import { StateCreator } from 'zustand';
import { AppState } from '../appStore';

export type WorkflowState = {
  currentStepIndex: number;
  maxReachedStepIndex: number;
  workflowVariables: Record<string, any>;
  stepExecutionIds: Record<string, string>;
};

export type WorkflowSlice = {
  currentStepIndex: number;
  maxReachedStepIndex: number;
  workflowVariables: Record<string, any>;
  stepExecutionIds: Record<string, string>;
  goToStep: (index: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  resetWorkflow: () => void;
  setWorkflowVariable: (key: string, value: any) => void;
  setWorkflowVariables: (variables: Record<string, any>) => void;
  setStepExecutionId: (stepId: string, executionId: string) => void;
  setWorkflowState: (state: Partial<WorkflowState>) => void;
};

export const createWorkflowSlice: StateCreator<AppState, [], [], WorkflowSlice> = (set, get) => ({
  currentStepIndex: 0,
  maxReachedStepIndex: 0,
  workflowVariables: {},
  stepExecutionIds: {},

  goToStep: (index: number) => {
    const { customUiConfig, isCustomUiMode, maxReachedStepIndex } = get();
    const steps = isCustomUiMode && customUiConfig?.workflow?.steps ? customUiConfig.workflow.steps : [];
    const target = steps.length > 0 ? Math.max(0, Math.min(index, steps.length - 1)) : Math.max(0, index);
    set({
      currentStepIndex: target,
      maxReachedStepIndex: Math.max(maxReachedStepIndex, target),
      isAnnotationEditMode: false,
    });
  },

  nextStep: () => {
    const { currentStepIndex, customUiConfig, isCustomUiMode, maxReachedStepIndex } = get();
    const steps = isCustomUiMode && customUiConfig?.workflow?.steps ? customUiConfig.workflow.steps : [];
    if (currentStepIndex < steps.length - 1) {
      const nextIdx = currentStepIndex + 1;
      set({
        currentStepIndex: nextIdx,
        maxReachedStepIndex: Math.max(maxReachedStepIndex, nextIdx),
        isAnnotationEditMode: false,
      });
    }
  },

  prevStep: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex > 0) {
      set({
        currentStepIndex: currentStepIndex - 1,
        isAnnotationEditMode: false,
      });
    }
  },

  resetWorkflow: () => set({
    currentStepIndex: 0,
    maxReachedStepIndex: 0,
    workflowVariables: {},
    stepExecutionIds: {},
    isAnnotationEditMode: false,
  }),

  setWorkflowVariable: (key: string, value: any) => set((state) => ({
    workflowVariables: {
      ...state.workflowVariables,
      [key]: value,
    },
    isDirty: true,
  })),

  setWorkflowVariables: (variables: Record<string, any>) => set((state) => ({
    workflowVariables: {
      ...state.workflowVariables,
      ...variables,
    },
    isDirty: true,
  })),

  setStepExecutionId: (stepId: string, executionId: string) => set((state) => ({
    stepExecutionIds: {
      ...state.stepExecutionIds,
      [stepId]: executionId,
    },
    isDirty: true,
  })),

  setWorkflowState: (incomingState: Partial<WorkflowState>) => set((state) => ({
    currentStepIndex: incomingState.currentStepIndex ?? state.currentStepIndex,
    maxReachedStepIndex: incomingState.maxReachedStepIndex ?? state.maxReachedStepIndex,
    workflowVariables: incomingState.workflowVariables
      ? { ...state.workflowVariables, ...incomingState.workflowVariables }
      : state.workflowVariables,
    stepExecutionIds: incomingState.stepExecutionIds
      ? { ...state.stepExecutionIds, ...incomingState.stepExecutionIds }
      : state.stepExecutionIds,
  })),
});
