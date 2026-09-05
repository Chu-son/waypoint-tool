import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSnapping } from './useSnapping';
import { useAppStore } from '../../../stores/appStore';

describe('useSnapping', () => {
  beforeEach(() => {
    useAppStore.getState().resetProject();
    useAppStore.setState({
      activeTool: 'add_point',
      appMode: {
        mode: 'waypoint_add',
        snapInput: '',
        lockedWaypointId: null,
        forcedAxis: null,
        forcedSign: null,
      },
      nodes: {
        'wp-1': {
          id: 'wp-1',
          type: 'manual',
          transform: { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
        },
      },
      rootNodeIds: ['wp-1'],
    });
  });

  describe('Focus Guard for Input Elements', () => {
    it('never hijacks keydown events when an HTMLInputElement has focus', () => {
      const interactionMode = { current: 'none' };
      const activeNodeId = { current: null };

      const { result } = renderHook(() => {
        const snapping = useSnapping({ scale: 1, enableSnapping: true });
        snapping.useSnappingKeyboardEvents(interactionMode, activeNodeId);
        return snapping;
      });

      // Set snapState so that snapping would otherwise be active
      act(() => {
        result.current.setSnapState(prev => ({
          ...prev,
          lockedWaypointId: 'wp-1',
          isSnapped: true,
          axis: 'X',
        }));
      });

      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      const backspaceEvent = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
      const stopPropSpy = vi.spyOn(backspaceEvent, 'stopPropagation');
      const prevDefSpy = vi.spyOn(backspaceEvent, 'preventDefault');

      input.dispatchEvent(backspaceEvent);

      expect(stopPropSpy).not.toHaveBeenCalled();
      expect(prevDefSpy).not.toHaveBeenCalled();
      expect(result.current.snapInput).toBe('');

      // Test digit key
      const digitEvent = new KeyboardEvent('keydown', { key: '5', bubbles: true, cancelable: true });
      input.dispatchEvent(digitEvent);

      expect(result.current.snapInput).toBe('');

      document.body.removeChild(input);
    });

    it('never hijacks keydown events when an HTMLTextAreaElement has focus', () => {
      const interactionMode = { current: 'none' };
      const activeNodeId = { current: null };

      const { result } = renderHook(() => {
        const snapping = useSnapping({ scale: 1, enableSnapping: true });
        snapping.useSnappingKeyboardEvents(interactionMode, activeNodeId);
        return snapping;
      });

      act(() => {
        result.current.setSnapState(prev => ({
          ...prev,
          lockedWaypointId: 'wp-1',
          isSnapped: true,
          axis: 'X',
        }));
      });

      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      textarea.focus();

      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      const prevDefSpy = vi.spyOn(tabEvent, 'preventDefault');

      textarea.dispatchEvent(tabEvent);

      expect(prevDefSpy).not.toHaveBeenCalled();
      document.body.removeChild(textarea);
    });

    it('never hijacks keydown events when an element with isContentEditable has focus', () => {
      const interactionMode = { current: 'none' };
      const activeNodeId = { current: null };

      const { result } = renderHook(() => {
        const snapping = useSnapping({ scale: 1, enableSnapping: true });
        snapping.useSnappingKeyboardEvents(interactionMode, activeNodeId);
        return snapping;
      });

      act(() => {
        result.current.setSnapState(prev => ({
          ...prev,
          lockedWaypointId: 'wp-1',
          isSnapped: true,
          axis: 'X',
        }));
      });

      const editableDiv = document.createElement('div');
      editableDiv.contentEditable = 'true';
      document.body.appendChild(editableDiv);
      editableDiv.focus();

      const arrowEvent = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true });
      const prevDefSpy = vi.spyOn(arrowEvent, 'preventDefault');

      editableDiv.dispatchEvent(arrowEvent);

      expect(prevDefSpy).not.toHaveBeenCalled();
      document.body.removeChild(editableDiv);
    });
  });

  describe('Keyboard Snapping when Not in Input', () => {
    it('records digits into snapInput when snapState is locked', () => {
      const interactionMode = { current: 'none' };
      const activeNodeId = { current: null };

      const { result } = renderHook(() => {
        const snapping = useSnapping({ scale: 1, enableSnapping: true });
        snapping.useSnappingKeyboardEvents(interactionMode, activeNodeId);
        return snapping;
      });

      act(() => {
        result.current.setSnapState(prev => ({
          ...prev,
          lockedWaypointId: 'wp-1',
          isSnapped: true,
          axis: 'X',
        }));
      });

      // Focus body (not an input element)
      document.body.focus();

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
      });
      expect(result.current.snapInput).toBe('1');

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }));
      });
      expect(result.current.snapInput).toBe('12');

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));
      });
      expect(result.current.snapInput).toBe('1');
    });

    it('sets forcedAxis on arrow keys when snapInput has a value', () => {
      const interactionMode = { current: 'none' };
      const activeNodeId = { current: null };

      const { result } = renderHook(() => {
        const snapping = useSnapping({ scale: 1, enableSnapping: true });
        snapping.useSnappingKeyboardEvents(interactionMode, activeNodeId);
        return snapping;
      });

      act(() => {
        result.current.setSnapState(prev => ({
          ...prev,
          lockedWaypointId: 'wp-1',
          isSnapped: true,
          axis: 'X',
        }));
      });

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '5', bubbles: true }));
      });
      expect(result.current.snapInput).toBe('5');

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
      });

      expect(result.current.snapState.forcedAxis).toBe('X');
      expect(result.current.snapState.forcedSign).toBe(1);
    });
  });
});
