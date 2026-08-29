import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useResponsiveContainer } from './useResponsiveContainer';

describe('useResponsiveContainer', () => {
  let mockResizeObserverCallback: (entries: { contentRect: { width: number } }[]) => void;

  beforeEach(() => {
    class MockResizeObserver {
      constructor(callback: (entries: { contentRect: { width: number } }[]) => void) {
        mockResizeObserverCallback = callback;
      }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
  });

  function TestComponent({ compact = 500, normal = 800 }: { compact?: number; normal?: number }) {
    const { containerRef, tier, isCompact, isNormal, isWide } = useResponsiveContainer({ compact, normal });
    return (
      <div ref={containerRef} data-testid="container">
        <span data-testid="tier">{tier}</span>
        <span data-testid="isCompact">{isCompact ? 'yes' : 'no'}</span>
        <span data-testid="isNormal">{isNormal ? 'yes' : 'no'}</span>
        <span data-testid="isWide">{isWide ? 'yes' : 'no'}</span>
      </div>
    );
  }

  it('updates to compact tier when container width is small', () => {
    render(<TestComponent compact={500} normal={800} />);

    act(() => {
      mockResizeObserverCallback([{ contentRect: { width: 400 } }]);
    });

    expect(screen.getByTestId('tier').textContent).toBe('compact');
    expect(screen.getByTestId('isCompact').textContent).toBe('yes');
    expect(screen.getByTestId('isNormal').textContent).toBe('no');
    expect(screen.getByTestId('isWide').textContent).toBe('no');
  });

  it('updates to normal tier when container width is medium', () => {
    render(<TestComponent compact={500} normal={800} />);

    act(() => {
      mockResizeObserverCallback([{ contentRect: { width: 650 } }]);
    });

    expect(screen.getByTestId('tier').textContent).toBe('normal');
    expect(screen.getByTestId('isNormal').textContent).toBe('yes');
    expect(screen.getByTestId('isCompact').textContent).toBe('no');
    expect(screen.getByTestId('isWide').textContent).toBe('no');
  });

  it('updates to wide tier when container width is large', () => {
    render(<TestComponent compact={500} normal={800} />);

    act(() => {
      mockResizeObserverCallback([{ contentRect: { width: 950 } }]);
    });

    expect(screen.getByTestId('tier').textContent).toBe('wide');
    expect(screen.getByTestId('isWide').textContent).toBe('yes');
    expect(screen.getByTestId('isCompact').textContent).toBe('no');
    expect(screen.getByTestId('isNormal').textContent).toBe('no');
  });
});
