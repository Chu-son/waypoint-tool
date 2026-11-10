import type { ReactElement } from 'react';
import { fireEvent, render, type RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AppState } from '../stores/appStore';
import { resetAppStore } from './store';

/**
 * Reset the real store to `state`, render `ui`, and return a user-event instance bound to it.
 *
 *   const { user } = renderWithStore(<PropertiesPanel />, { ...waypointTree([...]), selectedNodeIds: ['a'] });
 *   await user.type(screen.getByLabelText('X'), '15{Enter}');
 *   expect(getAppState().nodes.a.transform?.x).toBe(15);
 */
export function renderWithStore(ui: ReactElement, state: Partial<AppState> = {}, options?: RenderOptions) {
  resetAppStore(state);
  const user = userEvent.setup();
  return { user, ...render(ui, options) };
}

/**
 * One drag of a `Slider` through `values`, released anywhere: one editing operation (`onEditStart` on
 * press, `onEditEnd` on release), so a single undo step.
 */
export function dragSlider(slider: HTMLElement, ...values: string[]): void {
  fireEvent.pointerDown(slider, { button: 0 });
  values.forEach((value) => fireEvent.change(slider, { target: { value } }));
  fireEvent.pointerUp(window);
}

/** Focuses `input`, types `values` in turn and leaves it: one editing operation, so a single undo step. */
export function typeInto(input: HTMLElement, ...values: string[]): void {
  fireEvent.focus(input);
  values.forEach((value) => fireEvent.change(input, { target: { value } }));
  fireEvent.blur(input);
}
