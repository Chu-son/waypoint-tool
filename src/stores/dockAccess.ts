import type { AppState } from './appStore';
import type { DockState } from '../types/ui';

type DockSource = Pick<
  AppState,
  'isCustomUiMode' | 'customPanelLayout' | 'dockLayout' | 'isLeftPanelOpen' | 'isRightPanelOpen'
>;

/**
 * The dock the user is looking at: the Custom UI's own layout while a Custom UI is active (it is never saved),
 * the saved app layout otherwise. Together with the session-only open flags of the two side panels.
 */
export function getDockState(state: DockSource): DockState {
  return {
    layout: state.isCustomUiMode && state.customPanelLayout ? state.customPanelLayout : state.dockLayout,
    open: { left: state.isLeftPanelOpen, right: state.isRightPanelOpen },
  };
}

/**
 * Applies a dock operation to the store: `operate` gets the current dock and returns the next one (the same object
 * when nothing changes). Returns the store update — empty when nothing changed. It never marks the project dirty,
 * because the layout belongs to the app, not to the project.
 */
export function applyDockOperation(state: DockSource, operate: (dock: DockState) => DockState): Partial<AppState> {
  const prev = getDockState(state);
  const next = operate(prev);
  if (next === prev) return {};
  const patch: Partial<AppState> = {};
  if (next.open.left !== prev.open.left) patch.isLeftPanelOpen = next.open.left;
  if (next.open.right !== prev.open.right) patch.isRightPanelOpen = next.open.right;
  if (next.layout !== prev.layout) {
    if (state.isCustomUiMode && state.customPanelLayout) patch.customPanelLayout = next.layout;
    else patch.dockLayout = next.layout;
  }
  return patch;
}
