import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../appStore';

describe('workflowSlice', () => {
  beforeEach(() => {
    useAppStore.setState({
      currentStepIndex: 0,
      customUiConfig: {
        workflow: {
          id: 'test_flow',
          title: 'Test Workflow',
          steps: [
            { id: 's1', title: 'Step 1' },
            { id: 's2', title: 'Step 2' },
            { id: 's3', title: 'Step 3' },
          ],
        },
      },
      isCustomUiMode: true,
    });
  });

  it('should navigate through steps and track maxReachedStepIndex correctly', () => {
    expect(useAppStore.getState().currentStepIndex).toBe(0);
    expect(useAppStore.getState().maxReachedStepIndex).toBe(0);

    useAppStore.getState().nextStep();
    expect(useAppStore.getState().currentStepIndex).toBe(1);
    expect(useAppStore.getState().maxReachedStepIndex).toBe(1);

    useAppStore.getState().nextStep();
    expect(useAppStore.getState().currentStepIndex).toBe(2);
    expect(useAppStore.getState().maxReachedStepIndex).toBe(2);

    // Going backward preserves maxReachedStepIndex
    useAppStore.getState().prevStep();
    expect(useAppStore.getState().currentStepIndex).toBe(1);
    expect(useAppStore.getState().maxReachedStepIndex).toBe(2);

    useAppStore.getState().goToStep(0);
    expect(useAppStore.getState().currentStepIndex).toBe(0);
    expect(useAppStore.getState().maxReachedStepIndex).toBe(2);

    // Reset clears everything
    useAppStore.getState().resetWorkflow();
    expect(useAppStore.getState().currentStepIndex).toBe(0);
    expect(useAppStore.getState().maxReachedStepIndex).toBe(0);
  });

  it('should store and update workflow variables', () => {
    useAppStore.getState().setWorkflowVariable('testVar', 'val1');
    expect(useAppStore.getState().workflowVariables['testVar']).toBe('val1');

    useAppStore.getState().setWorkflowVariables({ a: 1, b: 2 });
    expect(useAppStore.getState().workflowVariables).toEqual({
      testVar: 'val1',
      a: 1,
      b: 2,
    });
  });

  it('should store stepExecutionIds and restore entire workflow state', () => {
    useAppStore.getState().setStepExecutionId('step_1', 'exec_123');
    expect(useAppStore.getState().stepExecutionIds['step_1']).toBe('exec_123');

    useAppStore.getState().setWorkflowState({
      currentStepIndex: 2,
      maxReachedStepIndex: 2,
      workflowVariables: { loadedVar: 'yes' },
      stepExecutionIds: { step_2: 'exec_456' },
    });

    const state = useAppStore.getState();
    expect(state.currentStepIndex).toBe(2);
    expect(state.maxReachedStepIndex).toBe(2);
    expect(state.workflowVariables['loadedVar']).toBe('yes');
    expect(state.stepExecutionIds['step_2']).toBe('exec_456');
  });
});
