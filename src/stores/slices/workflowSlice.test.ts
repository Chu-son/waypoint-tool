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

  it('should navigate through steps correctly', () => {
    expect(useAppStore.getState().currentStepIndex).toBe(0);

    useAppStore.getState().nextStep();
    expect(useAppStore.getState().currentStepIndex).toBe(1);

    useAppStore.getState().nextStep();
    expect(useAppStore.getState().currentStepIndex).toBe(2);

    // Cannot advance past last step
    useAppStore.getState().nextStep();
    expect(useAppStore.getState().currentStepIndex).toBe(2);

    useAppStore.getState().prevStep();
    expect(useAppStore.getState().currentStepIndex).toBe(1);

    useAppStore.getState().goToStep(0);
    expect(useAppStore.getState().currentStepIndex).toBe(0);

    useAppStore.getState().resetWorkflow();
    expect(useAppStore.getState().currentStepIndex).toBe(0);
  });
});
