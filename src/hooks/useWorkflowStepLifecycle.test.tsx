import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getAppState, resetAppStore } from '../test/store';
import type { WorkflowStep } from '../types/customUi';
import { useWorkflowStepLifecycle } from './useWorkflowStepLifecycle';

describe('direct state updates of a workflow step', () => {
  it('sets view state but not project data, which only undoable actions may change', () => {
    resetAppStore();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onEnter = { state: { showFootprints: true, exportRegions: ['x'] } };
    const step = { id: 'a', onEnter } as unknown as WorkflowStep;

    renderHook(() => useWorkflowStepLifecycle(step));

    expect(getAppState().showFootprints).toBe(true);
    expect(getAppState().exportRegions).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
