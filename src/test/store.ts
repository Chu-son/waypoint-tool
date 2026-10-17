/**
 * Real-store helpers for tests (docs/TESTING.md).
 *
 * Tests use the real Zustand store and assert on the resulting state, instead of mocking
 * `useAppStore` and asserting which action was called.
 */
import { useAppStore, type AppState } from '../stores/appStore';
import { layerOrderOf } from '../utils/layerTree';
import { visibleTabIds } from '../utils/dockLayout';
import { getDockState } from '../stores/dockAccess';
import { resetPoseEditGuards } from '../services/poseEditGuards';

// Captured when this module is first evaluated (each test file gets a fresh module graph),
// i.e. before any test has mutated the store.
const initialState: AppState = useAppStore.getState();

/** Restore the store to its freshly-created state, then apply `overrides`. */
export function resetAppStore(overrides: Partial<AppState> = {}): void {
  try {
    localStorage.clear();
  } catch {
    // localStorage may be unavailable in some environments.
  }
  resetPoseEditGuards();
  useAppStore.setState({ ...initialState, ...overrides }, true);
}

/**
 * A freshly-created store represents the very first launch, so the welcome modal is open and
 * keyboard shortcuts are blocked. Spread this into the state to start from the idle editor.
 */
export const PAST_WELCOME: Partial<AppState> = {
  isInitialLaunch: false,
  isWelcomeModalOpen: false,
  modalStack: [],
};

/** Shorthand for `useAppStore.getState()`. */
export const getAppState = (): AppState => useAppStore.getState();

/** The compositing order of the layers in the store (the layer tree flattened), top of the stack first. */
export const getLayerOrder = (): string[] => layerOrderOf(useAppStore.getState());

/** The panel tabs whose contents are on screen right now (across both side panels and all columns). */
export const getVisibleTabs = (): string[] => visibleTabIds(getDockState(useAppStore.getState()));
