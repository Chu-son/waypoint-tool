import type { ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
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
