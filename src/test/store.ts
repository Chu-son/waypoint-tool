/**
 * Real-store helpers for tests (docs/TESTING.md).
 *
 * Tests use the real Zustand store and assert on the resulting state, instead of mocking
 * `useAppStore` and asserting which action was called.
 */
import { useAppStore, type AppState } from '../stores/appStore';

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
  useAppStore.setState({ ...initialState, ...overrides }, true);
}

/** Shorthand for `useAppStore.getState()`. */
export const getAppState = (): AppState => useAppStore.getState();
