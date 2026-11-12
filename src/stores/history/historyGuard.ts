/**
 * The guard against undoable changes that were not recorded.
 *
 * The store wraps every `set` of its slices with {@link historyGuard}. A `set` that changes a value listed in
 * `HISTORY_FIELDS` must either
 *   - run inside a history transaction, or
 *   - be the first change after a `pushHistorySnapshot()` (one changing `set` per record), or
 *   - be marked as deliberately not undoable with {@link withoutHistory} (loading a project, adding a map, …).
 * Anything else is a violation: undo would revert it together with an unrelated step.
 *
 * Recording keeps references to the store's values instead of copies, so those values must never be
 * mutated in place. In tests every recorded snapshot is deep-frozen, which turns such a mutation into a
 * TypeError at the line that does it.
 *
 * Enabled in tests, where a violation fails the test (src/test/setup.ts), and in development builds, where it
 * logs a warning; production builds pass `set` through untouched.
 *
 * `useAppStore.setState` is not guarded: it is how tests arrange the state they start from.
 */
import type { StateCreator } from 'zustand';
import type { AppState } from '../appStore';
import { changedKeys, type HistoryKey, type HistorySnapshot } from './historyModel';

type HistoryViolation = { keys: HistoryKey[]; stack: string };

const isTest = import.meta.env?.MODE === 'test';
const isDev = !!import.meta.env?.DEV;

const enabled = isTest || isDev;
let excludedDepth = 0;
let violations: HistoryViolation[] = [];
/** A record was just made and no change has used it yet; it allows exactly one change. */
let recordPending = false;

/** The violations found since the last call, which clears them and starts observing afresh. */
export function takeHistoryViolations(): HistoryViolation[] {
  const taken = violations;
  violations = [];
  recordPending = false;
  return taken;
}

/**
 * Runs `fn`, whose changes are deliberately not undoable: undo neither records nor reverts them on their own.
 * Synchronous only; wrap the `set` calls after an `await`, not the whole async action.
 */
export function withoutHistory<T>(fn: () => T): T {
  excludedDepth += 1;
  try {
    return fn();
  } finally {
    excludedDepth -= 1;
  }
}

type StoreUpdate = Partial<AppState> | ((state: AppState) => Partial<AppState>);

/** A `set` whose changes are deliberately not undoable (see {@link withoutHistory}). */
export const setWithoutHistoryOf =
  (set: (update: StoreUpdate) => void) =>
  (update: StoreUpdate): void =>
    withoutHistory(() => set(update));

const isFreezable = (value: unknown): value is object => {
  if (value === null || typeof value !== 'object') return false;
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === Array.prototype || proto === null;
};

/** Freezes plain objects and arrays all the way down; class instances and binary data are left alone. */
function deepFreeze(value: unknown): void {
  if (!isFreezable(value) || Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
}

const lastEntry = (state: AppState): HistorySnapshot | undefined => state.historyPast[state.historyPast.length - 1];

const report = (keys: HistoryKey[]) => {
  const stack = new Error().stack ?? '';
  violations.push({ keys, stack });
  if (!isTest) console.warn(`[history] an undoable change was not recorded: ${keys.join(', ')}\n${stack}`);
};

type Inspect = (before: AppState, after: AppState) => void;

const inspect: Inspect = (before, after) => {
  const entry = lastEntry(after);
  const entryChanged = entry !== lastEntry(before);
  if (isTest && entry && entryChanged) deepFreeze(entry);

  const allowed = recordPending;
  if (entryChanged) {
    // Undo, redo and closing a transaction also move the newest entry; only a plain record allows a change.
    recordPending =
      !!entry && excludedDepth === 0 && before.historyTransactionDepth === 0 && after.historyTransactionDepth === 0;
  }

  if (excludedDepth > 0 || before.historyTransactionDepth > 0) return;
  const keys = changedKeys(before, after);
  if (keys.length === 0) return;
  if (allowed) recordPending = false;
  else report(keys);
};

/** Store middleware: checks each `set` of the slices against the rules above. */
export const historyGuard =
  (config: StateCreator<AppState, [], []>): StateCreator<AppState, [], []> =>
  (set, get, api) => {
    const guardedSet = ((...args: Parameters<typeof set>) => {
      if (!enabled) return set(...args);
      const before = get();
      set(...args);
      inspect(before, get());
    }) as typeof set;
    return config(guardedSet, get, api);
  };
