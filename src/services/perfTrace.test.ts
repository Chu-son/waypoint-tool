import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTrace, megabytes } from './perfTrace';

describe('createTrace', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('records each stage with the time since the previous one and prints a table', () => {
    vi.useFakeTimers();
    const table = vi.spyOn(console, 'table').mockImplementation(() => {});
    vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    const clock = vi.spyOn(performance, 'now');
    clock.mockReturnValueOnce(100); // createTrace
    const trace = createTrace('test', true);
    clock.mockReturnValueOnce(130);
    trace.mark('first', 'a');
    clock.mockReturnValueOnce(190);
    trace.mark('second');
    clock.mockReturnValueOnce(200);

    const rows = trace.end();

    expect(rows).toEqual([
      { stage: 'first', ms: 30, detail: 'a' },
      { stage: 'second', ms: 60, detail: '' },
    ]);
    expect(table).toHaveBeenCalledWith(rows);
  });

  it('does nothing when disabled', () => {
    const table = vi.spyOn(console, 'table').mockImplementation(() => {});
    const trace = createTrace('test', false);

    trace.mark('ignored');

    expect(trace.end()).toEqual([]);
    expect(table).not.toHaveBeenCalled();
  });

  it('formats sizes in megabytes', () => {
    expect(megabytes(69_600_000)).toBe('69.6 MB');
  });
});
