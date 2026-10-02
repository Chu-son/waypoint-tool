import type { Viewport } from './viewport';

/**
 * The current viewport, readable outside React render and subscribable via `useSyncExternalStore`.
 *
 * Panning changes the position on every pointer move. Keeping it here instead of in React state
 * lets MapCanvas move the world container directly, so only the subscribers (the geo tile layer)
 * re-render while panning.
 */
export interface ViewportStore {
  get: () => Viewport;
  set: (viewport: Viewport) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createViewportStore(initial: Viewport): ViewportStore {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (viewport) => {
      if (viewport.scale === current.scale && viewport.position === current.position) return;
      current = viewport;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
