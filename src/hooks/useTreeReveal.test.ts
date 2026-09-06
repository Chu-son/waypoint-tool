import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTreeReveal } from './useTreeReveal';
import { useAppStore } from '../stores/appStore';

describe('useTreeReveal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useAppStore.setState({ treeRevealTarget: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing when treeRevealTarget is null or type does not match', () => {
    const setExpanded = vi.fn();
    const getAncestorIds = vi.fn().mockReturnValue(['grp-1']);

    useAppStore.setState({ treeRevealTarget: { type: 'annotation', id: 'annot-1', timestamp: 123 } });

    renderHook(() =>
      useTreeReveal({
        treeType: 'node',
        getAncestorIds,
        setExpanded,
      })
    );

    expect(getAncestorIds).not.toHaveBeenCalled();
    expect(setExpanded).not.toHaveBeenCalled();
  });

  it('expands ancestors and scrolls to element when treeRevealTarget matches', () => {
    let expandedSet = new Set<string>();
    const setExpanded = vi.fn((updater) => {
      if (typeof updater === 'function') {
        expandedSet = updater(expandedSet);
      }
    });
    const getAncestorIds = vi.fn().mockReturnValue(['top-grp', 'sub-grp']);

    // Mock DOM element
    const scrollIntoViewMock = vi.fn();
    const mockElement = document.createElement('div');
    mockElement.setAttribute('data-tree-item-id', 'wp-target');
    mockElement.scrollIntoView = scrollIntoViewMock;
    document.body.appendChild(mockElement);

    useAppStore.setState({
      treeRevealTarget: { type: 'node', id: 'wp-target', timestamp: 456 },
    });

    const { result } = renderHook(() =>
      useTreeReveal({
        treeType: 'node',
        getAncestorIds,
        setExpanded,
        scrollDelayMs: 50,
        flashDurationMs: 1000,
      })
    );

    expect(getAncestorIds).toHaveBeenCalledWith('wp-target');
    expect(expandedSet.has('top-grp')).toBe(true);
    expect(expandedSet.has('sub-grp')).toBe(true);

    // Fast-forward scroll timer
    act(() => {
      vi.advanceTimersByTime(60);
    });

    expect(useAppStore.getState().treeRevealTarget).toBeNull();
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' });
    expect(result.current.flashingId).toBe('wp-target');

    // Fast-forward flash timer
    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(result.current.flashingId).toBeNull();

    document.body.removeChild(mockElement);
  });
});
