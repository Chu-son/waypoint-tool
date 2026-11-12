import { StateCreator } from 'zustand';
import type { AppState } from '../appStore';
import { captureSnapshot, matchesSnapshot, restoreSnapshot, type HistorySnapshot } from '../history/historyModel';
import { setWithoutHistoryOf } from '../history/historyGuard';

const MAX_HISTORY_LENGTH = 100;

/** The outermost open transaction: the entry it recorded and the redo stack it cleared. */
type OpenTransaction = { entry: HistorySnapshot; future: HistorySnapshot[]; dirty: boolean };

export type HistorySlice = {
  historyPast: HistorySnapshot[];
  historyFuture: HistorySnapshot[];
  historyTransactionDepth: number;
  historyTransaction: OpenTransaction | null;

  /** Records the state before a change, so that undo puts it back. Does nothing inside a transaction. */
  pushHistorySnapshot: () => void;
  /**
   * Opens a transaction: every change until the matching `endHistoryTransaction` is undone in one step.
   * Transactions nest; only the outermost records.
   */
  beginHistoryTransaction: () => void;
  /** Closes a transaction. When the outermost closes and nothing changed, its entry is dropped again. */
  endHistoryTransaction: () => void;
  /** Closes the outermost transaction and puts back the state from when it opened (an aborted gesture). */
  cancelHistoryTransaction: () => void;
  runInHistoryTransaction: (fn: () => void) => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
};

const withEntry = (past: HistorySnapshot[], entry: HistorySnapshot): HistorySnapshot[] => {
  const next = [...past, entry];
  if (next.length > MAX_HISTORY_LENGTH) next.splice(0, next.length - MAX_HISTORY_LENGTH);
  return next;
};

/** `past` without `entry` when it is the last one (it may have been trimmed away meanwhile). */
const withoutLast = (past: HistorySnapshot[], entry: HistorySnapshot): HistorySnapshot[] =>
  past[past.length - 1] === entry ? past.slice(0, -1) : past;

const warn = (message: string) => {
  if (import.meta.env?.MODE !== 'production') console.warn(`[history] ${message}`);
};

export const createHistorySlice: StateCreator<AppState, [], [], HistorySlice> = (set, get) => {
  /** Putting a recorded state back is not a change to record. */
  const setRestoring = setWithoutHistoryOf(set);

  /** A transaction left open by mistake would silence every later change; undo and redo close it. */
  const closeLeakedTransaction = () => {
    if (get().historyTransactionDepth === 0) return;
    warn('a history transaction was left open; closing it');
    set({ historyTransactionDepth: 0, historyTransaction: null });
  };

  /** Undo (`historyPast` → `historyFuture`) or redo (the other way): puts back the newest entry of `from`. */
  const step = (from: 'historyPast' | 'historyFuture', to: 'historyPast' | 'historyFuture') => {
    get().abortCanvasGestures?.();
    closeLeakedTransaction();
    setRestoring((state) => {
      const stack = state[from];
      if (stack.length === 0) return {};
      return {
        ...restoreSnapshot(state, stack[stack.length - 1]),
        isDirty: true,
        [from]: stack.slice(0, -1),
        [to]: [...state[to], captureSnapshot(state)],
      };
    });
  };

  return {
    historyPast: [],
    historyFuture: [],
    historyTransactionDepth: 0,
    historyTransaction: null,

    pushHistorySnapshot: () => {
      if (get().historyTransactionDepth > 0) return;
      set((state) => ({ historyPast: withEntry(state.historyPast, captureSnapshot(state)), historyFuture: [] }));
    },

    beginHistoryTransaction: () => {
      const state = get();
      if (state.historyTransactionDepth > 0) {
        set({ historyTransactionDepth: state.historyTransactionDepth + 1 });
        return;
      }
      const entry = captureSnapshot(state);
      set({
        historyPast: withEntry(state.historyPast, entry),
        historyFuture: [],
        historyTransactionDepth: 1,
        historyTransaction: { entry, future: state.historyFuture, dirty: state.isDirty },
      });
    },

    endHistoryTransaction: () => {
      const state = get();
      if (state.historyTransactionDepth === 0) return;
      if (state.historyTransactionDepth > 1) {
        set({ historyTransactionDepth: state.historyTransactionDepth - 1 });
        return;
      }
      const open = state.historyTransaction;
      set({
        historyTransactionDepth: 0,
        historyTransaction: null,
        ...(open && matchesSnapshot(open.entry, state)
          ? { historyPast: withoutLast(state.historyPast, open.entry), historyFuture: open.future }
          : {}),
      });
    },

    cancelHistoryTransaction: () => {
      const state = get();
      if (state.historyTransactionDepth === 0) return;
      if (state.historyTransactionDepth > 1) {
        warn('cancelHistoryTransaction inside a nested transaction; ending it instead');
        state.endHistoryTransaction();
        return;
      }
      const open = state.historyTransaction;
      setRestoring({
        ...(open && {
          ...restoreSnapshot(state, open.entry),
          isDirty: open.dirty,
          historyPast: withoutLast(state.historyPast, open.entry),
          historyFuture: open.future,
        }),
        historyTransactionDepth: 0,
        historyTransaction: null,
      });
    },

    runInHistoryTransaction: (fn: () => void) => {
      const { beginHistoryTransaction, endHistoryTransaction } = get();
      beginHistoryTransaction();
      try {
        fn();
      } finally {
        endHistoryTransaction();
      }
    },

    undo: () => step('historyPast', 'historyFuture'),
    redo: () => step('historyFuture', 'historyPast'),

    clearHistory: () =>
      set({ historyPast: [], historyFuture: [], historyTransactionDepth: 0, historyTransaction: null }),
  };
};
