import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useStableCallback } from './useStableCallback';

describe('useStableCallback', () => {
  it('keeps the same function across renders while running the latest one', () => {
    const { result, rerender } = renderHook(({ suffix }) => useStableCallback((s: string) => s + suffix), {
      initialProps: { suffix: '-a' },
    });
    const first = result.current;
    expect(first('x')).toBe('x-a');

    rerender({ suffix: '-b' });

    expect(result.current).toBe(first);
    expect(first('x')).toBe('x-b');
  });
});
