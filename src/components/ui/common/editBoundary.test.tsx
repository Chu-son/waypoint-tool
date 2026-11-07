/**
 * The `onEditStart` / `onEditEnd` convention of the input components, wired to the undo history with
 * `historyEditHandlers`: one drag or one typing session is one undo step, and an edit cut short by
 * unmounting does not leave a transaction open.
 */
import { act, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useAppStore } from '../../../stores/appStore';
import { historyEditHandlers } from '../../../stores/history/historyEditHandlers';
import { renderWithStore } from '../../../test/render';
import { getAppState } from '../../../test/store';
import { makeTransform, makeWaypoint, waypointTree } from '../../../test/fixtures';
import { Input } from './Input';
import { NumericInput } from './NumericInput';
import { PoseAdjuster } from './PoseAdjuster';
import { Slider } from './Slider';

const oneWaypoint = () => waypointTree([makeWaypoint('a', { name: 'start', transform: makeTransform(0, 0) })]);

const setX = (x: number) => getAppState().updateNode('a', { transform: makeTransform(x, 0) });
const xOf = () => getAppState().nodes.a.transform?.x;

function XSlider() {
  const x = useAppStore((s) => s.nodes.a.transform?.x ?? 0);
  return (
    <Slider
      aria-label="x"
      min={0}
      max={100}
      value={x}
      onChange={(e) => setX(Number(e.target.value))}
      {...historyEditHandlers}
    />
  );
}

function NameInput() {
  const name = useAppStore((s) => s.nodes.a.name ?? '');
  return (
    <Input
      aria-label="name"
      value={name}
      onChange={(e) => getAppState().updateNode('a', { name: e.target.value })}
      {...historyEditHandlers}
    />
  );
}

const expectNoOpenTransaction = () => expect(getAppState().historyTransactionDepth).toBe(0);

describe('input components and the undo history', () => {
  it('undoes a whole slider drag in one step, wherever the pointer is released', () => {
    renderWithStore(<XSlider />, oneWaypoint());
    const slider = screen.getByLabelText('x');

    fireEvent.pointerDown(slider, { button: 0 });
    fireEvent.change(slider, { target: { value: '10' } });
    fireEvent.change(slider, { target: { value: '30' } });
    fireEvent.pointerUp(window);

    expect(xOf()).toBe(30);
    expect(getAppState().historyPast).toHaveLength(1);
    act(() => getAppState().undo());
    expect(xOf()).toBe(0);
  });

  it('undoes everything typed between focus and blur in one step', () => {
    renderWithStore(<NameInput />, oneWaypoint());
    const input = screen.getByLabelText('name');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'e' } });
    fireEvent.change(input, { target: { value: 'end' } });
    fireEvent.blur(input);

    expect(getAppState().historyPast).toHaveLength(1);
    act(() => getAppState().undo());
    expect(getAppState().nodes.a.name).toBe('start');
  });

  it('leaves no undo step for a focus without typing', () => {
    renderWithStore(<NameInput />, oneWaypoint());
    const input = screen.getByLabelText('name');

    fireEvent.focus(input);
    fireEvent.blur(input);

    expect(getAppState().historyPast).toHaveLength(0);
    expectNoOpenTransaction();
  });

  describe('when unmounted mid-edit', () => {
    it('ends the typing, keeping what was typed as one step', () => {
      const { unmount } = renderWithStore(<NameInput />, oneWaypoint());
      const input = screen.getByLabelText('name');

      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'end' } });
      unmount();

      expectNoOpenTransaction();
      expect(getAppState().historyPast).toHaveLength(1);
      expect(getAppState().nodes.a.name).toBe('end');
    });

    it('ends a number being typed', () => {
      const { unmount } = renderWithStore(
        <NumericInput aria-label="x" value={0} onChange={setX} {...historyEditHandlers} />,
        oneWaypoint(),
      );

      fireEvent.focus(screen.getByRole('textbox'));
      fireEvent.change(screen.getByRole('textbox'), { target: { value: '12' } });
      unmount();

      expectNoOpenTransaction();
      expect(xOf()).toBe(12);
    });

    it('ends a slider drag', () => {
      const { unmount } = renderWithStore(<XSlider />, oneWaypoint());

      fireEvent.pointerDown(screen.getByLabelText('x'), { button: 0 });
      fireEvent.change(screen.getByLabelText('x'), { target: { value: '40' } });
      unmount();

      expectNoOpenTransaction();
    });

    it('ends a held nudge', () => {
      const { unmount } = renderWithStore(
        <PoseAdjuster onNudge={({ dx }) => setX((xOf() ?? 0) + dx)} {...historyEditHandlers} />,
        oneWaypoint(),
      );

      fireEvent.keyDown(screen.getByRole('group', { name: 'Pose adjuster' }), { key: 'ArrowRight' });
      expect(getAppState().historyTransactionDepth).toBe(1);
      unmount();

      expectNoOpenTransaction();
    });
  });
});
