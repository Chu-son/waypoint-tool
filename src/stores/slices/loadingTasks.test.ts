import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../appStore';

describe('Loading Tasks (uiSlice)', () => {
  beforeEach(() => {
    // Reset loading tasks
    useAppStore.setState({ activeLoadingTasks: {} });
  });

  it('starts and stops a loading task', () => {
    const taskId = useAppStore.getState().startLoading({
      id: 'task-1',
      message: 'Processing...',
      detail: 'Step 1 of 2',
      blocking: true,
    });

    expect(taskId).toBe('task-1');
    const tasks = useAppStore.getState().activeLoadingTasks;
    expect(tasks['task-1']).toBeDefined();
    expect(tasks['task-1'].message).toBe('Processing...');
    expect(tasks['task-1'].detail).toBe('Step 1 of 2');
    expect(tasks['task-1'].blocking).toBe(true);

    useAppStore.getState().stopLoading('task-1');
    expect(useAppStore.getState().activeLoadingTasks['task-1']).toBeUndefined();
  });

  it('generates an id if not provided', () => {
    const taskId = useAppStore.getState().startLoading({
      message: 'Generating preview...',
    });

    expect(taskId).toBeDefined();
    expect(typeof taskId).toBe('string');
    const task = useAppStore.getState().activeLoadingTasks[taskId];
    expect(task).toBeDefined();
    expect(task.blocking).toBe(true); // default is true
  });

  it('correctly sets blocking=false for background tasks', () => {
    const taskId = useAppStore.getState().startLoading({
      id: 'bg-task',
      message: 'Calculating path...',
      blocking: false,
    });

    const task = useAppStore.getState().activeLoadingTasks[taskId];
    expect(task.blocking).toBe(false);
  });

  it('runs async task with runWithLoading and cleans up on success', async () => {
    let executed = false;
    const result = await useAppStore.getState().runWithLoading(
      { id: 'async-task', message: 'Running...' },
      async () => {
        executed = true;
        expect(useAppStore.getState().activeLoadingTasks['async-task']).toBeDefined();
        return 'success';
      }
    );

    expect(executed).toBe(true);
    expect(result).toBe('success');
    expect(useAppStore.getState().activeLoadingTasks['async-task']).toBeUndefined();
  });

  it('cleans up task with runWithLoading even when an error occurs', async () => {
    let errorThrown = false;
    try {
      await useAppStore.getState().runWithLoading(
        { id: 'error-task', message: 'Failing...' },
        async () => {
          throw new Error('Something went wrong');
        }
      );
    } catch (err: any) {
      errorThrown = true;
      expect(err.message).toBe('Something went wrong');
    }

    expect(errorThrown).toBe(true);
    expect(useAppStore.getState().activeLoadingTasks['error-task']).toBeUndefined();
  });
});
