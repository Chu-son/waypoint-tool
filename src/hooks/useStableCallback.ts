import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * A function whose identity never changes but that always runs the `fn` of the latest render.
 *
 * For event handlers handed to memoized children (canvas layers): a handler that closes over
 * component state would otherwise be a new function on every render and re-render them all.
 * Do not call the result during render; it sees the latest committed `fn`.
 */
export function useStableCallback<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const latest = useRef(fn);
  useLayoutEffect(() => {
    latest.current = fn;
  });
  return useCallback((...args: A) => latest.current(...args), []);
}
