import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PoseAdjuster } from './PoseAdjuster';

function setup() {
  const onNudge = vi.fn();
  const onEditStart = vi.fn();
  const onEditEnd = vi.fn();
  render(<PoseAdjuster onNudge={onNudge} onEditStart={onEditStart} onEditEnd={onEditEnd} />);
  return { onNudge, onEditStart, onEditEnd, pad: screen.getByRole('group', { name: 'Pose adjuster' }) };
}

describe('PoseAdjuster', () => {
  it('moves along the screen directions with the arrow buttons (up is +Y)', () => {
    const { onNudge } = setup();

    fireEvent.click(screen.getByRole('button', { name: /Move up/ }));
    fireEvent.click(screen.getByRole('button', { name: /Move down/ }));
    fireEvent.click(screen.getByRole('button', { name: /Move left/ }));
    fireEvent.click(screen.getByRole('button', { name: /Move right/ }));

    expect(onNudge.mock.calls.map(([n]) => n)).toEqual([
      { dx: 0, dy: 0.1, dyawDeg: 0 },
      { dx: 0, dy: -0.1, dyawDeg: 0 },
      { dx: -0.1, dy: 0, dyawDeg: 0 },
      { dx: 0.1, dy: 0, dyawDeg: 0 },
    ]);
  });

  it('rotates counter-clockwise as positive yaw', () => {
    const { onNudge } = setup();

    fireEvent.click(screen.getByRole('button', { name: /counter-clockwise/ }));
    fireEvent.click(screen.getByRole('button', { name: /Rotate clockwise/ }));

    expect(onNudge.mock.calls.map(([n]) => n)).toEqual([
      { dx: 0, dy: 0, dyawDeg: 1 },
      { dx: 0, dy: 0, dyawDeg: -1 },
    ]);
  });

  it('changes the step size with the presets', () => {
    const { onNudge } = setup();

    fireEvent.click(screen.getByRole('button', { name: /Coarse/ }));
    fireEvent.click(screen.getByRole('button', { name: /Move right/ }));
    fireEvent.click(screen.getByRole('button', { name: /Fine/ }));
    fireEvent.click(screen.getByRole('button', { name: /Move right/ }));
    fireEvent.click(screen.getByRole('button', { name: /counter-clockwise/ }));

    expect(onNudge.mock.calls.map(([n]) => n)).toEqual([
      { dx: 1, dy: 0, dyawDeg: 0 },
      { dx: 0.01, dy: 0, dyawDeg: 0 },
      { dx: 0, dy: 0, dyawDeg: 0.1 },
    ]);
  });

  it('moves with arrow keys and rotates with Q / E while focused, with Shift and Alt scaling the step', () => {
    const { onNudge, pad } = setup();

    fireEvent.keyDown(pad, { key: 'ArrowRight' });
    fireEvent.keyDown(pad, { key: 'ArrowUp', shiftKey: true });
    fireEvent.keyDown(pad, { key: 'ArrowLeft', altKey: true });
    fireEvent.keyDown(pad, { key: 'q' });
    fireEvent.keyDown(pad, { key: 'E' });

    expect(onNudge.mock.calls.map(([n]) => n)).toEqual([
      { dx: 0.1, dy: 0, dyawDeg: 0 },
      { dx: 0, dy: 1, dyawDeg: 0 },
      { dx: -0.01, dy: 0, dyawDeg: 0 },
      { dx: 0, dy: 0, dyawDeg: 1 },
      { dx: 0, dy: 0, dyawDeg: -1 },
    ]);
  });

  it('ignores unrelated keys and keys held with Ctrl', () => {
    const { onNudge, pad } = setup();

    fireEvent.keyDown(pad, { key: 'a' });
    fireEvent.keyDown(pad, { key: 'ArrowUp', ctrlKey: true });

    expect(onNudge).not.toHaveBeenCalled();
  });

  it('groups a key hold into one edit session', () => {
    const { onEditStart, onEditEnd, pad } = setup();

    fireEvent.keyDown(pad, { key: 'ArrowUp' });
    fireEvent.keyDown(pad, { key: 'ArrowUp', repeat: true });
    fireEvent.keyDown(pad, { key: 'ArrowUp', repeat: true });
    expect(onEditStart).toHaveBeenCalledTimes(1);
    expect(onEditEnd).not.toHaveBeenCalled();

    fireEvent.keyUp(pad, { key: 'ArrowUp' });
    expect(onEditEnd).toHaveBeenCalledTimes(1);
  });

  it('repeats while a button is held and stops on release', () => {
    vi.useFakeTimers();
    try {
      const { onNudge, onEditStart, onEditEnd } = setup();
      const right = screen.getByRole('button', { name: /Move right/ });

      fireEvent.pointerDown(right, { button: 0 });
      expect(onNudge).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(400 + 60 * 3);
      expect(onNudge.mock.calls.length).toBeGreaterThan(2);

      fireEvent.pointerUp(right);
      const callsAtRelease = onNudge.mock.calls.length;
      vi.advanceTimersByTime(1000);
      expect(onNudge).toHaveBeenCalledTimes(callsAtRelease);
      expect(onEditStart).toHaveBeenCalledTimes(1);
      expect(onEditEnd).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
