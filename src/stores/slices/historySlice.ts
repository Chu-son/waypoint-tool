import { StateCreator } from 'zustand';
import type { AppState } from '../appStore';
import { ActiveSelection } from '../../types/selection';
import { captureSnapshot, matchesSnapshot, restoreSnapshot, type HistorySnapshot } from '../history/historyModel';

export type { HistorySnapshot } from '../history/historyModel';

const MAX_HISTORY_LENGTH = 100;

/** The outermost open transaction: the entry it recorded and the redo stack it cleared. */
type OpenTransaction = { entry: HistorySnapshot | null; future: HistorySnapshot[]; dirty: boolean };

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

export const cloneSelection = (sel: ActiveSelection | undefined): ActiveSelection => {
  if (!sel) return { type: 'none' };
  switch (sel.type) {
    case 'none':
      return { type: 'none' };
    case 'nodes':
      return { type: 'nodes', ids: [...sel.ids] };
    case 'annotations':
      return { type: 'annotations', ids: [...sel.ids] };
    case 'layers':
      return { type: 'layers', ids: [...sel.ids], selectedObjectId: sel.selectedObjectId };
  }
};

const withEntry = (past: HistorySnapshot[], entry: HistorySnapshot): HistorySnapshot[] => {
  const next = [...past, entry];
  if (next.length > MAX_HISTORY_LENGTH) next.splice(0, next.length - MAX_HISTORY_LENGTH);
  return next;
};

/** `past` without `entry` when it is the last one (it may have been trimmed away meanwhile). */
const withoutLast = (past: HistorySnapshot[], entry: HistorySnapshot | null): HistorySnapshot[] =>
  entry && past[past.length - 1] === entry ? past.slice(0, -1) : past;

const warn = (message: string) => {
  if (import.meta.env?.MODE !== 'production') console.warn(`[history] ${message}`);
};

export const createHistorySlice: StateCreator<AppState, [], [], HistorySlice> = (set, get) => {
  /** A transaction left open by mistake would silence every later change; undo and redo close it. */
  const closeLeakedTransaction = () => {
    if (get().historyTransactionDepth === 0) return;
    warn('a history transaction was left open; closing it');
    set({ historyTransactionDepth: 0, historyTransaction: null });
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
      const unchanged = !!open?.entry && matchesSnapshot(open.entry, state);
      set({
        historyTransactionDepth: 0,
        historyTransaction: null,
        ...(unchanged && open
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
      set({
        ...(open?.entry ? { ...restoreSnapshot(state, open.entry), isDirty: open.dirty } : {}),
        historyPast: open ? withoutLast(state.historyPast, open.entry) : state.historyPast,
        historyFuture: open ? open.future : state.historyFuture,
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

    undo: () => {
      get().abortCanvasGestures?.();
      closeLeakedTransaction();
      set((state) => {
        if (state.historyPast.length === 0) return {};
        const snapshot = state.historyPast[state.historyPast.length - 1];
        return {
          ...restoreSnapshot(state, snapshot),
          isDirty: true,
          historyPast: state.historyPast.slice(0, -1),
          historyFuture: [...state.historyFuture, captureSnapshot(state)],
        };
      });
    },

    redo: () => {
      get().abortCanvasGestures?.();
      closeLeakedTransaction();
      set((state) => {
        if (state.historyFuture.length === 0) return {};
        const snapshot = state.historyFuture[state.historyFuture.length - 1];
        return {
          ...restoreSnapshot(state, snapshot),
          isDirty: true,
          historyFuture: state.historyFuture.slice(0, -1),
          historyPast: [...state.historyPast, captureSnapshot(state)],
        };
      });
    },

    clearHistory: () =>
      set({ historyPast: [], historyFuture: [], historyTransactionDepth: 0, historyTransaction: null }),
  };
};
